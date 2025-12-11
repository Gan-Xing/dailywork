/**
 * 清理历史分项中的层次，使其严格匹配模板(defaultLayers)。
 *
 * 规则：
 * - 每个分项实例(RoadPhase)仅保留其模板(PhaseDefinition)的层次；
 * - 区间(PhaseInterval.layers)会过滤到模板层次之外的值；
 * - roadPhaseLayer 关联表中不在模板里的层次会被删除；
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
    include: { defaultLayers: { include: { layerDefinition: true } } },
  })
  const definitionMap = new Map(
    definitions.map((def) => {
      const layerIds = def.defaultLayers.map((l) => l.layerDefinitionId)
      const layerNames = canonicalizeList(def.defaultLayers.map((l) => l.layerDefinition.name))
      return [
        def.id,
        {
          name: def.name,
          layerIds,
          layerNames,
          layerNameSet: new Set(layerNames.map(canonicalize)),
        },
      ]
    }),
  )

  const phases = await prisma.roadPhase.findMany({
    include: {
      intervals: true,
      layerLinks: true,
    },
  })

  const summary = {
    phasesTouched: 0,
    layerLinksDeleted: 0,
    intervalsUpdated: 0,
  }

  for (const phase of phases) {
    const definition = definitionMap.get(phase.phaseDefinitionId)
    if (!definition) continue

    const invalidLayerLinks = phase.layerLinks.filter((link) => !definition.layerIds.includes(link.layerDefinitionId))

    const intervalUpdates = []
    for (const interval of phase.intervals) {
      const rawLayers = Array.isArray(interval.layers) ? interval.layers : []
      if (!rawLayers.length) continue
      const canonical = canonicalizeList(rawLayers)
      const filtered = canonical.filter((name) => definition.layerNameSet.has(canonicalize(name)))
      if (filtered.length !== canonical.length) {
        intervalUpdates.push({ id: interval.id, layers: filtered })
      }
    }

    const hasInvalidLinks = invalidLayerLinks.length > 0
    const shouldCleanupFallback = !hasInvalidLinks && definition.layerIds.length > 0 && phase.layerLinks.length > 0
    if (!hasInvalidLinks && !intervalUpdates.length && !shouldCleanupFallback) continue

    summary.phasesTouched += 1
    summary.layerLinksDeleted += hasInvalidLinks ? invalidLayerLinks.length : 0
    summary.intervalsUpdated += intervalUpdates.length

    console.log(
      `[${APPLY ? 'APPLY' : 'DRY'}] phase #${phase.id} (${definition.name}) -> remove links: ${invalidLayerLinks.length}, update intervals: ${intervalUpdates.length}`,
    )

    if (!APPLY) continue

    const ops = []
    if (hasInvalidLinks || shouldCleanupFallback) {
      // 删除实例中不在模板里的所有层次绑定；如果模板为空则清空绑定
      ops.push(
        prisma.roadPhaseLayer.deleteMany({
          where: {
            roadPhaseId: phase.id,
            ...(definition.layerIds.length ? { layerDefinitionId: { notIn: definition.layerIds } } : {}),
          },
        }),
      )
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
