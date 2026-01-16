/**
 * Generate PDF from HTML report prototype for A3 Landscape.
 */
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Default to looking in the same directory as this script if no args provided
const inputPath = process.argv[2] ?? path.join(__dirname, "report-prototype.html");
const outputPath = process.argv[3] ?? path.join(__dirname, "report-prototype.pdf");

async function generateReportPDF(filePath, pdfPath) {
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

    // Critical: Set viewport to match A3 landscape dimensions (at 96 DPI)
    // 420mm -> ~1587px
    // 297mm -> ~1123px
    await page.setViewport({
        width: 1587,
        height: 1123,
        deviceScaleFactor: 1, // Ensure 1:1 pixel mapping
    });

    await page.goto(htmlUrl.href, { waitUntil: "networkidle0" });

    // Explicitly set width and height for A3 Landscape
    await page.pdf({
        path: pdfPath,
        width: '420mm',
        height: '297mm',
        printBackground: true,
        margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
        scale: 1,
        preferCSSPageSize: true
    });

    await browser.close();
    console.log(`PDF generated at: ${pdfPath}`);
}

generateReportPDF(inputPath, outputPath).catch((err) => {
    console.error(err);
    process.exit(1);
});
