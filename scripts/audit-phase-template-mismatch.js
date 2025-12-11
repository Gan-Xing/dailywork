const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const normalize = (v) => `${v || ''}`.trim().toLowerCase()
const canonicalizeProgressList = (_kind, values) => {
  const seen = new Set()
  const result = []
  values.forEach((val) => {
    if (!val) return
    const canonical = `${val}`.trim()
    const key = normalize(canonical)
    if (seen.has(key)) return
    seen.add(key)
    result.push(canonical)
  })
  return result
}

async function main() {
  const phases = await prisma.roadPhase.findMany({
    include: {
      intervals: true,
      layerLinks: { include: { layerDefinition: true } },
      phaseDefinition: {
        include: {
          defaultLayers: { include: { layerDefinition: true } },
          defaultChecks: { include: { checkDefinition: true } },
        },
      },
    },
  })

  const report = {
    definitionMissingDefaults: [],
    intervalLayerOutsideTemplate: [],
    phaseLayerLinkOutsideTemplate: [],
  }

  phases.forEach((phase) => {
    const tplLayerNames = canonicalizeProgressList(
      'layer',
      phase.phaseDefinition.defaultLayers.map((l) => l.layerDefinition.name),
    )
    const tplCheckNames = canonicalizeProgressList(
      'check',
      phase.phaseDefinition.defaultChecks.map((c) => c.checkDefinition.name),
    )
    if (!tplLayerNames.length || !tplCheckNames.length) {
      report.definitionMissingDefaults.push({
        definitionId: phase.phaseDefinitionId,
        name: phase.phaseDefinition.name,
        missing: `${!tplLayerNames.length ? 'layers' : ''}${!tplLayerNames.length && !tplCheckNames.length ? ' & ' : ''}${!tplCheckNames.length ? 'checks' : ''}`,
      })
    }

    const tplLayerSet = new Set(tplLayerNames.map(normalize))

    phase.intervals.forEach((interval) => {
      const rawLayers = interval.layers || []
      if (!rawLayers.length) return
      const canonical = canonicalizeProgressList('layer', rawLayers)
      const invalid = canonical.filter((name) => !tplLayerSet.has(normalize(name)))
      if (invalid.length) {
        report.intervalLayerOutsideTemplate.push({
          roadPhaseId: phase.id,
          phaseName: phase.name,
          definitionId: phase.phaseDefinitionId,
          intervalId: interval.id,
          side: interval.side,
          startPk: interval.startPk,
          endPk: interval.endPk,
          spec: interval.spec || null,
          invalidLayers: invalid,
          templateLayers: tplLayerNames,
        })
      }
    })

    phase.layerLinks.forEach((link) => {
      const name = link.layerDefinition.name
      const canonical = canonicalizeProgressList('layer', [name])[0]
      if (!tplLayerSet.has(normalize(canonical))) {
        report.phaseLayerLinkOutsideTemplate.push({
          roadPhaseId: phase.id,
          phaseName: phase.name,
          definitionId: phase.phaseDefinitionId,
          layerId: link.layerDefinitionId,
          layerName: name,
          templateLayers: tplLayerNames,
        })
      }
    })
  })

  console.log(JSON.stringify(report, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
