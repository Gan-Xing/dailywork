import { Prisma, type MachineAsset as PrismaMachineAsset } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { parseMachineEquipmentTypeKey } from '@/lib/resources/machines/equipmentTypes'
import type { MachineAsset, MachineImportRow } from '@/types/machines'

export type MachineAssetDTO = MachineAsset

const assertMachineModels = () => {
  const client = prisma as unknown as Record<string, unknown>
  if (!client.machineAsset) {
    throw new Error('Prisma Client 未包含机械台账模型，请先执行 `prisma migrate deploy && prisma generate`')
  }
}

const toNumber = (value: Prisma.Decimal | number | null): number | null => {
  if (value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  return new Prisma.Decimal(value).toNumber()
}

const toOptionalDateISOString = (value: Date | null) => (value ? value.toISOString() : null)

const MACHINE_PHOTO_ENTITY_TYPE = 'machine-asset'
const MACHINE_PHOTO_CATEGORY = 'machine-photo'

const listUploadedPhotoCounts = async (machineIds: number[]) => {
  const uniqueIds = Array.from(
    new Set(machineIds.filter((id) => Number.isFinite(id) && id > 0).map((id) => Math.round(id))),
  )
  if (uniqueIds.length === 0) return new Map<number, number>()

  const grouped = await prisma.fileAssetLink.groupBy({
    by: ['entityId'],
    where: {
      entityType: MACHINE_PHOTO_ENTITY_TYPE,
      entityId: { in: uniqueIds.map(String) },
      file: { category: MACHINE_PHOTO_CATEGORY },
    },
    _count: { _all: true },
  })

  const map = new Map<number, number>()
  grouped.forEach((row) => {
    const id = Number(row.entityId)
    if (!Number.isFinite(id) || id <= 0) return
    map.set(id, row._count._all)
  })
  return map
}

const getUploadedPhotoCount = async (machineId: number) => {
  if (!Number.isFinite(machineId) || machineId <= 0) return 0
  return prisma.fileAssetLink.count({
    where: {
      entityType: MACHINE_PHOTO_ENTITY_TYPE,
      entityId: String(machineId),
      file: { category: MACHINE_PHOTO_CATEGORY },
    },
  })
}

// Ledger month boundary should follow a specific business timezone (not server locale).
// Defaulting to Cote d'Ivoire time (UTC+0, no DST).
const DEFAULT_LEDGER_TIMEZONE = 'Africa/Abidjan'

const resolveLedgerTimeZone = () => {
  const raw = process.env.DW_LEDGER_TIMEZONE?.trim()
  if (!raw) return DEFAULT_LEDGER_TIMEZONE
  const normalized = raw.toLowerCase()
  if (normalized === 'london') return 'Europe/London'
  if (normalized === 'abidjan') return 'Africa/Abidjan'
  if (normalized.includes("cote") || normalized.includes('ivoire') || normalized.includes('ivory')) {
    return 'Africa/Abidjan'
  }
  return raw
}

const monthKeyUtc = (date: Date) => date.getUTCFullYear() * 12 + date.getUTCMonth()

const buildMonthFormatter = (timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
    })
  } catch (error) {
    console.warn(
      `Invalid DW_LEDGER_TIMEZONE "${timeZone}", falling back to ${DEFAULT_LEDGER_TIMEZONE}.`,
      error,
    )
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: DEFAULT_LEDGER_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
    })
  }
}

const monthKeyInFormatter = (date: Date, formatter: Intl.DateTimeFormat) => {
  try {
    const parts = formatter.formatToParts(date)
    const yearPart = parts.find((part) => part.type === 'year')?.value
    const monthPart = parts.find((part) => part.type === 'month')?.value
    const year = yearPart ? Number(yearPart) : Number.NaN
    const month = monthPart ? Number(monthPart) : Number.NaN
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return monthKeyUtc(date)
    }
    return year * 12 + (month - 1)
  } catch {
    return monthKeyUtc(date)
  }
}

