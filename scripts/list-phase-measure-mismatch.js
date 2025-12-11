/**
 * 列出指定分项名称的实例与模板的 measure/pointHasSides 对比。
 * 用法：
 *   NAME="过道涵" node scripts/list-phase-measure-mismatch.js
 *   # 不传 NAME 则列出所有分项
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const targetName = process.env.NAME
  const phases = await prisma.roadPhase.findMany({
    where: targetName ? { name: targetName } : undefined,
    include: { phaseDefinition: true, road: true },
    orderBy: { id: 'asc' },
  })

  const rows = phases.map((p) => ({
    phaseId: p.id,
    road: p.road.name,
    name: p.name,
    measure: p.measure,
    pointHasSides: p.pointHasSides,
    templateMeasure: p.phaseDefinition.measure,
    templatePointHasSides: p.phaseDefinition.pointHasSides,
  }))

  console.log(JSON.stringify(rows, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
