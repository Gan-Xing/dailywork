import { InspectionStatus, IntervalSide, PhaseMeasure, Prisma } from '@prisma/client'

import type {
  InspectionEntryDTO,
  InspectionEntryFilter,
  InspectionEntryPayload,
  InspectionEntryListResponse,
  InspectionListItem,
} from '@/lib/progressTypes'
import { canonicalizeProgressList } from '@/lib/i18n/progressDictionary'
import { clampTypesForCheck, mergeTypesForCheck } from './inspectionTypeRules'
import { prisma } from '@/lib/prisma'
import { getWorkflowByPhaseDefinitionId } from './workflowStore'

const normalizeSide = (side: string | undefined) =>
  side === 'LEFT' || side === 'RIGHT' || side === 'BOTH' ? side : 'BOTH'

const normalizeLabel = (value: string) => value.trim().toLowerCase()

const normalizeRange = (start: number, end: number) => {
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = Number.isFinite(end) ? end : safeStart
  const ordered = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
  return { startPk: ordered[0], endPk: ordered[1] }
}

const overlapsRange = (startA: number, endA: number, startB: number, endB: number) =>
  Math.max(startA, startB) < Math.min(endA, endB)

const statusPriority: Record<InspectionStatus, number> = {
  PENDING: 1,
  SCHEDULED: 2,
  SUBMITTED: 3,
  IN_PROGRESS: 4,
  APPROVED: 5,
}

const assertPointSideAllowed = (
  phase: { measure: PhaseMeasure; pointHasSides: boolean; intervals?: { startPk: number; endPk: number; side: IntervalSide }[] },
  side: IntervalSide,
  range: { startPk: number; endPk: number },
) => {
  if (phase.measure !== 'POINT' || !phase.pointHasSides) return
  if (side === 'BOTH') {
    throw new Error('单体按左右侧展示的报检不可选择“双侧”，请根据点位所在侧提交单侧报检。')
  }
  const intervals = phase.intervals ?? []
  const overlappingSides = new Set(
    intervals
      .filter((interval) => overlapsRange(interval.startPk, interval.endPk, range.startPk, range.endPk))
      .map((interval) => interval.side)
      .filter((value) => value !== 'BOTH'),
  )
  if (overlappingSides.size === 1) {
    const expectedSide = Array.from(overlappingSides)[0]
    if (side !== expectedSide) {
      const sideLabel = expectedSide === 'LEFT' ? '左侧' : '右侧'
      throw new Error(`该单体点位配置为${sideLabel}，报检侧别需保持一致。`)
    }
  }
}

const mapEntry = (
  row: Prisma.InspectionEntryGetPayload<{
    include: { submission: true; road: true; phase: true; submitter: true; creator: true; updater: true }
  }>,
): InspectionEntryDTO => ({
  id: row.id,
  submissionId: row.submissionId,
  submissionCode: row.submission?.code ?? null,
  roadId: row.roadId,
  roadName: row.road.name,
  roadSlug: row.road.slug,
  phaseId: row.phaseId,
  phaseName: row.phase.name,
  side: row.side,
  startPk: row.startPk,
  endPk: row.endPk,
  layerId: row.layerId ?? null,
  layerName: row.layerName,
  checkId: row.checkId ?? null,
  checkName: row.checkName,
  types: row.types,
  status: row.status,
  appointmentDate: row.appointmentDate?.toISOString(),
  remark: row.remark ?? undefined,
  submissionOrder: row.submissionOrder ?? undefined,
  submittedAt: row.submittedAt.toISOString(),
  submittedBy: row.submitter ? { id: row.submitter.id, username: row.submitter.username } : null,
  createdBy: row.creator ? { id: row.creator.id, username: row.creator.username } : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updater ? { id: row.updater.id, username: row.updater.username } : null,
})

type InspectionEntryCreateData = Omit<Prisma.InspectionEntryUncheckedCreateInput, 'submissionId' | 'types'> & {
  submissionId?: number | null
  types: string[]
}

const normalizeEntry = (entry: InspectionEntryPayload): InspectionEntryPayload => {
  const normalizedLayer = canonicalizeProgressList('layer', [entry.layerName ?? '']).at(0) ?? ''
  const normalizedCheck = canonicalizeProgressList('check', [entry.checkName ?? '']).at(0) ?? ''
  const normalizedTypes = clampTypesForCheck(normalizedCheck, entry.types ?? [])
  return {
    ...entry,
    layerName: normalizedLayer,
    checkName: normalizedCheck,
    types: normalizedTypes,
  }
}