const roundMoney = (value: number) => Math.round(value * 100) / 100

const computeDepreciation = ({
  nowKey,
  registrationMonthKey,
  usedMonths,
  fallbackDepreciatedMonths,
  fallbackRemainingMonths,
}: {
  nowKey: number
  registrationMonthKey: number | null
  usedMonths: number | null
  fallbackDepreciatedMonths: number | null
  fallbackRemainingMonths: number | null
}) => {
  if (registrationMonthKey == null) {
    return {
      depreciatedMonths: fallbackDepreciatedMonths,
      remainingMonths: fallbackRemainingMonths,
    }
  }

  const diff = nowKey - registrationMonthKey
  const rawDepreciated = Math.max(0, diff)

  const safeUsedMonths =
    usedMonths == null || !Number.isFinite(usedMonths) ? null : Math.max(0, Math.round(usedMonths))
  const cappedDepreciated =
    safeUsedMonths == null ? rawDepreciated : Math.min(rawDepreciated, safeUsedMonths)
  const remaining =
    safeUsedMonths == null ? null : Math.max(0, safeUsedMonths - cappedDepreciated)

  return { depreciatedMonths: cappedDepreciated, remainingMonths: remaining }
}

const buildLedgerContext = () => {
  const ledgerTimeZone = resolveLedgerTimeZone()
  const monthFormatter = buildMonthFormatter(ledgerTimeZone)
  const nowKey = monthKeyInFormatter(new Date(), monthFormatter)
  return { monthFormatter, nowKey }
}

const mapMachineAssetRecord = (
  machine: PrismaMachineAsset,
  {
    monthFormatter,
    nowKey,
    uploadedPhotoCountById,
  }: {
    monthFormatter: Intl.DateTimeFormat
    nowKey: number
    uploadedPhotoCountById: Map<number, number>
  },
): MachineAssetDTO => {
  const originalValue = toNumber(machine.originalValue)
  const fallbackCurrentValue = toNumber(machine.currentValue)
  const registrationMonthKey = machine.registrationDate
    ? monthKeyInFormatter(machine.registrationDate, monthFormatter)
    : null
  const depreciation = computeDepreciation({
    nowKey,
    registrationMonthKey,
    usedMonths: machine.usedMonths,
    fallbackDepreciatedMonths: machine.depreciatedMonths,
    fallbackRemainingMonths: machine.remainingMonths,
  })

  const safeUsedMonths =
    machine.usedMonths == null || !Number.isFinite(machine.usedMonths)
      ? null
      : Math.max(0, Math.round(machine.usedMonths))
  const currentValue =
    originalValue != null &&
    safeUsedMonths != null &&
    safeUsedMonths > 0 &&
    depreciation.remainingMonths != null
      ? roundMoney((originalValue * depreciation.remainingMonths) / safeUsedMonths)
      : fallbackCurrentValue

  const photoLinks = machine.photoLinks ?? []
  const uploadedPhotoCount = uploadedPhotoCountById.get(machine.id) ?? 0
  const photoCount = uploadedPhotoCount + photoLinks.length

  return {
    ...depreciation,
    id: machine.id,
    assetCategoryName: machine.assetCategoryName,
    assetNumber: machine.assetNumber,
    manufacturer: machine.manufacturer,
    assetName: machine.assetName,
    assetStatusName: machine.assetStatusName,
    specModel: machine.specModel,
    equipmentTypeKey: machine.equipmentTypeKey ?? null,
    registrationDate: toOptionalDateISOString(machine.registrationDate),
    originalValue,
    usedMonths: machine.usedMonths,
    currentValue,
    usageStatus: machine.usageStatus,
    alias: machine.alias,
    plateNumber: machine.plateNumber,
    photoLinks,
    uploadedPhotoCount,
    photoCount,
    meta: machine.meta ?? undefined,
    createdAt: machine.createdAt.toISOString(),
    updatedAt: machine.updatedAt.toISOString(),
  }
}

