import 'dotenv/config'
import fs from 'fs/promises'
import path from 'path'

import { PrismaClient, type IntervalSide } from '@prisma/client'

type MappingRange = {
  startPk: number
  endPk: number
  side?: IntervalSide
}

type MappingTarget = {
  locationRoadSlug?: string
  locationRoadId?: number
  ranges: MappingRange[]
}

type MappingConfig = {
  levelCrossingSlug?: string
  targets: MappingTarget[]
}

const prisma = new PrismaClient()

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out: { mappingPath?: string; apply?: boolean; includeSelf?: boolean } = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--mapping' || arg === '-m') {
      out.mappingPath = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--apply') {
      out.apply = true
      continue
    }
    if (arg === '--include-level-crossing') {
      out.includeSelf = true
      continue
    }
  }
  return out
}

const normalizeRange = (startPk: number, endPk: number) => {
  const safeStart = Number.isFinite(startPk) ? startPk : 0
  const safeEnd = Number.isFinite(endPk) ? endPk : safeStart
  return safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
}

const formatRange = (startPk: number, endPk: number, side?: IntervalSide) => {
  const [start, end] = normalizeRange(startPk, endPk)
  return `${start} -> ${end}${side ? ` (${side})` : ''}`
}

const main = async () => {
  const { mappingPath, apply, includeSelf } = parseArgs()
  if (!mappingPath) {
    throw new Error('请提供 --mapping <path> 指向 JSON 映射文件')
  }
  const absolutePath = path.isAbsolute(mappingPath)
    ? mappingPath
    : path.join(process.cwd(), mappingPath)
  const raw = await fs.readFile(absolutePath, 'utf-8')
  const config = JSON.parse(raw) as MappingConfig
  if (!config || !Array.isArray(config.targets)) {
    throw new Error('映射文件格式不正确：必须包含 targets 数组')
  }

  const levelCrossingSlug = config.levelCrossingSlug ?? 'level-crossing'
  const levelCrossing = await prisma.roadSection.findUnique({
    where: { slug: levelCrossingSlug },
    select: { id: true, slug: true, name: true },
  })
  if (!levelCrossing) {
    throw new Error(`未找到平交路口路段：slug=${levelCrossingSlug}`)
  }

  let totalIntervals = 0
  let totalEntries = 0
  const logs: string[] = []

  for (const target of config.targets) {
    const locationRoadId =
      typeof target.locationRoadId === 'number'
        ? target.locationRoadId
        : target.locationRoadSlug
          ? (
              await prisma.roadSection.findUnique({
                where: { slug: target.locationRoadSlug },
                select: { id: true },
              })
            )?.id
          : undefined

    if (!locationRoadId) {
      throw new Error(
        `映射项缺少 locationRoadId 或 locationRoadSlug：${JSON.stringify(target)}`,
      )
    }
    if (locationRoadId === levelCrossing.id) {
      throw new Error('locationRoadId 不能与平交路口本身相同')
    }

    for (const range of target.ranges ?? []) {
      const [startPk, endPk] = normalizeRange(range.startPk, range.endPk)
      const side = range.side

      const locationFilter = includeSelf
        ? { OR: [{ locationRoadId: null }, { locationRoadId: levelCrossing.id }] }
        : { locationRoadId: null }

      const intervalWhere = {
        phase: { roadId: levelCrossing.id },
        ...locationFilter,
        AND: [
          {
            OR: [
              { startPk, endPk },
              { startPk: endPk, endPk: startPk },
            ],
            ...(side ? { side } : {}),
          },
        ],
      }
      const entryWhere = {
        roadId: levelCrossing.id,
        ...locationFilter,
        AND: [
          {
            OR: [
              { startPk, endPk },
              { startPk: endPk, endPk: startPk },
            ],
            ...(side ? { side } : {}),
          },
        ],
      }

      const intervalCount = await prisma.phaseInterval.count({ where: intervalWhere })
      const entryCount = await prisma.inspectionEntry.count({ where: entryWhere })
      logs.push(
        `路段 ${locationRoadId} | 区间 ${formatRange(startPk, endPk, side)} -> 区间 ${intervalCount} 条 / 报检 ${entryCount} 条`,
      )

      if (apply && (intervalCount > 0 || entryCount > 0)) {
        const [intervalResult, entryResult] = await prisma.$transaction([
          prisma.phaseInterval.updateMany({
            where: intervalWhere,
            data: { locationRoadId },
          }),
          prisma.inspectionEntry.updateMany({
            where: entryWhere,
            data: { locationRoadId },
          }),
        ])
        totalIntervals += intervalResult.count
        totalEntries += entryResult.count
      } else if (!apply) {
        totalIntervals += intervalCount
        totalEntries += entryCount
      }
    }
  }

  logs.forEach((line) => console.log(line))
  if (apply) {
    console.log(`\n已更新：区间 ${totalIntervals} 条，报检 ${totalEntries} 条`)
  } else {
    console.log(`\n（预览）将更新：区间 ${totalIntervals} 条，报检 ${totalEntries} 条`)
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
