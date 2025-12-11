import { PhaseMeasure as PrismaPhaseMeasure, Prisma } from '@prisma/client'

import {
  FIXED_INSPECTION_TYPES,
  defaultWorkflowTemplates,
  type WorkflowBinding,
  type WorkflowLayerTemplate,
  type WorkflowTemplate,
} from '@/lib/progressWorkflow'
import type { PhaseMeasure } from '@/lib/progressTypes'
import { prisma } from '@/lib/prisma'

type WorkflowItem = WorkflowBinding
type LayerDefinition = Prisma.LayerDefinitionGetPayload<{}>
type CheckDefinition = Prisma.CheckDefinitionGetPayload<{}>

const normalizeNames = (value?: string[] | null) =>
  Array.from(new Set((Array.isArray(value) ? value : []).map((item) => `${item}`.trim()).filter(Boolean)))

const normalizeTypes = (types?: string[]) =>
  types && types.length ? Array.from(new Set(types.map((item) => `${item}`.trim()).filter(Boolean))) : FIXED_INSPECTION_TYPES

const normalizeLayer = (layer: WorkflowLayerTemplate, defaultTypes: string[]): WorkflowLayerTemplate => ({
  ...layer,
  stage: Math.max(1, Math.floor(layer.stage || 1)),
  dependencies: layer.dependencies || [],
  lockStepWith: layer.lockStepWith || [],
  parallelWith: layer.parallelWith || [],
  checks: (layer.checks || []).map((check, idx) => ({
    ...check,
    id: check.id || `${layer.id}-check-${idx + 1}`,
    name: check.name?.trim() || `验收内容 ${idx + 1}`,
    types: normalizeTypes(check.types || defaultTypes),
  })),
})

const toPrismaMeasure = (measure: PhaseMeasure) =>
  measure === 'POINT' ? PrismaPhaseMeasure.POINT : PrismaPhaseMeasure.LINEAR

const inferMeasure = (measure: PrismaPhaseMeasure | PhaseMeasure): PhaseMeasure => {
  const normalized = `${measure}`
  return normalized === 'POINT' ? 'POINT' : 'LINEAR'
}

const buildTemplateFromDefinition = (
  definition: Prisma.PhaseDefinitionGetPayload<{
    include: { defaultLayers: { include: { layerDefinition: true } }; defaultChecks: { include: { checkDefinition: true } } }
  }>,
): WorkflowTemplate => {
  const layerNames = definition.defaultLayers?.map((item) => item.layerDefinition.name) ?? []
  const checkNames = definition.defaultChecks?.map((item) => item.checkDefinition.name) ?? []
  const safeChecks = checkNames.length ? checkNames : []

  const layers: WorkflowLayerTemplate[] =
    layerNames.length > 0
      ? layerNames.map((name, idx) => ({
          id: `${definition.id}-layer-${idx + 1}`,
          name,
          stage: idx + 1,
          dependencies: idx === 0 ? [] : [`${definition.id}-layer-${idx}`],
          lockStepWith: [],
          parallelWith: [],
          description: '',
          checks: (safeChecks.length ? safeChecks : [`${name}验收内容`]).map((checkName, checkIdx) => ({
            id: `${definition.id}-check-${idx + 1}-${checkIdx + 1}`,
            name: checkName,
            types: FIXED_INSPECTION_TYPES,
          })),
        }))
      : [
          {
            id: `${definition.id}-layer-1`,
            name: '新建层次',
            stage: 1,
            dependencies: [],
            lockStepWith: [],
            parallelWith: [],
            description: '',
            checks: (safeChecks.length ? safeChecks : ['验收内容']).map((checkName, checkIdx) => ({
              id: `${definition.id}-check-${checkIdx + 1}`,
              name: checkName,
              types: FIXED_INSPECTION_TYPES,
            })),
          },
        ]

  return {
    id: `phase-${definition.id}`,
    phaseName: definition.name,
    measure: inferMeasure(definition.measure),
    defaultTypes: FIXED_INSPECTION_TYPES,
    layers,
  }
}

