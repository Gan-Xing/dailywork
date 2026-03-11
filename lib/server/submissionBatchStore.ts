import {
  DocumentStatus,
  DocumentType,
  InspectionStatus,
  Prisma,
  TemplateStatus,
} from '@prisma/client'

import {
  DEFAULT_SUBMISSION_SUBJECT,
  DEFAULT_SUBMISSION_TITLE,
  buildDefaultSubmissionDraft,
} from '@/lib/documents/submissionDefaults'
import {
  MAX_SUBMISSION_ITEM_ROWS,
  buildSubmissionAutoItemsFromInspections,
  chunkSubmissionItems,
  type SubmissionAutoItem,
} from '@/lib/documents/submissionItems'
import { prisma } from '@/lib/prisma'
import { LEVEL_CROSSING_ROAD_SLUG } from '@/lib/roadConstants'
import type { InspectionListItem, IntervalSide, LevelCrossingSide } from '@/lib/progressTypes'

import { createSubmissionDocWithClient, getNextSubmissionNumber, type SubmissionStoreClient } from './submissionDocStore'

type BatchStoreClient = Prisma.TransactionClient

type RawInspectionEntry = Prisma.InspectionEntryGetPayload<{
  include: {
    road: true
    locationRoad: true
    phase: true
    interval: { select: { spec: true } }
    document: { include: { submission: true } }
  }
}>

type BatchedInspectionListItem = InspectionListItem & {
  rawInspectionIds: number[]
}

type PreparedSubmissionRow = SubmissionAutoItem & {
  roadName: string
  phaseName: string
  side: IntervalSide
  startPk: number
  endPk: number
  rawInspectionIds: number[]
  linePreview: string | null
}

export type SubmissionBatchPackingPolicy = 'strict-12' | 'road-first-then-12'
export type SubmissionBatchSortPolicy = 'road-phase-pk-side'
export type SubmissionBatchStatusAfterBind = 'KEEP' | InspectionStatus

export type SubmissionBatchSelection = {
  inspectionIds?: number[]
  inspectionStatuses?: InspectionStatus[]
  unboundOnly?: boolean
  roadIds?: number[]
  phaseIds?: number[]
}

export type SubmissionBatchInput = SubmissionBatchSelection & {
  title?: string
  subject?: string
  documentStatus?: DocumentStatus
  statusAfterBind?: SubmissionBatchStatusAfterBind
  packingPolicy?: SubmissionBatchPackingPolicy
  sortPolicy?: SubmissionBatchSortPolicy
  maxRows?: number
  templateId?: string | null
  now?: Date
}

export type SubmissionBatchChunkSummary = {
  chunkIndex: number
  suggestedSubmissionNumber: number
  groupedItemCount: number
  rawInspectionCount: number
  roads: string[]
  phases: string[]
  firstLine: string | null
  lastLine: string | null
}

export type SubmissionBatchPreview = {
  rawInspectionCount: number
  groupedInspectionCount: number
  groupedItemCount: number
  submissionCount: number
  nextSubmissionNumber: number
  title: string
  subject: string
  statusAfterBind: SubmissionBatchStatusAfterBind
  documentStatus: DocumentStatus
  maxRows: number
  packingPolicy: SubmissionBatchPackingPolicy
  sortPolicy: SubmissionBatchSortPolicy
  templateId: string | null
  templateVersion: number | null
  chunks: SubmissionBatchChunkSummary[]
}

export type SubmissionBatchExecutionResult = SubmissionBatchPreview & {
  created: Array<{
    documentId: number
    code: string
    submissionNumber: number
    itemCount: number
    rawInspectionCount: number
  }>
}

const normalizeLabel = (value: string) => value.trim().toLowerCase()

const normalizeSpec = (value?: string | null) => {
  if (typeof value !== 'string') return null
  const cleaned = value.trim().replace(/\s+/g, ' ')
  return cleaned || null
}

