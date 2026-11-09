import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import puppeteer, { type Browser } from 'puppeteer'

import { prisma } from '@/lib/prisma'
import { createPresignedUrl } from '@/lib/server/r2'
import { getWeeklyPlanSignatureUrls } from '@/lib/server/signatureStore'
import {
  buildWeeklyPlanExportRows,
  buildWeeklyPlanFrDetailTitle,
  buildWeeklyPlanFrTitle,
  buildWeeklyPlanZhTitle,
  resolveWeeklyPlanExportContext,
} from '@/lib/server/weeklyPlanExport'
import { renderWeeklyPlanPdfHtml } from '@/lib/templates/weeklyPlanPdf'

const EXPORT_TIMEOUT_MS = 30_000
const USER_DATA_DIR_PREFIX = path.join(os.tmpdir(), 'weekly-plan-puppeteer-')
const LAUNCH_ARGS = [
  '--single-process',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
]

const withTimeout = async <T>(
  promise: Promise<T>,
  label: string,
  timeoutMs = EXPORT_TIMEOUT_MS,
  cleanupLateResult?: (value: T) => Promise<void>,
) => {
  let expired = false
  let timer: NodeJS.Timeout | undefined
  const guarded = promise.then(async (value) => {
    // A timed-out acquisition can still succeed; it must not leak its resource.
    if (expired && cleanupLateResult) await cleanupLateResult(value)
    return value
  })
  try {
    return await Promise.race([
      guarded,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true
          reject(new Error(`${label} timed out (${timeoutMs}ms)`))
        }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

const cleanupUserDataDir = async (dir: string) => {
  await fs.rm(dir, { recursive: true, force: true }).catch((error) => {
    console.warn('[weekly-plan-export] cleanup profile dir failed', error)
  })
}

const closeBrowser = async (browser: Browser) => {
  await withTimeout(browser.close(), 'Close browser', 5_000).catch(() => {
    browser.process()?.kill('SIGKILL')
  })
}

const launchBrowser = async () => {
  const userDataDir = await fs.mkdtemp(USER_DATA_DIR_PREFIX)
  try {
    const browser = await withTimeout(
      puppeteer.launch({
        headless: true,
        pipe: true,
        executablePath:
          process.env.CHROMIUM_EXECUTABLE_PATH ??
          process.env.PUPPETEER_EXECUTABLE_PATH ??
          (process.platform === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : '/usr/bin/chromium-browser'),
        args: LAUNCH_ARGS,
        userDataDir,
        timeout: EXPORT_TIMEOUT_MS,
      }),
      'Launch browser',
      EXPORT_TIMEOUT_MS,
      async (lateBrowser) => {
        try {
          await closeBrowser(lateBrowser)
        } finally {
          await cleanupUserDataDir(userDataDir)
        }
      },
    )
    return { browser, userDataDir }
  } catch (error) {
    await cleanupUserDataDir(userDataDir)
    throw error
  }
}

export const getWeeklyPlanWithItems = (planId: number) =>
  prisma.weeklyDeliveryPlan.findUnique({
    where: { id: planId },
    include: {
      project: { select: { id: true, name: true, code: true } },
      projects: {
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
      },
      items: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
    },
  })

type WeeklyPlanVersion = {
  id: number
  updatedAt: Date | string
  items: { id: number; sortOrder: number; updatedAt: Date | string }[]
}

export const getWeeklyPlanVersion = (plan: WeeklyPlanVersion): string => {
  const timestamp = (value: Date | string) => new Date(value).toISOString()
  const items = [...plan.items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  return createHash('sha256')
    .update(JSON.stringify([
      plan.id,
      timestamp(plan.updatedAt),
      items.map((item) => [item.id, item.sortOrder, timestamp(item.updatedAt)]),
    ]))
    .digest('hex')
}

const getRequiredSignatureUrl = async (userId: number | null, role: string) => {
  if (!userId) throw new Error(`Signed weekly plan requires an ${role} with an active signature`)
  // signatureStore intentionally falls back to inactive versions for legacy exports.
  const signature = await prisma.userSignature.findFirst({
    where: { userId, isActive: true },
    include: { file: true },
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
  })
  if (!signature) throw new Error(`Signed weekly plan requires an active ${role} signature`)
  return createPresignedUrl({
    method: 'GET',
    storageKey: signature.file.storageKey,
    expiresInSeconds: 300,
  })
}

export const buildWeeklyPlanPdf = async (
  planId: number,
  options: { signed?: boolean; requireActiveSignatures?: boolean } = {},
): Promise<{ buffer: Uint8Array; filename: string; sourceVersion: string } | null> => {
  const plan = await getWeeklyPlanWithItems(planId)
  if (!plan) return null
  const sourceVersion = getWeeklyPlanVersion(plan)
  const context = resolveWeeklyPlanExportContext(plan)
  const rows = buildWeeklyPlanExportRows(
    plan.items.filter((item) => item.status !== 'cancelled'),
    context,
  )

  let signatures: { approver: string | null; editor: string | null } | undefined
  if (options.signed) {
    if (options.requireActiveSignatures) {
      signatures = {
        approver: await getRequiredSignatureUrl(plan.approverUserId, 'approver'),
        editor: await getRequiredSignatureUrl(plan.editorUserId, 'editor'),
      }
    } else {
      try {
        signatures = await getWeeklyPlanSignatureUrls(plan)
      } catch (error) {
        console.warn('[weekly-plan-export] signature fetch failed', error)
      }
    }
  }

  const html = renderWeeklyPlanPdfHtml({
    frTitle: buildWeeklyPlanFrTitle(context),
    frSubtitle: buildWeeklyPlanFrDetailTitle(plan),
    zhTitle: buildWeeklyPlanZhTitle(plan, context),
    rows,
    approverSignatureUrl: signatures?.approver ?? null,
    editorSignatureUrl: signatures?.editor ?? null,
  })
  const { browser, userDataDir } = await launchBrowser()
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null
  try {
    page = await withTimeout(browser.newPage(), 'Create page', 12_000, async (latePage) => {
      await withTimeout(latePage.close(), 'Close late page', 5_000).catch(() => {})
    })
    await withTimeout(page.setContent(html, { waitUntil: 'domcontentloaded' }), 'Render page', 15_000)
    const imagesLoaded = await withTimeout(page.evaluate(async () => {
      await document.fonts.ready
      return Promise.all(Array.from(document.images, async (image) => {
        try {
          await image.decode()
          return image.naturalWidth > 0
        } catch {
          return false
        }
      }))
    }), 'Load PDF images and fonts', 15_000)
    if (options.signed && options.requireActiveSignatures && imagesLoaded.some((loaded) => !loaded)) {
      throw new Error('Required weekly plan signature image could not be loaded')
    }
    const buffer = await withTimeout(page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '10mm', bottom: '12mm', left: '12mm', right: '12mm' },
    }), 'Generate PDF', 20_000)
    return { buffer, filename: `weekly-plan-${plan.title}.pdf`, sourceVersion }
  } finally {
    if (page) await withTimeout(page.close(), 'Close page', 5_000).catch(() => {})
    try {
      await closeBrowser(browser)
    } finally {
      await cleanupUserDataDir(userDataDir)
    }
  }
}
