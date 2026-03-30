import 'server-only'

import type { WeeklyPlanExportRow } from '@/lib/server/weeklyPlanExport'

type RenderWeeklyPlanPdfOptions = {
  frTitle: string
  frSubtitle: string
  zhTitle: string
  rows: WeeklyPlanExportRow[]
  approverSignatureUrl?: string | null
  editorSignatureUrl?: string | null
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderSignature = (url?: string | null) =>
  url
    ? `<img src="${escapeHtml(url)}" alt="" class="signature-image" onerror="this.style.display='none'">`
    : '<span class="signature-placeholder"></span>'

const renderBodyRows = (rows: WeeklyPlanExportRow[]) =>
  rows
    .map(
      (row) => `<tr>
        <td>${row.number}</td>
        <td>${escapeHtml(row.nomLeTemps)}</td>
        <td>${escapeHtml(row.supplier)}</td>
        <td>${escapeHtml(row.goodsNameFr)}</td>
        <td>${escapeHtml(row.model)}</td>
        <td>${escapeHtml(row.unit)}</td>
        <td>${escapeHtml(String(row.plannedQty ?? ''))}</td>
        <td>${escapeHtml(row.transporter)}</td>
        <td>${escapeHtml(row.contact)}</td>
        <td>${escapeHtml(row.phone)}</td>
      </tr>`,
    )
    .join('')

export const renderWeeklyPlanPdfHtml = ({
  frTitle,
  frSubtitle,
  zhTitle,
  rows,
  approverSignatureUrl,
  editorSignatureUrl,
}: RenderWeeklyPlanPdfOptions) => {
  return `<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="utf-8">
    <title>${escapeHtml(frSubtitle)}</title>
    <style>
      @page {
        size: A4 landscape;
        margin: 10mm 12mm 12mm;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        color: #111827;
        font-family: "Times New Roman", "Liberation Serif", serif;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .sheet {
        width: 100%;
      }

      .header {
        margin-bottom: 12px;
        text-align: center;
      }

      .header-fr-title {
        font-size: 19px;
        font-weight: 700;
        letter-spacing: 0.2px;
      }

      .header-fr-subtitle {
        margin-top: 4px;
        font-size: 17px;
        font-weight: 700;
      }

      .header-zh-title {
        margin-top: 6px;
        color: #111827;
        font-family: "Songti SC", "SimSun", serif;
        font-size: 15px;
        font-weight: 700;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      thead {
        display: table-header-group;
      }

      th, td {
        border: 1px solid #111827;
        padding: 5px 4px;
        text-align: center;
        vertical-align: middle;
        font-size: 11px;
        line-height: 1.2;
        word-break: break-word;
      }

      th {
        background: #ffffff;
        font-size: 12px;
        font-weight: 700;
      }

      .col-number { width: 6%; }
      .col-time { width: 12%; }
      .col-supplier { width: 10%; }
      .col-name { width: 17%; }
      .col-model { width: 14%; }
      .col-unit { width: 8%; }
      .col-qty { width: 10%; }
      .col-transporter { width: 11%; }
      .col-contact { width: 16%; }
      .col-phone { width: 9%; }

      .signatures {
        margin-top: 18px;
        display: flex;
        justify-content: space-between;
        gap: 48px;
      }

      .signature-block {
        flex: 1;
        min-height: 70px;
      }

      .signature-label {
        margin-bottom: 8px;
        font-family: "Songti SC", "SimSun", serif;
        font-size: 12px;
      }

      .signature-box {
        position: relative;
        min-height: 48px;
        border-bottom: 1px solid transparent;
      }

      .signature-image {
        display: block;
        max-width: 180px;
        max-height: 52px;
        object-fit: contain;
      }

      .signature-placeholder {
        display: block;
        width: 180px;
        height: 52px;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="header">
        <div class="header-fr-title">${escapeHtml(frTitle)}</div>
        <div class="header-fr-subtitle">${escapeHtml(frSubtitle)}</div>
        <div class="header-zh-title">${escapeHtml(zhTitle)}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th class="col-number">Nombre</th>
            <th class="col-time">Nom/Le temps</th>
            <th class="col-supplier">Fournisseur</th>
            <th class="col-name">Nom</th>
            <th class="col-model">Modèle</th>
            <th class="col-unit">Unité</th>
            <th class="col-qty">Quantité</th>
            <th class="col-transporter">Transporteur</th>
            <th class="col-contact">Contact</th>
            <th class="col-phone">Téléphone</th>
          </tr>
        </thead>
        <tbody>
          ${renderBodyRows(rows)}
        </tbody>
      </table>

      <div class="signatures">
        <div class="signature-block">
          <div class="signature-label">审批人：</div>
          <div class="signature-box">${renderSignature(approverSignatureUrl)}</div>
        </div>
        <div class="signature-block">
          <div class="signature-label">编制：</div>
          <div class="signature-box">${renderSignature(editorSignatureUrl)}</div>
        </div>
      </div>
    </div>
  </body>
</html>`
}