const statusPriority: Record<InspectionStatus, number> = {
  PENDING: 1,
  SCHEDULED: 2,
  SUBMITTED: 3,
  IN_PROGRESS: 4,
  APPROVED: 5,
}

const sidePriority: Record<IntervalSide, number> = {
  LEFT: 1,
  RIGHT: 2,
  BOTH: 3,
}

const buildWhere = (input: SubmissionBatchSelection): Prisma.InspectionEntryWhereInput => ({
  ...(input.inspectionIds?.length ? { id: { in: input.inspectionIds } } : {}),
  ...(input.inspectionStatuses?.length ? { status: { in: input.inspectionStatuses } } : {}),
  ...(input.unboundOnly ? { documentId: null } : {}),
  ...(input.roadIds?.length ? { roadId: { in: input.roadIds } } : {}),
  ...(input.phaseIds?.length ? { phaseId: { in: input.phaseIds } } : {}),
})

const aggregateKeyOf = (entry: {
  roadId: number
  locationRoadId: number | null
  levelCrossingSide: LevelCrossingSide | null
  phaseId: number
  intervalId: number | null
  side: IntervalSide
  startPk: number
  endPk: number
  documentId: number | null
}) =>
  `${entry.roadId}:${entry.locationRoadId ?? 'null'}:${entry.levelCrossingSide ?? 'null'}:${entry.phaseId}:${entry.intervalId ?? 'null'}:${entry.side}:${entry.startPk}:${entry.endPk}:${entry.documentId ?? ''}`

const resolveEffectiveLocation = (row: RawInspectionEntry) => {
  const fallbackLocationRoadId = row.road.slug === LEVEL_CROSSING_ROAD_SLUG ? null : row.roadId
  const effectiveLocationRoadId = row.locationRoadId ?? fallbackLocationRoadId
  const resolvedLocationRoad =
    row.locationRoad ?? (effectiveLocationRoadId && effectiveLocationRoadId === row.roadId ? row.road : null)

  return {
    effectiveLocationRoadId,
    resolvedLocationRoad,
  }
}

const aggregateInspectionRows = (rows: RawInspectionEntry[]): BatchedInspectionListItem[] => {
  const grouped = new Map<string, BatchedInspectionListItem>()

  rows.forEach((row) => {
    const { effectiveLocationRoadId, resolvedLocationRoad } = resolveEffectiveLocation(row)
    const key = aggregateKeyOf({
      roadId: row.roadId,
      locationRoadId: effectiveLocationRoadId ?? null,
      levelCrossingSide: row.levelCrossingSide ?? null,
      phaseId: row.phaseId,
      intervalId: row.intervalId ?? null,
      side: row.side,
      startPk: row.startPk,
      endPk: row.endPk,
      documentId: row.documentId ?? null,
    })
    const priority = statusPriority[row.status]
    const existing = grouped.get(key)
    const layerToken = row.layerName
    const checkToken = row.checkName
    const intervalSpecToken = normalizeSpec(row.interval?.spec)
    const updatedAt = row.updatedAt.getTime()

    if (!existing) {
      grouped.set(key, {
        id: 0,
        roadId: row.roadId,
        roadName: row.road.name,
        roadSlug: row.road.slug,
        locationRoadId: effectiveLocationRoadId ?? null,
        locationRoadName: resolvedLocationRoad?.name ?? null,
        locationRoadSlug: resolvedLocationRoad?.slug ?? null,
        levelCrossingSide: row.levelCrossingSide ?? null,
        phaseId: row.phaseId,
        phaseName: row.phase.name,
        intervalId: row.intervalId ?? null,
        intervalSpec: intervalSpecToken,
        documentId: row.documentId ?? null,
        documentCode: row.document?.code ?? null,
        submissionId: row.documentId ?? null,
        submissionCode: row.document?.code ?? null,
        submissionNumber: row.document?.submission?.submissionNumber ?? null,
        side: row.side,
        startPk: row.startPk,
        endPk: row.endPk,
        layers: layerToken ? [layerToken] : [],
        checks: checkToken ? [checkToken] : [],
        types: row.types,
        submissionOrder: row.submissionOrder ?? undefined,
        status: row.status,
        remark: row.remark ?? undefined,
        appointmentDate: row.appointmentDate?.toISOString(),
        submittedAt: row.submittedAt.toISOString(),
        submittedBy: null,
        createdBy: null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: null,
        rawInspectionIds: [row.id],
      })
      return
    }

    const existingPriority = statusPriority[existing.status]
    const mergedStatus =
      priority > existingPriority
        ? row.status
        : priority < existingPriority
          ? existing.status
          : updatedAt >= new Date(existing.updatedAt).getTime()
            ? row.status
            : existing.status

    grouped.set(key, {
      ...existing,
      documentId: existing.documentId ?? row.documentId ?? null,
      documentCode: existing.documentCode ?? row.document?.code ?? null,
      submissionId: existing.submissionId ?? row.documentId ?? null,
      submissionCode: existing.submissionCode ?? row.document?.code ?? null,
      submissionNumber: existing.submissionNumber ?? row.document?.submission?.submissionNumber ?? null,
      intervalSpec: existing.intervalSpec ?? intervalSpecToken,
      layers: Array.from(new Set([...(existing.layers || []), layerToken].filter(Boolean))),
      checks: Array.from(new Set([...(existing.checks || []), checkToken].filter(Boolean))),
      types: Array.from(new Set([...(existing.types || []), ...(row.types || [])])),
      status: mergedStatus,
      updatedAt:
        updatedAt >= new Date(existing.updatedAt).getTime() ? row.updatedAt.toISOString() : existing.updatedAt,
      rawInspectionIds: Array.from(new Set([...existing.rawInspectionIds, row.id])).sort((left, right) => left - right),
    })
  })

  return Array.from(grouped.values()).map((item, index) => ({
    ...item,
    id: index + 1,
  }))
}

