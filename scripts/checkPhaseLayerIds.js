/* eslint-disable no-console */
// Inspect phase layer links (id + name) for a given road keyword and phase name.
// Usage: node scripts/checkPhaseLayerIds.js [roadKeyword] [phaseName]
// Defaults: roadKeyword="大学城", phaseName="过道涵".

const { PrismaClient } = require('@prisma/client')
const dotenv = require('dotenv')

dotenv.config()

const prisma = new PrismaClient()

const normalizeList = (arr) => Array.from(new Set((arr || []).map((v) => `${v}`.trim()).filter(Boolean)))

async function main() {
  const roadKeyword = process.argv[2] || '大学城'
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
      layerLinks: { include: { layerDefinition: { select: { id: true, name: true } } } },
      phaseDefinition: {
        select: {
          defaultLayers: { include: { layerDefinition: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: [{ road: { name: 'asc' } }, { id: 'asc' }],
  })

  if (!phases.length) {
    console.log(`No phases found for road keyword "${roadKeyword}" and phase "${phaseName}".`)
    return
  }

  phases.forEach((phase) => {
    const instance = normalizeList(phase.layerLinks.map((l) => `${l.layerDefinition?.id}:${l.layerDefinition?.name}`))
    const template = normalizeList(
      phase.phaseDefinition.defaultLayers.map((l) => `${l.layerDefinition?.id}:${l.layerDefinition?.name}`),
    )
    console.log({
      road: `${phase.road.slug} / ${phase.road.name}`,
      phaseId: phase.id,
      instanceLayerIds: phase.layerLinks.map((l) => l.layerDefinition?.id).filter(Boolean),
      instanceLayers: instance,
      templateLayerIds: phase.phaseDefinition.defaultLayers.map((l) => l.layerDefinition?.id).filter(Boolean),
      templateLayers: template,
    })
  })
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
