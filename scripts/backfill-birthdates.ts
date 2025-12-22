/**
 * Backfill User.birthDate using Chinese ID numbers when available.
 *
 * Usage:
 *   npx tsx scripts/backfill-birthdates.ts
 */
/* eslint-disable no-console */
import 'dotenv/config'

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const parseBirthDateFromIdNumber = (value: string) => {
  const text = value.trim()
  if (!text) return null
  let digits = ''
  if (/^\d{17}[\dXx]$/.test(text)) {
    digits = text.slice(6, 14)
  } else if (/^\d{15}$/.test(text)) {
    digits = `19${text.slice(6, 12)}`
  } else {
    return null
  }
  const year = Number(digits.slice(0, 4))
  const month = Number(digits.slice(4, 6))
  const day = Number(digits.slice(6, 8))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return date
}

const main = async () => {
  const candidates = await prisma.user.findMany({
    where: { birthDate: null },
    select: {
      id: true,
      username: true,
      name: true,
      nationality: true,
      chineseProfile: { select: { idNumber: true } },
    },
  })

  const updated: Array<{ id: number; username: string }> = []
  const missing: Array<{ id: number; username: string; reason: string }> = []

  for (const user of candidates) {
    if (user.nationality !== 'china') {
      missing.push({ id: user.id, username: user.username, reason: 'non_china' })
      continue
    }
    const idNumber = user.chineseProfile?.idNumber ?? ''
    const birthDate = parseBirthDateFromIdNumber(idNumber)
    if (!birthDate) {
      missing.push({ id: user.id, username: user.username, reason: 'missing_id' })
      continue
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { birthDate },
    })
    updated.push({ id: user.id, username: user.username })
  }

  console.log(`Updated ${updated.length} users with birthDate.`)
  if (missing.length) {
    console.log('Users still missing birthDate:')
    missing.forEach((item) => {
      console.log(`- ${item.username} (#${item.id}) reason=${item.reason}`)
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