const assertEntryRequiredFields = (entry: InspectionEntryPayload) => {
  if (!entry.layerName) {
    throw new Error('层次必填')
  }
  if (!entry.checkName) {
    throw new Error('验收内容必填')
  }
  if (!entry.types || entry.types.length === 0) {
    throw new Error('验收类型必填')
  }
}

type WorkflowCheckMeta = { layerId: string; order: number }

const mergeRanges = (ranges: Array<{ start: number; end: number }>) => {
  if (!ranges.length) return []
  const sorted = [...ranges].sort((a, b) => a.start - b.start)
  const merged: Array<{ start: number; end: number }> = []
  sorted.forEach((range) => {
    const last = merged[merged.length - 1]
    if (last && range.start <= last.end + 1e-6) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) }
    } else {
      merged.push({ ...range })
    }
  })
  return merged
}

const isWorkflowSatisfied = (status?: InspectionStatus) =>
  (statusPriority[status ?? InspectionStatus.PENDING] ?? 0) >= (statusPriority.SCHEDULED ?? 0)

const resolvePhaseLayers = (phase: {
  layerLinks?: { layerDefinition?: { name: string | null } | null }[]
  phaseDefinition?: { defaultLayers?: { layerDefinition?: { name: string | null } | null }[] } | null
}) => {
  const instanceLayers =
    phase.layerLinks?.map((link) => link.layerDefinition?.name).filter(Boolean) ?? []
  if (instanceLayers.length) {
    return Array.from(new Set(instanceLayers)) as string[]
  }
  const defaultLayers =
    phase.phaseDefinition?.defaultLayers?.map((item) => item.layerDefinition?.name).filter(Boolean) ?? []
  return Array.from(new Set(defaultLayers)) as string[]
}

export class WorkflowValidationError extends Error {
  details?: string[]
  constructor(message: string, details?: string[]) {
    super(message)
    this.name = 'WorkflowValidationError'
    this.details = details
  }
}

export const isWorkflowValidationError = (error: unknown): error is WorkflowValidationError =>
  error instanceof WorkflowValidationError

