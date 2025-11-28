import { Prisma } from '@prisma/client'

import financeCategories from '@/lib/data/finance-cost-categories.json'
import { prisma } from '@/lib/prisma'

type FinanceCategoryNode = {
  key: string
  code?: string
  label: { zh: string; en?: string; fr?: string }
  children?: FinanceCategoryNode[]
}

type FlatCategory = {
  key: string
  parentKey: string | null
  parentKeys: string[]
  labelZh: string
  labelEn?: string
  labelFr?: string
  code?: string
  sortOrder: number
}

export type FinanceCategoryDTO = {
  key: string
  parentKey: string | null
  labelZh: string
  labelEn?: string | null
  labelFr?: string | null
  code?: string | null
  isActive: boolean
  sortOrder: number
  children?: FinanceCategoryDTO[]
}

export type FinanceEntryDTO = {
  id: number
  sequence: number
  projectId: number
  projectName: string
  reason: string
  categoryKey: string
  categoryPath: { key: string; label: string }[]
  amount: number
  unitId: number
  unitName: string
  paymentTypeId: number
  paymentTypeName: string
  paymentDate: string
  handlerId?: number | null
  handlerName?: string | null
  handlerUsername?: string | null
  tva?: number
  remark?: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
  createdById?: number | null
  createdByName?: string | null
  createdByUsername?: string | null
  updatedById?: number | null
  updatedByName?: string | null
  updatedByUsername?: string | null
}

type EntryPayload = {
  projectId: number
  reason: string
  categoryKey: string
  amount: number
  unitId: number
  paymentTypeId: number
  paymentDate: string
  handlerId?: number | null
  tva?: number | null
  remark?: string | null
}

export type FinanceEntryFilterOptions = {
  projectIds?: number[]
  categoryKeys?: string[]
  paymentTypeIds?: number[]
  handlerIds?: number[]
  reasonKeyword?: string
  amountMin?: number
  amountMax?: number
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
  sortField?: 'paymentDate' | 'amount' | 'category' | 'updatedAt'
  sortDir?: 'asc' | 'desc'
  includeDeleted?: boolean
}

type MasterDataPayload = {
  name: string
  code?: string | null
  symbol?: string | null
  isActive?: boolean
  sortOrder?: number
}

const assertFinanceModels = () => {
  const client = prisma as unknown as Record<string, unknown>
  const missing =
    !client.project ||
    !client.financeUnit ||
    !client.paymentType ||
    !client.financeCategory ||
    !client.financeEntry
  if (missing) {
    throw new Error('Prisma Client 未包含财务相关模型，请先执行 `npx prisma migrate deploy && npx prisma generate`')
  }
}

const flattenCategories = (
  nodes: FinanceCategoryNode[],
  parentKey: string | null,
  parentKeys: string[],
  acc: FlatCategory[],
  offset: number,
) => {
  nodes.forEach((node, index) => {
    const currentParentKeys = parentKey ? [...parentKeys, parentKey] : [...parentKeys]
    acc.push({
      key: node.key,
      parentKey,
      parentKeys: currentParentKeys,
      labelZh: node.label.zh,
      labelEn: node.label.en,
      labelFr: node.label.fr,
      code: node.code,
      sortOrder: offset + index + 1,
    })
    if (node.children?.length) {
      flattenCategories(node.children, node.key, currentParentKeys, acc, 0)
    }
  })
}

const buildCategoryMap = (items: Awaited<ReturnType<typeof prisma.financeCategory.findMany>>) => {
  const map = new Map<
    string,
    {
      key: string
      parentKey: string | null
      labelZh: string
      labelEn?: string | null
      labelFr?: string | null
      code?: string | null
      isActive: boolean
      sortOrder: number
    }
  >()
  items.forEach((item) => {
    map.set(item.key, {
      key: item.key,
      parentKey: item.parentKey,
      labelZh: item.labelZh,
      labelEn: item.labelEn,
      labelFr: item.labelFr,
      code: item.code,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    })
  })
  return map
}

