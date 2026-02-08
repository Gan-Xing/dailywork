import 'dotenv/config'

import { Prisma, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

type Args = {
  slug: string
  apply: boolean
}

const parseArgs = (): Args => {
  const args = process.argv.slice(2)
  const out: Args = { slug: 'level-crossing', apply: false }
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]
    if (arg === '--slug') {
      out.slug = args[i + 1] ?? out.slug
      i += 1
      continue
    }
    if (arg === '--apply') {
      out.apply = true
    }
  }
  return out
}

const requireColumn = async (table: string, column: string) => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${table}
        AND column_name = ${column}
    ) AS "exists";
  `
  if (!rows?.[0]?.exists) {
    throw new Error(`Missing column ${table}.${column}. Apply migrations first.`)
  }
}

const main = async () => {
  const { slug, apply } = parseArgs()

  await requireColumn('PhaseInterval', 'locationRoadId')
  await requireColumn('InspectionEntry', 'locationRoadId')
  await requireColumn('InspectionRequest', 'locationRoadId')

  const levelCrossing = await prisma.roadSection.findUnique({
    where: { slug },
    select: { id: true, slug: true, name: true },
  })

  if (!levelCrossing) {
    console.log(`Road slug "${slug}" not found. Backfill will include all roads.`)
  } else {
    console.log(`Exclude road slug "${levelCrossing.slug}" (${levelCrossing.name}).`)
  }

  const [intervalCount, entryCount, requestCount] = await prisma.$transaction([
    prisma.phaseInterval.count({
      where: levelCrossing
        ? { locationRoadId: null, phase: { road: { slug: { not: slug } } } }
        : { locationRoadId: null },
    }),
    prisma.inspectionEntry.count({
      where: levelCrossing ? { locationRoadId: null, road: { slug: { not: slug } } } : { locationRoadId: null },
    }),
    prisma.inspectionRequest.count({
      where: levelCrossing
        ? { locationRoadId: null, road: { slug: { not: slug } } }
        : { locationRoadId: null },
    }),
  ])

  console.log('Pending backfill:')
  console.log(`PhaseInterval: ${intervalCount}`)
  console.log(`InspectionEntry: ${entryCount}`)
  console.log(`InspectionRequest: ${requestCount}`)

  if (!apply) {
    console.log('Preview only. Re-run with --apply to execute.')
    return
  }

  const [intervalResult, entryResult, requestResult] = await prisma.$transaction([
    prisma.$executeRaw(
      Prisma.sql`
        UPDATE "PhaseInterval" AS pi
        SET "locationRoadId" = rp."roadId"
        FROM "RoadPhase" AS rp
        ${levelCrossing ? Prisma.sql`JOIN "RoadSection" AS rs ON rs."id" = rp."roadId"` : Prisma.empty}
        WHERE pi."phaseId" = rp."id"
          AND pi."locationRoadId" IS NULL
          ${levelCrossing ? Prisma.sql`AND rs."slug" <> ${slug}` : Prisma.empty};
      `,
    ),
    prisma.$executeRaw(
      Prisma.sql`
        UPDATE "InspectionEntry" AS ie
        SET "locationRoadId" = ie."roadId"
        ${levelCrossing ? Prisma.sql`FROM "RoadSection" AS rs` : Prisma.empty}
        WHERE ${levelCrossing ? Prisma.sql`ie."roadId" = rs."id" AND` : Prisma.empty}
              ie."locationRoadId" IS NULL
          ${levelCrossing ? Prisma.sql`AND rs."slug" <> ${slug}` : Prisma.empty};
      `,
    ),
    prisma.$executeRaw(
      Prisma.sql`
        UPDATE "InspectionRequest" AS ir
        SET "locationRoadId" = ir."roadId"
        ${levelCrossing ? Prisma.sql`FROM "RoadSection" AS rs` : Prisma.empty}
        WHERE ${levelCrossing ? Prisma.sql`ir."roadId" = rs."id" AND` : Prisma.empty}
              ir."locationRoadId" IS NULL
          ${levelCrossing ? Prisma.sql`AND rs."slug" <> ${slug}` : Prisma.empty};
      `,
    ),
  ])

  console.log(
    `Backfilled: PhaseInterval ${Number(intervalResult)} / InspectionEntry ${Number(entryResult)} / InspectionRequest ${Number(requestResult)}.`,
  )
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
