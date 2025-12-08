#!/usr/bin/env node
/**
 * Simple helper to render a local HTML file to an A4 PDF using Puppeteer.
 *
 * Usage:
 *   node generate-pdf.mjs [inputHtmlPath] [outputPdfPath]
 *
 * Defaults:
 *   inputHtmlPath  -> index.html
 *   outputPdfPath  -> report.pdf
 */
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const inputPath = process.argv[2] ?? "index.html";
const outputPath = process.argv[3] ?? "report.pdf";

async function generatePDF(filePath, pdfPath) {
  const resolvedHtml = path.resolve(filePath);

  // Ensure the input HTML exists before attempting to load it.
  if (!fs.existsSync(resolvedHtml)) {
    throw new Error(`Input HTML not found: ${resolvedHtml}`);
  }

  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  // Load the local file so that relative assets (CSS/images) resolve correctly.
  const htmlUrl = new URL(`file://${resolvedHtml}`);
  await page.goto(htmlUrl.href, { waitUntil: "networkidle0" });

  // Render to an A4 page with light margins and backgrounds preserved.
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "10mm", bottom: "10mm", left: "12mm", right: "12mm" }
  });

  await browser.close();
}

generatePDF(inputPath, outputPath).catch((err) => {
  console.error(err);
  process.exit(1);
});
