import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import ExcelJS from 'exceljs'
import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'
import { getWeeklyPlanSignatureUrls } from '@/lib/server/signatureStore'
import {
  buildWeeklyPlanExportRows,
  buildWeeklyPlanFrDetailTitle,
  buildWeeklyPlanFrTitle,
  buildWeeklyPlanZhTitle,
  resolveWeeklyPlanExportContext,
} from '@/lib/server/weeklyPlanExport'
import { renderWeeklyPlanPdfHtml } from '@/lib/templates/weeklyPlanPdf'

export const dynamic = 'force-dynamic'

const colCount = 10
const EXPORT_TIMEOUT_MS = 30_000
const EXECUTABLE_PATH =
  process.env.CHROMIUM_EXECUTABLE_PATH ??
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  (process.platform === 'darwin'
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium-browser')
const USER_DATA_DIR_PREFIX = path.join(os.tmpdir(), 'weekly-plan-puppeteer-')
const LAUNCH_ARGS = [
  '--single-process',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
]

const withTimeout = async <T>(promise: Promise<T>, label: string, timeoutMs = EXPORT_TIMEOUT_MS) => {
  let timer: NodeJS.Timeout | null = null
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时 (${timeoutMs}ms)，请稍后重试`)), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const cleanupUserDataDir = async (dir: string | null) => {
  if (!dir) return
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch (error) {
    console.warn('[weekly-plan-export] cleanup profile dir failed', error)
  }
}

const launchBrowser = async () => {
  const userDataDir = await fs.mkdtemp(USER_DATA_DIR_PREFIX)
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: EXECUTABLE_PATH,
      args: LAUNCH_ARGS,
      userDataDir,
    })
    return { browser, userDataDir }
  } catch (error) {
    await cleanupUserDataDir(userDataDir)
    throw error
  }
}

const getPlanWithItems = async (planId: number) =>
  prisma.weeklyDeliveryPlan.findUnique({
    where: { id: planId },
    include: {
      project: { select: { id: true, name: true, code: true } },
      projects: {
        include: { project: { select: { id: true, name: true, code: true } } },
        orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
      },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })

const buildWorkbook = async (planId: number) => {
  const plan = await getPlanWithItems(planId)
  if (!plan) return null

  const exportItems = plan.items.filter((item) => item.status !== 'cancelled')
  const context = resolveWeeklyPlanExportContext(plan)
  const rows = buildWeeklyPlanExportRows(exportItems, context)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Dailywork'
  const sheet = workbook.addWorksheet('周计划')

  const mergeAndStyle = (
    row: number,
    value: string,
    options: { fontSize: number; bold?: boolean; fontName?: string },
  ) => {
    sheet.mergeCells(row, 1, row, colCount)
    const cell = sheet.getCell(row, 1)
    cell.value = value
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.font = {
      name: options.fontName ?? 'Times New Roman',
      bold: options.bold ?? true,
      size: options.fontSize,
    }
    sheet.getRow(row).height = options.fontSize + 10
  }

  mergeAndStyle(1, buildWeeklyPlanFrTitle(context), { fontSize: 13 })
  mergeAndStyle(2, buildWeeklyPlanFrDetailTitle(plan), { fontSize: 12 })
  mergeAndStyle(3, buildWeeklyPlanZhTitle(plan, context), {
    fontSize: 12,
    fontName: 'Songti SC',
  })

  const headers = [
    'Nombre',
    'Nom/Le temps',
    'Fournisseur',
    'Nom',
    'Modèle',
    'Unité',
    'Quantité',
    'Transporteur',
    'Contact',
    'Téléphone',
  ]

  const headerRow = sheet.getRow(4)
  headers.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1)
    cell.value = header
    cell.font = { name: 'Times New Roman', bold: true, size: 11 }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }
    cell.border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 28

  rows.forEach((rowData) => {
    const row = sheet.addRow([
      rowData.number,
      rowData.nomLeTemps,
      rowData.supplier,
      rowData.goodsNameFr,
      rowData.model,
      rowData.unit,
      rowData.plannedQty,
      rowData.transporter,
      rowData.contact,
      rowData.phone,
    ])
    row.height = 18
    row.eachCell((cell) => {
      cell.font = { name: 'Times New Roman', size: 11 }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      }
    })
  })

  const sigRowNum = 4 + rows.length + 1
  const half = Math.floor(colCount / 2)
  sheet.mergeCells(sigRowNum, 1, sigRowNum, half)
  sheet.mergeCells(sigRowNum, half + 1, sigRowNum, colCount)
  sheet.getCell(sigRowNum, 1).value = '审批人：'
  sheet.getCell(sigRowNum, half + 1).value = '编制：'
  sheet.getCell(sigRowNum, 1).font = { name: 'Songti SC', size: 11 }
  sheet.getCell(sigRowNum, half + 1).font = { name: 'Songti SC', size: 11 }
  sheet.getCell(sigRowNum, 1).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getCell(sigRowNum, half + 1).alignment = { horizontal: 'left', vertical: 'middle' }
  sheet.getRow(sigRowNum).height = 24

  const widths = [8, 16, 14, 17, 18, 8, 10, 14, 18, 14]
  headers.forEach((_, index) => {
    sheet.getColumn(index + 1).width = widths[index] ?? 12
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return {
    buffer,
    filename: `weekly-plan-${plan.title}.xlsx`,
  }
}

const buildPdfBuffer = async (planId: number) => {
  const plan = await getPlanWithItems(planId)
  if (!plan) return null

  const exportItems = plan.items.filter((item) => item.status !== 'cancelled')
  const context = resolveWeeklyPlanExportContext(plan)
  const rows = buildWeeklyPlanExportRows(exportItems, context)

  let signatures: { approver: string | null; editor: string | null } | undefined
  if (await hasPermission('signature:use')) {
    try {
      signatures = await getWeeklyPlanSignatureUrls({
        approverUserId: plan.approverUserId,
        editorUserId: plan.editorUserId,
      })
    } catch (error) {
      console.warn('[weekly-plan-export] signature fetch failed', error)
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

  const { browser, userDataDir } = await withTimeout(launchBrowser(), '启动浏览器')
  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null

  try {
    page = await withTimeout(browser.newPage(), '创建页面', 12_000)
    await withTimeout(page.setContent(html, { waitUntil: 'domcontentloaded' }), '渲染页面', 15_000)
    const pdf = await withTimeout(
      page.pdf({
        format: 'A4',
        landscape: true,
        printBackground: true,
        margin: { top: '10mm', bottom: '12mm', left: '12mm', right: '12mm' },
      }),
      '生成 PDF',
      20_000,
    )

    return {
      buffer: pdf,
      filename: `weekly-plan-${plan.title}.pdf`,
    }
  } finally {
    if (page) {
      await page.close().catch((error) => console.error('[weekly-plan-export] close page error', error))
    }
    await browser.close().catch((error) => console.error('[weekly-plan-export] close browser error', error))
    await cleanupUserDataDir(userDataDir)
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const { id } = await params
  const planId = Number(id)
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'excel'

  try {
    if (format === 'pdf') {
      const result = await buildPdfBuffer(planId)
      if (!result) return NextResponse.json({ message: '计划不存在' }, { status: 404 })

      return new NextResponse(result.buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${result.filename}"`,
          'Content-Length': String(result.buffer.length),
        },
      })
    }

    const result = await buildWorkbook(planId)
    if (!result) return NextResponse.json({ message: '计划不存在' }, { status: 404 })

    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    })
  } catch (error) {
    console.error('[weekly-plan export]', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '导出失败，请稍后重试' },
      { status: 500 },
    )
  }
}