export async function listMachineAssets(): Promise<MachineAssetDTO[]> {
  assertMachineModels()
  const machines = await prisma.machineAsset.findMany({
    orderBy: [{ assetNumber: 'asc' }, { id: 'asc' }],
  })
  const ctx = buildLedgerContext()
  const uploadedPhotoCountById = await listUploadedPhotoCounts(machines.map((machine) => machine.id))
  return machines.map((machine) =>
    mapMachineAssetRecord(machine, { ...ctx, uploadedPhotoCountById }),
  )
}

type UpsertResult = { created: number; updated: number }

const normalizeString = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  return text.length ? text : null
}

const normalizeEquipmentTypeKey = (value: unknown, { strict }: { strict: boolean }) => {
  const raw = normalizeString(value)
  if (!raw) return null
  const parsed = parseMachineEquipmentTypeKey(raw)
  if (parsed) return parsed
  if (strict) {
    throw new Error('设备类型无效（请从下拉中选择）')
  }
  return null
}

const normalizeStringList = (value: unknown): string[] | null => {
  if (value == null) return null
  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeString(item)).filter(Boolean) as string[]
    return items.length ? items : null
  }
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return null
    const items = text
      .split(/[\/,，;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean)
    return items.length ? items : null
  }
  const text = String(value ?? '').trim()
  return text ? [text] : null
}

const normalizeNumber = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value).trim().replace(/,/g, '')
  if (!text) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeInteger = (value: unknown) => {
  const number = normalizeNumber(value)
  if (number === null) return null
  return Math.round(number)
}

const normalizeDate = (value: unknown) => {
  if (value === null || value === undefined) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return null
}