const sortInspections = (items: BatchedInspectionListItem[], sortPolicy: SubmissionBatchSortPolicy) => {
  if (sortPolicy !== 'road-phase-pk-side') return items

  return [...items].sort((left, right) => {
    const roadCompare = left.roadName.localeCompare(right.roadName, 'fr', { sensitivity: 'base' })
    if (roadCompare !== 0) return roadCompare
    const phaseCompare = left.phaseName.localeCompare(right.phaseName, 'fr', { sensitivity: 'base' })
    if (phaseCompare !== 0) return phaseCompare
    const startCompare = left.startPk - right.startPk
    if (startCompare !== 0) return startCompare
    const endCompare = left.endPk - right.endPk
    if (endCompare !== 0) return endCompare
    const sideCompare = (sidePriority[left.side] ?? 99) - (sidePriority[right.side] ?? 99)
    if (sideCompare !== 0) return sideCompare
    return left.id - right.id
  })
}

const sortPreparedRows = (rows: PreparedSubmissionRow[], sortPolicy: SubmissionBatchSortPolicy) => {
  if (sortPolicy !== 'road-phase-pk-side') return rows

  return [...rows].sort((left, right) => {
    const roadCompare = left.roadName.localeCompare(right.roadName, 'fr', { sensitivity: 'base' })
    if (roadCompare !== 0) return roadCompare
    const phaseCompare = left.phaseName.localeCompare(right.phaseName, 'fr', { sensitivity: 'base' })
    if (phaseCompare !== 0) return phaseCompare
    const startCompare = left.startPk - right.startPk
    if (startCompare !== 0) return startCompare
    const endCompare = left.endPk - right.endPk
    if (endCompare !== 0) return endCompare
    const sideCompare = (sidePriority[left.side] ?? 99) - (sidePriority[right.side] ?? 99)
    if (sideCompare !== 0) return sideCompare
    return String(left.designation).localeCompare(String(right.designation), 'fr', { sensitivity: 'base' })
  })
}

