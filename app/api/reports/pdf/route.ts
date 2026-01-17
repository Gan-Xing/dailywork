import { NextResponse } from 'next/server'
import { DocumentType, TemplateStatus } from '@prisma/client'
import { PDFDocument } from 'pdf-lib'
import puppeteer, { type Browser } from 'puppeteer'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'
import type { Locale } from '@/lib/i18n'
import { renderDailyReportTemplate } from '@/lib/documents/reportTemplate'
import type { DailyReport } from '@/lib/reportState'
import { DATE_KEY_REGEX, normalizeReportForDate, recalcReportMaterials } from '@/lib/reportUtils'

export const maxDuration = 120

const EXECUTABLE_PATH =
  process.env.CHROMIUM_EXECUTABLE_PATH ??
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/snap/bin/chromium'

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']
const MAX_EXPORT_COUNT = 31

const resolveLocale = (value?: string | null): Locale => (value === 'fr' ? 'fr' : 'zh')
const resolveBaseUrl = (request: Request) => {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost ?? request.headers.get('host')
  if (!host) return undefined
  const proto = forwardedProto ?? 'http'
  return `${proto}://${host}`
}

const toDateTime = (dateKey: string) => new Date(`${dateKey}T00:00:00.000Z`)

const formatDateKey = (value: Date) => value.toISOString().split('T')[0]

const getTemplate = async (locale: Locale) => {
  const published = await prisma.documentTemplate.findFirst({
    where: {
      type: DocumentType.DAILY_REPORT,
      language: locale,
      status: TemplateStatus.PUBLISHED,
    },
    orderBy: { updatedAt: 'desc' },
  })
  if (published) return published

  return prisma.documentTemplate.findFirst({
    where: {
      type: DocumentType.DAILY_REPORT,
      language: locale,
      status: TemplateStatus.DRAFT,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

const generatePdfBuffer = async (browser: Browser, html: string) => {
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 120_000 })
    await page.emulateMediaType('print')
    await page.addStyleTag({
      content:
        'html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }',
    })
    return await page.pdf({
      format: 'A3',
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    })
  } finally {
    await page.close()
  }
}

export async function POST(request: Request) {
  const [canView, canEdit] = await Promise.all([
    hasPermission('report:view'),
    hasPermission('report:edit'),
  ])
  if (!canView && !canEdit) {
    return NextResponse.json({ message: '缺少日报查看权限' }, { status: 403 })
  }

  let payload: { dates?: unknown; locale?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const rawDates = Array.isArray(payload.dates) ? payload.dates : []
  const dateKeys = Array.from(
    new Set(
      rawDates
        .map((value) => String(value).trim())
        .filter((value) => DATE_KEY_REGEX.test(value)),
    ),
  )

  if (dateKeys.length === 0) {
    return NextResponse.json({ message: '请选择至少一份日报' }, { status: 400 })
  }
  if (dateKeys.length > MAX_EXPORT_COUNT) {
    return NextResponse.json(
      { message: `单次最多导出 ${MAX_EXPORT_COUNT} 份日报` },
      { status: 400 },
    )
  }

  const locale = resolveLocale(payload.locale)

  const template = await getTemplate(locale)
  if (!template) {
    return NextResponse.json({ message: '未找到日报模板' }, { status: 404 })
  }
  const baseUrl = resolveBaseUrl(request)

  const targetDates = dateKeys.map(toDateTime)
  const records = await prisma.dailyReport.findMany({
    where: { reportDate: { in: targetDates } },
    select: { reportDate: true, payload: true },
  })
  const recordByKey = new Map(records.map((record) => [formatDateKey(record.reportDate), record]))
  const missing = dateKeys.filter((key) => !recordByKey.has(key))
  if (missing.length > 0) {
    return NextResponse.json({ message: `以下日报尚未填写：${missing.join(', ')}` }, { status: 400 })
  }

  let browser: Browser | null = null
  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: EXECUTABLE_PATH,
      args: LAUNCH_ARGS,
    })

    const pdfBuffers: Uint8Array[] = []
    for (const dateKey of dateKeys) {
      const record = recordByKey.get(dateKey)
      if (!record?.payload) {
        throw new Error(`日报数据缺失：${dateKey}`)
      }
      let report = normalizeReportForDate(record.payload as DailyReport, dateKey)
      report = recalcReportMaterials(report)
      const html = renderDailyReportTemplate(template.html, report, locale, { baseUrl })
      const buffer = await generatePdfBuffer(browser, html)
      pdfBuffers.push(buffer)
    }

    let mergedBuffer: Uint8Array
    if (pdfBuffers.length === 1) {
      mergedBuffer = pdfBuffers[0]
    } else {
      const merged = await PDFDocument.create()
      for (const buffer of pdfBuffers) {
        const doc = await PDFDocument.load(buffer)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach((page) => merged.addPage(page))
      }
      mergedBuffer = await merged.save()
    }

    const filename =
      dateKeys.length === 1
        ? `daily-report-${dateKeys[0]}.pdf`
        : `daily-reports-${dateKeys[0]}-to-${dateKeys[dateKeys.length - 1]}.pdf`
    const pdfArrayBuffer = mergedBuffer.buffer.slice(
      mergedBuffer.byteOffset,
      mergedBuffer.byteOffset + mergedBuffer.byteLength,
    ) as ArrayBuffer

    return new Response(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(mergedBuffer.byteLength),
      },
    })
  } catch (error) {
    console.error('[ReportPDF] Error:', error)
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          '生成 PDF 失败：请先安装浏览器内核或设置 CHROMIUM_EXECUTABLE_PATH/PUPPETEER_EXECUTABLE_PATH。',
      },
      { status: 500 },
    )
  } finally {
    if (browser) {
      await browser.close().catch((err) => console.error('[ReportPDF] Close browser failed', err))
    }
  }
}
