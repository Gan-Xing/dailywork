import { PrismaClient } from '@prisma/client'

type GroupKey = {
  phase: string
  side: string
  startPk: number
  endPk: number
  layer: string
  check: string
}

const prisma = new PrismaClient()

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

const groupKeyToText = (key: GroupKey) =>
  `${key.phase} | ${key.side} | PK${key.startPk}→PK${key.endPk} | ${key.layer} | ${key.check}`

async function inspectEntries(roadSlug: string) {
  const rows = await prisma.inspectionEntry.findMany({
    where: { road: { slug: roadSlug } },
    include: { phase: true },
  })

  const bucket = new Map<string, { key: GroupKey; ids: number[]; types: string[][] }>()
  rows.forEach((row) => {
    const key: GroupKey = {
      phase: row.phase.name,
      side: row.side,
      startPk: row.startPk,
      endPk: row.endPk,
      layer: row.layerName,
      check: row.checkName,
    }
    const k = JSON.stringify({
      phase: normalize(key.phase),
      side: normalize(key.side),
      startPk: key.startPk,
      endPk: key.endPk,
      layer: normalize(key.layer),
      check: normalize(key.check),
    })
    const entry = bucket.get(k) ?? { key, ids: [], types: [] }
    entry.ids.push(row.id)
    entry.types.push(row.types)
    bucket.set(k, entry)
  })

  const duplicates = Array.from(bucket.values()).filter((item) => item.ids.length > 1)
  if (!duplicates.length) {
    console.log(`✅ No duplicate inspection entries on road "${roadSlug}".`)
    return
  }

  console.log(`⚠️ Duplicate inspection entries on road "${roadSlug}":`)
  duplicates.forEach((item) => {
    console.log(
      `- ${groupKeyToText(item.key)} -> count ${item.ids.length}, ids=${item.ids.join(', ')}, types=${item.types
        .map((t) => `[${t.join(',')}]`)
        .join(' ')}`,
    )
  })
}

async function inspectPhaseBindings(roadSlug: string) {
  const road = await prisma.roadSection.findFirst({
    where: { slug: roadSlug },
    select: {
      id: true,
      name: true,
      phases: {
        select: {
          id: true,
          name: true,
          layerLinks: { select: { layerDefinition: { select: { name: true } } } },
          checkLinks: { select: { checkDefinition: { select: { name: true } } } },
        },
      },
    },
  })

  if (!road) {
    console.log(`❌ Road slug not found: ${roadSlug}`)
    return
  }

  const comboMap = new Map<string, { phase: string; layer: string; check: string; count: number }>()
  road.phases.forEach((phase) => {
    const layers = phase.layerLinks.map((l) => l.layerDefinition?.name ?? '').filter(Boolean)
    const checks = phase.checkLinks.map((c) => c.checkDefinition?.name ?? '').filter(Boolean)
    layers.forEach((layer) => {
      checks.forEach((check) => {
        const key = JSON.stringify({
          phase: normalize(phase.name),
          layer: normalize(layer),
          check: normalize(check),
        })
        const entry =
          comboMap.get(key) ?? {
            phase: phase.name,
            layer,
            check,
            count: 0,
          }
        entry.count += 1
        comboMap.set(key, entry)
      })
    })
  })

  const duplicates = Array.from(comboMap.values()).filter((item) => item.count > 1)
  if (!duplicates.length) {
    console.log(`✅ No duplicate phase layer/check bindings on road "${roadSlug}".`)
    return
  }

  console.log(`⚠️ Duplicate phase bindings on road "${roadSlug}":`)
  duplicates.forEach((item) => {
    console.log(`- ${item.phase} | ${item.layer} | ${item.check} -> count ${item.count}`)
  })
}

async function inspectWorkflowTemplates(roadSlug: string) {
  const phaseDefs = await prisma.phaseDefinition.findMany({
    where: { phases: { some: { road: { slug: roadSlug } } } },
    include: { workflows: true },
  })

  const dupes: Array<{ phase: string; layer: string; check: string; types: string[]; count: number }> = []

  phaseDefs.forEach((def) => {
    def.workflows.forEach((wf) => {
      const config = (wf as any).config as any
      const layers = Array.isArray(config?.layers) ? config.layers : []
      const map = new Map<string, { layer: string; check: string; types: string[]; count: number }>()
      layers.forEach((layer: any) => {
        const layerName = layer?.name ?? ''
        const checks = Array.isArray(layer?.checks) ? layer.checks : []
        checks.forEach((check: any) => {
          const checkName = check?.name ?? ''
          const types = Array.isArray(check?.types) ? (check.types as string[]) : []
          const key = JSON.stringify({
            layer: normalize(layerName),
            check: normalize(checkName),
            types: types.slice().sort(),
          })
          const entry = map.get(key) ?? { layer: layerName, check: checkName, types, count: 0 }
          entry.count += 1
          map.set(key, entry)
        })
      })
      map.forEach((entry) => {
        if (entry.count > 1) {
          dupes.push({
            phase: def.name,
            layer: entry.layer,
            check: entry.check,
            types: entry.types,
            count: entry.count,
          })
        }
      })
    })
  })

  if (!dupes.length) {
    console.log(`✅ No duplicate workflow checks in templates for road "${roadSlug}".`)
    return
  }

  console.log(`⚠️ Duplicate workflow checks in templates for road "${roadSlug}":`)
  dupes.forEach((item) => {
    console.log(
      `- ${item.phase} | ${item.layer} | ${item.check} | types=[${item.types.join(',')}] -> count ${item.count}`,
    )
  })
}

async function main() {
  const roadSlug = process.argv[2] || process.env.ROAD_SLUG
  if (!roadSlug) {
    console.error('Usage: pnpm tsx scripts/inspectInspectionDuplicates.ts <road-slug>')
    process.exit(1)
  }

  await inspectEntries(roadSlug)
  await inspectPhaseBindings(roadSlug)
  await inspectWorkflowTemplates(roadSlug)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