const buildPreparedRows = (items: BatchedInspectionListItem[]): PreparedSubmissionRow[] => {
  const aggregatedById = new Map(items.map((item) => [item.id, item]))
  const autoItems = buildSubmissionAutoItemsFromInspections(items)

  return autoItems.map((item) => {
    const sourceItems = item.sourceInspectionIds
      .map((id) => aggregatedById.get(id))
      .filter((value): value is BatchedInspectionListItem => Boolean(value))
    const sample = sourceItems[0]
    return {
      ...item,
      roadName: sample?.roadName ?? '',
      phaseName: sample?.phaseName ?? '',
      side: sample?.side ?? 'BOTH',
      startPk: sample?.startPk ?? 0,
      endPk: sample?.endPk ?? 0,
      rawInspectionIds: Array.from(
        new Set(sourceItems.flatMap((sourceItem) => sourceItem.rawInspectionIds)),
      ).sort((left, right) => left - right),
      linePreview: String(item.designation || '').split('\n')[0] || null,
    }
  })
}

const packPreparedRows = (
  rows: PreparedSubmissionRow[],
  packingPolicy: SubmissionBatchPackingPolicy,
  maxRows: number,
): PreparedSubmissionRow[][] => {
  if (packingPolicy === 'road-first-then-12') {
    const byRoad = new Map<string, PreparedSubmissionRow[]>()
    rows.forEach((row) => {
      const bucket = byRoad.get(row.roadName) ?? []
      bucket.push(row)
      byRoad.set(row.roadName, bucket)
    })
    return Array.from(byRoad.values()).flatMap((roadRows) => chunkSubmissionItems(roadRows, maxRows))
  }

  return chunkSubmissionItems(rows, maxRows)
}

const resolveTemplate = async (client: BatchStoreClient, templateId?: string | null) => {
  if (templateId) {
    const explicit = await client.documentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, version: true },
    })
    if (!explicit) {
      throw new Error('提交单模板不存在，请重新选择')
    }
    return explicit
  }

  const published = await client.documentTemplate.findFirst({
    where: { type: DocumentType.SUBMISSION, status: TemplateStatus.PUBLISHED },
    orderBy: [{ updatedAt: 'desc' }, { version: 'desc' }],
    select: { id: true, version: true },
  })
  if (published) return published

  return null
}

const summarizeChunks = (chunks: PreparedSubmissionRow[][], nextSubmissionNumber: number): SubmissionBatchChunkSummary[] =>
  chunks.map((chunk, index) => ({
    chunkIndex: index + 1,
    suggestedSubmissionNumber: nextSubmissionNumber + index,
    groupedItemCount: chunk.length,
    rawInspectionCount: Array.from(new Set(chunk.flatMap((row) => row.rawInspectionIds))).length,
    roads: Array.from(new Set(chunk.map((row) => row.roadName))).filter(Boolean),
    phases: Array.from(new Set(chunk.map((row) => row.phaseName))).filter(Boolean),
    firstLine: chunk[0]?.linePreview ?? null,
    lastLine: chunk[chunk.length - 1]?.linePreview ?? null,
  }))

type PreparedSubmissionBatch = SubmissionBatchPreview & {
  now: Date
  chunksWithRows: PreparedSubmissionRow[][]
}

