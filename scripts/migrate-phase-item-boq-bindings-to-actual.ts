/**
 * Migrate PhaseItemBoqItem bindings from CONTRACT BoqItem to ACTUAL BoqItem.
 *
 * Usage:
 *   npx tsx scripts/migrate-phase-item-boq-bindings-to-actual.ts
 *   npx tsx scripts/migrate-phase-item-boq-bindings-to-actual.ts --confirm
 *   npx tsx scripts/migrate-phase-item-boq-bindings-to-actual.ts --limit 200
 */
/* eslint-disable no-console */
import { prisma } from '@/lib/prisma'

type ContractBinding = {
  id: number
  phaseItemId: number
  boqItemId: number
  boqItem: {
    id: number
    projectId: number
    code: string
  }
}

type ActualItem = {
  id: number
  projectId: number
  code: string
  contractItemId: number | null
}

type MigrationAction =
  | {
      type: 'update'
      bindingId: number
      phaseItemId: number
      fromBoqItemId: number
      toBoqItemId: number
      projectId: number
      code: string
    }
  | {
      type: 'delete'
      bindingId: number
      phaseItemId: number
      fromBoqItemId: number
      toBoqItemId: number
      projectId: number
      code: string
    }

const parseLimit = () => {
  const index = process.argv.indexOf('--limit')
  if (index === -1) return null
  const raw = process.argv[index + 1]
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

const buildProjectCodeKey = (projectId: number, code: string) => `${projectId}::${code}`

const pickActualItem = (
  contractItemId: number,
  projectId: number,
  code: string,
  actualByContractId: Map<number, ActualItem[]>,
  actualByProjectCode: Map<string, ActualItem[]>,
) => {
  const direct = actualByContractId.get(contractItemId)
  if (direct && direct.length) {
    return { item: direct[0], multiple: direct.length > 1, source: 'contract' as const }
  }
  const fallback = actualByProjectCode.get(buildProjectCodeKey(projectId, code))
  if (fallback && fallback.length) {
    return { item: fallback[0], multiple: fallback.length > 1, source: 'code' as const }
  }
  return { item: null, multiple: false, source: null }
}

const main = async () => {
  const confirm = process.argv.includes('--confirm')
  const limit = parseLimit()

  const contractBindings = await prisma.phaseItemBoqItem.findMany({
    where: {
      isActive: true,
      boqItem: {
        sheetType: 'CONTRACT',
        tone: 'ITEM',
        isActive: true,
      },
    },
    select: {
      id: true,
      phaseItemId: true,
      boqItemId: true,
      boqItem: {
        select: {
          id: true,
          projectId: true,
          code: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  })

  if (!contractBindings.length) {
    console.log('No contract bindings found.')
    return
  }

  const scopedBindings = limit ? contractBindings.slice(0, limit) : contractBindings

  const contractIds = Array.from(new Set(scopedBindings.map((binding) => binding.boqItem.id)))
  const projectIds = Array.from(new Set(scopedBindings.map((binding) => binding.boqItem.projectId)))
  const codes = Array.from(new Set(scopedBindings.map((binding) => binding.boqItem.code)))
  const phaseItemIds = Array.from(new Set(scopedBindings.map((binding) => binding.phaseItemId)))

  const actualItems = await prisma.boqItem.findMany({
    where: {
      sheetType: 'ACTUAL',
      tone: 'ITEM',
      isActive: true,
      OR: [
        { contractItemId: { in: contractIds } },
        { projectId: { in: projectIds }, code: { in: codes } },
      ],
    },
    select: {
      id: true,
      projectId: true,
      code: true,
      contractItemId: true,
    },
    orderBy: [{ id: 'asc' }],
  })

  const actualByContractId = new Map<number, ActualItem[]>()
  const actualByProjectCode = new Map<string, ActualItem[]>()

  actualItems.forEach((item) => {
    if (item.contractItemId) {
      const list = actualByContractId.get(item.contractItemId) ?? []
      list.push(item)
      actualByContractId.set(item.contractItemId, list)
    }
    const key = buildProjectCodeKey(item.projectId, item.code)
    const list = actualByProjectCode.get(key) ?? []
    list.push(item)
    actualByProjectCode.set(key, list)
  })

  const existingActualBindings = await prisma.phaseItemBoqItem.findMany({
    where: {
      phaseItemId: { in: phaseItemIds },
      isActive: true,
      boqItem: {
        sheetType: 'ACTUAL',
        tone: 'ITEM',
        isActive: true,
      },
    },
    select: {
      phaseItemId: true,
      boqItemId: true,
      boqItem: {
        select: {
          projectId: true,
          code: true,
        },
      },
    },
  })

  const phaseProjectBindingMap = new Map<number, Map<number, { boqItemId: number; code: string }>>()
  existingActualBindings.forEach((binding) => {
    const map = phaseProjectBindingMap.get(binding.phaseItemId) ?? new Map()
    map.set(binding.boqItem.projectId, {
      boqItemId: binding.boqItemId,
      code: binding.boqItem.code,
    })
    phaseProjectBindingMap.set(binding.phaseItemId, map)
  })

  const actions: MigrationAction[] = []
  const missing: ContractBinding[] = []
  const conflicts: Array<{ binding: ContractBinding; existingBoqItemId: number; code: string }> = []
  let multipleMatches = 0

  scopedBindings.forEach((binding) => {
    const { item, multiple } = pickActualItem(
      binding.boqItem.id,
      binding.boqItem.projectId,
      binding.boqItem.code,
      actualByContractId,
      actualByProjectCode,
    )

    if (multiple) {
      multipleMatches += 1
    }

    if (!item) {
      missing.push(binding)
      return
    }

    const phaseProjects = phaseProjectBindingMap.get(binding.phaseItemId)
    const existing = phaseProjects?.get(item.projectId)
    if (existing && existing.boqItemId !== item.id) {
      conflicts.push({
        binding,
        existingBoqItemId: existing.boqItemId,
        code: existing.code,
      })
      return
    }

    if (existing && existing.boqItemId === item.id) {
      actions.push({
        type: 'delete',
        bindingId: binding.id,
        phaseItemId: binding.phaseItemId,
        fromBoqItemId: binding.boqItemId,
        toBoqItemId: item.id,
        projectId: item.projectId,
        code: item.code,
      })
      return
    }

    actions.push({
      type: 'update',
      bindingId: binding.id,
      phaseItemId: binding.phaseItemId,
      fromBoqItemId: binding.boqItemId,
      toBoqItemId: item.id,
      projectId: item.projectId,
      code: item.code,
    })
  })

  console.log(`Contract bindings scanned: ${scopedBindings.length}`)
  console.log(`Actions needed: ${actions.length}`)
  console.log(`Missing actual items: ${missing.length}`)
  console.log(`Conflicts (already bound to other actual items): ${conflicts.length}`)
  console.log(`Multiple actual matches: ${multipleMatches}`)

  const preview = actions.slice(0, 20)
  preview.forEach((action) => {
    console.log(
      `- ${action.type} binding#${action.bindingId} phase#${action.phaseItemId} ` +
        `boq ${action.fromBoqItemId} -> ${action.toBoqItemId} ` +
        `(project=${action.projectId}, code=${action.code})`,
    )
  })
  if (actions.length > preview.length) {
    console.log(`...and ${actions.length - preview.length} more`)
  }

  if (!confirm) {
    console.log('Dry run only. Re-run with --confirm to apply changes.')
    return
  }

  if (actions.length === 0) {
    console.log('No updates to apply.')
    return
  }

  const batchSize = 100
  for (let i = 0; i < actions.length; i += batchSize) {
    const batch = actions.slice(i, i + batchSize)
    await prisma.$transaction(
      batch.map((action) =>
        action.type === 'update'
          ? prisma.phaseItemBoqItem.update({
              where: { id: action.bindingId },
              data: { boqItemId: action.toBoqItemId },
            })
          : prisma.phaseItemBoqItem.delete({
              where: { id: action.bindingId },
            }),
      ),
    )
  }

  console.log(`Applied ${actions.length} binding changes.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
