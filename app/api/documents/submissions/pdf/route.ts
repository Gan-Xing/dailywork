import { NextResponse } from 'next/server'

import puppeteer from 'puppeteer'

import { renderBordereauTemplate } from '@/lib/documents/render'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'
import { hasPermission } from '@/lib/server/authSession'
import { getTemplate } from '@/lib/server/templateStore'

export async function POST(request: Request) {
  const [canView, canCreate, canUpdate] = await Promise.all([
    hasPermission('submission:view'),
    hasPermission('submission:create'),
    hasPermission('submission:update'),
  ])
  if (!canView && !canCreate && !canUpdate) {
    return NextResponse.json({ message: '缺少提交单查看权限' }, { status: 403 })
  }

  let payload: { templateId?: string; data: unknown; pageNumberText?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const tpl = payload.templateId ? await getTemplate(payload.templateId) : null
  const fallback = tpl ?? (await loadBordereauTemplateFromFile())
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  const headerOrigin = forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined
  const origin = process.env.SITE_BASE_URL || headerOrigin || new URL(request.url).origin

  const html = renderBordereauTemplate(fallback.html, payload.data as any, {
    pageNumberText: payload.pageNumberText ?? '',
    minItemRows: 10,
    maxItemRows: 12,
    baseUrl: origin,
  })

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/snap/bin/chromium'

  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0' })
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
    })
    await browser.close()

    const pdfArrayBuffer = pdfBuffer.buffer.slice(pdfBuffer.byteOffset, pdfBuffer.byteOffset + pdfBuffer.byteLength) as ArrayBuffer

    return new Response(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="submission.pdf"',
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        message:
          (error as Error).message ||
          '生成 PDF 失败：请先安装浏览器内核 (npx puppeteer browsers install chrome)，或设置 PUPPETEER_EXECUTABLE_PATH 指向已安装的 chrome/chromium。',
      },
      { status: 500 },
    )
  }
}
