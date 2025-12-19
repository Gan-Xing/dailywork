/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs')
const path = require('path')
const { PrismaClient, $Enums } = require('@prisma/client')

const prisma = new PrismaClient()

function extractPlaceholderKeys(html: string) {
  const regex = /{{\s*([^{}]+?)\s*}}/g
  const keys = new Set()
  let match
  while ((match = regex.exec(html))) {
    const key = (match[1] || '').trim()
    if (key) keys.add(key)
  }
  return Array.from(keys).map((key) => ({ key, path: key }))
}

async function main() {
  const htmlPath = path.resolve('module/bordereau.html')
  const cssPath = path.resolve('module/bordereau.css')
  if (!fs.existsSync(htmlPath)) {
    throw new Error(`Template HTML not found at ${htmlPath}`)
  }
  const html = fs.readFileSync(htmlPath, 'utf-8')
  const placeholders = extractPlaceholderKeys(html)
  const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf-8') : ''
  const combinedHtml = cssContent ? `<style>${cssContent}</style>\n${html}` : html

const name = 'Bordereau v1'
const existing = await prisma.documentTemplate.findFirst({ where: { name } })

if (existing) {
  await prisma.documentTemplate.update({
    where: { id: existing.id },
    data: {
      html: combinedHtml,
      placeholders,
      status: $Enums.TemplateStatus.PUBLISHED,
      type: $Enums.DocumentType.SUBMISSION,
      version: existing.version ?? 1,
    },
  })
  console.log(`Updated template "${name}" with ${placeholders.length} placeholders.`)
} else {
  await prisma.documentTemplate.create({
    data: {
      name,
      html: combinedHtml,
      placeholders,
      status: $Enums.TemplateStatus.PUBLISHED,
      type: $Enums.DocumentType.SUBMISSION,
      version: 1,
    },
  })
  console.log(`Created template "${name}" with ${placeholders.length} placeholders.`)
}
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
