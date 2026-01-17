'use server'

import { getTemplate } from '@/lib/server/templateStore'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'

function cleanTemplateHtmlContent(html: string): string {
  let cleaned = html

  // 1. Handle known list/table placeholders with dummy rows to preserve layout
  // Bordereau: 4 columns
  if (cleaned.includes('{{itemsTable}}')) {
    // Using generic tds is usually sufficient as widths are often defined in <thead>
    const dummyRow = '<tr>' + '<td style="height:24px">&nbsp;</td>'.repeat(4) + '</tr>'
    cleaned = cleaned.replace(/{{itemsTable}}/g, dummyRow.repeat(3))
  }

  // Generic Rows (Salary, Presence, etc.): Assume 12 columns to be safe covering 7-8 columns tables
  if (cleaned.includes('{{rows}}')) {
    const dummyRow = '<tr>' + '<td style="height:24px">&nbsp;</td>'.repeat(12) + '</tr>'
    cleaned = cleaned.replace(/{{rows}}/g, dummyRow.repeat(3))
  }

  // Total Row
  if (cleaned.includes('{{totalRow}}')) {
    cleaned = cleaned.replace(/{{totalRow}}/g, '<tr><td colspan="100" style="height:24px">&nbsp;</td></tr>')
  }

  // 2. Replace all remaining {{ variable }} placeholders with non-breaking space
  // using a regex that matches the handlebars pattern safely
  cleaned = cleaned.replace(/{{\s*[^{}]+?\s*}}/g, '&nbsp;')

  return cleaned
}

export async function getTemplateHtml(id: string) {
  let html = ''
  if (id === 'file-bordereau') {
    const tpl = await loadBordereauTemplateFromFile()
    html = tpl?.html ?? ''
  } else {
    const tpl = await getTemplate(id)
    html = tpl?.html ?? ''
  }

  return cleanTemplateHtmlContent(html)
}