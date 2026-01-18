import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const dateKey = process.argv[2] ?? '2026-01-16'

const runDbQuery = async () => {
  const rows = await prisma.$queryRaw<
    Array<{
      id: number
      logDate: Date
      supervisorId: number
      supervisorName: string
    }>
  >`
    SELECT id, "logDate", "supervisorId", "supervisorName"
    FROM "LeaderDailyLog"
    WHERE to_char("logDate", 'YYYY-MM-DD') = ${dateKey}
    ORDER BY "supervisorName" ASC
  `

  console.log(JSON.stringify(rows, null, 2))
}

const runApiQuery = async () => {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000'
  const username = process.env.LOGIN_USERNAME
  const password = process.env.LOGIN_PASSWORD

  if (!username || !password) {
    throw new Error('LOGIN_USERNAME/LOGIN_PASSWORD are required for API debug.')
  }

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const cookie = login.headers.get('set-cookie') ?? ''
  const res = await fetch(`${baseUrl}/api/leader-logs?date=${dateKey}&debug=1`, {
    headers: { cookie },
  })
  const text = await res.text()
  console.log(text)
}

const mode = process.env.DEBUG_MODE ?? 'db'

const run = async () => {
  if (mode === 'api') {
    await runApiQuery()
  } else {
    await runDbQuery()
  }
}

run()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