export async function upsertMachineAssets(
  rows: MachineImportRow[],
  {
    ignoreBlanks = true,
    updatedById,
  }: { ignoreBlanks?: boolean; updatedById?: number | null },
): Promise<UpsertResult> {
  assertMachineModels()

  const sanitized = rows
    .map((row) => {
      const assetNumber = normalizeString(row.assetNumber)
      if (!assetNumber) return null
      const hasUsageStatus = Object.prototype.hasOwnProperty.call(row, 'usageStatus')
      const hasAlias = Object.prototype.hasOwnProperty.call(row, 'alias')
      const hasPlateNumber = Object.prototype.hasOwnProperty.call(row, 'plateNumber')
      const hasEquipmentTypeKey = Object.prototype.hasOwnProperty.call(row, 'equipmentTypeKey')
      const hasPhotoLinks = Object.prototype.hasOwnProperty.call(row, 'photoLinks')
      const hasCurrentValue = Object.prototype.hasOwnProperty.call(row, 'currentValue')
      const hasDepreciatedMonths = Object.prototype.hasOwnProperty.call(row, 'depreciatedMonths')
      const hasRemainingMonths = Object.prototype.hasOwnProperty.call(row, 'remainingMonths')
      return {
        assetNumber,
        assetCategoryName: normalizeString(row.assetCategoryName),
        manufacturer: normalizeString(row.manufacturer),
        assetName: normalizeString(row.assetName),
        assetStatusName: normalizeString(row.assetStatusName),
        specModel: normalizeString(row.specModel),
        equipmentTypeKey: hasEquipmentTypeKey ? normalizeEquipmentTypeKey(row.equipmentTypeKey, { strict: false }) : undefined,
        registrationDate: normalizeDate(row.registrationDate),
        originalValue: normalizeNumber(row.originalValue),
        usedMonths: normalizeInteger(row.usedMonths),
        currentValue: hasCurrentValue ? normalizeNumber(row.currentValue) : undefined,
        depreciatedMonths: hasDepreciatedMonths ? normalizeInteger(row.depreciatedMonths) : undefined,
        remainingMonths: hasRemainingMonths ? normalizeInteger(row.remainingMonths) : undefined,
        usageStatus: hasUsageStatus ? normalizeString(row.usageStatus) : undefined,
        alias: hasAlias ? normalizeString(row.alias) : undefined,
        plateNumber: hasPlateNumber ? normalizeString(row.plateNumber) : undefined,
        photoLinks: hasPhotoLinks ? normalizeStringList(row.photoLinks) : undefined,
      }
    })
    .filter(Boolean) as Array<{
    assetNumber: string
    assetCategoryName: string | null
    manufacturer: string | null
    assetName: string | null
    assetStatusName: string | null
    specModel: string | null
    equipmentTypeKey: string | null | undefined
    registrationDate: Date | null
    originalValue: number | null
    usedMonths: number | null
    currentValue: number | null | undefined
    depreciatedMonths: number | null | undefined
    remainingMonths: number | null | undefined
    usageStatus: string | null | undefined
    alias: string | null | undefined
    plateNumber: string | null | undefined
    photoLinks: string[] | null | undefined
  }>

  if (sanitized.length === 0) return { created: 0, updated: 0 }

  const BATCH_SIZE = 25
  const batches: Array<typeof sanitized> = []
  for (let i = 0; i < sanitized.length; i += BATCH_SIZE) {
    batches.push(sanitized.slice(i, i + BATCH_SIZE))
  }

  let created = 0
  let updated = 0

  for (const batch of batches) {
    const operations = batch.map((item) => {
      const createData: Prisma.MachineAssetUncheckedCreateInput = {
        assetNumber: item.assetNumber,
        assetCategoryName: item.assetCategoryName,
        manufacturer: item.manufacturer,
        assetName: item.assetName,
        assetStatusName: item.assetStatusName,
        specModel: item.specModel,
        equipmentTypeKey: item.equipmentTypeKey ?? null,
        registrationDate: item.registrationDate,
        originalValue: item.originalValue == null ? null : new Prisma.Decimal(item.originalValue),
        usedMonths: item.usedMonths,
        currentValue: item.currentValue == null ? null : new Prisma.Decimal(item.currentValue),
        depreciatedMonths: item.depreciatedMonths ?? null,
        remainingMonths: item.remainingMonths ?? null,
        usageStatus: item.usageStatus ?? null,
        alias: item.alias ?? null,
        plateNumber: item.plateNumber ?? null,
        photoLinks: item.photoLinks ?? [],
        updatedById: updatedById ?? null,
        createdById: updatedById ?? null,
      }

      const updateData: Prisma.MachineAssetUncheckedUpdateInput = {
        updatedById: updatedById ?? null,
      }
      const assign = <K extends keyof Prisma.MachineAssetUncheckedUpdateInput>(
        key: K,
        value: Prisma.MachineAssetUncheckedUpdateInput[K],
      ) => {
        if (value === undefined) return
        if (!ignoreBlanks || value !== null) {
          updateData[key] = value
        }
      }

      assign('assetCategoryName', item.assetCategoryName)
      assign('manufacturer', item.manufacturer)
      assign('assetName', item.assetName)
      assign('assetStatusName', item.assetStatusName)
      assign('specModel', item.specModel)
      assign('equipmentTypeKey', item.equipmentTypeKey === undefined ? undefined : item.equipmentTypeKey)
      assign('registrationDate', item.registrationDate)
      assign(
        'originalValue',
        item.originalValue == null ? null : new Prisma.Decimal(item.originalValue),
      )
      assign('usedMonths', item.usedMonths)
      assign(
        'currentValue',
        item.currentValue === undefined
          ? undefined
          : item.currentValue == null
            ? null
            : new Prisma.Decimal(item.currentValue),
      )
      assign(
        'depreciatedMonths',
        item.depreciatedMonths === undefined ? undefined : item.depreciatedMonths,
      )
      assign(
        'remainingMonths',
        item.remainingMonths === undefined ? undefined : item.remainingMonths,
      )
      assign('usageStatus', item.usageStatus)
      assign('alias', item.alias)
      assign('plateNumber', item.plateNumber)
      if (item.photoLinks !== undefined) {
        if (!ignoreBlanks) {
          // photoLinks is a scalar list (non-null). When blanks are allowed to override, clear to [].
          updateData.photoLinks = item.photoLinks ?? []
        } else if (item.photoLinks) {
          updateData.photoLinks = item.photoLinks
        }
      }

      return prisma.machineAsset.upsert({
        where: { assetNumber: item.assetNumber },
        create: createData,
        update: updateData,
        select: { createdAt: true, updatedAt: true },
      })
    })

    const results = await prisma.$transaction(operations)
    results.forEach((record) => {
      if (record.createdAt.getTime() === record.updatedAt.getTime()) {
        created += 1
      } else {
        updated += 1
      }
    })
  }

  return { created, updated }
}