const resolveParentKeys = (map: Map<string, { parentKey: string | null }>, key: string) => {
  const chain: string[] = []
  let current = map.get(key)?.parentKey ?? null
  while (current) {
    chain.unshift(current)
    current = map.get(current)?.parentKey ?? null
  }
  return chain
}

export const ensureFinanceDefaults = async () => {
  assertFinanceModels()
  await prisma.$transaction([
    prisma.project.createMany({
      data: [
        { name: '邦杜库市政路项目', code: 'project-bondoukou-city' },
        { name: '邦杜库边境路项目', code: 'project-bondoukou-border' },
        { name: '邦杜库供料项目', code: 'project-bondoukou-supply' },
        { name: '铁布高速项目', code: 'project-tieb-highway' },
        { name: '阿比让办事处', code: 'project-abidjan-office' },
      ],
      skipDuplicates: true,
    }),
    prisma.financeUnit.createMany({
      data: [
        { name: '西法', symbol: null, sortOrder: 1 },
        { name: '美金', symbol: '$', sortOrder: 2 },
        { name: '人民币', symbol: '¥', sortOrder: 3 },
      ],
      skipDuplicates: true,
    }),
    prisma.paymentType.createMany({
      data: [
        { name: '现金', sortOrder: 1 },
        { name: '现金支票', sortOrder: 2 },
        { name: '转账支票', sortOrder: 3 },
        { name: '办事处代付', sortOrder: 4 },
        { name: '无票据支出', sortOrder: 5 },
      ],
      skipDuplicates: true,
    }),
  ])
}

export const ensureFinanceCategories = async () => {
  assertFinanceModels()
  const flat: FlatCategory[] = []
  flattenCategories(financeCategories as FinanceCategoryNode[], null, [], flat, 0)

  await prisma.$transaction(async (tx) => {
    for (const item of flat) {
      await tx.financeCategory.upsert({
        where: { key: item.key },
        update: {
          parentKey: item.parentKey ?? null,
          labelZh: item.labelZh,
          labelEn: item.labelEn ?? null,
          labelFr: item.labelFr ?? null,
          code: item.code ?? null,
          isActive: true,
          sortOrder: item.sortOrder,
        },
        create: {
          key: item.key,
          parentKey: item.parentKey ?? null,
          labelZh: item.labelZh,
          labelEn: item.labelEn ?? null,
          labelFr: item.labelFr ?? null,
          code: item.code ?? null,
          sortOrder: item.sortOrder,
        },
      })
    }
  })
}

export const listFinanceMetadata = async () => {
  assertFinanceModels()
  await ensureFinanceDefaults()
  await ensureFinanceCategories()

  const [projects, units, paymentTypes, categories, handlers] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    prisma.financeUnit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    prisma.paymentType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    prisma.financeCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
    prisma.user.findMany({
      where: { nationality: 'china' },
      orderBy: [{ name: 'asc' }, { username: 'asc' }],
      select: { id: true, name: true, username: true },
    }),
  ])

  const map = new Map<string, FinanceCategoryDTO>()
  categories.forEach((cat) =>
    map.set(cat.key, {
      key: cat.key,
      parentKey: cat.parentKey ?? null,
      labelZh: cat.labelZh,
      labelEn: cat.labelEn,
      labelFr: cat.labelFr,
      code: cat.code,
      isActive: cat.isActive,
      sortOrder: cat.sortOrder,
      children: [],
    }),
  )

  const roots: FinanceCategoryDTO[] = []
  map.forEach((cat) => {
    if (cat.parentKey && map.has(cat.parentKey)) {
      map.get(cat.parentKey)!.children!.push(cat)
    } else {
      roots.push(cat)
    }
  })

  const sortTree = (items: FinanceCategoryDTO[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
    items.forEach((child) => child.children && sortTree(child.children))
  }
  sortTree(roots)

  return {
    projects,
    units,
    paymentTypes,
    categories: roots,
    handlers: handlers.map((handler) => ({
      id: handler.id,
      name: handler.name,
      username: handler.username,
    })),
  }
}

