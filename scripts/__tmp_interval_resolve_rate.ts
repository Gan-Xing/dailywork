import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import type { IntervalSide, LevelCrossingSide } from '@prisma/client'

const normalizeRange = (start: number, end: number) => {
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  return safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
}

const isIntervalSideCompatible = (intervalSide: IntervalSide, targetSide: IntervalSide) => {
  if (intervalSide === targetSide) return true
  return intervalSide === 'BOTH' && (targetSide === 'LEFT' || targetSide === 'RIGHT')
}

async function main() {
  const rows = await prisma.inspectionEntry.findMany({
    where: {
      intervalId: null,
      phase: { measure: 'LINEAR' },
    },
    select: {
      id: true,
      phaseId: true,
      roadId: true,
      side: true,
      startPk: true,
      endPk: true,
      locationRoadId: true,
      levelCrossingSide: true,
      phase: {
        select: {
          roadId: true,
          intervals: {
            select: {
              id: true,
              startPk: true,
              endPk: true,
              side: true,
              locationRoadId: true,
              levelCrossingSide: true,
            },
          },
        },
      },
    },
  })

  let resolvable = 0
  let ambiguous = 0
  let none = 0

  for (const row of rows) {
    const [targetStart, targetEnd] = normalizeRange(row.startPk, row.endPk)
    const locationRoadId = row.locationRoadId ?? row.roadId
    const candidates = row.phase.intervals.filter((interval) => {
      const [s, e] = normalizeRange(interval.startPk, interval.endPk)
      if (s !== targetStart || e !== targetEnd) return false
      if (!isIntervalSideCompatible(interval.side, row.side)) return false
      const intervalLocationRoadId = interval.locationRoadId ?? row.phase.roadId
      if ((intervalLocationRoadId ?? null) !== (locationRoadId ?? null)) return false
      if ((interval.levelCrossingSide ?? null) !== (row.levelCrossingSide ?? null)) return false
      return true
    })

    let picked = 0
    if (candidates.length === 1) {
      picked = candidates[0].id
    } else if (candidates.length > 1) {
      const exact = candidates.filter((c) => c.side === row.side)
      if (exact.length === 1) picked = exact[0].id
    }

    if (picked > 0) resolvable += 1
    else if (candidates.length > 0) ambiguous += 1
    else none += 1
  }

  console.log(
    JSON.stringify(
      {
        total: rows.length,
        resolvable,
        ambiguous,
        none,
        resolveRatio: rows.length ? resolvable / rows.length : 0,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