const assertWorkflowSubmissionRules = async (params: {
  phase: { id: number; phaseDefinitionId: number; name?: string }
  side: IntervalSide
  startPk: number
  endPk: number
  layers: string[]
  checks: string[]
  availableLayers?: string[]
}) => {
  const workflow = await getWorkflowByPhaseDefinitionId(params.phase.phaseDefinitionId)
  if (!workflow || !workflow.layers?.length) return

  const layerIdByName = new Map<string, string>()
  const layerNameById = new Map<string, string>()
  const checkMetaByName = new Map<string, WorkflowCheckMeta[]>()
  const workflowCheckOrderByLayerId = new Map<string, string[]>()

  workflow.layers.forEach((layer) => {
    const normalizedLayer = normalizeLabel(layer.name)
    layerIdByName.set(normalizedLayer, layer.id)
    layerNameById.set(layer.id, layer.name)
    workflowCheckOrderByLayerId.set(layer.id, layer.checks.map((check) => check.name))
    layer.checks.forEach((check, idx) => {
      const list = checkMetaByName.get(normalizeLabel(check.name)) ?? []
      list.push({ layerId: layer.id, order: Number.isFinite(check.order) ? (check.order as number) : idx })
      checkMetaByName.set(normalizeLabel(check.name), list)
    })
  })

  const availableLayerIds = new Set<string>()
  if (params.availableLayers?.length) {
    params.availableLayers.forEach((name) => {
      const matched = layerIdByName.get(normalizeLabel(name))
      if (matched) availableLayerIds.add(matched)
    })
  }

  const selectedLayerIds = new Set<string>()
  params.layers.forEach((layer) => {
    const matched = layerIdByName.get(normalizeLabel(layer))
    if (matched) selectedLayerIds.add(matched)
  })
  const selectedChecksNormalized = new Set(params.checks.map((item) => normalizeLabel(item)))
  const invalidLayers = params.layers.filter((layer) => !layerIdByName.has(normalizeLabel(layer)))
  if (invalidLayers.length) {
    throw new WorkflowValidationError('报检层次不在模板中', invalidLayers)
  }
  const invalidChecks = params.checks.filter((check) => !checkMetaByName.has(normalizeLabel(check)))
  if (invalidChecks.length) {
    throw new WorkflowValidationError('报检内容不在模板中', invalidChecks)
  }
  const targetRange = normalizeRange(params.startPk, params.endPk)
  const satisfiedEntries = await prisma.inspectionEntry.findMany({
    where: {
      phaseId: params.phase.id,
      status: { in: [InspectionStatus.SCHEDULED, InspectionStatus.SUBMITTED, InspectionStatus.IN_PROGRESS, InspectionStatus.APPROVED] },
      startPk: { lte: targetRange.endPk },
      endPk: { gte: targetRange.startPk },
    },
  })
  // 打印模板与本次报检内容，便于直接定位前置校验
  const coverageByLayer = new Map<string, { LEFT: Array<{ start: number; end: number }>; RIGHT: Array<{ start: number; end: number }> }>()
  const completedChecksBySide: { LEFT: Map<string, Set<string>>; RIGHT: Map<string, Set<string>> } = {
    LEFT: new Map(),
    RIGHT: new Map(),
  }

  const ensureCoverage = (layerId: string) => {
    const existing = coverageByLayer.get(layerId)
    if (existing) return existing
    const created = { LEFT: [] as Array<{ start: number; end: number }>, RIGHT: [] as Array<{ start: number; end: number }> }
    coverageByLayer.set(layerId, created)
    return created
  }

  const addCoverage = (layerId: string, side: IntervalSide, range: { start: number; end: number }) => {
    const coverage = ensureCoverage(layerId)
    if (side === 'LEFT') {
      coverage.LEFT.push(range)
    } else if (side === 'RIGHT') {
      coverage.RIGHT.push(range)
    } else {
      coverage.LEFT.push(range)
      coverage.RIGHT.push(range)
    }
  }

  const markCheckCompleted = (layerId: string, side: IntervalSide, checkName: string) => {
    const normalized = normalizeLabel(checkName)
    const map = side === 'LEFT' ? completedChecksBySide.LEFT : completedChecksBySide.RIGHT
    const set = map.get(layerId) ?? new Set<string>()
    set.add(normalized)
    map.set(layerId, set)
  }

  const markLayerChecksCompleted = (layerId: string, side: IntervalSide) => {
    const checksForLayer = workflowCheckOrderByLayerId.get(layerId) ?? []
    checksForLayer.forEach((name) => markCheckCompleted(layerId, side, name))
  }

  satisfiedEntries.forEach((entry) => {
    const layerId = layerIdByName.get(normalizeLabel(entry.layerName ?? ''))
    if (!layerId) return
    if (!isWorkflowSatisfied(entry.status)) return
    const { startPk, endPk } = normalizeRange(entry.startPk, entry.endPk)
    if (endPk < targetRange.startPk || startPk > targetRange.endPk) return
    const clippedStart = Math.max(startPk, targetRange.startPk)
    const clippedEnd = Math.min(endPk, targetRange.endPk)
    if (clippedEnd < clippedStart) return
    const sides = entry.side === 'BOTH' ? (['LEFT', 'RIGHT'] as IntervalSide[]) : [entry.side]
    sides.forEach((side) => {
      addCoverage(layerId, side, { start: clippedStart, end: clippedEnd })
      markLayerChecksCompleted(layerId, side)
    })
    if (entry.checkName) {
      const metaList = checkMetaByName.get(normalizeLabel(entry.checkName))
      const metaForLayer = metaList?.find((item) => item.layerId === layerId)
      if (metaForLayer) {
        sides.forEach((side) => {
          markCheckCompleted(metaForLayer.layerId, side, entry.checkName as string)
        })
      }
    }
  })

  const hasCoverage = (layerId: string, side: IntervalSide) => {
    const coverage = coverageByLayer.get(layerId)
    if (!coverage) return false
    const ranges = side === 'LEFT' ? coverage.LEFT : coverage.RIGHT
    if (!ranges.length) return false
    const merged = mergeRanges(ranges)
    let cursor = targetRange.startPk
    for (const range of merged) {
      if (range.end < cursor - 1e-6) continue
      if (range.start > cursor + 1e-6) return false
      cursor = Math.max(cursor, range.end)
      if (cursor >= targetRange.endPk - 1e-6) {
        return true
      }
    }
    return cursor >= targetRange.endPk - 1e-6
  }

  const hasCompletedCheck = (layerId: string, side: IntervalSide, checkName: string) => {
    const map = side === 'LEFT' ? completedChecksBySide.LEFT : completedChecksBySide.RIGHT
    const normalized = normalizeLabel(checkName)
    return map.get(layerId)?.has(normalized) ?? false
  }

  const missingDeps = new Set<string>()
  const resolveDependencies = (layerId: string, visited = new Set<string>()): string[] => {
    if (visited.has(layerId)) return []
    visited.add(layerId)
    const layer = workflow.layers.find((item) => item.id === layerId)
    if (!layer || !layer.dependencies?.length) return []
    const resolved: string[] = []
    layer.dependencies.forEach((depId) => {
      if (!availableLayerIds.size || availableLayerIds.has(depId)) {
        resolved.push(depId)
        return
      }
      const fallback = resolveDependencies(depId, new Set(visited))
      if (fallback.length) {
        resolved.push(...fallback)
      }
    })
    return Array.from(new Set(resolved))
  }

  selectedLayerIds.forEach((layerId) => {
    const layer = workflow.layers.find((item) => item.id === layerId)
    if (!layer || !layer.dependencies?.length) return
    const dependenciesToCheck = resolveDependencies(layerId)
    dependenciesToCheck.forEach((depId) => {
      if (selectedLayerIds.has(depId)) return
      if (params.side === 'BOTH') {
        const leftCovered = hasCoverage(depId, 'LEFT')
        const rightCovered = hasCoverage(depId, 'RIGHT')
        if (!leftCovered) missingDeps.add(`左侧：${layerNameById.get(depId) ?? depId}`)
        if (!rightCovered) missingDeps.add(`右侧：${layerNameById.get(depId) ?? depId}`)
      } else if (!hasCoverage(depId, params.side)) {
        missingDeps.add(layerNameById.get(depId) ?? depId)
      }
    })
  })
  if (missingDeps.size) {
    const depsText = Array.from(missingDeps).join('、')
    throw new WorkflowValidationError(
      `缺少前置报检/预约：${depsText}`,
      Array.from(missingDeps),
    )
  }

  const targetSides: IntervalSide[] = params.side === 'BOTH' ? ['LEFT', 'RIGHT'] : [params.side]
  const missingChecks = new Set<string>()
  params.checks.forEach((check) => {
    const candidates = checkMetaByName.get(normalizeLabel(check))
    if (!candidates || !candidates.length) return
    const meta =
      candidates.find((item) => selectedLayerIds.has(item.layerId)) ??
      candidates.find((item) => {
        const orderedChecks = workflowCheckOrderByLayerId.get(item.layerId) ?? []
        return orderedChecks.some((name) => normalizeLabel(name) === normalizeLabel(check))
      }) ??
      candidates[0]
    const orderedChecks = workflowCheckOrderByLayerId.get(meta.layerId) ?? []
    for (let idx = 0; idx < meta.order; idx += 1) {
      const requiredName = orderedChecks[idx]
      const normalizedRequired = normalizeLabel(requiredName)
      const selectedNow = selectedChecksNormalized.has(normalizedRequired)
      const completed = targetSides.every((side) => hasCompletedCheck(meta.layerId, side, requiredName))
      if (!selectedNow && !completed) {
        missingChecks.add(requiredName)
      }
    }
  })
  if (missingChecks.size) {
    const checksText = Array.from(missingChecks).join('、')
    throw new WorkflowValidationError(
      `缺少前置验收内容：${checksText}`,
      Array.from(missingChecks),
    )
  }
}

