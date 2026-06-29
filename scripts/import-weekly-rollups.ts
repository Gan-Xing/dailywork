import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

import type { PrismaClient } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { config as loadEnv } from 'dotenv'

import {
  WEEKLY_ROLLUP_CATEGORY,
  WEEKLY_ROLLUP_ENTITY_TYPE,
  WEEKLY_ROLLUP_MIME_TYPE,
  WEEKLY_ROLLUP_PURPOSE,
  buildReportPeriodFromKey,
} from '../lib/weeklyRollups'

loadEnv({ path: '.env.local', override: true })
loadEnv({ path: '.env', override: false })

type ImportTarget = {
  absolutePath: string
  originalName: string
  periodKey: string
  reportPeriod: string
  storageKey: string
  title: string
}

const FILENAME_RE = /^(\d{8}-\d{8})_(.+)\.html?$/i
const TITLE_RE = /<title>([\s\S]*?)<\/title>/i

const usage = () => {
  console.error('Usage: pnpm exec tsx scripts/import-weekly-rollups.ts <file-or-directory> [more-files...]')
}

const normalizeTitle = (html: string, fallback: string) => {
  const match = TITLE_RE.exec(html)
  if (!match) return fallback
  const title = match[1].replace(/\s+/g, ' ').trim()
  return title || fallback
}

const safeSegment = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')

const collectHtmlFiles = async (inputs: string[]) => {
  const resolved: string[] = []

  for (const input of inputs) {
    const absolute = path.resolve(input)
    const stat = await fs.stat(absolute)
    if (stat.isDirectory()) {
      const children = await fs.readdir(absolute, { withFileTypes: true })
      for (const child of children) {
        if (!child.isFile() || !child.name.toLowerCase().endsWith('.html')) continue
        resolved.push(path.join(absolute, child.name))
      }
      continue
    }
    resolved.push(absolute)
  }

  return Array.from(new Set(resolved)).sort()
}

const buildImportTarget = async (absolutePath: string): Promise<ImportTarget> => {
  const originalName = path.basename(absolutePath)
  const match = FILENAME_RE.exec(originalName)
  if (!match) {
    throw new Error(`Unrecognized weekly rollup filename: ${originalName}`)
  }

  const periodKey = match[1]
  const reportPeriod = buildReportPeriodFromKey(periodKey)
  const html = await fs.readFile(absolutePath, 'utf8')
  const title = normalizeTitle(html, `${match[2]} - ${reportPeriod}`)
  const storageKey = `files/${WEEKLY_ROLLUP_CATEGORY}/weekly-rollups/${periodKey}/${safeSegment(originalName) || `${periodKey}.html`}`

  return {
    absolutePath,
    originalName,
    periodKey,
    reportPeriod,
    storageKey,
    title,
  }
}

const checksumOf = (content: string) => createHash('sha256').update(content, 'utf8').digest('hex')

const upsertWeeklyRollup = async ({
  prisma,
  getR2Config,
  uploadObjectBuffer,
  target,
}: {
  prisma: PrismaClient
  getR2Config: () => { bucket: string }
  uploadObjectBuffer: (storageKey: string, body: Uint8Array, contentType: string) => Promise<void>
  target: ImportTarget
}) => {
  const html = await fs.readFile(target.absolutePath, 'utf8')
  const checksum = checksumOf(html)
  const buffer = Buffer.from(html, 'utf8')
  const bucket = getR2Config().bucket
  const size = buffer.byteLength
  const projectNames = ['邦杜库', '阿尼比莱克鲁']

  const existingLink = await prisma.fileAssetLink.findFirst({
    where: {
      entityType: WEEKLY_ROLLUP_ENTITY_TYPE,
      entityId: target.periodKey,
      purpose: WEEKLY_ROLLUP_PURPOSE,
    },
    include: {
      file: true,
    },
    orderBy: { id: 'desc' },
  })

  const shouldUpload =
    !existingLink ||
    existingLink.file.checksum !== checksum ||
    existingLink.file.storageKey !== target.storageKey ||
    existingLink.file.size !== size

  if (shouldUpload) {
    await uploadObjectBuffer(target.storageKey, buffer, `${WEEKLY_ROLLUP_MIME_TYPE}; charset=utf-8`)
  }

  const meta: Prisma.JsonObject = {
    title: target.title,
    reportPeriod: target.reportPeriod,
    sourceFilename: target.originalName,
    sourceRelativePath: target.absolutePath,
    projectNames,
  }

  if (existingLink) {
    await prisma.$transaction([
      prisma.fileAsset.update({
        where: { id: existingLink.fileId },
        data: {
          category: WEEKLY_ROLLUP_CATEGORY,
          storageKey: target.storageKey,
          bucket,
          originalName: target.originalName,
          mimeType: WEEKLY_ROLLUP_MIME_TYPE,
          size,
          previewStorageKey: null,
          previewMimeType: null,
          previewSize: null,
          checksum,
        },
      }),
      prisma.fileAssetLink.update({
        where: { id: existingLink.id },
        data: {
          label: target.title,
          meta,
          purpose: WEEKLY_ROLLUP_PURPOSE,
        },
      }),
    ])
    return { mode: 'updated' as const, uploaded: shouldUpload }
  }

  await prisma.fileAsset.create({
    data: {
      category: WEEKLY_ROLLUP_CATEGORY,
      storageKey: target.storageKey,
      bucket,
      originalName: target.originalName,
      mimeType: WEEKLY_ROLLUP_MIME_TYPE,
      size,
      checksum,
      links: {
        create: {
          entityType: WEEKLY_ROLLUP_ENTITY_TYPE,
          entityId: target.periodKey,
          purpose: WEEKLY_ROLLUP_PURPOSE,
          label: target.title,
          meta,
        },
      },
    },
  })

  return { mode: 'created' as const, uploaded: shouldUpload }
}

async function main() {
  const inputs = process.argv.slice(2)
  if (!inputs.length) {
    usage()
    process.exitCode = 1
    return
  }

  const files = await collectHtmlFiles(inputs)
  if (!files.length) {
    throw new Error('No HTML files found to import')
  }

  const [{ prisma }, { getR2Config, uploadObjectBuffer }] = await Promise.all([
    import('../lib/prisma'),
    import('../lib/server/r2'),
  ])

  for (const file of files) {
    const target = await buildImportTarget(file)
    const result = await upsertWeeklyRollup({
      prisma,
      getR2Config,
      uploadObjectBuffer,
      target,
    })
    console.log(
      `[weekly-rollup] ${result.mode} ${target.periodKey} ${target.originalName} upload=${result.uploaded ? 'yes' : 'no'}`,
    )
  }

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('[weekly-rollup] import failed', error)
    process.exitCode = 1
  })
