import { prisma } from '@/lib/prisma'

type BoqItem = {
  id: number
  contractItemId: number | null
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: string | null
  quantity: string | null
  totalPrice: string | null
  tone: 'SECTION' | 'SUBSECTION' | 'ITEM' | 'TOTAL'
  sortOrder: number
  isActive: boolean
}

const parseDecimalValue = (value?: string | null) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const computeTotalPrice = (quantity?: string | null, unitPrice?: string | null) => {
  const quantityValue = parseDecimalValue(quantity)
  const unitValue = parseDecimalValue(unitPrice)
  if (quantityValue === null || unitValue === null) return null
  return (quantityValue * unitValue).toFixed(2)
}

const resolveProjectId = () => {
  const value = process.env.PROJECT_ID
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const resolveProjectByCode = async () => {
  const code = process.env.PROJECT_CODE?.trim()
  if (!code) return null
  return prisma.project.findFirst({
    where: { code },
    select: { id: true },
  })
}

const resolveProjectByName = async () => {
  const name = process.env.PROJECT_NAME?.trim()
  if (!name) return null
  return prisma.project.findFirst({
    where: { name },
    select: { id: true },
  })
}

const resolveTargetProjectId = async () => {
  const direct = resolveProjectId()
  if (direct) return direct
  const byCode = await resolveProjectByCode()
  if (byCode?.id) return byCode.id
  const byName = await resolveProjectByName()
  if (byName?.id) return byName.id
  return null
}

const main = async () => {
  const projectId = await resolveTargetProjectId()
  if (!projectId) {
    throw new Error('需要设置 PROJECT_ID 或 PROJECT_CODE 或 PROJECT_NAME')
  }

  const contractItems = await prisma.boqItem.findMany({
    where: { projectId, sheetType: 'CONTRACT' },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  if (!contractItems.length) {
    throw new Error('合同清单为空')
  }

  const actualItems = await prisma.boqItem.findMany({
    where: { projectId, sheetType: 'ACTUAL', contractItemId: { not: null } },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  })
  const actualMap = new Map<number, typeof actualItems[number]>()
  const duplicateIds: number[] = []
  actualItems.forEach((item) => {
    if (!item.contractItemId) return
    if (actualMap.has(item.contractItemId)) {
      duplicateIds.push(item.id)
      return
    }
    actualMap.set(item.contractItemId, item)
  })

  const contractIds = new Set(contractItems.map((item) => item.id))
  const extraActualIds = actualItems
    .filter((item) => item.contractItemId && !contractIds.has(item.contractItemId))
    .map((item) => item.id)
  const removeIdMap: Record<number, true> = {}
  duplicateIds.forEach((id) => {
    removeIdMap[id] = true
  })
  extraActualIds.forEach((id) => {
    removeIdMap[id] = true
  })
  const removeIds = Object.keys(removeIdMap).map((id) => Number(id))

  await prisma.$transaction(async (tx) => {
    if (removeIds.length) {
      await tx.boqItem.deleteMany({
        where: { id: { in: removeIds } },
      })
    }

    const contractOrdered = [...contractItems].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
    )

    await Promise.all(
      contractOrdered.map((contract, index) => {
        const existing = actualMap.get(contract.id)
        const nextCode = contract.code === '0' ? '000' : contract.code
        const nextQuantity = existing?.quantity ?? contract.quantity
        const nextUnitPrice = contract.unitPrice
        const nextTotalPrice = computeTotalPrice(
          nextQuantity ? String(nextQuantity) : null,
          nextUnitPrice ? String(nextUnitPrice) : null,
        )
        if (existing) {
          return tx.boqItem.update({
            where: { id: existing.id },
            data: {
              code: nextCode,
              designationZh: contract.designationZh,
              designationFr: contract.designationFr,
              unit: contract.unit,
              unitPrice: contract.unitPrice,
              quantity: nextQuantity,
              totalPrice: nextTotalPrice ?? contract.totalPrice,
              tone: contract.tone,
              sortOrder: (index + 1) * 10,
              isActive: contract.isActive,
            },
          })
        }
        return tx.boqItem.create({
          data: {
            projectId: contract.projectId,
            sheetType: 'ACTUAL',
            contractItemId: contract.id,
            code: nextCode,
            designationZh: contract.designationZh,
            designationFr: contract.designationFr,
            unit: contract.unit,
            unitPrice: contract.unitPrice,
            quantity: contract.quantity,
            totalPrice: contract.totalPrice,
            tone: contract.tone,
            sortOrder: (index + 1) * 10,
            isActive: contract.isActive,
          },
        })
      }),
    )

    const customItems = await tx.boqItem.findMany({
      where: { projectId, sheetType: 'ACTUAL' },
      select: { id: true, sortOrder: true, contractItemId: true, tone: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    })
    const contractIdSet = new Set(contractOrdered.map((item) => item.id))
    const customSubsections = customItems.filter(
      (item) => item.tone === 'SUBSECTION' && (!item.contractItemId || !contractIdSet.has(item.contractItemId)),
    )
    const baseItems = customItems.filter(
      (item) =>
        !(
          item.tone === 'SUBSECTION' &&
          (!item.contractItemId || !contractIdSet.has(item.contractItemId))
        ),
    )
    const sorted = [...baseItems, ...customSubsections].map((item) => ({ id: item.id }))
    await Promise.all(
      sorted.map((item, index) =>
        tx.boqItem.update({
          where: { id: item.id },
          data: { sortOrder: (index + 1) * 10 },
        }),
      ),
    )
  })

  await prisma.$disconnect()
  console.log('OK: 实际工程量清单已重新同步并重排')
}

main().catch(async (error) => {
  console.error(error)
  await prisma.$disconnect()
  process.exit(1)
})
