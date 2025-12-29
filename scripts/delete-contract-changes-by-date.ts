import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const parseDateArg = (value?: string) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map((part) => Number(part))
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day))
}

const getArgValue = (flag: string) => {
  const args = process.argv.slice(2)
  const match = args.find((arg) => arg.startsWith(`${flag}=`))
  if (match) return match.split('=').slice(1).join('=')
  const index = args.indexOf(flag)
  if (index >= 0) return args[index + 1]
  return null
}

const hasFlag = (flag: string) => process.argv.slice(2).includes(flag)

const run = async () => {
  const dateArg = getArgValue('--date')
  const targetDate = parseDateArg(dateArg ?? undefined)
  if (!targetDate) {
    throw new Error('Missing or invalid --date (expected YYYY-MM-DD).')
  }

  const start = targetDate
  const end = new Date(start.getTime())
  end.setUTCDate(end.getUTCDate() + 1)

  const count = await prisma.userContractChange.count({
    where: {
      changeDate: {
        gte: start,
        lt: end,
      },
    },
  })

  if (!hasFlag('--confirm')) {
    console.log(
      `Found ${count} contract change record(s) with changeDate on ${dateArg ?? ''} (UTC).`,
    )
    console.log('Run again with --confirm to delete them.')
    return
  }

  const result = await prisma.userContractChange.deleteMany({
    where: {
      changeDate: {
        gte: start,
        lt: end,
      },
    },
  })
  console.log(`Deleted ${result.count} contract change record(s).`)
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
