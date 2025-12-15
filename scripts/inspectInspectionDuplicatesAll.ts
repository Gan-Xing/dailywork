import { PrismaClient } from '@prisma/client'

type GroupKey = {
  roadSlug: string
  phase: string
  side: string
  startPk: number
  endPk: number
  layer: string
  check: string
}

const prisma = new PrismaClient()

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase()

const keyToText = (key: GroupKey) =>
  `${key.roadSlug} | ${key.phase} | ${key.side} | PK${key.startPk}→PK${key.endPk} | ${key.layer} | ${key.check}`

async function main() {
  const filterCheck = process.env.CHECK_FILTER // e.g. 模板安装验收
  const filterType = process.env.TYPE_FILTER // e.g. 试验验收

  const rows = await prisma.inspectionEntry.findMany({
    include: { phase: true, road: true },
  })

  const bucket = new Map<
    string,
    { key: GroupKey; ids: number[]; types: string[][] }
  >()

  rows.forEach((row) => {
    if (filterCheck && !row.checkName.includes(filterCheck)) return
    if (
      filterType &&
      !row.types.some((t) => t.toLowerCase().includes(filterType.toLowerCase()))
    )
      return

    const key: GroupKey = {
      roadSlug: row.road.slug,
      phase: row.phase.name,
      side: row.side,
      startPk: row.startPk,
      endPk: row.endPk,
      layer: row.layerName,
      check: row.checkName,
    }
    const k = JSON.stringify({
      roadSlug: normalize(key.roadSlug),
      phase: normalize(key.phase),
      side: normalize(key.side),
      startPk: key.startPk,
      endPk: key.endPk,
      layer: normalize(key.layer),
      check: normalize(key.check),
    })
    const entry = bucket.get(k) ?? { key, ids: [], types: [] }
    entry.ids.push(row.id)
    entry.types.push(row.types)
    bucket.set(k, entry)
  })

  const duplicates = Array.from(bucket.values()).filter((item) => item.ids.length > 1)
  if (!duplicates.length) {
    console.log('✅ No duplicate inspection entries across all roads.')
    return
  }

  console.log(`⚠️ Found ${duplicates.length} duplicate groups across all roads${filterCheck ? ` (check contains "${filterCheck}")` : ''}${filterType ? ` (type contains "${filterType}")` : ''}:`)
  duplicates.forEach((item) => {
    console.log(
      `- ${keyToText(item.key)} -> count ${item.ids.length}, ids=${item.ids.join(', ')}, types=${item.types
        .map((t) => `[${t.join(',')}]`)
        .join(' ')}`,
    )
  })
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
