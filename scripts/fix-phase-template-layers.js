/**
 * 清理历史分项中的层次，使其严格匹配模板(defaultLayers)。
 *
 * 规则：
 * - 每个分项实例(RoadPhase)强制绑定模板(PhaseDefinition)的层次/验收全集；
 * - 区间(PhaseInterval.layers)会过滤到模板之外并覆盖为模板层次全集；
 * - measure/pointHasSides 对齐模板；
 *
 * 用法：
 *   DRY_RUN=1 node scripts/fix-phase-template-layers.js   # 仅查看将要修改的内容（默认）
 *   APPLY=1 node scripts/fix-phase-template-layers.js     # 实际写入数据库
 */

/* eslint-disable no-console */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const canonicalize = (value) => `${value || ''}`.trim().toLowerCase()
const canonicalizeList = (values) => {
  const seen = new Set()
  const result = []
  values.forEach((val) => {
    if (!val) return
    const trimmed = `${val}`.trim()
    const key = canonicalize(trimmed)
    if (seen.has(key)) return
    seen.add(key)
    result.push(trimmed)
  })
  return result
}

const APPLY = process.env.APPLY === '1'

async function main() {
  const definitions = await prisma.phaseDefinition.findMany({
    include: {
      defaultLayers: { include: { layerDefinition: true } },
      defaultChecks: { include: { checkDefinition: true } },
    },
  })
  const definitionMap = new Map(
    definitions.map((def) => {
      const layerIds = def.defaultLayers.map((l) => l.layerDefinitionId)
      const layerNames = canonicalizeList(def.defaultLayers.map((l) => l.layerDefinition.name))
      const checkIds = def.defaultChecks.map((c) => c.checkDefinitionId)
      const checkNames = canonicalizeList(def.defaultChecks.map((c) => c.checkDefinition.name))
      return [
        def.id,
        {
          name: def.name,
          layerIds,
          layerNames,
          checkIds,
          checkNames,
          measure: def.measure,
          pointHasSides: def.pointHasSides,
          layerNameSet: new Set(layerNames.map(canonicalize)),
        },
      ]
    }),
  )

  const phases = await prisma.roadPhase.findMany({
    include: {
      intervals: true,
      layerLinks: true,
      checkLinks: true,
    },
  })

  const summary = {
    phasesTouched: 0,
    layerLinksReset: 0,
    checkLinksReset: 0,
    intervalsOverwritten: 0,
    phasesUpdatedMeasure: 0,
  }

  for (const phase of phases) {
    const definition = definitionMap.get(phase.phaseDefinitionId)
    if (!definition) continue

    const hasLayerMismatch =
      phase.layerLinks.length !== definition.layerIds.length ||
      phase.layerLinks.some((link) => !definition.layerIds.includes(link.layerDefinitionId))
    const hasCheckMismatch =
      phase.checkLinks.length !== definition.checkIds.length ||
      phase.checkLinks.some((link) => !definition.checkIds.includes(link.checkDefinitionId))

    const intervalUpdates = []
    for (const interval of phase.intervals) {
      const rawLayers = Array.isArray(interval.layers) ? interval.layers : []
      const canonical = canonicalizeList(rawLayers)
      const filtered = canonical.filter((name) => definition.layerNameSet.has(canonicalize(name)))
      const needsOverwrite =
        filtered.length !== definition.layerNames.length ||
        definition.layerNames.some((name, idx) => name !== filtered[idx])
      if (needsOverwrite) {
        intervalUpdates.push({ id: interval.id, layers: definition.layerNames })
      }
    }

    const needsMeasureUpdate = phase.measure !== definition.measure || phase.pointHasSides !== definition.pointHasSides

    if (!hasLayerMismatch && !hasCheckMismatch && !intervalUpdates.length && !needsMeasureUpdate) continue

    summary.phasesTouched += 1
    summary.layerLinksReset += hasLayerMismatch ? 1 : 0
    summary.checkLinksReset += hasCheckMismatch ? 1 : 0
    summary.intervalsOverwritten += intervalUpdates.length
    summary.phasesUpdatedMeasure += needsMeasureUpdate ? 1 : 0

    console.log(
      `[${APPLY ? 'APPLY' : 'DRY'}] phase #${phase.id} (${definition.name}) -> reset layers: ${hasLayerMismatch ? 'yes' : 'no'}, reset checks: ${hasCheckMismatch ? 'yes' : 'no'}, overwrite intervals: ${intervalUpdates.length}${
        needsMeasureUpdate ? ', update measure/pointHasSides' : ''
      }`,
    )

    if (!APPLY) continue

    const ops = []

    // 同步 measure / pointHasSides
    if (needsMeasureUpdate) {
      ops.push(
        prisma.roadPhase.update({
          where: { id: phase.id },
          data: {
            measure: definition.measure,
            pointHasSides: definition.pointHasSides ?? false,
          },
        }),
      )
    }

    // 重置层次与验收绑定为模板全集
    if (hasLayerMismatch) {
      ops.push(prisma.roadPhaseLayer.deleteMany({ where: { roadPhaseId: phase.id } }))
      if (definition.layerIds.length) {
        ops.push(
          prisma.roadPhaseLayer.createMany({
            data: definition.layerIds.map((id) => ({ roadPhaseId: phase.id, layerDefinitionId: id })),
          }),
        )
      }
    }
    if (hasCheckMismatch) {
      ops.push(prisma.roadPhaseCheck.deleteMany({ where: { roadPhaseId: phase.id } }))
      if (definition.checkIds.length) {
        ops.push(
          prisma.roadPhaseCheck.createMany({
            data: definition.checkIds.map((id) => ({ roadPhaseId: phase.id, checkDefinitionId: id })),
          }),
        )
      }
    }

    intervalUpdates.forEach((item) => {
      ops.push(prisma.phaseInterval.update({ where: { id: item.id }, data: { layers: item.layers } }))
    })

    if (ops.length) {
      await prisma.$transaction(ops)
    }
  }

  console.log('Done', summary)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