const buildEntryWhere = (options: FinanceEntryFilterOptions): Prisma.FinanceEntryWhereInput => {
  const andConditions: Prisma.FinanceEntryWhereInput[] = []
  if (options.amountMin !== undefined) {
    andConditions.push({ amount: { gte: new Prisma.Decimal(options.amountMin) } })
  }
  if (options.amountMax !== undefined) {
    andConditions.push({ amount: { lte: new Prisma.Decimal(options.amountMax) } })
  }
  if (options.dateFrom) {
    andConditions.push({ paymentDate: { gte: new Date(options.dateFrom) } })
  }
  if (options.dateTo) {
    andConditions.push({ paymentDate: { lte: new Date(options.dateTo) } })
  }
  if (options.reasonKeyword) {
    andConditions.push({ reason: { contains: options.reasonKeyword, mode: 'insensitive' } })
  }
  if (options.categoryKeys?.length) {
    const orConditions = options.categoryKeys.flatMap((key) => [
      { categoryKey: key },
      { parentKeys: { has: key } },
    ])
    andConditions.push({ OR: orConditions })
  }

  const where: Prisma.FinanceEntryWhereInput = {
    projectId: options.projectIds?.length ? { in: options.projectIds } : undefined,
    paymentTypeId: options.paymentTypeIds?.length ? { in: options.paymentTypeIds } : undefined,
    handlerId: options.handlerIds?.length ? { in: options.handlerIds } : undefined,
    isDeleted: options.includeDeleted ? undefined : false,
    AND: andConditions.length ? andConditions : undefined,
  }

  return where
}

const buildEntryOrderBy = (options: FinanceEntryFilterOptions) => {
  const direction = options.sortDir === 'asc' ? 'asc' : 'desc'
  switch (options.sortField) {
    case 'amount':
      return [{ amount: direction }, { paymentDate: 'desc' as const }, { id: 'desc' as const }]
    case 'category':
      return [{ categoryKey: direction }, { paymentDate: 'desc' as const }, { id: 'desc' as const }]
    case 'updatedAt':
      return [{ updatedAt: direction }, { id: 'desc' as const }]
    case 'paymentDate':
    default:
      return [{ paymentDate: direction }, { id: 'desc' as const }]
  }
}

export type FinanceEntryListResult = {
  items: FinanceEntryDTO[]
  total: number
  page: number
  pageSize: number
}

export const listFinanceEntries = async (options: FinanceEntryFilterOptions): Promise<FinanceEntryListResult> => {
  assertFinanceModels()
  const where = buildEntryWhere(options)
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.max(1, Math.min(options.pageSize ?? 50, 200))
  const skip = (page - 1) * pageSize
  const orderBy = buildEntryOrderBy(options)

  const [total, entries, categories] = await prisma.$transaction([
    prisma.financeEntry.count({ where }),
    prisma.financeEntry.findMany({
      where,
      orderBy,
      skip,
      take: pageSize,
      include: {
        project: true,
        unit: true,
        paymentType: true,
        handler: true,
        creator: true,
        updater: true,
      },
    }),
    prisma.financeCategory.findMany(),
  ])

  const map = buildCategoryMap(categories)

  const toNumber = (val: Prisma.Decimal | null): number | undefined =>
    val ? new Prisma.Decimal(val).toNumber() : undefined

  const buildPath = (key: string) => {
    const chain = resolveParentKeys(map, key)
    const full = [...chain, key]
    return full
      .map((k) => {
        const node = map.get(k)
        return node ? { key: k, label: node.labelZh } : null
      })
      .filter((item): item is { key: string; label: string } => Boolean(item))
  }

  return {
    items: entries.map<FinanceEntryDTO>((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      projectId: entry.projectId,
      projectName: entry.project.name,
      reason: entry.reason,
      categoryKey: entry.categoryKey,
      categoryPath: buildPath(entry.categoryKey),
      amount: new Prisma.Decimal(entry.amount).toNumber(),
      unitId: entry.unitId,
      unitName: entry.unit.name,
      paymentTypeId: entry.paymentTypeId,
      paymentTypeName: entry.paymentType.name,
      paymentDate: entry.paymentDate.toISOString(),
      handlerId: entry.handlerId ?? null,
      handlerName: entry.handler?.name ?? null,
      handlerUsername: entry.handler?.username ?? null,
      tva: toNumber(entry.tva),
      remark: entry.remark,
      isDeleted: entry.isDeleted,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      createdById: entry.createdBy ?? null,
      createdByName: entry.creator?.name ?? null,
      createdByUsername: entry.creator?.username ?? null,
      updatedById: entry.updatedBy ?? null,
      updatedByName: entry.updater?.name ?? null,
      updatedByUsername: entry.updater?.username ?? null,
    })),
    total,
    page,
    pageSize,
  }
}

