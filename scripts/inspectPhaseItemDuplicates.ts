/**
 * Inspect phase item duplicates by name/spec/measure.
 *
 * Usage:
 *   npx tsx scripts/inspectPhaseItemDuplicates.ts
 *   PHASE_DEFINITION_ID=123 npx tsx scripts/inspectPhaseItemDuplicates.ts
 *   NAME_FILTER="0.60x0.60" npx tsx scripts/inspectPhaseItemDuplicates.ts
 *   INCLUDE_INACTIVE=1 npx tsx scripts/inspectPhaseItemDuplicates.ts
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

type GroupKey = {
  phaseDefinitionId: number
  phaseDefinitionName: string
  name: string
  spec: string | null
  measure: string
}

type Group = {
  key: GroupKey
  ids: number[]
  rows: Array<{ id: number; spec: string | null; measure: string; isActive: boolean }>
}

const prisma = new PrismaClient()

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

const parsePositiveInt = (value?: string) => {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const main = async () => {
  const phaseDefinitionId = parsePositiveInt(process.env.PHASE_DEFINITION_ID)
  const nameFilter = process.env.NAME_FILTER?.trim()
  const includeInactive = ['1', 'true', 'yes'].includes(
    (process.env.INCLUDE_INACTIVE ?? '').toLowerCase(),
  )

  const items = await prisma.phaseItem.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(phaseDefinitionId ? { phaseDefinitionId } : {}),
      ...(nameFilter ? { name: { contains: nameFilter } } : {}),
    },
    include: { phaseDefinition: { select: { name: true } } },
    orderBy: [
      { phaseDefinitionId: 'asc' },
      { name: 'asc' },
      { spec: 'asc' },
      { id: 'asc' },
    ],
  })

  if (!items.length) {
    console.log('No phase items found with the provided filters.')
    return
  }

  const groupsByName = new Map<string, Group>()
  const groupsByNameSpec = new Map<string, Group>()

  items.forEach((item) => {
    const normalizedName = normalize(item.name)
    const normalizedSpec = normalize(item.spec)
    const keyByName = JSON.stringify({
      phaseDefinitionId: item.phaseDefinitionId,
      name: normalizedName,
    })
    const keyByNameSpec = JSON.stringify({
      phaseDefinitionId: item.phaseDefinitionId,
      name: normalizedName,
      spec: normalizedSpec,
      measure: item.measure,
    })
    const baseKey: GroupKey = {
      phaseDefinitionId: item.phaseDefinitionId,
      phaseDefinitionName: item.phaseDefinition.name,
      name: item.name,
      spec: item.spec ?? null,
      measure: item.measure,
    }
    const row = {
      id: item.id,
      spec: item.spec ?? null,
      measure: item.measure,
      isActive: item.isActive,
    }

    const groupByName = groupsByName.get(keyByName) ?? { key: baseKey, ids: [], rows: [] }
    groupByName.ids.push(item.id)
    groupByName.rows.push(row)
    groupsByName.set(keyByName, groupByName)

    const groupByNameSpec =
      groupsByNameSpec.get(keyByNameSpec) ?? { key: baseKey, ids: [], rows: [] }
    groupByNameSpec.ids.push(item.id)
    groupByNameSpec.rows.push(row)
    groupsByNameSpec.set(keyByNameSpec, groupByNameSpec)
  })

  const exactDuplicates = Array.from(groupsByNameSpec.values()).filter(
    (group) => group.ids.length > 1,
  )
  const nameDuplicates = Array.from(groupsByName.values())
    .filter((group) => group.ids.length > 1)
    .filter((group) => {
      const distinct = new Set(
        group.rows.map((row) => `${normalize(row.spec)}|${row.measure}`),
      )
      return distinct.size > 1
    })

  if (!exactDuplicates.length && !nameDuplicates.length) {
    console.log('No duplicates found by name/spec/measure for the selected scope.')
    return
  }

  if (exactDuplicates.length) {
    console.log(`Exact duplicates (same definition + name + spec + measure): ${exactDuplicates.length}`)
    exactDuplicates.forEach((group) => {
      console.log(
        `- definition=${group.key.phaseDefinitionName} (#${group.key.phaseDefinitionId}) name="${group.key.name}" spec="${group.key.spec ?? ''}" measure=${group.key.measure} count=${group.ids.length}`,
      )
      console.log(
        `  ids=${group.rows.map((row) => `${row.id}${row.isActive ? '' : '(inactive)'}`).join(', ')}`,
      )
    })
  }

  if (nameDuplicates.length) {
    console.log(
      `Name duplicates with different spec/measure (UI may look duplicated if spec is hidden): ${nameDuplicates.length}`,
    )
    nameDuplicates.forEach((group) => {
      console.log(
        `- definition=${group.key.phaseDefinitionName} (#${group.key.phaseDefinitionId}) name="${group.key.name}" count=${group.ids.length}`,
      )
      console.log(
        `  rows=${group.rows
          .map(
            (row) =>
              `id=${row.id} spec="${row.spec ?? ''}" measure=${row.measure}${row.isActive ? '' : ' inactive'}`,
          )
          .join(' | ')}`,
      )
    })
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
