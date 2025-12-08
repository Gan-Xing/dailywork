import type { Locale } from '@/lib/i18n'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { localizeProgressList, localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import type { InspectionListItem } from '@/lib/progressTypes'

type RenderOptions = {
  locale?: Locale
}

const inlineCss = `/* Reset and Page Setup */
* {
    box-sizing: border-box;
}

@page {
    size: A4;
    margin: 0;
}

body {
    margin: 0;
    padding: 0;
    background-color: #fff;
    font-family: Arial, Helvetica, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    width: 210mm;
    height: 297mm;
}

.page {
    width: 210mm;
    min-height: 297mm;
    padding: 10mm;
    margin: 0 auto;
    background: white;
    position: relative;
    border: 1px solid transparent;
    page-break-after: always;
}

.page:last-child {
    page-break-after: auto;
}

/* General Utilities */
.row {
    width: 100%;
    border: 0.3mm solid black;
    border-bottom: none;
    text-align: center;
    padding: 1mm;
}

.row:last-child {
    border-bottom: 0.3mm solid black;
}

strong {
    font-weight: bold;
}

/* Header Section */
.header-section {
    width: 100%;
}

.title-row {
    font-size: 10pt;
    padding: 1.5mm;
    background-color: #fff;
}

.subtitle-row {
    font-size: 8pt;
    padding: 1mm;
    white-space: pre-line;
    line-height: 1.2;
}

.section-title {
    background-color: #d3d3d3;
    font-size: 9pt;
    padding: 1mm;
}

/* Structures Table */
.structures-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9pt;
}

.structures-table td {
    border: 0.3mm solid black;
    padding: 1mm;
    text-align: center;
    vertical-align: middle;
}

.col-role {
    width: 28.33%;
    font-weight: bold;
    font-size: 8pt;
}

.col-name {
    width: 28.33%;
}

.col-logo {
    width: 28.33%;
}

.col-contract {
    width: 15%;
    font-size: 8pt;
}

.logo-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 8mm;
    border: 1px dashed #ccc;
    color: #666;
    font-size: 7pt;
}

.logo-img {
    max-width: 100%;
    max-height: 10mm;
    object-fit: contain;
}

/* Demande de Reception */
.section-header-row {
    display: flex;
    border: 0.3mm solid black;
    border-top: none;
    font-size: 9pt;
}

.cell-left {
    flex: 1;
    text-align: center;
    padding: 1mm;
    border-right: 0.3mm solid black;
}

.cell-right {
    text-align: left;
    width: 50mm;
    padding: 1mm;
}

.checkbox-row {
    display: flex;
    justify-content: space-around;
    border: 0.3mm solid black;
    border-top: none;
    font-size: 8pt;
    padding: 1.5mm;
}

/* Localisation Table */
.localisation-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0;
}

.localisation-table td {
    border: 0.3mm solid black;
    border-top: none;
    text-align: center;
    vertical-align: middle;
}

.col-loc-header,
.col-nature-header {
    height: 10mm;
    font-size: 9pt;
}

.col-loc-header {
    width: 60%;
}

.col-nature-header {
    width: 40%;
}

.col-loc-content,
.col-nature-content {
    height: 25mm;
}

.col-loc-content {
    width: 60%;
}

.col-nature-content {
    width: 40%;
}

/* Signatures Section 1 */
.signatures-section-1 {
    display: flex;
    width: 100%;
    border: 0.3mm solid black;
    border-top: none;
    font-size: 8pt;
}

.sig-col-left {
    width: 70%;
    padding: 1mm;
}

.sig-col-right {
    width: 30%;
    padding: 1mm;
}

.sig-row {
    margin-bottom: 2mm;
    display: flex;
    align-items: baseline;
}

.sig-row.name-row {
    margin-top: 4mm;
}

.sig-row.visa-row {
    margin-top: 4mm;
}

.label {
    font-weight: bold;
    margin-right: 2mm;
}

.value.handwritten {
    font-family: "Brush Script MT", cursive;
    font-size: 12pt;
    color: #000;
}

.reception-check {
    flex-direction: column;
    align-items: flex-start;
}

.check-options {
    margin-top: 4mm;
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding-right: 10mm;
}

.reception-box {
    border-left: 0.3mm solid black;
    border-bottom: 0.3mm solid black;
    border-right: none;
    border-top: none;
    padding: 2mm 1mm 1mm 1mm;
    margin-left: -1mm;
    margin-right: -1mm;
    margin-top: -1mm;
}

.empty-space {
    height: 5mm;
}

.section-title-italic {
    font-style: italic;
    font-size: 9pt;
    border-top: none;
    padding: 2mm 1mm;
}

.observations-list {
    width: 100%;
    border: 0.3mm solid black;
    border-top: none;
    font-size: 8pt;
}

.obs-item {
    display: grid;
    grid-template-columns: 35mm 1fr 1fr 1fr 40mm;
    grid-template-rows: auto auto;
    border-bottom: 0.1mm dotted #999;
    padding: 1mm 2mm;
    align-items: flex-start;
    row-gap: 1.5mm;
}

.obs-item:last-child {
    border-bottom: none;
}

.obs-label {
    grid-column: 1;
    grid-row: 1;
    font-weight: bold;
}

.obs-accord {
    grid-column: 2;
    grid-row: 1;
}

.obs-check {
    grid-row: 1;
}

.obs-visa {
    grid-column: 5;
    grid-row: 1 / span 2;
    justify-self: end;
    width: 38mm;
    height: 8mm;
}

.visa-box {
    width: 100%;
    height: 100%;
    border: 0.3mm solid black;
    padding: 0.5mm;
    display: flex;
    align-items: flex-start;
}

.obs-comment {
    grid-column: 1 / span 4;
    grid-row: 2;
    margin-top: 1.5mm;
    line-height: 1.6;
    white-space: nowrap;
    overflow: hidden;
}

/* Footer Section */
.footer-section {
    display: flex;
    width: 100%;
    border: 0.3mm solid black;
    border-top: 0.3mm solid black;
    margin-top: 0;
    height: 25mm;
}

.footer-left {
    width: 45%;
    border-right: 0.3mm solid black;
    display: flex;
    flex-direction: column;
}

.footer-right {
    width: 55%;
    display: flex;
    flex-direction: column;
}

.footer-title {
    font-weight: bold;
    font-size: 8pt;
    padding: 1mm;
    border-bottom: 0.1mm dotted #999;
}

.footer-content {
    flex: 1;
    padding: 1mm;
    font-size: 8pt;
}

.remark-block {
    margin-top: 4mm;
    border: 0.3mm solid black;
    border-top: none;
    padding: 3mm 2mm;
    font-size: 8pt;
    min-height: 16mm;
}

.remark-title {
    font-weight: bold;
    margin-bottom: 2mm;
}

.remark-body {
    white-space: pre-wrap;
    line-height: 1.4;
}

p {
    margin: 0;
}`;

const logoAgeroute =
  'data:image/png;base64,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'

const logoPorteo =
  'data:image/png;base64,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'

const logoRb =
  'data:image/png;base64,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'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const formatDate = (value?: string | null, locale: Locale = 'fr') => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const buildPage = (inspection: InspectionListItem, locale: Locale) => {
  const sideCopy: Record<string, string> =
    locale === 'fr'
      ? { LEFT: 'Gauche', RIGHT: 'Droite', BOTH: 'Deux côtés' }
      : { LEFT: '左侧', RIGHT: '右侧', BOTH: '双侧' }

  const roadText = inspection.roadSlug === 'prefab'
    ? (locale === 'fr' ? 'Préfabriqué' : '预制')
    : resolveRoadName({ slug: inspection.roadSlug, name: inspection.roadName }, locale)

  const phaseText = localizeProgressTerm('phase', inspection.phaseName, locale)
  const sideText = sideCopy[inspection.side] ?? inspection.side
  const rangeText = `${formatPK(inspection.startPk)} → ${formatPK(inspection.endPk)}`
  const localisation = `${roadText} · ${phaseText} · ${sideText} · ${rangeText}`

  const layersText = localizeProgressList('layer', inspection.layers, locale, {
    phaseName: inspection.phaseName,
  }).join(' / ')
  const checksText = localizeProgressList('check', inspection.checks, locale, {
    phaseName: inspection.phaseName,
  }).join(' / ')
  const typesText = localizeProgressList('type', inspection.types, locale).join(' / ')
  const natureTravaux = checksText || layersText || typesText

  const numero = ''
  const dateSubmitted = formatDate(inspection.submittedAt, locale)
  const dateAppointment = formatDate(inspection.appointmentDate ?? inspection.submittedAt, locale)
  const remark = inspection.remark ? escapeHtml(inspection.remark) : ''

  const typeTokens = inspection.types.map((type) => type.toLowerCase())
  const hasType = (keywords: string[]) => typeTokens.some((type) => keywords.some((k) => type.includes(k)))
  const mark = (matched: boolean) => (matched ? 'X' : '☐')
  const topoMark = mark(hasType(['topo', '测量']))
  const geoMark = mark(hasType(['geo', '试验', '实验']))
  const genieMark = mark(hasType(['génie', 'genie', 'civil', '现场']))
  const otherMark = mark(!hasType(['topo', '测量', 'geo', '试验', '实验', 'génie', 'genie', 'civil', '现场']))

  return `<div class="page">
    <div class="header-section">
      <div class="row title-row">
        <strong>FORMULAIRE QUALITE</strong>
      </div>
      <div class="row subtitle-row">
        REALISATION DE LA STRUCTURE DE CHAUSSEE 5BB+12 GNT+18 GN 3% A TANDA<br>
        &REALISATION DE LA STRUCTURE DE CHAUSSEE 5BB+12 GNT+18 GN 3% A BONDOUKOU
      </div>
      <div class="row section-title">
        <strong>STRUCTURES PARTICIPANTES</strong>
      </div>
    </div>

    <table class="structures-table">
      <tr>
        <td class="col-role"><strong>MAITRE D'OUVRAGE DELEGUE</strong></td>
        <td class="col-name">AGEROUTE</td>
        <td class="col-logo"><img src="${logoAgeroute}" alt="AGEROUTE" class="logo-img"></td>
        <td class="col-contract" rowspan="3">
          <strong>Contrat :</strong><br>
          090/2025&091/2025
        </td>
      </tr>
      <tr>
        <td class="col-role"><strong>MAÎTRE D'ŒUVRE</strong></td>
        <td class="col-name">PORTEO</td>
        <td class="col-logo"><img src="${logoPorteo}" alt="PORTEO BTP" class="logo-img"></td>
      </tr>
      <tr>
        <td class="col-role"><strong>ENTREPRISE</strong></td>
        <td class="col-name">CRBC</td>
        <td class="col-logo"><img src="${logoRb}" alt="RB" class="logo-img"></td>
      </tr>
    </table>

    <div class="row section-header-row">
      <div class="cell-left"><strong>DEMANDE DE RECEPTION</strong></div>
      <div class="cell-right"><strong>N°:</strong> <span class="variable">${numero}</span></div>
    </div>
    <div class="row checkbox-row">
      <span>${topoMark} TOPOGRAPHIQUE</span>
      <span>${geoMark} GEOTECHNIQUE</span>
      <span>${genieMark} GENIE CIVIL</span>
      <span>${otherMark} AUTRES: ............</span>
    </div>

    <table class="localisation-table">
      <tr>
        <td class="col-loc-header">
          <strong>LOCALISATION</strong><br>
          (Partie d'ouvrage ,PK au PK)
        </td>
        <td class="col-nature-header">
          Nature des Travaux (Type de tâche ou couche)
        </td>
      </tr>
      <tr>
        <td class="col-loc-content">
          <span class="variable">${escapeHtml(localisation)}</span>
        </td>
        <td class="col-nature-content">
          <span class="variable">${escapeHtml(natureTravaux)}</span>
        </td>
      </tr>
    </table>

    <div class="signatures-section-1">
      <div class="sig-col-left">
        <div class="sig-row">
          <span class="label">Pour le:</span> <span class="variable">${dateAppointment}</span>
        </div>
        <div class="sig-row">
          <span class="label">Contrôle intérieur effectué par:</span>
          <span class="value handwritten">Gan Xing (Franck)</span>
        </div>
        <div class="sig-row">
          <span class="label">Document joint:</span>
          <span class="value">Néant</span>
        </div>
        <div class="sig-row">
          <span class="label">Date:</span> <span class="variable">${dateSubmitted}</span>
        </div>
        <div class="sig-row">
          <span class="label">Directeur des travaux ou Conducteur des travaux terrassement</span>
        </div>
        <div class="sig-row name-row">
          <span class="label">NOM:</span>
          <span class="value handwritten">Du Qin (Chris)</span>
        </div>
        <div class="sig-row visa-row">
          <span class="label">Visa:</span>
        </div>
      </div>
      <div class="sig-col-right">
        <div class="reception-box">
          <div class="sig-row reception-check">
            <span class="label">La réception par la Mission de Contrôle peut être demandée</span>
            <div class="check-options">
              <span>Oui X</span>
              <span>Non ☐</span>
            </div>
          </div>
        </div>
        <div class="sig-row empty-space"></div>
        <div class="quality-section">
          <div class="sig-row">
            <span class="label">Ingénieur Qualité</span>
          </div>
          <div class="sig-row name-row">
            <span class="label">NOM:</span>
            <span class="value handwritten">Gan Xing (Franck)</span>
          </div>
          <div class="sig-row visa-row">
            <span class="label">Visa:</span>
          </div>
        </div>
      </div>
    </div>

    <div class="row section-title-italic">
      <strong><em>OBSERVATIONS DU MAÎTRE D'ŒUVRE</em></strong>
    </div>

    <div class="observations-list">
      <div class="obs-item">
        <div class="obs-label">TOPOGRAPHIE :</div>
        <div class="obs-accord">Accordée</div>
        <div class="obs-check">☐ Oui</div>
        <div class="obs-check">☐ Non</div>
        <div class="obs-visa">
          <div class="visa-box">Visa :</div>
        </div>
        <div class="obs-comment">Commentaires :
          ....................................................................................................................................
        </div>
      </div>
      <div class="obs-item">
        <div class="obs-label">GEOTECHNIQUE :</div>
        <div class="obs-accord">Accordée</div>
        <div class="obs-check">☐ Oui</div>
        <div class="obs-check">☐ Non</div>
        <div class="obs-visa">
          <div class="visa-box">Visa :</div>
        </div>
        <div class="obs-comment">Commentaires :
          ....................................................................................................................................
        </div>
      </div>
      <div class="obs-item">
        <div class="obs-label">GENIE CIVIL :</div>
        <div class="obs-accord">Accordée</div>
        <div class="obs-check">☐ Oui</div>
        <div class="obs-check">☐ Non</div>
        <div class="obs-visa">
          <div class="visa-box">Visa :</div>
        </div>
        <div class="obs-comment">Commentaires :
          ....................................................................................................................................
        </div>
      </div>
      <div class="obs-item">
        <div class="obs-label">ELECTRICITE :</div>
        <div class="obs-accord">Accordée</div>
        <div class="obs-check">☐ Oui</div>
        <div class="obs-check">☐ Non</div>
        <div class="obs-visa">
          <div class="visa-box">Visa :</div>
        </div>
        <div class="obs-comment">Commentaires :
          ....................................................................................................................................
        </div>
      </div>
      <div class="obs-item">
        <div class="obs-label">TELECOMS :</div>
        <div class="obs-accord">Accordée</div>
        <div class="obs-check">☐ Oui</div>
        <div class="obs-check">☐ Non</div>
        <div class="obs-visa">
          <div class="visa-box">Visa :</div>
        </div>
        <div class="obs-comment">Commentaires :
          ....................................................................................................................................
        </div>
      </div>
      <div class="obs-item">
        <div class="obs-label">AEP :</div>
        <div class="obs-accord">Accordée</div>
        <div class="obs-check">☐ Oui</div>
        <div class="obs-check">☐ Non</div>
        <div class="obs-visa">
          <div class="visa-box">Visa :</div>
        </div>
        <div class="obs-comment">Commentaires :
          ....................................................................................................................................
        </div>
      </div>
    </div>

    ${remark ? `<div class="remark-block"><div class="remark-title">REMARQUES</div><div class="remark-body">${remark}</div></div>` : ''}

    <div class="footer-section">
      <div class="footer-left">
        <div class="footer-title">Accusé réception MDC</div>
        <div class="footer-content"></div>
      </div>
      <div class="footer-right">
        <div class="footer-title">Décision de l'Ingénieur</div>
        <div class="footer-content">
          <br>
        </div>
      </div>
    </div>
  </div>`
}

export const renderInspectionReportHtml = (inspections: InspectionListItem[], options?: RenderOptions) => {
  const locale = options?.locale ?? 'fr'
  const pages = inspections.map((inspection) => buildPage(inspection, locale)).join('\n')

  return `<!DOCTYPE html>
  <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Inspection Report</title>
      <style>${inlineCss}</style>
    </head>
    <body>
      ${pages}
    </body>
  </html>`
}