const toOrderBy = (
  field: NonNullable<InspectionEntryFilter['sortField']>,
  order: 'asc' | 'desc',
): Prisma.InspectionEntryOrderByWithRelationInput | Prisma.InspectionEntryOrderByWithRelationInput[] => {
  switch (field) {
    case 'road':
      return { road: { name: order } }
    case 'phase':
      return { phase: { name: order } }
    case 'side':
      return { side: order }
    case 'range':
      return [{ startPk: order }, { endPk: order }]
    case 'layers':
      return { layerName: order }
    case 'checks':
      return { checkName: order }
    case 'submissionOrder':
      return [{ submissionOrder: order }, { startPk: order }]
    case 'status':
      return { status: order }
    case 'appointmentDate':
      return { appointmentDate: order }
    case 'submittedAt':
      return { submittedAt: order }
    case 'submittedBy':
      return { submitter: { username: order } }
    case 'createdBy':
      return { creator: { username: order } }
    case 'createdAt':
      return { createdAt: order }
    case 'updatedBy':
      return { updater: { username: order } }
    case 'updatedAt':
      return { updatedAt: order }
    case 'remark':
      return { remark: order }
    default:
      return { updatedAt: order }
  }
}

export const listInspectionEntries = async (filter: InspectionEntryFilter): Promise<InspectionEntryListResponse> => {
  const page = Math.max(1, filter.page || 1)
  const pageSize = Math.max(1, Math.min(1000, filter.pageSize || 20))
  const skip = (page - 1) * pageSize
  const sortStack = filter.sort?.length
    ? filter.sort
    : [{ field: filter.sortField ?? 'updatedAt', order: filter.sortOrder ?? 'desc' }]
  const orderBy: Prisma.InspectionEntryOrderByWithRelationInput[] = []
  sortStack.forEach((spec) => {
    const clause = toOrderBy(spec.field, spec.order)
    if (Array.isArray(clause)) {
      orderBy.push(...clause)
    } else {
      orderBy.push(clause)
    }
  })

  const where: Prisma.InspectionEntryWhereInput = {}
  if (filter.roadSlugs && filter.roadSlugs.length) {
    where.road = { slug: { in: filter.roadSlugs } }
  } else if (filter.roadSlug) {
    where.road = { slug: filter.roadSlug }
  }
  if (filter.phaseId) {
    where.phaseId = filter.phaseId
  }
  if (filter.phaseDefinitionIds && filter.phaseDefinitionIds.length) {
    where.phase = { is: { phaseDefinitionId: { in: filter.phaseDefinitionIds } } }
  } else if (filter.phaseDefinitionId) {
    where.phase = { is: { phaseDefinitionId: filter.phaseDefinitionId } }
  }
  if (filter.status && filter.status.length) {
    where.status = { in: filter.status as InspectionStatus[] }
  }
  if (filter.side) {
    where.side = filter.side as IntervalSide
  }
  if (filter.layerNames && filter.layerNames.length) {
    where.layerName = { in: filter.layerNames }
  }
  if (filter.types && filter.types.length) {
    where.types = { hasSome: filter.types }
  }
  if (filter.checkId) {
    where.checkId = filter.checkId
  }
  if (filter.checkNames && filter.checkNames.length) {
    where.checkName = { in: filter.checkNames }
  } else if (filter.checkName) {
    where.checkName = { contains: filter.checkName, mode: 'insensitive' }
  }
  if (Number.isFinite(filter.startPkFrom)) {
    where.startPk = { gte: filter.startPkFrom as number }
  }
  if (Number.isFinite(filter.startPkTo)) {
    where.endPk = { lte: filter.startPkTo as number }
  }
  if (filter.keyword) {
    const normalizedKeyword = filter.keyword.trim()
    const remarkPrefix = 'remark:'
    if (normalizedKeyword.toLowerCase().startsWith(remarkPrefix)) {
      const remarkValue = normalizedKeyword.slice(remarkPrefix.length).trim()
      if (remarkValue) {
        where.remark = { contains: remarkValue, mode: 'insensitive' }
      }
    } else {
      where.OR = [
        { remark: { contains: normalizedKeyword, mode: 'insensitive' } },
        { layerName: { contains: normalizedKeyword, mode: 'insensitive' } },
        { checkName: { contains: normalizedKeyword, mode: 'insensitive' } },
        { phase: { name: { contains: normalizedKeyword, mode: 'insensitive' } } },
        { road: { name: { contains: normalizedKeyword, mode: 'insensitive' } } },
      ]
    }
  }
  if (filter.startDate || filter.endDate) {
    where.createdAt = {
      gte: filter.startDate ? new Date(filter.startDate) : undefined,
      lte: filter.endDate ? new Date(filter.endDate) : undefined,
    }
  }

  const [total, rows] = await prisma.$transaction([
    prisma.inspectionEntry.count({ where }),
    prisma.inspectionEntry.findMany({
      where,
      include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
      orderBy: orderBy.length ? orderBy : [{ updatedAt: 'desc' }],
      skip,
      take: pageSize,
    }),
  ])

  return {
    items: rows.map(mapEntry),
    total,
    page,
    pageSize,
  }
}

