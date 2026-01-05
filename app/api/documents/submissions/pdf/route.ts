import { NextResponse } from 'next/server'

import { PDFDocument } from 'pdf-lib'
import puppeteer from 'puppeteer'

import { renderBordereauTemplate } from '@/lib/documents/render'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'
import { hasPermission } from '@/lib/server/authSession'
import { aggregateEntriesAsListItems } from '@/lib/server/inspectionEntryStore'
import { getTemplate } from '@/lib/server/templateStore'
import { renderInspectionReportHtml } from '@/lib/templates/inspectionReport'

export const maxDuration = 300

export async function POST(request: Request) {
  const [canView, canCreate, canUpdate] = await Promise.all([
    hasPermission('submission:view'),
    hasPermission('submission:create'),
    hasPermission('submission:update'),
  ])
  if (!canView && !canCreate && !canUpdate) {
    return NextResponse.json({ message: '缺少提交单查看权限' }, { status: 403 })
  }

  let payload: { templateId?: string; data: unknown; pageNumberText?: string; submissionId?: number }
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

  console.log('[PDF Export] Starting export process...')
  const startTime = Date.now()

  try {
    console.log('[PDF Export] Launching browser...')
    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    console.log('[PDF Export] Browser launched.')

    // 1. Generate Submission PDF
    console.log('[PDF Export] Generating Submission PDF...')
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 })
    const submissionPdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
      timeout: 60000,
    })
    console.log(`[PDF Export] Submission PDF generated. Size: ${submissionPdfBuffer.length} bytes.`)

    // 2. Check for bound inspections and generate Inspection PDF if needed
    let inspectionPdfBuffer: Uint8Array | null = null
    if (payload.submissionId) {
      console.log(`[PDF Export] Fetching inspections for submissionId: ${payload.submissionId}...`)
      const { items } = await aggregateEntriesAsListItems({
        documentId: payload.submissionId,
        groupByLayer: true,
        pageSize: 100, // Reasonable limit for attached inspections
      })
      console.log(`[PDF Export] Found ${items.length} inspections.`)

      if (items.length > 0) {
        console.log('[PDF Export] Generating Inspection PDF...')
        // Assume locale 'fr' for consistency with submission or extract from payload if available
        const inspectionHtml = renderInspectionReportHtml(items, { locale: 'fr' })
        
        // Reuse page or create new? Reuse to be safe with memory but clear content
        await page.setContent(inspectionHtml, { waitUntil: 'load', timeout: 60000 })
        inspectionPdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
          timeout: 60000,
        })
        console.log(`[PDF Export] Inspection PDF generated. Size: ${inspectionPdfBuffer.length} bytes.`)
      } else {
        console.log('[PDF Export] No inspections to export.')
      }
    }

    console.log('[PDF Export] Closing browser...')
    await browser.close()
    console.log('[PDF Export] Browser closed.')

    // 3. Merge PDFs if inspection PDF exists
    let finalPdfBytes: Uint8Array
    if (inspectionPdfBuffer) {
      console.log('[PDF Export] Merging PDFs...')
      const mergedPdf = await PDFDocument.create()
      
      const submissionDoc = await PDFDocument.load(submissionPdfBuffer)
      const submissionPages = await mergedPdf.copyPages(submissionDoc, submissionDoc.getPageIndices())
      submissionPages.forEach((page) => mergedPdf.addPage(page))

      const inspectionDoc = await PDFDocument.load(inspectionPdfBuffer)
      const inspectionPages = await mergedPdf.copyPages(inspectionDoc, inspectionDoc.getPageIndices())
      inspectionPages.forEach((page) => mergedPdf.addPage(page))

      finalPdfBytes = await mergedPdf.save()
      console.log(`[PDF Export] PDFs merged. Final size: ${finalPdfBytes.length} bytes.`)
    } else {
      finalPdfBytes = submissionPdfBuffer
    }

    const totalTime = Date.now() - startTime
    console.log(`[PDF Export] Process completed in ${totalTime}ms.`)

    const pdfArrayBuffer = finalPdfBytes.buffer.slice(
      finalPdfBytes.byteOffset,
      finalPdfBytes.byteOffset + finalPdfBytes.byteLength,
    ) as ArrayBuffer

    return new Response(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="submission.pdf"',
      },
    })
  } catch (error) {
    console.error('[PDF Export] Error:', error)
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
