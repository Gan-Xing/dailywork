#!/usr/bin/env node
/**
 * Helper to render presence-cdd.html to an A4 Portrait PDF.
 *
 * Usage:
 *   node generate-presence-cdd-pdf.mjs [inputHtmlPath] [outputPdfPath]
 */
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const inputPath = process.argv[2] ?? "presence-cdd.html";
const outputPath = process.argv[3] ?? "presence-cdd.pdf";

async function generatePDF(filePath, pdfPath) {
    const resolvedHtml = path.resolve(filePath);

    if (!fs.existsSync(resolvedHtml)) {
        throw new Error(`Input HTML not found: ${resolvedHtml}`);
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    const htmlUrl = new URL(`file://${resolvedHtml}`);
    await page.goto(htmlUrl.href, { waitUntil: "networkidle0" });

    await page.pdf({
        path: pdfPath,
        format: "A4",
        landscape: false,
        printBackground: true,
        margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" } // Margins handled by CSS .page padding
    });

    await browser.close();
    console.log(`PDF generated at: ${pdfPath}`);
}

generatePDF(inputPath, outputPath).catch((err) => {
    console.error(err);
    process.exit(1);
});
