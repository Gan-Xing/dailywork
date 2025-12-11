/**
 * 列出所有模板的默认层次/验收，并对比实例化分项的差异。
 * 用法：
 *   node scripts/list-template-instance-diff.js
 * 需要有效的 DATABASE_URL。
 */
/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const canonical = (v) => `${v || ''}`.trim().toLowerCase()
const uniqList = (arr) => {
  const seen = new Set()
  const res = []
  arr.forEach((v) => {
    const t = `${v}`.trim()
    const key = canonical(t)
    if (!t || seen.has(key)) return
    seen.add(key)
    res.push(t)
  })
  return res
}

async function main() {
  const defs = await prisma.phaseDefinition.findMany({
    include: {
      defaultLayers: { include: { layerDefinition: true } },
      defaultChecks: { include: { checkDefinition: true } },
    },
    orderBy: { id: 'asc' },
  })
  const definitionMap = new Map(
    defs.map((d) => [
      d.id,
      {
        id: d.id,
        name: d.name,
        layers: uniqList(d.defaultLayers.map((l) => l.layerDefinition.name)),
        checks: uniqList(d.defaultChecks.map((c) => c.checkDefinition.name)),
      },
    ]),
  )

  const phases = await prisma.roadPhase.findMany({
    include: {
      intervals: true,
      layerLinks: { include: { layerDefinition: true } },
      checkLinks: { include: { checkDefinition: true } },
      road: true,
    },
    orderBy: { id: 'asc' },
  })

  const phaseSummary = phases.map((p) => {
    const def = definitionMap.get(p.phaseDefinitionId) || { layers: [], checks: [] }
    const tplLayerSet = new Set(def.layers.map(canonical))
    const tplCheckSet = new Set(def.checks.map(canonical))
    const instLayers = uniqList(p.layerLinks.map((l) => l.layerDefinition.name))
    const instChecks = uniqList(p.checkLinks.map((c) => c.checkDefinition.name))
    const extraLayers = instLayers.filter((n) => !tplLayerSet.has(canonical(n)))
    const missingLayers = def.layers.filter((n) => !instLayers.map(canonical).includes(canonical(n)))
    const extraChecks = instChecks.filter((n) => !tplCheckSet.has(canonical(n)))
    const missingChecks = def.checks.filter((n) => !instChecks.map(canonical).includes(canonical(n)))
    const intervalIssues = (p.intervals || [])
      .map((i) => {
        const raw = Array.isArray(i.layers) ? i.layers : []
        const bad = uniqList(raw).filter((name) => !tplLayerSet.has(canonical(name)))
        return bad.length
          ? { intervalId: i.id, range: `${i.startPk}-${i.endPk}`, side: i.side, invalidLayers: bad }
          : null
      })
      .filter(Boolean)
    return {
      id: p.id,
      road: p.road.name,
      name: p.name,
      definitionId: p.phaseDefinitionId,
      templateLayers: def.layers,
      instanceLayers: instLayers,
      extraLayers,
      missingLayers,
      templateChecks: def.checks,
      instanceChecks: instChecks,
      extraChecks,
      missingChecks,
      intervalIssues,
    }
  })

  console.log('TEMPLATES:\n' + JSON.stringify(Array.from(definitionMap.values()), null, 2))
  console.log('\nPHASES_DIFF:\n' + JSON.stringify(phaseSummary, null, 2))

  // Summary stats
  const summary = phaseSummary.reduce(
    (acc, item) => {
      if (item.extraLayers.length || item.missingLayers.length || item.intervalIssues.length) acc.layerMismatches += 1
      if (item.extraChecks.length || item.missingChecks.length) acc.checkMismatches += 1
      if (item.intervalIssues.length) acc.intervalIssuesCount += item.intervalIssues.length
      return acc
    },
    { layerMismatches: 0, checkMismatches: 0, intervalIssuesCount: 0, total: phaseSummary.length },
  )
  console.log('\nSUMMARY:', JSON.stringify(summary, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
