import { Prisma, PrismaClient } from '@prisma/client'

import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import {
  allowedTypesForCheck as hardAllowedTypes,
  clampTypesForCheck as clampByHardRule,
  mergeTypesForCheck as mergeByHardRule,
  normalizeCheckKey,
} from '@/lib/server/inspectionTypeRules'

const prisma = new PrismaClient()
type Entry = Prisma.InspectionEntryGetPayload<{ include: { road: true; phase: true } }>

type Key = {
  roadId: number
  phaseId: number
  side: string
  startPk: number
  endPk: number
  layerName: string
  checkName: string
}

const keyOf = (entry: Key) =>
  [
    entry.roadId,
    entry.phaseId,
    entry.side,
    entry.startPk,
    entry.endPk,
    entry.layerName.trim().toLowerCase(),
    entry.checkName.trim().toLowerCase(),
  ].join(':')

const firstNonEmpty = (values: Array<string | null | undefined>) =>
  values.find((v) => typeof v === 'string' && v.trim().length > 0)?.trim() ?? undefined

const firstNonNullDate = (values: Array<Date | null | undefined>) =>
  values.find((v) => v instanceof Date && !Number.isNaN(v.getTime())) ?? undefined

type AllowedTypesMap = Map<string, string[]>

const loadTemplateAllowedTypes = async (): Promise<AllowedTypesMap> => {
  const map: AllowedTypesMap = new Map()
  const workflows = await prisma.phaseWorkflowDefinition.findMany({
    include: { phaseDefinition: true },
  })
  workflows.forEach((wf) => {
    const config = (wf as any).config as any
    const layers = Array.isArray(config?.layers) ? config.layers : []
    layers.forEach((layer: any) => {
      const checks = Array.isArray(layer?.checks) ? layer.checks : []
      checks.forEach((check: any) => {
        const name = check?.name ?? ''
        const types = Array.isArray(check?.types) ? (check.types as string[]) : []
        if (!name || !types.length) return
        const canonicalTypes = canonicalizeProgressList('type', types)
        const key = normalizeCheckKey(name)
        if (!map.has(key)) {
          map.set(key, canonicalTypes)
          return
        }
        const existing = map.get(key)!
        const same =
          existing.length === canonicalTypes.length &&
          existing.every((v, idx) => canonicalTypes[idx] === v)
        if (!same) {
          // If conflict, prefer shortest (stricter)
          const pick = canonicalTypes.length <= existing.length ? canonicalTypes : existing
          map.set(key, pick)
        }
      })
    })
  })
  return map
}

const clampTypes = (allowedMap: AllowedTypesMap, checkName: string, types: string[]) => {
  const key = normalizeCheckKey(checkName)
  const templateAllowed = allowedMap.get(key)
  if (templateAllowed) return templateAllowed
  const hard = hardAllowedTypes(checkName)
  if (hard) return hard
  return canonicalizeProgressList('type', types ?? [])
}

const mergeTypes = (allowedMap: AllowedTypesMap, checkName: string, current: string[], incoming: string[]) => {
  const key = normalizeCheckKey(checkName)
  const templateAllowed = allowedMap.get(key)
  if (templateAllowed) return templateAllowed
  return mergeByHardRule(checkName, current, incoming)
}

async function main() {
  const allowedMap = await loadTemplateAllowedTypes()

  const entries: Entry[] = await prisma.inspectionEntry.findMany({
    include: { road: true, phase: true },
    orderBy: { id: 'asc' },
  })

  if (!entries.length) {
    console.log('No inspection entries found.')
    return
  }

  // Normalize types per entry first
  for (const entry of entries) {
    const clamped = clampTypes(allowedMap, entry.checkName, entry.types)
    if (clamped.join(',') !== entry.types.join(',')) {
      await prisma.inspectionEntry.update({
        where: { id: entry.id },
        data: { types: clamped },
      })
    }
  }

  const groups = new Map<string, { key: Key; items: Entry[] }>()

  entries.forEach((entry) => {
    const canonicalLayer = canonicalizeProgressList('layer', [entry.layerName]).at(0) ?? entry.layerName
    const canonicalCheck = canonicalizeProgressList('check', [entry.checkName]).at(0) ?? entry.checkName
    const key: Key = {
      roadId: entry.roadId,
      phaseId: entry.phaseId,
      side: entry.side,
      startPk: entry.startPk,
      endPk: entry.endPk,
      layerName: canonicalLayer,
      checkName: canonicalCheck,
    }
    const k = keyOf(key)
    const group = groups.get(k) ?? { key, items: [] as Entry[] }
    group.items.push({
      ...entry,
      layerName: canonicalLayer,
      checkName: canonicalCheck,
    })
    groups.set(k, group)
  })

  let cleaned = 0
  let touched = 0

  for (const group of Array.from(groups.values())) {
    if (group.items.length <= 1) continue
    // sort by id asc; keep the oldest
    const sorted = group.items.slice().sort((a, b) => a.id - b.id)
    const keeper = sorted[0]
    const rest = sorted.slice(1)

    const mergedTypes = rest.reduce(
      (acc, item) => mergeTypes(allowedMap, group.key.checkName, acc, item.types),
      keeper.types,
    )
    const forced = allowedMap.get(normalizeCheckKey(group.key.checkName)) ?? hardAllowedTypes(group.key.checkName)
    const finalTypes = forced ?? mergedTypes

    const mergedRemark = firstNonEmpty([keeper.remark, ...rest.map((r) => r.remark)])
    const mergedAppointment = firstNonNullDate([keeper.appointmentDate, ...rest.map((r) => r.appointmentDate)])
    const mergedSubmissionOrder =
      keeper.submissionOrder ?? rest.map((r) => r.submissionOrder).find((v) => v !== null && v !== undefined)

    await prisma.$transaction([
      prisma.inspectionEntry.update({
        where: { id: keeper.id },
        data: {
          types: finalTypes,
          remark: mergedRemark,
          appointmentDate: mergedAppointment,
          submissionOrder: mergedSubmissionOrder,
        },
      }),
      prisma.inspectionEntry.deleteMany({
        where: { id: { in: rest.map((r) => r.id) } },
      }),
    ])

    cleaned += rest.length
    touched += 1
    console.log(
      `Merged ${rest.length + 1} -> 1 for ${keeper.road.slug} | ${keeper.phase.name} | ${keeper.side} | PK${keeper.startPk}→PK${keeper.endPk} | ${keeper.layerName} | ${keeper.checkName} (kept id=${keeper.id}, deleted ids=${rest
        .map((r) => r.id)
        .join(',')}, types=${finalTypes.join(',')})`,
    )
  }

  console.log(`Done. Groups touched=${touched}, records removed=${cleaned}.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