const prepareSubmissionBatch = async (
  input: SubmissionBatchInput,
  client: BatchStoreClient = prisma,
): Promise<PreparedSubmissionBatch> => {
  const where = buildWhere(input)
  const rawRows = await client.inspectionEntry.findMany({
    where,
    include: {
      road: true,
      locationRoad: true,
      phase: true,
      interval: { select: { spec: true } },
      document: { include: { submission: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  })

  if (!rawRows.length) {
    throw new Error('未找到符合条件的报检记录')
  }

  const aggregatedInspections = sortInspections(aggregateInspectionRows(rawRows), input.sortPolicy ?? 'road-phase-pk-side')
  const preparedRows = sortPreparedRows(buildPreparedRows(aggregatedInspections), input.sortPolicy ?? 'road-phase-pk-side')

  if (!preparedRows.length) {
    throw new Error('未生成可用于提交单的明细行')
  }

  const maxRows = Math.max(1, Math.floor(input.maxRows ?? MAX_SUBMISSION_ITEM_ROWS))
  const nextSubmissionNumber = await getNextSubmissionNumber(client)
  const template = await resolveTemplate(client, input.templateId)
  const chunksWithRows = packPreparedRows(preparedRows, input.packingPolicy ?? 'strict-12', maxRows)
  const title = input.title?.trim() || DEFAULT_SUBMISSION_TITLE
  const subject = input.subject?.trim() || DEFAULT_SUBMISSION_SUBJECT
  const documentStatus = input.documentStatus ?? DocumentStatus.FINAL
  const statusAfterBind = input.statusAfterBind ?? 'KEEP'

  return {
    rawInspectionCount: rawRows.length,
    groupedInspectionCount: aggregatedInspections.length,
    groupedItemCount: preparedRows.length,
    submissionCount: chunksWithRows.length,
    nextSubmissionNumber,
    title,
    subject,
    statusAfterBind,
    documentStatus,
    maxRows,
    packingPolicy: input.packingPolicy ?? 'strict-12',
    sortPolicy: input.sortPolicy ?? 'road-phase-pk-side',
    templateId: template?.id ?? null,
    templateVersion: template?.version ?? null,
    chunks: summarizeChunks(chunksWithRows, nextSubmissionNumber),
    now: input.now ?? new Date(),
    chunksWithRows,
  }
}

export const previewSubmissionBatch = async (input: SubmissionBatchInput): Promise<SubmissionBatchPreview> => {
  const prepared = await prepareSubmissionBatch(input)
  const { now: _now, chunksWithRows: _chunksWithRows, ...preview } = prepared
  return preview
}

export const executeSubmissionBatch = async (
  input: SubmissionBatchInput,
  userId?: number | null,
): Promise<SubmissionBatchExecutionResult> => {
  return prisma.$transaction(async (tx) => {
    const prepared = await prepareSubmissionBatch(input, tx)
    const created: SubmissionBatchExecutionResult['created'] = []

    for (let index = 0; index < prepared.chunksWithRows.length; index += 1) {
      const chunk = prepared.chunksWithRows[index]
      const rawInspectionIds = Array.from(new Set(chunk.flatMap((row) => row.rawInspectionIds))).sort((left, right) => left - right)
      const draft = buildDefaultSubmissionDraft({
        suggestedSubmissionNumber: prepared.nextSubmissionNumber + index,
        now: prepared.now,
      })

      const submission = await createSubmissionDocWithClient(
        tx,
        {
          title: prepared.title,
          status: prepared.documentStatus,
          templateId: prepared.templateId,
          templateVersion: prepared.templateVersion,
          assignNextSubmissionNumber: true,
          data: {
            ...draft.data,
            documentMeta: {
              ...draft.data.documentMeta,
              subject: prepared.subject,
            },
            items: chunk.map(
              ({
                sourceInspectionIds,
                rawInspectionIds: _rawInspectionIds,
                roadName,
                phaseName,
                side,
                startPk,
                endPk,
                linePreview,
                ...item
              }) => item,
            ),
          } as Prisma.InputJsonValue,
        },
        userId,
      )

      const patch: Prisma.InspectionEntryUpdateManyMutationInput = {
        documentId: submission.id,
        updatedBy: userId ?? undefined,
      }
      if (prepared.statusAfterBind !== 'KEEP') {
        patch.status = prepared.statusAfterBind
      }

      await tx.inspectionEntry.updateMany({
        where: { id: { in: rawInspectionIds } },
        data: patch,
      })

      created.push({
        documentId: submission.id,
        code: submission.code,
        submissionNumber: submission.submission?.submissionNumber ?? prepared.nextSubmissionNumber + index,
        itemCount: chunk.length,
        rawInspectionCount: rawInspectionIds.length,
      })
    }

    const { now: _now, chunksWithRows: _chunksWithRows, ...preview } = prepared
    return {
      ...preview,
      created,
    }
  })
}
