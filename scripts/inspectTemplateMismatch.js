#!/usr/bin/env node
/*
 * 检查 PhaseDefinition 与存储的 Workflow 配置的计量方式/左右侧设置是否一致，
 * 并可按路段 slug 列出实例化的分项（用于对比编辑分项弹框显示）。
 * 用法：DATABASE_URL=... node scripts/inspectTemplateMismatch.js --slug bondoukou-university
 */
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const args = process.argv.slice(2)
const slugArg = (() => {
  const idx = args.findIndex((a) => a === '--slug')
  return idx >= 0 ? args[idx + 1] : null
})()

const badge = (measure, pointHasSides) =>
  `${measure === 'POINT' ? '单体' : '延米'}${measure === 'POINT' && pointHasSides ? '·左右侧' : ''}`

async function main() {
  const defs = await prisma.phaseDefinition.findMany({
    include: { workflows: true },
    orderBy: [{ name: 'asc' }, { measure: 'asc' }],
  })

  console.log('=== 全局模板（PhaseDefinition + Workflow config） ===')
  defs.forEach((d) => {
    const cfg = d.workflows[0]?.config || {}
    const mismatch = d.measure !== cfg.measure || d.pointHasSides !== Boolean(cfg.pointHasSides)
    console.log(
      `- ${d.id} ${d.name} | 定义=${badge(d.measure, d.pointHasSides)} ` +
        `配置=${cfg.measure ? badge(cfg.measure, cfg.pointHasSides) : '缺省'}${mismatch ? '  << 不一致' : ''}`,
    )
  })

  if (slugArg) {
    const road = await prisma.roadSection.findUnique({ where: { slug: slugArg } })
    if (!road) {
      console.error(`未找到 slug=${slugArg} 的路段`)
      return
    }
    const phases = await prisma.roadPhase.findMany({
      where: { roadId: road.id },
      include: { phaseDefinition: true },
      orderBy: [{ name: 'asc' }],
    })
    console.log(`\n=== 路段 ${road.name} (${slugArg}) 的分项实例 ===`)
    phases.forEach((p) => {
      console.log(
        `- phaseId=${p.id} ${p.name} | 实例=${badge(p.measure, p.pointHasSides)} ` +
          `模板=${badge(p.phaseDefinition.measure, p.phaseDefinition.pointHasSides)} (templateId=${p.phaseDefinitionId})`,
      )
    })
  }
}

main()
  .catch((err) => {
    console.error(err)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
