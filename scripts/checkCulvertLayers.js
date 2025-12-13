/* eslint-disable no-console */
// Quick checker for culvert (过道涵) phase layers on a given road (defaults to “大学城”).
// Usage: node scripts/checkCulvertLayers.js [roadKeyword] [phaseName]
// roadKeyword matches road.name (ILIKE %keyword%) and slug (contains keyword).

const { PrismaClient } = require('@prisma/client')
const dotenv = require('dotenv')

dotenv.config()

const prisma = new PrismaClient()

const normalizeList = (list) => Array.from(new Set((list || []).map((v) => `${v}`.trim()).filter(Boolean)))

const main = async () => {
  const roadKeyword = process.argv[2] || '大学城'
  // 默认按“过道涵”查，可通过第 2 个参数覆盖
  const phaseName = process.argv[3] || '过道涵'

  const phases = await prisma.roadPhase.findMany({
    where: {
      OR: [
        { road: { name: { contains: roadKeyword, mode: 'insensitive' } } },
        { road: { slug: { contains: roadKeyword } } },
      ],
      phaseDefinition: { name: phaseName },
    },
    include: {
      road: { select: { name: true, slug: true } },
      phaseDefinition: {
        select: {
          name: true,
          defaultLayers: { include: { layerDefinition: { select: { name: true } } } },
        },
      },
      layerLinks: { include: { layerDefinition: { select: { name: true } } } },
    },
    orderBy: [{ road: { name: 'asc' } }, { id: 'asc' }],
  })

  if (!phases.length) {
    console.log(`No phases found for road keyword "${roadKeyword}" and phase "${phaseName}".`)
    return
  }

  phases.forEach((phase) => {
    const instanceLayers = normalizeList(phase.layerLinks.map((l) => l.layerDefinition?.name))
    const templateLayers = normalizeList(
      phase.phaseDefinition.defaultLayers.map((l) => l.layerDefinition?.name),
    )
    const resolvedLayers = instanceLayers.length ? instanceLayers : templateLayers
    console.log({
      road: `${phase.road.slug} / ${phase.road.name}`,
      phase: phase.name,
      instanceLayers,
      templateLayers,
      resolvedLayers,
      hasCushion: resolvedLayers.includes('垫层'),
    })
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
