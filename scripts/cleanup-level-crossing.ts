import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const parseArgs = () => {
  const args = process.argv.slice(2)
  const out: { slug?: string; apply?: boolean; deleteRoad?: boolean; backfillDefaults?: boolean } = {}
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--slug') {
      out.slug = args[i + 1]
      i += 1
      continue
    }
    if (arg === '--apply') {
      out.apply = true
      continue
    }
    if (arg === '--delete-road') {
      out.deleteRoad = true
      continue
    }
    if (arg === '--backfill-defaults') {
      out.backfillDefaults = true
      continue
    }
  }
  return out
}

const main = async () => {
  const { slug = 'level-crossing', apply, deleteRoad, backfillDefaults } = parseArgs()

  const road = await prisma.roadSection.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  })
  if (!road) {
    throw new Error(`未找到路段：${slug}`)
  }

  const [phaseCount, intervalCount, inputCount, entryCount, requestCount] = await prisma.$transaction([
    prisma.roadPhase.count({ where: { roadId: road.id } }),
    prisma.phaseInterval.count({ where: { phase: { roadId: road.id } } }),
    prisma.phaseItemInput.count({ where: { interval: { phase: { roadId: road.id } } } }),
    prisma.inspectionEntry.count({ where: { roadId: road.id } }),
    prisma.inspectionRequest.count({ where: { roadId: road.id } }),
  ])

  console.log(`路段：${road.name} (${road.slug})`)
  console.log(`RoadPhase: ${phaseCount}`)
  console.log(`PhaseInterval: ${intervalCount}`)
  console.log(`PhaseItemInput: ${inputCount}`)
  console.log(`InspectionEntry: ${entryCount}`)
  console.log(`InspectionRequest: ${requestCount}`)

  if (backfillDefaults) {
    const [defaultIntervals, defaultEntries, defaultRequests] = await prisma.$transaction([
      prisma.phaseInterval.count({
        where: { locationRoadId: null, phase: { road: { slug: { not: slug } } } },
      }),
      prisma.inspectionEntry.count({
        where: { locationRoadId: null, road: { slug: { not: slug } } },
      }),
      prisma.inspectionRequest.count({
        where: { locationRoadId: null, road: { slug: { not: slug } } },
      }),
    ])
    console.log(`\n待回填 locationRoadId（非平交路口）：`)
    console.log(`PhaseInterval: ${defaultIntervals}`)
    console.log(`InspectionEntry: ${defaultEntries}`)
    console.log(`InspectionRequest: ${defaultRequests}`)
  }

  if (!apply) {
    console.log('\n（预览）未执行删除。若要执行，请加 --apply')
    return
  }

  await prisma.$transaction(async (tx) => {
    await tx.inspectionEntry.deleteMany({ where: { roadId: road.id } })
    await tx.inspectionRequest.deleteMany({ where: { roadId: road.id } })
    await tx.roadPhase.deleteMany({ where: { roadId: road.id } })
    if (deleteRoad) {
      await tx.roadSection.delete({ where: { id: road.id } })
    }
  })

  if (backfillDefaults) {
    const [intervalResult, entryResult, requestResult] = await prisma.$transaction([
      prisma.$executeRaw`
        UPDATE "PhaseInterval" AS pi
        SET "locationRoadId" = rp."roadId"
        FROM "RoadPhase" AS rp
        JOIN "RoadSection" AS rs ON rs."id" = rp."roadId"
        WHERE pi."phaseId" = rp."id"
          AND pi."locationRoadId" IS NULL
          AND rs."slug" <> ${slug};
      `,
      prisma.$executeRaw`
        UPDATE "InspectionEntry" AS ie
        SET "locationRoadId" = ie."roadId"
        FROM "RoadSection" AS rs
        WHERE ie."roadId" = rs."id"
          AND ie."locationRoadId" IS NULL
          AND rs."slug" <> ${slug};
      `,
      prisma.$executeRaw`
        UPDATE "InspectionRequest" AS ir
        SET "locationRoadId" = ir."roadId"
        FROM "RoadSection" AS rs
        WHERE ir."roadId" = rs."id"
          AND ir."locationRoadId" IS NULL
          AND rs."slug" <> ${slug};
      `,
    ])
    console.log(
      `\n已回填 locationRoadId（非平交路口）：PhaseInterval ${Number(intervalResult)} 条，InspectionEntry ${Number(entryResult)} 条，InspectionRequest ${Number(requestResult)} 条`,
    )
  }

  console.log('\n已删除完成。')
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
