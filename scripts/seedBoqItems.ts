import 'dotenv/config'

import type { BoqItemTone } from '@prisma/client'

import { boqProjects } from '@/lib/data/boqSeed'
import { prisma } from '@/lib/prisma'

const parseOptionalDecimal = (value?: string) => {
  if (!value) return null
  const trimmed = value.replace(/,/g, '').trim()
  if (!trimmed || trimmed === '-') return null
  return trimmed
}

const mapTone = (tone?: string): BoqItemTone => {
  switch (tone) {
    case 'section':
      return 'SECTION'
    case 'subsection':
      return 'SUBSECTION'
    case 'total':
      return 'TOTAL'
    default:
      return 'ITEM'
  }
}

const resolveProject = async (code: string, fallbackName: string) => {
  const byCode = await prisma.project.findUnique({
    where: { code },
  })
  if (byCode) return byCode

  const byName = await prisma.project.findUnique({
    where: { name: fallbackName },
  })
  if (byName) return byName

  throw new Error(`项目不存在: ${fallbackName} (${code})`)
}

const seedProject = async (project: typeof boqProjects[number]) => {
  if (!project.rows.length) {
    return
  }

  const dbProject = await resolveProject(project.id, project.name.zh)

  await prisma.boqItem.deleteMany({
    where: {
      projectId: dbProject.id,
      sheetType: 'CONTRACT',
    },
  })

  const data = project.rows.map((row, index) => ({
    projectId: dbProject.id,
    sheetType: 'CONTRACT' as const,
    code: row.code,
    designationZh: row.designation.zh,
    designationFr: row.designation.fr,
    unit: row.unit ?? null,
    unitPrice: parseOptionalDecimal(row.unitPrice),
    quantity: parseOptionalDecimal(row.quantity),
    totalPrice: parseOptionalDecimal(row.totalPrice),
    tone: mapTone(row.tone),
    sortOrder: index,
    isActive: true,
  }))

  await prisma.boqItem.createMany({ data })
  console.log(`已写入 ${project.name.zh}: ${data.length} 条工程量清单`) // eslint-disable-line no-console
}

const run = async () => {
  for (const project of boqProjects) {
    await seedProject(project)
  }
}

run()
  .catch((error) => {
    console.error(error) // eslint-disable-line no-console
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
