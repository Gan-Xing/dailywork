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
  tva?: number
  remark?: string | null
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

type EntryPayload = {
  projectId: number
  reason: string
  categoryKey: string
  amount: number
  unitId: number
  paymentTypeId: number
  paymentDate: string
  tva?: number | null
  remark?: string | null
}

type MasterDataPayload = {
  name: string
  code?: string | null
  symbol?: string | null
  isActive?: boolean
  sortOrder?: number
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
  await prisma.$transaction(
    [
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
    ],
    { timeout: 15000 },
  )
}

export const ensureFinanceCategories = async () => {
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
  await ensureFinanceDefaults()
  await ensureFinanceCategories()

  const [projects, units, paymentTypes, categories] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }] }),
    prisma.financeUnit.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    prisma.paymentType.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] }),
    prisma.financeCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }] }),
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
  }
}

export const listFinanceEntries = async (options: { projectId?: number; includeDeleted?: boolean }) => {
  const where: Prisma.FinanceEntryWhereInput = {
    projectId: options.projectId,
    isDeleted: options.includeDeleted ? undefined : false,
  }

  const [entries, categories] = await Promise.all([
    prisma.financeEntry.findMany({
      where,
      orderBy: [{ paymentDate: 'desc' }, { id: 'desc' }],
      include: {
        project: true,
        unit: true,
        paymentType: true,
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

  return entries.map<FinanceEntryDTO>((entry) => ({
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
    tva: toNumber(entry.tva),
    remark: entry.remark,
    isDeleted: entry.isDeleted,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  }))
}

const assertCategoryExists = async (categoryKey: string) => {
  const cat = await prisma.financeCategory.findUnique({ where: { key: categoryKey } })
  if (!cat || !cat.isActive) {
    throw new Error('分类不存在或已停用')
  }
  return cat
}

const normalizeNumber = (value: number | string | null | undefined) => {
  const num = Number(value)
  if (!Number.isFinite(num)) {
    throw new Error('金额/税费必须为数字')
  }
  return num
}

export const createFinanceEntry = async (payload: EntryPayload, userId?: number | null) => {
  const category = await assertCategoryExists(payload.categoryKey)
  const categories = await prisma.financeCategory.findMany()
  const map = buildCategoryMap(categories)
  const parentKeys = resolveParentKeys(map, payload.categoryKey)

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
      createdBy: userId ?? null,
    },
    include: {
      project: true,
      unit: true,
      paymentType: true,
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
    tva: tva == null ? undefined : tva,
    remark: entry.remark,
    isDeleted: entry.isDeleted,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  } satisfies FinanceEntryDTO
}

export const updateFinanceEntry = async (id: number, payload: Partial<EntryPayload>) => {
  const existing = await prisma.financeEntry.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('记录不存在')
  }
  const categoryKey = payload.categoryKey ?? existing.categoryKey
  await assertCategoryExists(categoryKey)
  const categories = await prisma.financeCategory.findMany()
  const map = buildCategoryMap(categories)
  const parentKeys = resolveParentKeys(map, categoryKey)

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
    },
    include: {
      project: true,
      unit: true,
      paymentType: true,
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
    tva: tva == null ? undefined : tva,
    remark: entry.remark,
    isDeleted: entry.isDeleted,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  } satisfies FinanceEntryDTO
}

export const softDeleteFinanceEntry = async (id: number, userId?: number | null) => {
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
  return prisma.financeCategory.update({
    where: { key },
    data: { isActive: false },
  })
}
