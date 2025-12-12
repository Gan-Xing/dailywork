/**
 * 检查数据库中是否存在 Submission / InspectionEntry 表。
 * 用法：
 *   node scripts/check-inspection-tables.js
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('Submission','InspectionEntry');`
  console.log(rows)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