export const createInspectionEntries = async (
  entries: InspectionEntryPayload[],
  userId: number | null,
): Promise<InspectionEntryDTO[]> => {
  if (!entries.length) {
    throw new Error('至少需要一条报检明细')
  }

  const providedSubmissionIds = Array.from(
    new Set(entries.map((item) => item.submissionId).filter((v): v is number => Number.isFinite(v))),
  )
  if (providedSubmissionIds.length) {
    const submissions = await prisma.submission.findMany({ where: { id: { in: providedSubmissionIds } } })
    if (submissions.length !== providedSubmissionIds.length) {
      throw new Error('提交单号不存在，请重新选择')
    }
  }

  const roadIds = Array.from(new Set(entries.map((item) => item.roadId)))
  const roads = await prisma.roadSection.findMany({ where: { id: { in: roadIds } } })
  if (roads.length !== roadIds.length) {
    throw new Error('路段不存在或已删除')
  }
  const roadMap = new Map(roads.map((road) => [road.id, road]))

  const phaseIds = Array.from(new Set(entries.map((item) => item.phaseId)))
  const phases = await prisma.roadPhase.findMany({
    where: { id: { in: phaseIds } },
    include: {
      intervals: true,
      layerLinks: { include: { layerDefinition: true } },
      phaseDefinition: { include: { defaultLayers: { include: { layerDefinition: true } } } },
    },
  })
  if (phases.length !== phaseIds.length) {
    throw new Error('分项不存在或已删除')
  }
  const phaseMap = new Map(phases.map((phase) => [phase.id, phase]))
  const resolvedLayersByPhaseId = new Map<number, string[]>(phases.map((phase) => [phase.id, resolvePhaseLayers(phase)]))

  const prepared: { data: InspectionEntryCreateData; meta: { roadSlug: string } }[] = []
  let generatedSubmissionId: number | null = null
  const workflowGroups = new Map<
    string,
    {
      phase: (typeof phases)[number]
      side: IntervalSide
      startPk: number
      endPk: number
      layers: Set<string>
      checks: Set<string>
    }
  >()
  const ensureSubmissionId = async (provided?: number | null) => {
    if (Number.isFinite(provided)) return provided as number
    if (!generatedSubmissionId) {
      const submission = await createSubmission(undefined, undefined, [])
      generatedSubmissionId = submission.id
    }
    return generatedSubmissionId
  }

  for (const raw of entries) {
    const normalized = normalizeEntry(raw)
    assertEntryRequiredFields(normalized)
    const submissionId = await ensureSubmissionId(normalized.submissionId ?? null)
    const side = normalizeSide(normalized.side)
    const range = normalizeRange(normalized.startPk, normalized.endPk)
    const phase = phaseMap.get(normalized.phaseId)!
    assertPointSideAllowed(phase, side as IntervalSide, range)
    const appointmentDate = normalized.appointmentDate ? new Date(normalized.appointmentDate) : null
    const submittedAt = normalized.submittedAt ? new Date(normalized.submittedAt) : new Date()

    const road = roadMap.get(normalized.roadId)
    if (!road) {
      throw new Error('路段不存在或已删除')
    }

    if (phase.roadId !== normalized.roadId) {
      throw new Error('分项与路段不匹配，请刷新后重试')
    }

    const groupKey = `${phase.id}:${side}:${range.startPk}:${range.endPk}`
    const group = workflowGroups.get(groupKey) ?? {
      phase,
      side: side as IntervalSide,
      startPk: range.startPk,
      endPk: range.endPk,
      layers: new Set<string>(),
      checks: new Set<string>(),
    }
    group.layers.add(normalized.layerName)
    group.checks.add(normalized.checkName)
    workflowGroups.set(groupKey, group)

    prepared.push({
      data: {
        submissionId,
        roadId: normalized.roadId,
        phaseId: normalized.phaseId,
        side: side as IntervalSide,
        startPk: range.startPk,
        endPk: range.endPk,
        layerId: normalized.layerId ?? undefined,
        layerName: normalized.layerName,
        checkId: normalized.checkId ?? undefined,
        checkName: normalized.checkName,
        types: normalized.types,
        status: (normalized.status as InspectionStatus | undefined) ?? InspectionStatus.SCHEDULED,
        appointmentDate: appointmentDate ?? undefined,
        remark: normalized.remark,
        submissionOrder: normalized.submissionOrder ?? undefined,
        submittedAt,
        submittedBy: userId ?? undefined,
        createdBy: userId ?? undefined,
        updatedBy: userId ?? undefined,
      },
      meta: { roadSlug: road.slug },
    })
  }

  for (const group of Array.from(workflowGroups.values())) {
    const availableLayers = resolvedLayersByPhaseId.get(group.phase.id)
    await assertWorkflowSubmissionRules({
      phase: { id: group.phase.id, phaseDefinitionId: group.phase.phaseDefinitionId },
      side: group.side,
      startPk: group.startPk,
      endPk: group.endPk,
      layers: Array.from(group.layers),
      checks: Array.from(group.checks),
      availableLayers,
    })
  }

  const uniqueByKey = new Map<string, InspectionEntryCreateData>()
  const keyFor = (data: InspectionEntryCreateData) =>
    [
      data.roadId,
      data.phaseId,
      data.side,
      data.startPk,
      data.endPk,
      normalizeLabel(data.layerName),
      normalizeLabel(data.checkName),
    ].join(':')

  prepared.forEach((item) => {
    const key = keyFor(item.data)
    const existing = uniqueByKey.get(key)
    if (!existing) {
      uniqueByKey.set(key, item.data)
      return
    }
    const mergedTypes = mergeTypesForCheck(item.data.checkName, existing.types, item.data.types)
    uniqueByKey.set(key, {
      ...existing,
      types: mergedTypes,
      remark: item.data.remark ?? existing.remark,
      appointmentDate: item.data.appointmentDate ?? existing.appointmentDate,
      submissionOrder:
        item.data.submissionOrder !== undefined ? item.data.submissionOrder : existing.submissionOrder,
    })
  })

  const results: InspectionEntryDTO[] = []
  for (const data of Array.from(uniqueByKey.values())) {
    const existing = await prisma.inspectionEntry.findFirst({
      where: {
        roadId: data.roadId,
        phaseId: data.phaseId,
        side: data.side,
        startPk: data.startPk,
        endPk: data.endPk,
        layerName: data.layerName,
        checkName: data.checkName,
      },
      orderBy: { id: 'asc' },
      include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
    })

    if (existing) {
      const mergedTypes = mergeTypesForCheck(data.checkName, existing.types, data.types)
      const updateData: Prisma.InspectionEntryUncheckedUpdateInput = {
        types: mergedTypes,
        updatedBy: data.updatedBy,
      }
      if (data.remark) updateData.remark = data.remark
      if (data.appointmentDate) updateData.appointmentDate = data.appointmentDate
      if (data.submissionOrder !== undefined) updateData.submissionOrder = data.submissionOrder

      const updated = await prisma.inspectionEntry.update({
        where: { id: existing.id },
        data: updateData,
        include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
      })
      results.push(mapEntry(updated as any))
    } else {
      const created = await prisma.inspectionEntry.create({
        data: data as Prisma.InspectionEntryUncheckedCreateInput,
        include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
      })
      results.push(mapEntry(created as any))
    }
  }

  return results
}

