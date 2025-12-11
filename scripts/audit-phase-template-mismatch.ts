import { prisma } from '@/lib/prisma'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'

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

  const report: any = {
    definitionMissingDefaults: [] as { definitionId: number; name: string; missing: string }[],
    intervalLayerOutsideTemplate: [] as {
      roadPhaseId: number
      phaseName: string
      definitionId: number
      intervalId: number
      side: string
      startPk: number
      endPk: number
      spec: string | null
      invalidLayers: string[]
      templateLayers: string[]
    }[],
    phaseLayerLinkOutsideTemplate: [] as {
      roadPhaseId: number
      phaseName: string
      definitionId: number
      layerId: number
      layerName: string
      templateLayers: string[]
    }[],
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

    // interval.layers free-text check
    phase.intervals.forEach((interval) => {
      const rawLayers = (interval as { layers?: string[] }).layers ?? []
      if (!rawLayers.length) return
      const canonical = canonicalizeProgressList('layer', rawLayers)
      const invalid = canonical.filter((name) => !tplLayerNames.includes(name))
      if (invalid.length) {
        report.intervalLayerOutsideTemplate.push({
          roadPhaseId: phase.id,
          phaseName: phase.name,
          definitionId: phase.phaseDefinitionId,
          intervalId: interval.id,
          side: interval.side,
          startPk: interval.startPk,
          endPk: interval.endPk,
          spec: interval.spec ?? null,
          invalidLayers: invalid,
          templateLayers: tplLayerNames,
        })
      }
    })

    // roadPhaseLayer links check
    phase.layerLinks.forEach((link) => {
      const name = link.layerDefinition.name
      const canonical = canonicalizeProgressList('layer', [name])[0]
      if (!tplLayerNames.includes(canonical)) {
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

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