const assertCategoryExists = async (categoryKey: string) => {
  const cat = await prisma.financeCategory.findUnique({ where: { key: categoryKey } })
  if (!cat || !cat.isActive) {
    throw new Error('分类不存在或已停用')
  }
  return cat
}

const assertHandlerIsChinese = async (handlerId?: number | null) => {
  if (!handlerId) return null
  const handler = await prisma.user.findUnique({
    where: { id: handlerId },
    select: { id: true, name: true, username: true, nationality: true },
  })
  if (!handler) {
    throw new Error('经办人不存在')
  }
  if (handler.nationality !== 'china') {
    throw new Error('经办人必须为中国籍成员')
  }
  return handler
}

const normalizeNumber = (value: number | string | null | undefined) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    throw new Error('金额/税费必须为数字')
  }
  return num
}

const toOptionalNumber = (value: number | Prisma.Decimal | null | undefined) => {
  if (value == null) return undefined
  return new Prisma.Decimal(value).toNumber()
}

export type FinanceInsights = {
  totalAmount: number
  entryCount: number
  averageAmount: number
  latestPaymentDate?: string | null
  topCategories: { key: string; label: string; amount: number; count: number; share: number }[]
  paymentBreakdown: { id: number; name: string; amount: number; count: number; share: number }[]
  monthlyTrend: { month: string; amount: number; count: number }[]
  categoryBreakdown: {
    key: string
    label: string
    parentKey: string | null
    parentKeys: string[]
    amount: number
    count: number
    share: number
  }[]
}