export const aggregateEntriesAsListItems = async (
  filter: InspectionEntryFilter & { ids?: number[]; groupByLayer?: boolean },
): Promise<{ items: InspectionListItem[]; total: number; page: number; pageSize: number }> => {
  const page = Math.max(1, filter.page || 1)
  const pageSize = Math.max(1, Math.min(100, filter.pageSize || 20))
  const skip = (page - 1) * pageSize
  const where: Prisma.InspectionEntryWhereInput = {
    ...(filter.ids?.length ? { id: { in: filter.ids } } : {}),
    ...(filter.roadSlug ? { road: { slug: filter.roadSlug } } : {}),
    ...(filter.phaseId ? { phaseId: filter.phaseId } : {}),
    ...(filter.phaseDefinitionId ? { phase: { phaseDefinitionId: filter.phaseDefinitionId } } : {}),
    ...(filter.status?.length ? { status: { in: filter.status as InspectionStatus[] } } : {}),
    ...(filter.side ? { side: filter.side as IntervalSide } : {}),
    ...(filter.types?.length ? { types: { hasSome: filter.types } } : {}),
    ...(filter.checkId ? { checkId: filter.checkId } : {}),
    ...(filter.checkName ? { checkName: { contains: filter.checkName, mode: 'insensitive' as const } } : {}),
    ...(filter.keyword
      ? {
          OR: [
            { remark: { contains: filter.keyword, mode: 'insensitive' } },
            { layerName: { contains: filter.keyword, mode: 'insensitive' } },
            { checkName: { contains: filter.keyword, mode: 'insensitive' } },
            { phase: { name: { contains: filter.keyword, mode: 'insensitive' } } },
            { road: { name: { contains: filter.keyword, mode: 'insensitive' } } },
          ],
        }
      : {}),
    ...(filter.startDate || filter.endDate
      ? {
          createdAt: {
            gte: filter.startDate ? new Date(filter.startDate) : undefined,
            lte: filter.endDate ? new Date(filter.endDate) : undefined,
          },
        }
      : {}),
  }

  const [total, entries] = await prisma.$transaction([
    prisma.inspectionEntry.count({ where }),
    prisma.inspectionEntry.findMany({
      where,
      include: { road: true, phase: true, submission: true, submitter: true, creator: true, updater: true },
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: pageSize,
    }),
  ])

  const grouped = new Map<string, InspectionListItem>()
  entries.forEach((entry) => {
    const layerKey = entry.layerId
      ? `id:${entry.layerId}`
      : entry.layerName
        ? `name:${normalizeLabel(entry.layerName)}`
        : 'layer:unknown'
    const baseKey = `${entry.roadId}:${entry.phaseId}:${entry.side}:${entry.startPk}:${entry.endPk}:${entry.submissionId ?? ''}`
    const key = filter.groupByLayer ? `${baseKey}:${layerKey}` : baseKey
    const priority = statusPriority[entry.status]
    const existing = grouped.get(key)
    const layerToken = entry.layerName
    const checkToken = entry.checkName
    const updatedAt = entry.updatedAt.getTime()
    if (!existing) {
      grouped.set(key, {
        id: entry.id,
        roadId: entry.roadId,
        roadName: entry.road.name,
        roadSlug: entry.road.slug,
        phaseId: entry.phaseId,
        phaseName: entry.phase.name,
        submissionId: entry.submissionId,
        submissionCode: entry.submission?.code ?? null,
        side: entry.side,
        startPk: entry.startPk,
        endPk: entry.endPk,
        layers: layerToken ? [layerToken] : [],
        checks: checkToken ? [checkToken] : [],
        types: entry.types,
        submissionOrder: entry.submissionOrder ?? undefined,
        status: entry.status,
        remark: entry.remark ?? undefined,
        appointmentDate: entry.appointmentDate?.toISOString(),
        submittedAt: entry.submittedAt.toISOString(),
        submittedBy: entry.submitter ? { id: entry.submitter.id, username: entry.submitter.username } : null,
        createdBy: entry.creator ? { id: entry.creator.id, username: entry.creator.username } : null,
        createdAt: entry.createdAt.toISOString(),
        updatedAt: entry.updatedAt.toISOString(),
        updatedBy: entry.updater ? { id: entry.updater.id, username: entry.updater.username } : null,
      })
    } else {
      const existingPriority = statusPriority[existing.status]
      const mergedStatus =
        priority > existingPriority
          ? entry.status
          : priority < existingPriority
            ? existing.status
            : updatedAt >= new Date(existing.updatedAt).getTime()
              ? entry.status
              : existing.status
      grouped.set(key, {
        ...existing,
        id: Math.max(existing.id, entry.id),
        layers: filter.groupByLayer
          ? existing.layers && existing.layers.length
            ? existing.layers
            : layerToken
              ? [layerToken]
              : existing.layers
          : Array.from(new Set([...(existing.layers || []), layerToken].filter(Boolean))),
        checks: Array.from(new Set([...(existing.checks || []), checkToken].filter(Boolean))),
        types: Array.from(new Set([...(existing.types || []), ...(entry.types || [])])),
        status: mergedStatus,
        updatedAt:
          updatedAt >= new Date(existing.updatedAt).getTime() ? entry.updatedAt.toISOString() : existing.updatedAt,
      })
    }
  })

  const items = Array.from(grouped.values())
  return { items, total, page, pageSize }
}

export const listSubmissions = async (): Promise<{ id: number; code: string }[]> => {
  const rows = await prisma.submission.findMany({
    orderBy: [{ id: 'asc' }],
    select: { id: true, code: true },
  })
  return rows
}

const nextSubmissionCode = async () => {
  const latest = await prisma.submission.findFirst({ orderBy: { id: 'desc' }, select: { id: true } })
  const next = (latest?.id ?? 0) + 1
  return `SUB-${String(next).padStart(3, '0')}`
}

export const createSubmission = async (code?: string, remark?: string, files?: unknown) => {
  const finalCode = code && code.trim().length > 0 ? code.trim() : await nextSubmissionCode()
  const submission = await prisma.submission.create({
    data: {
      code: finalCode,
      remark: remark ?? undefined,
      files: files ?? [],
    },
  })
  return submission
}