const hasOwn = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key)

export type MachineAssetCreatePayload = {
  assetNumber?: unknown
  assetCategoryName?: unknown
  manufacturer?: unknown
  assetName?: unknown
  assetStatusName?: unknown
  specModel?: unknown
  equipmentTypeKey?: unknown
  registrationDate?: unknown
  originalValue?: unknown
  usedMonths?: unknown
  usageStatus?: unknown
  alias?: unknown
  plateNumber?: unknown
}

export async function createMachineAsset(
  payload: MachineAssetCreatePayload,
  { createdById }: { createdById?: number | null },
): Promise<MachineAssetDTO> {
  assertMachineModels()

  const assetNumber = normalizeString(payload.assetNumber)
  if (!assetNumber) {
    throw new Error('资产编号不能为空')
  }

  const data: Prisma.MachineAssetUncheckedCreateInput = {
    assetNumber,
    assetCategoryName: normalizeString(payload.assetCategoryName),
    manufacturer: normalizeString(payload.manufacturer),
    assetName: normalizeString(payload.assetName),
    assetStatusName: normalizeString(payload.assetStatusName),
    specModel: normalizeString(payload.specModel),
    equipmentTypeKey: normalizeEquipmentTypeKey(payload.equipmentTypeKey, { strict: true }),
    registrationDate: normalizeDate(payload.registrationDate),
    originalValue:
      normalizeNumber(payload.originalValue) == null
        ? null
        : new Prisma.Decimal(normalizeNumber(payload.originalValue) as number),
    usedMonths: normalizeInteger(payload.usedMonths),
    usageStatus: normalizeString(payload.usageStatus),
    alias: normalizeString(payload.alias),
    plateNumber: normalizeString(payload.plateNumber),
    photoLinks: [],
    createdById: createdById ?? null,
    updatedById: createdById ?? null,
  }

  try {
    const created = await prisma.machineAsset.create({ data })
    const ctx = buildLedgerContext()
    const uploadedPhotoCountById = new Map<number, number>()
    uploadedPhotoCountById.set(created.id, 0)
    return mapMachineAssetRecord(created, { ...ctx, uploadedPhotoCountById })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new Error('资产编号已存在')
    }
    throw error
  }
}

export type MachineAssetUpdatePayload = {
  assetNumber?: unknown
  assetCategoryName?: unknown
  manufacturer?: unknown
  assetName?: unknown
  assetStatusName?: unknown
  specModel?: unknown
  equipmentTypeKey?: unknown
  registrationDate?: unknown
  originalValue?: unknown
  usedMonths?: unknown
  currentValue?: unknown
  depreciatedMonths?: unknown
  remainingMonths?: unknown
  usageStatus?: unknown
  alias?: unknown
  plateNumber?: unknown
}

