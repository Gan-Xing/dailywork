import 'server-only'

import fs from 'fs/promises'
import path from 'path'
import puppeteer, { type PaperFormat } from 'puppeteer'

export interface PdfOptions {
  format?: string
  margin?: {
    top?: string
    bottom?: string
    left?: string
    right?: string
  }
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2'
}

/**
  * Render a local HTML file (with relative assets) to PDF.
  * Mirrors the existing module/generate-pdf.mjs script but as a reusable helper.
  */
export async function renderHtmlFileToPdf(htmlFilePath: string, pdfPath: string, options?: PdfOptions): Promise<void> {
  const resolvedHtml = path.resolve(htmlFilePath)
  await assertFileExists(resolvedHtml)

  const browser = await puppeteer.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const htmlUrl = new URL(`file://${resolvedHtml}`)
    await page.goto(htmlUrl.href, { waitUntil: options?.waitUntil ?? 'networkidle0' })
    await page.pdf({
      path: pdfPath,
      format: (options?.format as PaperFormat | undefined) ?? 'A4',
      printBackground: true,
      margin: options?.margin ?? { top: '10mm', bottom: '10mm', left: '12mm', right: '12mm' },
    })
  } finally {
    await browser.close()
  }
}

async function assertFileExists(filePath: string) {
  try {
    await fs.access(filePath)
  } catch {
    throw new Error(`Input HTML not found: ${filePath}`)
  }
}