const normalizeWorkflow = (
  definition: Prisma.PhaseDefinitionGetPayload<{
    include: { defaultLayers: { include: { layerDefinition: true } }; defaultChecks: { include: { checkDefinition: true } } }
  }>,
  config?: WorkflowTemplate | null,
): WorkflowItem => {
  const fallback = defaultWorkflowTemplates.find((tpl) => tpl.phaseName === definition.name)
  const source = config ?? fallback ?? buildTemplateFromDefinition(definition)
  const defaultTypes = normalizeTypes(source.defaultTypes)
  const layers = (source.layers || []).map((layer, idx) =>
    normalizeLayer(
      {
        ...layer,
        id: layer.id || `${definition.id}-layer-${idx + 1}`,
      },
      defaultTypes,
    ),
  )
  return {
    ...source,
    id: source.id || `phase-${definition.id}`,
    phaseName: source.phaseName || definition.name,
    measure: source.measure || inferMeasure(definition.measure),
    defaultTypes,
    layers,
    phaseDefinitionId: definition.id,
    isActive: definition.isActive,
    pointHasSides: definition.pointHasSides,
  }
}

const ensureLayerDefinitions = async (names: string[], tx: Prisma.TransactionClient) => {
  const unique = normalizeNames(names)
  if (!unique.length) return [] as LayerDefinition[]
  await Promise.all(
    unique.map((name) =>
      tx.layerDefinition.upsert({
        where: { name },
        create: { name },
        update: { isActive: true },
      }),
    ),
  )
  const layers = await tx.layerDefinition.findMany({ where: { name: { in: unique } } })
  return layers
}

const ensureCheckDefinitions = async (names: string[], tx: Prisma.TransactionClient) => {
  const unique = normalizeNames(names)
  if (!unique.length) return [] as CheckDefinition[]
  await Promise.all(
    unique.map((name) =>
      tx.checkDefinition.upsert({
        where: { name },
        create: { name },
        update: { isActive: true },
      }),
    ),
  )
  const checks = await tx.checkDefinition.findMany({ where: { name: { in: unique } } })
  return checks
}

const syncDefinitionBindings = async (
  tx: Prisma.TransactionClient,
  params: { definitionId: number; layerIds: number[]; checkIds: number[] },
) => {
  await tx.phaseDefinitionLayer.deleteMany({ where: { phaseDefinitionId: params.definitionId } })
  if (params.layerIds.length) {
    await tx.phaseDefinitionLayer.createMany({
      data: params.layerIds.map((id) => ({ phaseDefinitionId: params.definitionId, layerDefinitionId: id })),
    })
  }

  await tx.phaseDefinitionCheck.deleteMany({ where: { phaseDefinitionId: params.definitionId } })
  if (params.checkIds.length) {
    await tx.phaseDefinitionCheck.createMany({
      data: params.checkIds.map((id) => ({ phaseDefinitionId: params.definitionId, checkDefinitionId: id })),
    })
  }
}

