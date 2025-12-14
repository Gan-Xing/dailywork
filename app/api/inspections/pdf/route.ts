import { NextResponse } from 'next/server'
import puppeteer, { Browser } from 'puppeteer'

import { renderInspectionReportHtml } from '@/lib/templates/inspectionReport'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { aggregateEntriesAsListItems } from '@/lib/server/inspectionEntryStore'

export const maxDuration = 60

const MAX_EXPORT_COUNT = 30
const EXPORT_TIMEOUT_MS = 30_000
const logPrefix = '[pdf-export]'
const EXECUTABLE_PATH = process.env.CHROMIUM_EXECUTABLE_PATH ?? '/usr/bin/chromium-browser'
const LAUNCH_ARGS = [
  '--single-process',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
]

let browserPromise: Promise<Browser> | null = null

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

const getBrowser = async () => {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        executablePath: EXECUTABLE_PATH,
        args: LAUNCH_ARGS,
      })
      .catch((err) => {
        browserPromise = null
        throw err
      })
  }
  const browser = await browserPromise
  browser.on('disconnected', () => {
    browserPromise = null
  })
  return browser
}

export async function POST(request: Request) {
  const started = Date.now()
  const logError = (error: unknown) => {
    if (error instanceof Error) {
      console.error(logPrefix, 'error', {
        name: error.name,
        message: error.message,
        stack: error.stack?.slice(0, 500),
      })
    } else {
      console.error(logPrefix, 'error', error)
    }
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再导出报检 PDF' }, { status: 401 })
  }
  if (!(await hasPermission('inspection:view'))) {
    return NextResponse.json({ message: '缺少报检查看权限' }, { status: 403 })
  }

  let body: { ids?: unknown; locale?: string; mode?: 'preview' | 'download' }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids) ? (body.ids as Array<number | string>) : []
  const locale = body.locale === 'zh' ? 'zh' : 'fr'
  const mode = body.mode === 'preview' ? 'preview' : 'download'
  const numericIds = Array.from(new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)))

  if (numericIds.length === 0) {
    return NextResponse.json({ message: '请选择至少一条报检记录' }, { status: 400 })
  }
  if (numericIds.length > MAX_EXPORT_COUNT) {
    return NextResponse.json({ message: `单次最多导出 ${MAX_EXPORT_COUNT} 条报检记录` }, { status: 400 })
  }

  try {
    // 以 entry id 查询，并按层次聚合同层验收内容到同一 Nature
    const { items } = await aggregateEntriesAsListItems({ ids: numericIds, groupByLayer: true })
    if (items.length === 0) {
      return NextResponse.json({ message: '未找到可导出的报检记录' }, { status: 404 })
    }

    const html = renderInspectionReportHtml(items, { locale })

    const browser = await withTimeout(getBrowser(), '启动浏览器')

    let page: Awaited<ReturnType<typeof browser.newPage>> | null = null
    try {
      page = await withTimeout(browser.newPage(), '创建页面', 12_000)

      await withTimeout(page.setContent(html, { waitUntil: 'networkidle2' }), '渲染页面', 15_000)

      const pdf = await withTimeout(
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
        }),
        '生成 PDF',
        20_000,
      )

      const filename = `inspection-export-${new Date().toISOString().slice(0, 10)}.pdf`
      const disposition = mode === 'preview' ? 'inline' : 'attachment'

      return new NextResponse(pdf as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${disposition}; filename="${filename}"`,
          'Content-Length': String(pdf.length),
        },
      })
    } finally {
      if (page) {
        await page.close().catch((closeErr) => console.error(logPrefix, 'close page error', closeErr))
      }
      // 浏览器复用，单次请求不关闭，避免频繁启动开销
    }
  } catch (error) {
    logError(error)
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : '导出失败，请稍后重试'
    console.error(logPrefix, 'export failed', { durationMs: Date.now() - started, error: message })
    return NextResponse.json({ message }, { status: 500 })
  }
}
