import { prisma } from '@/lib/prisma'
import { listRoadSectionsWithProgress } from '@/lib/server/roadStore'
import {
  isValueBillStructurePhase,
  VALUE_BILL_STRUCTURE_PHASE_NAMES,
} from '@/lib/value/valueBillStructure'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const toNumber = (value: unknown) => {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const statusOrder: Record<string, number> = {
  NEEDS_REVIEW: 0,
  UNCLEAR: 1,
  CONFIRMED: 2,
}

export type ValueBillReviewRecordDto = {
  id: number
  recordId: string
  status: string
  issueId: string | null
  boqCode: string | null
  boqNameZh: string | null
  boqNameFr: string | null
  unit: string | null
  roadSlug: string | null
  roadZh: string | null
  roadRaw: string | null
  sideCode: string | null
  sideZh: string | null
  pkStart: string | null
  pkEnd: string | null
  quantity: number | null
  formula: string | null
  note: string | null
  sourceExcelRow: number | null
  source: unknown
  project: unknown
  attachment: unknown
  data: unknown
  rawRecord: unknown
  createdAt: string
  updatedAt: string
}

export type ValueBillReviewDto = {
  id: number
  key: string
  projectCode: string
  projectName: string
  attachmentNumber: number
  attachmentLabel: string
  sourceFileName: string | null
  sourceSha256: string | null
  recordCount: number
  problemRecordCount: number
  importedAt: string
  updatedAt: string
  roadRanges: ValueBillRoadRangeDto[]
  designIntervals: ValueBillDesignIntervalDto[]
  constructionIntervals: ValueBillConstructionIntervalDto[]
  boqPrices: ValueBillBoqPriceDto[]
  records: ValueBillReviewRecordDto[]
}

export type ValueBillBoqPriceDto = {
  code: string
  designation: string | null
  unit: string | null
  unitPrice: number | null
  source: 'BOQ_DATABASE' | 'PRIVATE_BILL_SOURCE'
}

export type ValueBillRoadRangeDto = {
  id: number
  slug: string
  name: string
  startPk: string
  endPk: string
}

export type ValueBillDesignIntervalDto = {
  id: number
  roadSlug: string
  roadName: string
  phaseName: string
  sideCode: string
  startPk: number
  endPk: number
  spec: string | null
  quantity: number | null
}

export type ValueBillConstructionIntervalDto = {
  id: string
  roadSlug: string
  roadName: string
  phaseName: string
  sideCode: string
  startPk: number
  endPk: number
  workStatus: 'COMPLETED' | 'IN_PROGRESS'
  sourceStatus: string
}

const intervalSideCode: Record<string, string> = {
  LEFT: 'CG',
  RIGHT: 'CD',
  BOTH: 'D/G',
  CENTER: 'X',
}

const loadPrivateBillPrices = async (key: string, codes: string[]) => {
  const prices = await Promise.all(codes.map(async (code): Promise<ValueBillBoqPriceDto | null> => {
    const fileName = `${code.toLowerCase().replace(/[^a-z0-9]/g, '')}.json`
    try {
      const raw = await readFile(path.join(process.cwd(), '.tmp', key, 'items', fileName), 'utf8')
      const item = JSON.parse(raw) as {
        summary?: {
          designation?: unknown
          unit?: unknown
          unitPriceFcfa?: unknown
        }
      }
      const summary = item.summary
      if (!summary) return null
      return {
        code,
        designation: typeof summary.designation === 'string' ? summary.designation : null,
        unit: typeof summary.unit === 'string' ? summary.unit : null,
        unitPrice: toNumber(summary.unitPriceFcfa),
        source: 'PRIVATE_BILL_SOURCE',
      }
    } catch {
      return null
    }
  }))
  return prices.filter((price): price is ValueBillBoqPriceDto => Boolean(price))
}

export const getValueBillReview = async (key: string): Promise<ValueBillReviewDto | null> => {
  const review = await prisma.valueBillReview.findUnique({
    where: { key },
    include: {
      records: {
        orderBy: [
          { boqCode: 'asc' },
          { roadSlug: 'asc' },
          { sourceExcelRow: 'asc' },
          { id: 'asc' },
        ],
      },
    },
  })

  if (!review) return null

  const roadRanges = await prisma.roadSection.findMany({
    where: {
      project: {
        code: review.projectCode,
      },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      startPk: true,
      endPk: true,
    },
    orderBy: {
      id: 'asc',
    },
  })

  const designRows = await prisma.phaseInterval.findMany({
    where: {
      phase: {
        name: {
          in: VALUE_BILL_STRUCTURE_PHASE_NAMES,
        },
        road: {
          project: {
            code: review.projectCode,
          },
        },
      },
    },
    select: {
      id: true,
      side: true,
      startPk: true,
      endPk: true,
      spec: true,
      billQuantity: true,
      phase: {
        select: {
          name: true,
          road: {
            select: {
              slug: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: [
      { phase: { road: { id: 'asc' } } },
      { side: 'asc' },
      { startPk: 'asc' },
    ],
  })
  const designIntervals: ValueBillDesignIntervalDto[] = designRows.map((interval) => ({
    id: interval.id,
    roadSlug: interval.phase.road.slug,
    roadName: interval.phase.road.name,
    phaseName: interval.phase.name,
    sideCode: intervalSideCode[interval.side] ?? interval.side,
    startPk: interval.startPk,
    endPk: interval.endPk,
    spec: interval.spec,
    quantity: toNumber(interval.billQuantity),
  }))

  const roadIds = new Set(roadRanges.map((road) => road.id))
  const [roadProgress, pendingInspections] = await Promise.all([
    listRoadSectionsWithProgress(),
    prisma.inspectionRequest.findMany({
      where: {
        roadId: { in: Array.from(roadIds) },
        status: { in: ['SCHEDULED', 'SUBMITTED', 'IN_PROGRESS'] },
        phase: {
          name: {
            in: VALUE_BILL_STRUCTURE_PHASE_NAMES,
          },
        },
      },
      select: {
        id: true,
        status: true,
        side: true,
        startPk: true,
        endPk: true,
        phase: {
          select: {
            name: true,
            road: {
              select: {
                slug: true,
                name: true,
              },
            },
          },
        },
      },
    }),
  ])
  const completedIntervals: ValueBillConstructionIntervalDto[] = roadProgress
    .filter((road) => roadIds.has(road.id))
    .flatMap((road) => road.phases
      .filter((phase) => isValueBillStructurePhase(phase.phaseName))
      .flatMap((phase) => phase.inspections.map((inspection, index) => ({
        id: `completed-${phase.phaseId}-${index}`,
        roadSlug: road.slug,
        roadName: road.name,
        phaseName: phase.phaseName,
        sideCode: intervalSideCode[inspection.side] ?? inspection.side,
        startPk: inspection.startPk,
        endPk: inspection.endPk,
        workStatus: 'COMPLETED' as const,
        sourceStatus: 'APPROVED',
      }))))
  const constructionIntervals: ValueBillConstructionIntervalDto[] = [
    ...completedIntervals,
    ...pendingInspections.map((inspection) => ({
      id: `request-${inspection.id}`,
      roadSlug: inspection.phase.road.slug,
      roadName: inspection.phase.road.name,
      phaseName: inspection.phase.name,
      sideCode: intervalSideCode[inspection.side] ?? inspection.side,
      startPk: inspection.startPk,
      endPk: inspection.endPk,
      workStatus: 'IN_PROGRESS' as const,
      sourceStatus: inspection.status,
    })),
  ]

  const records = review.records
    .map((record) => ({
      id: record.id,
      recordId: record.recordId,
      status: record.status,
      issueId: record.issueId,
      boqCode: record.boqCode,
      boqNameZh: record.boqNameZh,
      boqNameFr: record.boqNameFr,
      unit: record.unit,
      roadSlug: record.roadSlug,
      roadZh: record.roadZh,
      roadRaw: record.roadRaw,
      sideCode: record.sideCode,
      sideZh: record.sideZh,
      pkStart: record.pkStart,
      pkEnd: record.pkEnd,
      quantity: toNumber(record.quantity),
      formula: record.formula,
      note: record.note,
      sourceExcelRow: record.sourceExcelRow,
      source: record.source,
      project: record.project,
      attachment: record.attachment,
      data: record.data,
      rawRecord: record.rawRecord,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }))
    .sort((left, right) => {
      const statusDelta = (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9)
      if (statusDelta) return statusDelta
      return (left.boqCode ?? '').localeCompare(right.boqCode ?? '')
        || (left.roadZh ?? '').localeCompare(right.roadZh ?? '')
        || (left.sourceExcelRow ?? 999999) - (right.sourceExcelRow ?? 999999)
        || left.id - right.id
    })

  const codes = Array.from(new Set(
    records.map((record) => record.boqCode?.toUpperCase()).filter((code): code is string => Boolean(code)),
  ))
  const databasePrices = await prisma.boqItem.findMany({
    where: {
      project: { code: review.projectCode },
      sheetType: 'CONTRACT',
      isActive: true,
    },
    select: {
      code: true,
      designationZh: true,
      designationFr: true,
      unit: true,
      unitPrice: true,
    },
  })
  const pricesByCode = new Map<string, ValueBillBoqPriceDto>()
  databasePrices.forEach((item) => {
    const code = item.code.toUpperCase()
    if (!codes.includes(code) || pricesByCode.has(code)) return
    pricesByCode.set(code, {
      code,
      designation: item.designationZh || item.designationFr || null,
      unit: item.unit,
      unitPrice: toNumber(item.unitPrice),
      source: 'BOQ_DATABASE',
    })
  })
  const missingCodes = codes.filter((code) => !pricesByCode.has(code))
  const privatePrices = await loadPrivateBillPrices(key, missingCodes)
  privatePrices.forEach((price) => pricesByCode.set(price.code, price))

  return {
    id: review.id,
    key: review.key,
    projectCode: review.projectCode,
    projectName: review.projectName,
    attachmentNumber: review.attachmentNumber,
    attachmentLabel: review.attachmentLabel,
    sourceFileName: review.sourceFileName,
    sourceSha256: review.sourceSha256,
    recordCount: review.recordCount,
    problemRecordCount: review.problemRecordCount,
    importedAt: review.importedAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    roadRanges,
    designIntervals,
    constructionIntervals,
    boqPrices: Array.from(pricesByCode.values()),
    records,
  }
}
