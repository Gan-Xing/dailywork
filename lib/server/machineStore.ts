import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
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

export async function listMachineAssets(): Promise<MachineAssetDTO[]> {
  assertMachineModels()
  const machines = await prisma.machineAsset.findMany({
    orderBy: [{ assetNumber: 'asc' }, { id: 'asc' }],
  })
  const ledgerTimeZone = resolveLedgerTimeZone()
  const monthFormatter = buildMonthFormatter(ledgerTimeZone)
  const nowKey = monthKeyInFormatter(new Date(), monthFormatter)

  return machines.map((machine) => {
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

    return {
      ...depreciation,
      id: machine.id,
      assetCategoryName: machine.assetCategoryName,
      assetNumber: machine.assetNumber,
      manufacturer: machine.manufacturer,
      assetName: machine.assetName,
      assetStatusName: machine.assetStatusName,
      specModel: machine.specModel,
      registrationDate: toOptionalDateISOString(machine.registrationDate),
      originalValue,
      usedMonths: machine.usedMonths,
      currentValue,
      usageStatus: machine.usageStatus,
      alias: machine.alias,
      plateNumber: machine.plateNumber,
      photoLinks: machine.photoLinks ?? [],
      meta: machine.meta ?? undefined,
      createdAt: machine.createdAt.toISOString(),
      updatedAt: machine.updatedAt.toISOString(),
    }
  })
}

type UpsertResult = { created: number; updated: number }

const normalizeString = (value: unknown) => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  return text.length ? text : null
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
