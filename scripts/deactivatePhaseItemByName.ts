/**
 * Deactivate phase items by definition name + item name.
 *
 * Usage:
 *   npx tsx scripts/deactivatePhaseItemByName.ts
 *   APPLY=1 npx tsx scripts/deactivatePhaseItemByName.ts
 *   DEFINITION_NAME="垫层" ITEM_NAME="取土场回填 包括垫层" APPLY=1 npx tsx scripts/deactivatePhaseItemByName.ts
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const DEFAULT_DEFINITION_NAME = '垫层'
const DEFAULT_ITEM_NAME = '取土场回填 包括垫层'

const parseApply = (value?: string) =>
  ['1', 'true', 'yes'].includes((value ?? '').toLowerCase())

const main = async () => {
  const definitionName = (process.env.DEFINITION_NAME ?? DEFAULT_DEFINITION_NAME).trim()
  const itemName = (process.env.ITEM_NAME ?? DEFAULT_ITEM_NAME).trim()
  const apply = parseApply(process.env.APPLY)

  if (!definitionName || !itemName) {
    console.log('DEFINITION_NAME and ITEM_NAME are required.')
    process.exitCode = 1
    return
  }

  const definition = await prisma.phaseDefinition.findFirst({
    where: { name: definitionName },
    select: { id: true, name: true },
  })

  if (!definition) {
    console.log(`Phase definition not found: ${definitionName}`)
    return
  }

  const items = await prisma.phaseItem.findMany({
    where: {
      phaseDefinitionId: definition.id,
      name: itemName,
      isActive: true,
    },
    orderBy: { id: 'asc' },
  })

  if (!items.length) {
    console.log(`No active phase items found for "${itemName}" under "${definition.name}".`)
    return
  }

  console.log(`Found ${items.length} item(s) under "${definition.name}":`)
  items.forEach((item) => {
    console.log(`- id=${item.id} name="${item.name}" spec="${item.spec ?? ''}"`)
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

  console.log(`Deactivated ${result.count} item(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