export const getFinanceInsights = async (options: FinanceEntryFilterOptions) => {
  const where = buildEntryWhere(options)
  const [aggregate, categories, paymentTypes, entriesForTrend] = await Promise.all([
    prisma.financeEntry.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
      _max: { paymentDate: true },
    }),
    prisma.financeCategory.findMany(),
    prisma.paymentType.findMany(),
    prisma.financeEntry.findMany({
      where,
      select: { amount: true, categoryKey: true, parentKeys: true, paymentTypeId: true, paymentDate: true },
    }),
  ])

  const totalAmount = aggregate._sum.amount ? new Prisma.Decimal(aggregate._sum.amount).toNumber() : 0
  const entryCount = aggregate._count || 0
  const averageAmount = entryCount ? Math.round((totalAmount / entryCount) * 100) / 100 : 0
  const latestPaymentDate = aggregate._max.paymentDate?.toISOString() ?? null

  const categoryMap = buildCategoryMap(categories)
  const paymentTypeMap = new Map(paymentTypes.map((pt) => [pt.id, pt.name]))

  const categoryAgg = new Map<
    string,
    {
      amount: number
      count: number
      parentKey: string | null
      parentKeys: string[]
      label: string
    }
  >()

  entriesForTrend.forEach((entry) => {
    const amount = new Prisma.Decimal(entry.amount).toNumber()
    const catMeta = categoryMap.get(entry.categoryKey) ?? {
      key: entry.categoryKey,
      parentKey: null,
      labelZh: entry.categoryKey,
      parentKeys: entry.parentKeys ?? [],
    }
    const existing = categoryAgg.get(entry.categoryKey)
    if (existing) {
      existing.amount += amount
      existing.count += 1
    } else {
      categoryAgg.set(entry.categoryKey, {
        amount,
        count: 1,
        parentKey: catMeta.parentKey ?? null,
        parentKeys: resolveParentKeys(categoryMap, entry.categoryKey),
        label: catMeta.labelZh ?? entry.categoryKey,
      })
    }
  })

  const categoryBreakdown = Array.from(categoryAgg.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    parentKey: value.parentKey,
    parentKeys: value.parentKeys,
    amount: Math.round(value.amount * 100) / 100,
    count: value.count,
    share: totalAmount ? Math.round((value.amount / totalAmount) * 1000) / 10 : 0,
  }))

  const topCategoryMap = new Map<string, { label: string; amount: number; count: number }>()
  categoryBreakdown.forEach((item) => {
    const rootKey = item.parentKeys.length ? item.parentKeys[0] : item.key
    const rootLabel = categoryMap.get(rootKey)?.labelZh ?? rootKey
    const existing = topCategoryMap.get(rootKey)
    if (existing) {
      existing.amount += item.amount
      existing.count += item.count
    } else {
      topCategoryMap.set(rootKey, { label: rootLabel, amount: item.amount, count: item.count })
    }
  })
  const topCategories = Array.from(topCategoryMap.entries())
    .map(([key, value]) => ({
      key,
      label: value.label,
      amount: Math.round(value.amount * 100) / 100,
      count: value.count,
      share: totalAmount ? Math.round((value.amount / totalAmount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const paymentMap = new Map<number, { name: string; amount: number; count: number }>()
  entriesForTrend.forEach((entry) => {
    const amount = new Prisma.Decimal(entry.amount).toNumber()
    const name = paymentTypeMap.get(entry.paymentTypeId) ?? `支付方式 ${entry.paymentTypeId}`
    const existing = paymentMap.get(entry.paymentTypeId)
    if (existing) {
      existing.amount += amount
      existing.count += 1
    } else {
      paymentMap.set(entry.paymentTypeId, { name, amount, count: 1 })
    }
  })
  const paymentBreakdown = Array.from(paymentMap.entries())
    .map(([id, value]) => ({
      id,
      name: value.name,
      amount: Math.round(value.amount * 100) / 100,
      count: value.count,
      share: totalAmount ? Math.round((value.amount / totalAmount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const monthlyMap = new Map<string, { amount: number; count: number }>()
  entriesForTrend.forEach((entry) => {
    const amount = new Prisma.Decimal(entry.amount).toNumber()
    const date = new Date(entry.paymentDate)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const existing = monthlyMap.get(month)
    if (existing) {
      existing.amount += amount
      existing.count += 1
    } else {
      monthlyMap.set(month, { amount, count: 1 })
    }
  })
  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, value]) => ({
      month,
      amount: Math.round(value.amount * 100) / 100,
      count: value.count,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    entryCount,
    averageAmount,
    latestPaymentDate,
    topCategories,
    paymentBreakdown,
    monthlyTrend,
    categoryBreakdown,
  } satisfies FinanceInsights
}

export const createFinanceEntry = async (payload: EntryPayload, userId?: number | null) => {
  assertFinanceModels()
  const category = await assertCategoryExists(payload.categoryKey)
  const categories = await prisma.financeCategory.findMany()
  const map = buildCategoryMap(categories)
  const parentKeys = resolveParentKeys(map, payload.categoryKey)
  const handler = await assertHandlerIsChinese(payload.handlerId)

  const amount = normalizeNumber(payload.amount)
  const tva = payload.tva != null ? normalizeNumber(payload.tva) : null

  const entry = await prisma.financeEntry.create({
    data: {
      projectId: payload.projectId,
      reason: payload.reason,
      categoryKey: payload.categoryKey,
      parentKeys,
      amount: new Prisma.Decimal(amount),
      unitId: payload.unitId,
      paymentTypeId: payload.paymentTypeId,
      paymentDate: new Date(payload.paymentDate),
      tva: tva == null ? null : new Prisma.Decimal(tva),
      remark: payload.remark ?? null,
      handlerId: handler?.id ?? null,
      createdBy: userId ?? null,
    },
    include: {
      project: true,
      unit: true,
      paymentType: true,
      handler: true,
      creator: true,
      updater: true,
    },
  })

  const categoryPath = resolveParentKeys(map, category.key)
    .concat(category.key)
    .map((key) => ({
      key,
      label: map.get(key)?.labelZh ?? key,
    }))

  return {
    id: entry.id,
    sequence: entry.sequence,
    projectId: entry.projectId,
    projectName: entry.project.name,
    reason: entry.reason,
    categoryKey: entry.categoryKey,
    categoryPath,
    amount: new Prisma.Decimal(entry.amount).toNumber(),
    unitId: entry.unitId,
    unitName: entry.unit.name,
    paymentTypeId: entry.paymentTypeId,
    paymentTypeName: entry.paymentType.name,
    paymentDate: entry.paymentDate.toISOString(),
    handlerId: entry.handlerId ?? null,
    handlerName: entry.handler?.name ?? null,
    handlerUsername: entry.handler?.username ?? null,
    tva: toOptionalNumber(tva),
    remark: entry.remark,
    isDeleted: entry.isDeleted,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    createdById: entry.createdBy ?? null,
    createdByName: entry.creator?.name ?? null,
    createdByUsername: entry.creator?.username ?? null,
    updatedById: entry.updatedBy ?? null,
    updatedByName: entry.updater?.name ?? null,
    updatedByUsername: entry.updater?.username ?? null,
  } satisfies FinanceEntryDTO
}

export const updateFinanceEntry = async (id: number, payload: Partial<EntryPayload>, userId?: number | null) => {
  assertFinanceModels()
  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('记录不存在')
  }
  const categoryKey = payload.categoryKey ?? existing.categoryKey
  await assertCategoryExists(categoryKey)
  const categories = await prisma.financeCategory.findMany()
  const map = buildCategoryMap(categories)
  const parentKeys = resolveParentKeys(map, categoryKey)
  const handler = await assertHandlerIsChinese(payload.handlerId ?? existing.handlerId ?? undefined)

  const amount =
    payload.amount != null ? normalizeNumber(payload.amount) : new Prisma.Decimal(existing.amount).toNumber()
  const tva =
    payload.tva === undefined ? existing.tva : payload.tva == null ? null : normalizeNumber(payload.tva)

  const entry = await prisma.financeEntry.update({
    where: { id },
    data: {
      projectId: payload.projectId ?? existing.projectId,
      reason: payload.reason ?? existing.reason,
      categoryKey,
      parentKeys,
      amount: new Prisma.Decimal(amount),
      unitId: payload.unitId ?? existing.unitId,
      paymentTypeId: payload.paymentTypeId ?? existing.paymentTypeId,
      paymentDate: payload.paymentDate ? new Date(payload.paymentDate) : existing.paymentDate,
      tva: tva == null ? null : new Prisma.Decimal(tva),
      remark: payload.remark ?? existing.remark,
      handlerId: handler?.id ?? null,
      updatedBy: userId ?? null,
    },
    include: {
      project: true,
      unit: true,
      paymentType: true,
      handler: true,
      creator: true,
      updater: true,
    },
  })

  const categoryPath = resolveParentKeys(map, categoryKey)
    .concat(categoryKey)
    .map((key) => ({
      key,
      label: map.get(key)?.labelZh ?? key,
    }))

  return {
    id: entry.id,
    sequence: entry.sequence,
    projectId: entry.projectId,
    projectName: entry.project.name,
    reason: entry.reason,
    categoryKey: entry.categoryKey,
    categoryPath,
    amount: new Prisma.Decimal(entry.amount).toNumber(),
    unitId: entry.unitId,
    unitName: entry.unit.name,
    paymentTypeId: entry.paymentTypeId,
    paymentTypeName: entry.paymentType.name,
    paymentDate: entry.paymentDate.toISOString(),
    handlerId: entry.handlerId ?? null,
    handlerName: entry.handler?.name ?? null,
    handlerUsername: entry.handler?.username ?? null,
    tva: toOptionalNumber(tva),
    remark: entry.remark,
    isDeleted: entry.isDeleted,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    createdById: entry.createdBy ?? null,
    createdByName: entry.creator?.name ?? null,
    createdByUsername: entry.creator?.username ?? null,
    updatedById: entry.updatedBy ?? null,
    updatedByName: entry.updater?.name ?? null,
    updatedByUsername: entry.updater?.username ?? null,
  } satisfies FinanceEntryDTO
}

export const softDeleteFinanceEntry = async (id: number, userId?: number | null) => {
  assertFinanceModels()
  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('记录不存在')
  }
  const entry = await prisma.financeEntry.update({
    where: { id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId ?? null,
    },
    include: {
      project: true,
      unit: true,
      paymentType: true,
    },
  })
  return entry
}

export const upsertProject = async (id: number | null, payload: MasterDataPayload) => {
  assertFinanceModels()
  const data = {
    name: payload.name,
    code: payload.code ?? null,
    isActive: payload.isActive ?? true,
  }
  const project = id
    ? await prisma.project.update({ where: { id }, data })
    : await prisma.project.create({ data })
  return project
}

export const upsertFinanceUnit = async (id: number | null, payload: MasterDataPayload) => {
  assertFinanceModels()
  const data = {
    name: payload.name,
    symbol: payload.symbol ?? null,
    isActive: payload.isActive ?? true,
    sortOrder: payload.sortOrder ?? 0,
  }
  const unit = id
    ? await prisma.financeUnit.update({ where: { id }, data })
    : await prisma.financeUnit.create({ data })
  return unit
}

export const upsertPaymentType = async (id: number | null, payload: MasterDataPayload) => {
  assertFinanceModels()
  const data = {
    name: payload.name,
    isActive: payload.isActive ?? true,
    sortOrder: payload.sortOrder ?? 0,
  }
  const paymentType = id
    ? await prisma.paymentType.update({ where: { id }, data })
    : await prisma.paymentType.create({ data })
  return paymentType
}

export const upsertFinanceCategory = async (payload: {
  key: string
  parentKey?: string | null
  labelZh: string
  labelEn?: string | null
  labelFr?: string | null
  code?: string | null
  sortOrder?: number
  isActive?: boolean
}) => {
  assertFinanceModels()
  if (payload.parentKey) {
    const parent = await prisma.financeCategory.findUnique({ where: { key: payload.parentKey } })
    if (!parent) {
      throw new Error('父级分类不存在')
    }
  }

  const category = await prisma.financeCategory.upsert({
    where: { key: payload.key },
    update: {
      parentKey: payload.parentKey ?? null,
      labelZh: payload.labelZh,
      labelEn: payload.labelEn ?? null,
      labelFr: payload.labelFr ?? null,
      code: payload.code ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
    },
    create: {
      key: payload.key,
      parentKey: payload.parentKey ?? null,
      labelZh: payload.labelZh,
      labelEn: payload.labelEn ?? null,
      labelFr: payload.labelFr ?? null,
      code: payload.code ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
    },
  })
  return category
}

export const deactivateFinanceCategory = async (key: string) => {
  assertFinanceModels()
  return prisma.financeCategory.update({
    where: { key },
    data: { isActive: false },
  })
}
