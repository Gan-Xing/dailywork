/**
 * Quick inspection script for inspectionEntry table.
 * Usage: node scripts/inspectInspectionEntries.js
 */
require('dotenv').config()
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  try {
    const dbUrl = process.env.DATABASE_URL || ''
    if (dbUrl) {
      try {
        const parsed = new URL(dbUrl)
        console.log(`Connecting to DB host: ${parsed.hostname}:${parsed.port} db: ${parsed.pathname.replace('/', '')}`)
      } catch {
        console.log('DATABASE_URL present but could not parse (maybe non-URL format)')
      }
    } else {
      console.warn('DATABASE_URL is empty; Prisma will use default config.')
    }
  } catch {
    // no-op
  }

  try {
    const total = await prisma.inspectionEntry.count()
    const byDoc = await prisma.$queryRaw`
      SELECT "documentId", COUNT(*) AS cnt
      FROM "InspectionEntry"
      GROUP BY "documentId"
      ORDER BY cnt DESC
      LIMIT 20
    `
    const byStatus = await prisma.$queryRaw`
      SELECT "status", COUNT(*) AS cnt
      FROM "InspectionEntry"
      GROUP BY "status"
      ORDER BY cnt DESC
    `

    const latest = await prisma.inspectionEntry.findMany({
      orderBy: { id: 'desc' },
      take: 20,
      include: {
        road: { select: { id: true, name: true, slug: true } },
        phase: { select: { id: true, name: true } },
        document: { select: { id: true, code: true } },
      },
    })

    console.log('Total inspectionEntry:', total)
    console.log('Top documentId counts:', byDoc)
    console.log('Counts by status:', byStatus)
    console.log(
      latest.map((row) => ({
        id: row.id,
        status: row.status,
        documentId: row.documentId,
        documentCode: row.document?.code ?? null,
        submissionOrder: row.submissionOrder,
        road: row.road ? `${row.road.id} ${row.road.name}` : null,
        phase: row.phase ? `${row.phase.id} ${row.phase.name}` : null,
        layerName: row.layerName,
        checkName: row.checkName,
        startPk: row.startPk,
        endPk: row.endPk,
        updatedAt: row.updatedAt,
      })),
    )
  } catch (err) {
    console.error(err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