export async function updateMachineAsset(
  machineId: number,
  payload: MachineAssetUpdatePayload,
  {
    updatedById,
    allowManageFields,
  }: { updatedById?: number | null; allowManageFields: boolean },
): Promise<MachineAssetDTO> {
  assertMachineModels()
  if (!Number.isFinite(machineId) || machineId <= 0) {
    throw new Error('机械 ID 无效')
  }

  // assetNumber is globally unique and stable. Never allow editing.
  if (hasOwn(payload as Record<string, unknown>, 'assetNumber')) {
    throw new Error('资产编号禁止修改')
  }

  // Computed finance fields should not be manually edited.
  if (
    hasOwn(payload as Record<string, unknown>, 'currentValue') ||
    hasOwn(payload as Record<string, unknown>, 'depreciatedMonths') ||
    hasOwn(payload as Record<string, unknown>, 'remainingMonths')
  ) {
    throw new Error('资产现值/已提月份/剩余月份为系统计算字段，禁止手工修改')
  }

  const data: Prisma.MachineAssetUncheckedUpdateInput = {
    updatedById: updatedById ?? null,
  }

  const assign = <K extends keyof Prisma.MachineAssetUncheckedUpdateInput>(
    key: K,
    value: Prisma.MachineAssetUncheckedUpdateInput[K],
  ) => {
    if (value === undefined) return
    data[key] = value
  }

  // machine:update: operational fields only
  if (hasOwn(payload as Record<string, unknown>, 'usageStatus')) {
    assign('usageStatus', normalizeString(payload.usageStatus))
  }
  if (hasOwn(payload as Record<string, unknown>, 'alias')) {
    assign('alias', normalizeString(payload.alias))
  }
  if (hasOwn(payload as Record<string, unknown>, 'plateNumber')) {
    assign('plateNumber', normalizeString(payload.plateNumber))
  }
  if (hasOwn(payload as Record<string, unknown>, 'equipmentTypeKey')) {
    assign('equipmentTypeKey', normalizeEquipmentTypeKey(payload.equipmentTypeKey, { strict: true }))
  }

  // machine:manage: allow base finance fields edit (still excluding computed fields + assetNumber)
  if (allowManageFields) {
    if (hasOwn(payload as Record<string, unknown>, 'assetCategoryName')) {
      assign('assetCategoryName', normalizeString(payload.assetCategoryName))
    }
    if (hasOwn(payload as Record<string, unknown>, 'manufacturer')) {
      assign('manufacturer', normalizeString(payload.manufacturer))
    }
    if (hasOwn(payload as Record<string, unknown>, 'assetName')) {
      assign('assetName', normalizeString(payload.assetName))
    }
    if (hasOwn(payload as Record<string, unknown>, 'assetStatusName')) {
      assign('assetStatusName', normalizeString(payload.assetStatusName))
    }
    if (hasOwn(payload as Record<string, unknown>, 'specModel')) {
      assign('specModel', normalizeString(payload.specModel))
    }
    if (hasOwn(payload as Record<string, unknown>, 'registrationDate')) {
      assign('registrationDate', normalizeDate(payload.registrationDate))
    }
    if (hasOwn(payload as Record<string, unknown>, 'originalValue')) {
      const parsed = normalizeNumber(payload.originalValue)
      assign('originalValue', parsed == null ? null : new Prisma.Decimal(parsed))
    }
    if (hasOwn(payload as Record<string, unknown>, 'usedMonths')) {
      assign('usedMonths', normalizeInteger(payload.usedMonths))
    }
  } else {
    const attemptedManageKeys = [
      'assetCategoryName',
      'manufacturer',
      'assetName',
      'assetStatusName',
      'specModel',
      'registrationDate',
      'originalValue',
      'usedMonths',
    ]
    const attempted = attemptedManageKeys.filter((key) => hasOwn(payload as Record<string, unknown>, key))
    if (attempted.length) {
      throw new Error('缺少权限：machine:manage')
    }
  }

  const updated = await prisma.machineAsset.update({
    where: { id: machineId },
    data,
  })

  const ctx = buildLedgerContext()
  const uploadedPhotoCountById = new Map<number, number>()
  uploadedPhotoCountById.set(machineId, await getUploadedPhotoCount(machineId))
  return mapMachineAssetRecord(updated, { ...ctx, uploadedPhotoCountById })
}
