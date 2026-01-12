/**
 * Deactivate duplicate phase items by name/spec under a phase definition.
 *
 * Usage:
 *   npx tsx scripts/deactivatePhaseItemDuplicates.ts
 *   APPLY=1 npx tsx scripts/deactivatePhaseItemDuplicates.ts
 *   PHASE_DEFINITION_ID=14 APPLY=1 npx tsx scripts/deactivatePhaseItemDuplicates.ts
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_DEFINITION_ID = 14
const DEFAULT_TARGETS = [
  { name: '0.60x0.60混凝土箱涵', spec: '80*60' },
  { name: '0.80x0.80混凝土箱涵', spec: '100*65' },
]

const parsePositiveInt = (value?: string) => {
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const parseApply = (value?: string) =>
  ['1', 'true', 'yes'].includes((value ?? '').toLowerCase())

const main = async () => {
  const phaseDefinitionId =
    parsePositiveInt(process.env.PHASE_DEFINITION_ID) ?? DEFAULT_DEFINITION_ID
  const apply = parseApply(process.env.APPLY)

  const items = await prisma.phaseItem.findMany({
    where: {
      phaseDefinitionId,
      OR: DEFAULT_TARGETS.map((target) => ({
        name: target.name,
        spec: target.spec,
      })),
    },
    include: { phaseDefinition: { select: { name: true } } },
    orderBy: { id: 'asc' },
  })

  if (!items.length) {
    console.log('No matching phase items found for the configured targets.')
    return
  }

  console.log(
    `Found ${items.length} phase items in definition #${phaseDefinitionId} (${items[0]?.phaseDefinition.name ?? 'unknown'}).`,
  )
  items.forEach((item) => {
    console.log(
      `- id=${item.id} name="${item.name}" spec="${item.spec ?? ''}" measure=${item.measure} active=${item.isActive}`,
    )
  })

  if (!apply) {
    console.log('Dry run only. Set APPLY=1 to deactivate these items.')
    return
  }

  const ids = items.map((item) => item.id)
  const result = await prisma.phaseItem.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  })

  console.log(`Deactivated ${result.count} phase item(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
