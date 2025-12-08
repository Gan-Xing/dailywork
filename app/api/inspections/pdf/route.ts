import { NextResponse } from 'next/server'

import path from 'path'

import { renderInspectionReportHtml } from '@/lib/templates/inspectionReport'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { getInspectionsByIds } from '@/lib/server/inspectionStore'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_EXPORT_COUNT = 30

export async function POST(request: Request) {
  const sessionUser = getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再导出报检 PDF' }, { status: 401 })
  }
  if (!hasPermission('inspection:view')) {
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
    const inspections = await getInspectionsByIds(numericIds)
    if (inspections.length === 0) {
      return NextResponse.json({ message: '未找到可导出的报检记录' }, { status: 404 })
    }

    const html = renderInspectionReportHtml(inspections, { locale })
    const { default: chromium } = await import('@sparticuz/chromium')
    const { default: puppeteer } = await import('puppeteer-core')
    chromium.setHeadlessMode = true
    chromium.setGraphicsMode = false
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH ?? (await chromium.executablePath())
    const binDir = path.dirname(executablePath)
    const libDir = path.join(binDir, '..', 'lib')
    const ldPathParts = [binDir, libDir, process.env.LD_LIBRARY_PATH].filter(Boolean)
    process.env.LD_LIBRARY_PATH = ldPathParts.join(':')

    const browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox'],
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
      })

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
      await browser.close()
    }
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
