import { Prisma } from '@prisma/client'

import { normalizeText } from '@/lib/members/utils'
import { prisma } from '@/lib/prisma'
import type { FuelSourceDailyPageData, FuelSourceDailyRow, FuelSource } from '@/types/machineLogs'
import { parseDateKey } from '@/lib/server/machineLogsStore'

const assertModels = () => {
  const client = prisma as unknown as Record<string, unknown>
  if (!client.fuelSource || !client.fuelSourceDailyLog || !client.machineFuelEvent || !client.machineDailyLog) {
    throw new Error('Prisma Client 未包含油料来源模型，请先执行 `prisma migrate deploy && prisma generate`')
  }
}

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const toNumber = (value: Prisma.Decimal | number | null): number | null => {
  if (value === null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  return new Prisma.Decimal(value).toNumber()
}

const round2 = (value: number) => Math.round(value * 100) / 100

const toMoney = (value: number | null) => (value == null ? null : round2(value))

const listFuelSources = async ({ includeIds }: { includeIds?: number[] } = {}): Promise<FuelSource[]> => {
  const ids = Array.from(
    new Set((includeIds ?? []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)),
  )
  const where = ids.length
    ? { OR: [{ isActive: true }, { id: { in: ids } }] }
    : { isActive: true }

  const sources = await prisma.fuelSource.findMany({
    where,
    orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
    include: {
      machine: {
        select: {
          id: true,
          assetNumber: true,
          assetName: true,
          alias: true,
          plateNumber: true,
        },
      },
    },
  })

  return sources.map((source) => ({
    id: source.id,
    type: source.type,
    code: source.code,
    name: source.name,
    machineId: source.machineId ?? null,
    isActive: source.isActive,
    machine: source.machine
      ? {
          id: source.machine.id,
          assetNumber: source.machine.assetNumber,
          assetName: source.machine.assetName,
          alias: source.machine.alias,
          plateNumber: source.machine.plateNumber,
        }
      : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  }))
}

export async function getFuelSourceDailyPageData(dateKey: string): Promise<FuelSourceDailyPageData> {
  assertModels()

  const start = parseDateKey(dateKey)
  const end = addUtcDays(start, 1)
  const prevStart = addUtcDays(start, -1)
  const prevEnd = start

  const [logs, prevLogs, dispensedRows] = await Promise.all([
    prisma.fuelSourceDailyLog.findMany({
      where: { logDate: { gte: start, lt: end } },
      select: { fuelSourceId: true, received: true, remainingEnd: true },
    }),
    prisma.fuelSourceDailyLog.findMany({
      where: { logDate: { gte: prevStart, lt: prevEnd } },
      select: { fuelSourceId: true, remainingEnd: true },
    }),
    prisma.machineFuelEvent.groupBy({
      by: ['fuelSourceId'],
      where: { dailyLog: { logDate: { gte: start, lt: end } } },
      _sum: { amount: true },
    }),
  ])

  const referencedSourceIds = Array.from(
    new Set([
      ...logs.map((log) => log.fuelSourceId),
      ...prevLogs.map((log) => log.fuelSourceId),
      ...dispensedRows.map((row) => row.fuelSourceId),
    ]),
  )
  const sources = await listFuelSources({ includeIds: referencedSourceIds })

  const dailyMap = new Map(
    logs.map((log) => [
      log.fuelSourceId,
      {
        received: toMoney(toNumber(log.received)),
        remainingEnd: toMoney(toNumber(log.remainingEnd)),
      },
    ]),
  )

  const prevMap = new Map(
    prevLogs.map((log) => [log.fuelSourceId, toMoney(toNumber(log.remainingEnd))]),
  )

  const dispensedMap = new Map(
    dispensedRows.map((row) => [row.fuelSourceId, toMoney(toNumber(row._sum.amount)) ?? 0]),
  )

  const rows: FuelSourceDailyRow[] = sources.map((source) => {
    const daily = dailyMap.get(source.id) ?? { received: null, remainingEnd: null }
    const prevRemainingEnd = prevMap.get(source.id) ?? null
    const dispensed = dispensedMap.get(source.id) ?? 0

    const expectedEnd =
      prevRemainingEnd == null ? null : toMoney(prevRemainingEnd + (daily.received ?? 0) - dispensed)
    const delta =
      expectedEnd == null || daily.remainingEnd == null
        ? null
        : toMoney(daily.remainingEnd - expectedEnd)

    return {
      fuelSource: source,
      received: daily.received,
      remainingEnd: daily.remainingEnd,
      prevRemainingEnd,
      dispensed,
      expectedEnd,
      delta,
    }
  })

  return { date: dateKey, rows }
}

export type SaveFuelSourceDailyLogInput = {
  date: string
  fuelSourceId: number
  received?: number | null
  remainingEnd?: number | null
  note?: string | null
}

export async function saveFuelSourceDailyLog(
  input: SaveFuelSourceDailyLogInput,
  { updatedById }: { updatedById: number | null },
) {
  assertModels()

  const fuelSourceId = Number(input.fuelSourceId)
  if (!Number.isFinite(fuelSourceId) || fuelSourceId <= 0) {
    throw new Error('fuelSourceId 无效')
  }

  const start = parseDateKey(input.date)

  const received =
    input.received === undefined || input.received === null ? null : Number(input.received)
  if (received !== null && !Number.isFinite(received)) {
    throw new Error('received 无效')
  }

  const remainingEnd =
    input.remainingEnd === undefined || input.remainingEnd === null
      ? null
      : Number(input.remainingEnd)
  if (remainingEnd !== null && !Number.isFinite(remainingEnd)) {
    throw new Error('remainingEnd 无效')
  }

  const note = typeof input.note === 'string' ? normalizeText(input.note) : ''

  const source = await prisma.fuelSource.findUnique({
    where: { id: fuelSourceId },
    select: { id: true, isActive: true },
  })
  if (!source) throw new Error('加油来源不存在')
  if (!source.isActive) throw new Error('加油来源已停用')

  const record = await prisma.fuelSourceDailyLog.upsert({
    where: { fuelSourceId_logDate: { fuelSourceId, logDate: start } },
    create: {
      fuelSourceId,
      logDate: start,
      received: received == null ? null : new Prisma.Decimal(round2(received)),
      remainingEnd: remainingEnd == null ? null : new Prisma.Decimal(round2(remainingEnd)),
      note: note || null,
      createdById: updatedById ?? null,
      updatedById: updatedById ?? null,
    },
    update: {
      received: received == null ? null : new Prisma.Decimal(round2(received)),
      remainingEnd: remainingEnd == null ? null : new Prisma.Decimal(round2(remainingEnd)),
      note: note || null,
      updatedById: updatedById ?? null,
    },
    select: { id: true },
  })

  return record
}

export async function upsertTruckFuelSource(
  machineIdInput: number,
  {
    isActive = true,
    updatedById,
  }: { isActive?: boolean; updatedById: number | null },
) {
  assertModels()

  const machineId = Number(machineIdInput)
  if (!Number.isFinite(machineId) || machineId <= 0) {
    throw new Error('machineId 无效')
  }

  const machine = await prisma.machineAsset.findUnique({
    where: { id: machineId },
    select: { id: true, assetNumber: true, assetName: true, alias: true, plateNumber: true },
  })
  if (!machine) {
    throw new Error('机械不存在')
  }

  const displayName = normalizeText(machine.alias) || normalizeText(machine.assetName) || machine.assetNumber
  const code = `TRUCK:${machine.id}`

  const source = await prisma.fuelSource.upsert({
    where: { code },
    create: {
      type: 'TRUCK',
      code,
      name: displayName,
      machineId: machine.id,
      isActive,
      meta: {
        plateNumber: machine.plateNumber ?? null,
        assetNumber: machine.assetNumber,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    update: {
      type: 'TRUCK',
      name: displayName,
      machineId: machine.id,
      isActive,
      meta: {
        plateNumber: machine.plateNumber ?? null,
        assetNumber: machine.assetNumber,
      },
      updatedAt: new Date(),
    },
    include: {
      machine: {
        select: {
          id: true,
          assetNumber: true,
          assetName: true,
          alias: true,
          plateNumber: true,
        },
      },
    },
  })

  return {
    id: source.id,
    type: source.type,
    code: source.code,
    name: source.name,
    machineId: source.machineId ?? null,
    isActive: source.isActive,
    machine: source.machine
      ? {
          id: source.machine.id,
          assetNumber: source.machine.assetNumber,
          assetName: source.machine.assetName,
          alias: source.machine.alias,
          plateNumber: source.machine.plateNumber,
        }
      : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  } satisfies FuelSource
}
