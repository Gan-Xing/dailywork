import 'dotenv/config'

import { ensureFinanceCategories, ensureFinanceDefaults } from '@/lib/server/financeStore'
import { prisma } from '@/lib/prisma'

const main = async () => {
  await ensureFinanceDefaults()
  await ensureFinanceCategories()
  console.log('Seeded finance projects, units, payment types, and categories.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