export const listWorkflowsWithDefaults = async (): Promise<WorkflowItem[]> => {
  const existingNames = await prisma.phaseDefinition.findMany({ select: { name: true } })
  const existingNameSet = new Set(existingNames.map((item) => item.name))
  const missingDefaults = defaultWorkflowTemplates.filter((tpl) => !existingNameSet.has(tpl.phaseName))
  for (const tpl of missingDefaults) {
    await createWorkflowTemplate({
      name: tpl.phaseName,
      measure: tpl.measure,
      pointHasSides: tpl.measure === 'POINT',
      workflow: tpl,
    })
  }

  const definitions = await prisma.phaseDefinition.findMany({
    include: {
      defaultLayers: { include: { layerDefinition: true } },
      defaultChecks: { include: { checkDefinition: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  const stored = await prisma.phaseWorkflowDefinition.findMany({
    where: { phaseDefinitionId: { in: definitions.map((d) => d.id) } },
  })
  const storedByDefinition = new Map(stored.map((item) => [item.phaseDefinitionId, item.config]))

  return definitions.map((definition) =>
    normalizeWorkflow(definition, storedByDefinition.get(definition.id) as WorkflowTemplate | null),
  )
}

export const getWorkflowByPhaseDefinitionId = async (
  phaseDefinitionId: number,
): Promise<WorkflowItem | null> => {
  const definition = await prisma.phaseDefinition.findUnique({
    where: { id: phaseDefinitionId },
    include: {
      defaultLayers: { include: { layerDefinition: true } },
      defaultChecks: { include: { checkDefinition: true } },
    },
  })
  if (!definition) return null
  const stored = await prisma.phaseWorkflowDefinition.findUnique({ where: { phaseDefinitionId } })
  return normalizeWorkflow(definition, (stored?.config as WorkflowTemplate | null) ?? null)
}

const normalizeWorkflowForSave = (
  definition: Prisma.PhaseDefinitionGetPayload<{
    include: { defaultLayers: { include: { layerDefinition: true } }; defaultChecks: { include: { checkDefinition: true } } }
  }>,
  workflow: WorkflowTemplate,
): WorkflowTemplate => {
  const merged: WorkflowTemplate = {
    ...workflow,
    id: workflow.id || `phase-${definition.id}`,
    phaseName: definition.name,
    measure: inferMeasure(definition.measure),
    defaultTypes: normalizeTypes(workflow.defaultTypes),
    layers: (workflow.layers || []).map((layer, idx) =>
      normalizeLayer(
        {
          ...layer,
          id: layer.id || `${definition.id}-layer-${idx + 1}`,
        },
        normalizeTypes(workflow.defaultTypes),
      ),
    ),
  }
  return merged
}

const fetchDefinitionWithRelations = async (phaseDefinitionId: number) =>
  prisma.phaseDefinition.findUnique({
    where: { id: phaseDefinitionId },
    include: {
      defaultLayers: { include: { layerDefinition: true } },
      defaultChecks: { include: { checkDefinition: true } },
    },
  })

const assertNonEmptyTemplate = (layers: string[], checks: string[]) => {
  if (!layers.length) {
    throw new Error('模板至少需要 1 个层次，请先添加层次后再保存')
  }
  if (!checks.length) {
    throw new Error('模板至少需要 1 个验收内容，请先添加验收内容后再保存')
  }
}

export const updateWorkflowTemplate = async (params: {
  phaseDefinitionId: number
  workflow: WorkflowTemplate
  name?: string
  measure?: PhaseMeasure
  pointHasSides?: boolean
}): Promise<WorkflowItem> => {
  const definition = await fetchDefinitionWithRelations(params.phaseDefinitionId)
  if (!definition) {
    throw new Error('分项模板不存在，请先创建分项定义。')
  }

  const nextName = params.name?.trim() || params.workflow.phaseName?.trim() || definition.name
  const nextMeasure = params.measure ?? params.workflow.measure ?? inferMeasure(definition.measure)
  const layerNames = normalizeNames(params.workflow.layers?.map((item) => item.name))
  const checkNames = normalizeNames(
    params.workflow.layers?.flatMap((item) => item.checks?.map((check) => check.name) || []),
  )
  assertNonEmptyTemplate(layerNames, checkNames)

  const { definition: savedDefinition, workflow: savedWorkflow } = await prisma.$transaction(async (tx) => {
    if (nextName !== definition.name) {
      const duplicate = await tx.phaseDefinition.findUnique({ where: { name: nextName } })
      if (duplicate && duplicate.id !== definition.id) {
        throw new Error('已存在同名的分项模板，请更换名称。')
      }
    }

    const layerDefs = await ensureLayerDefinitions(layerNames, tx)
    const checkDefs = await ensureCheckDefinitions(checkNames, tx)
    await syncDefinitionBindings(tx, {
      definitionId: definition.id,
      layerIds: layerDefs.map((l) => l.id),
      checkIds: checkDefs.map((c) => c.id),
    })

    const updated = await tx.phaseDefinition.update({
      where: { id: definition.id },
      data: {
        name: nextName,
        measure: toPrismaMeasure(nextMeasure),
        pointHasSides: nextMeasure === 'POINT' ? Boolean(params.pointHasSides ?? definition.pointHasSides) : false,
        updatedAt: new Date(),
      },
    })

    const normalizedWorkflow = normalizeWorkflowForSave(
      {
        ...definition,
        name: nextName,
        measure: toPrismaMeasure(nextMeasure),
        pointHasSides: updated.pointHasSides,
      },
      params.workflow,
    )

    await tx.phaseWorkflowDefinition.upsert({
      where: { phaseDefinitionId: definition.id },
      create: { phaseDefinitionId: definition.id, config: normalizedWorkflow },
      update: { config: normalizedWorkflow },
    })

    return {
      definition: {
        ...updated,
        defaultLayers: layerDefs.map((layer) => ({
          phaseDefinitionId: updated.id,
          layerDefinitionId: layer.id,
          layerDefinition: layer,
        })),
        defaultChecks: checkDefs.map((check) => ({
          phaseDefinitionId: updated.id,
          checkDefinitionId: check.id,
          checkDefinition: check,
        })),
      },
      workflow: normalizedWorkflow,
    }
  })

  return normalizeWorkflow(savedDefinition, savedWorkflow)
}

export const createWorkflowTemplate = async (params: {
  name: string
  measure: PhaseMeasure
  pointHasSides?: boolean
  workflow?: WorkflowTemplate
}): Promise<WorkflowItem> => {
  const name = params.name.trim()
  if (!name) {
    throw new Error('模板名称不能为空')
  }

  const existing = await prisma.phaseDefinition.findUnique({ where: { name } })
  if (existing) {
    throw new Error('模板名称已存在，请更换')
  }

  const fallback = defaultWorkflowTemplates.find((tpl) => tpl.phaseName === name)
  const initialWorkflow = params.workflow ?? fallback ?? {
    id: `phase-${name}`,
    phaseName: name,
    measure: params.measure,
    defaultTypes: FIXED_INSPECTION_TYPES,
    layers: [],
  }

  const layerNames = normalizeNames(initialWorkflow.layers?.map((item) => item.name))
  const checkNames = normalizeNames(
    initialWorkflow.layers?.flatMap((item) => item.checks?.map((check) => check.name) || []),
  )
  assertNonEmptyTemplate(layerNames, checkNames)

  const created = await prisma.$transaction(async (tx) => {
    const layerDefs = await ensureLayerDefinitions(layerNames, tx)
    const checkDefs = await ensureCheckDefinitions(checkNames, tx)

    const definition = await tx.phaseDefinition.create({
      data: {
        name,
        measure: toPrismaMeasure(params.measure),
        pointHasSides: params.measure === 'POINT' ? Boolean(params.pointHasSides) : false,
        isActive: true,
        defaultLayers: layerDefs.length
          ? {
              create: layerDefs.map((layer) => ({ layerDefinitionId: layer.id })),
            }
          : undefined,
        defaultChecks: checkDefs.length
          ? {
              create: checkDefs.map((check) => ({ checkDefinitionId: check.id })),
            }
          : undefined,
      },
      include: {
        defaultLayers: { include: { layerDefinition: true } },
        defaultChecks: { include: { checkDefinition: true } },
      },
    })

    const normalizedWorkflow = normalizeWorkflowForSave(definition, {
      ...initialWorkflow,
      phaseName: name,
      measure: params.measure,
    })

    await tx.phaseWorkflowDefinition.create({
      data: { phaseDefinitionId: definition.id, config: normalizedWorkflow },
    })

    return { definition, workflow: normalizedWorkflow }
  })

  return normalizeWorkflow(created.definition, created.workflow)
}

export const deleteWorkflowTemplate = async (phaseDefinitionId: number) => {
  const definition = await prisma.phaseDefinition.findUnique({ where: { id: phaseDefinitionId } })
  if (!definition) {
    throw new Error('模板不存在或已删除')
  }

  const hasPhases = await prisma.roadPhase.count({ where: { phaseDefinitionId } })
  if (hasPhases > 0) {
    await prisma.phaseDefinition.update({
      where: { id: phaseDefinitionId },
      data: { isActive: false, updatedAt: new Date() },
    })
    return
  }

  await prisma.phaseDefinition.delete({ where: { id: phaseDefinitionId } })
}
