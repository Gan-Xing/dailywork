import { PhaseMeasure } from '@prisma/client'

import { PREFAB_ROAD_NAME, PREFAB_ROAD_SLUG, prefabPhaseOptions, type PrefabPhaseKey } from '@/lib/prefabInspection'
import { prisma } from '@/lib/prisma'
import { createInspectionEntries } from './inspectionEntryStore'

const ensurePrefabRoad = async () => {
  return prisma.roadSection.upsert({
    where: { slug: PREFAB_ROAD_SLUG },
    update: { name: PREFAB_ROAD_NAME, startPk: 'N/A', endPk: 'N/A' },
    create: { slug: PREFAB_ROAD_SLUG, name: PREFAB_ROAD_NAME, startPk: 'N/A', endPk: 'N/A' },
  })
}

const ensurePhaseDefinition = async (name: string) => {
  return prisma.phaseDefinition.upsert({
    where: { name_measure: { name, measure: PhaseMeasure.POINT } },
    update: { measure: PhaseMeasure.POINT, pointHasSides: false },
    create: { name, measure: PhaseMeasure.POINT, pointHasSides: false },
  })
}

const ensurePrefabPhase = async (roadId: number, key: PrefabPhaseKey) => {
  const option = prefabPhaseOptions.find((item) => item.key === key)
  if (!option) throw new Error('未知的预制分项')

  const definition = await ensurePhaseDefinition(option.name)
  const existingPhase = await prisma.roadPhase.findFirst({
    where: { roadId, name: option.name },
  })
  if (existingPhase) return existingPhase

  return prisma.roadPhase.create({
    data: {
      roadId,
      phaseDefinitionId: definition.id,
      name: option.name,
      measure: definition.measure,
      pointHasSides: definition.pointHasSides,
      designLength: 0,
    },
  })
}

export const createPrefabInspection = async (
  phaseKey: PrefabPhaseKey,
  payload: {
    layers?: string[]
    checks: string[]
    types: string[]
    appointmentDate: string
    remark?: string
  },
  userId: number | null,
) => {
  const road = await ensurePrefabRoad()
  const phase = await ensurePrefabPhase(road.id, phaseKey)
  const matchedLayer = prefabPhaseOptions.find((item) => item.key === phaseKey)?.layer
  const layers = payload.layers && payload.layers.length ? payload.layers : matchedLayer ? [matchedLayer] : []

  const entriesPayload = layers.flatMap((layerName) =>
    payload.checks.map((checkName) => ({
      roadId: road.id,
      phaseId: phase.id,
      side: 'BOTH' as const,
      startPk: 0,
      endPk: 0,
      layerName,
      checkName,
      types: payload.types,
      status: 'SCHEDULED' as const,
      appointmentDate: payload.appointmentDate,
      remark: payload.remark,
    })),
  )

  const entries = await createInspectionEntries(entriesPayload, userId)
  return entries
}
