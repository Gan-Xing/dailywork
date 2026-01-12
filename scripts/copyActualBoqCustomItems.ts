import { prisma } from '@/lib/prisma'

type BoqItemTone = 'SECTION' | 'SUBSECTION' | 'ITEM' | 'TOTAL'

const resolveProjectId = () => {
  const value = process.env.PROJECT_ID
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

const resolveProjectByCode = async (code?: string) => {
  if (!code) return null
  return prisma.project.findFirst({
    where: { code },
    select: { id: true },
  })
}

const resolveProjectByName = async (name?: string) => {
  if (!name) return null
  return prisma.project.findFirst({
    where: { name },
    select: { id: true },
  })
}

const resolveTargetProjectId = async (prefix: 'SRC' | 'DEST') => {
  const id = process.env[`${prefix}_PROJECT_ID`]
  if (id) {
    const parsed = Number(id)
    if (Number.isInteger(parsed) && parsed > 0) return parsed
  }
  const code = process.env[`${prefix}_PROJECT_CODE`]
  const byCode = await resolveProjectByCode(code)
  if (byCode?.id) return byCode.id
  const name = process.env[`${prefix}_PROJECT_NAME`]
  const byName = await resolveProjectByName(name)
  if (byName?.id) return byName.id
  return null
}

const normalizeCode = (code: string) => (code === '0' ? '000' : code)

const main = async () => {
  const sourceProjectId = await resolveTargetProjectId('SRC')
  const destProjectId = await resolveTargetProjectId('DEST')
  if (!sourceProjectId || !destProjectId) {
    throw new Error('需要设置 SRC_PROJECT_CODE / DEST_PROJECT_CODE 或对应 ID/NAME')
  }

  const sourceItems = await prisma.boqItem.findMany({
    where: { projectId: sourceProjectId, sheetType: 'ACTUAL', contractItemId: null, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })
  if (!sourceItems.length) {
    throw new Error('来源项目没有新增分项')
  }

  const destItems = await prisma.boqItem.findMany({
    where: { projectId: destProjectId, sheetType: 'ACTUAL' },
    select: { id: true, sortOrder: true, code: true, tone: true, contractItemId: true },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  })

  const destCodeToneKey = new Set(
    destItems
      .filter((item) => item.contractItemId === null)
      .map((item) => `${item.code}::${item.tone}`),
  )

  let nextSortOrder = destItems.length
    ? Math.max(...destItems.map((item) => item.sortOrder)) + 10
    : 10

  const toCreate = sourceItems
    .filter((item) => !destCodeToneKey.has(`${item.code}::${item.tone}`))
    .map((item) => {
      const payload = {
        projectId: destProjectId,
        sheetType: 'ACTUAL' as const,
        contractItemId: null,
        code: normalizeCode(item.code),
        designationZh: item.designationZh,
        designationFr: item.designationFr,
        unit: item.unit,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        tone: item.tone as BoqItemTone,
        sortOrder: nextSortOrder,
        isActive: item.isActive,
      }
      nextSortOrder += 10
      return payload
    })

  if (!toCreate.length) {
    console.log('OK: 目标项目已包含这些新增分项')
    return
  }

  await prisma.boqItem.createMany({
    data: toCreate,
  })

  console.log(`OK: 已复制 ${toCreate.length} 条新增分项`)
}

main()
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
