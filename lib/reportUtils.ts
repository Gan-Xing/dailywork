import {
  additionalNarrativeSections,
  materialItems,
  observationBlocks,
  worksExecutedBlocks,
  type AdditionalSectionKey,
  type ObservationKey,
  type WorkBlock,
} from '@/lib/reportSchema'
import {
  createInitialReportState,
  type DailyReport,
  type LocalizedRichText,
  type MaterialStock,
  type PersonnelCount,
} from '@/lib/reportState'

export const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/

const materialIds = materialItems.map((item) => item.id)
const MATERIAL_PRECISION = 6
const narrativeLocaleKeys: Array<keyof LocalizedRichText> = ['fr', 'zh']

const ensureMaterialRow = (row?: MaterialStock): MaterialStock => ({
  previous: row?.previous ?? '0',
  entry: row?.entry ?? '0',
  exit: row?.exit ?? '0',
  current: row?.current ?? '0',
})

const parseAmount = (value: string | undefined) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatAmount = (value: number) => {
  if (!Number.isFinite(value)) {
    return '0'
  }
  const normalized = Number(value.toFixed(MATERIAL_PRECISION))
  return normalized.toString()
}

export const recalcMaterialRow = (row: MaterialStock): MaterialStock => {
  const previous = parseAmount(row.previous)
  const entry = parseAmount(row.entry)
  const exit = parseAmount(row.exit)
  return {
    ...row,
    current: formatAmount(previous + entry - exit),
  }
}

export const recalcAllMaterials = (materials: Record<string, MaterialStock>): Record<string, MaterialStock> => {
  const next: Record<string, MaterialStock> = {}
  materialIds.forEach((id) => {
    next[id] = recalcMaterialRow(ensureMaterialRow(materials[id]))
  })
  return next
}

export const inheritPreviousMaterials = (
  materials: Record<string, MaterialStock>,
  reference: Record<string, MaterialStock> | null,
): Record<string, MaterialStock> => {
  const next: Record<string, MaterialStock> = {}
  materialIds.forEach((id) => {
    const row = ensureMaterialRow(materials[id])
    if (reference) {
      row.previous = reference[id]?.current ?? '0'
    }
    next[id] = row
  })
  return recalcAllMaterials(next)
}

const createEmptyLocalizedNarrative = (): LocalizedRichText => ({
  fr: '',
  zh: '',
})

const ensureLocalizedNarrative = (value: unknown): LocalizedRichText => {
  if (typeof value === 'string') {
    return {
      fr: value,
      zh: value,
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Partial<LocalizedRichText>
    const result: LocalizedRichText = createEmptyLocalizedNarrative()
    narrativeLocaleKeys.forEach((locale) => {
      if (typeof record[locale] === 'string') {
        result[locale] = record[locale] as string
      }
    })
    if (result.fr || result.zh) {
      return result
    }
  }

  return createEmptyLocalizedNarrative()
}

const normalizeNarrativeBlock = <T extends string>(
  existing: Record<string, unknown> | undefined,
  definitions: ReadonlyArray<{ id: T }>,
): Record<T, LocalizedRichText> => {
  return definitions.reduce((acc, definition) => {
    acc[definition.id] = ensureLocalizedNarrative(existing?.[definition.id])
    return acc
  }, {} as Record<T, LocalizedRichText>)
}

export const normalizeReportForDate = (report: DailyReport, dateKey: string): DailyReport => {
  const [year, month] = dateKey.split('-')
  const normalizedObservations = normalizeNarrativeBlock(report.observations, observationBlocks)
  const normalizedWorks = normalizeNarrativeBlock(report.works, worksExecutedBlocks)
  const normalizedAdditional = normalizeNarrativeBlock(report.additional, additionalNarrativeSections)

  return {
    ...report,
    metadata: {
      ...report.metadata,
      date: dateKey,
      year: year ?? report.metadata.year,
      month: month ?? report.metadata.month,
    },
    observations: normalizedObservations,
    works: normalizedWorks,
    additional: normalizedAdditional,
  }
}

export const createReportForDate = (dateKey: string): DailyReport =>
  normalizeReportForDate(createInitialReportState(), dateKey)

export const cloneReport = (report: DailyReport): DailyReport =>
  JSON.parse(JSON.stringify(report)) as DailyReport

export const recalcReportMaterials = (report: DailyReport): DailyReport => ({
  ...report,
  materials: recalcAllMaterials(report.materials ?? {}),
})

const clonePersonnelCount = (entry?: PersonnelCount): PersonnelCount => ({
  present: entry?.present ?? '',
  absent: entry?.absent ?? '',
})

export const clonePersonnelMap = (map: DailyReport['personnel']): DailyReport['personnel'] => {
  const result: DailyReport['personnel'] = {}
  Object.entries(map ?? {}).forEach(([key, value]) => {
    result[key] = clonePersonnelCount(value)
  })
  return result
}

export const cloneExpatriateCount = (entry: PersonnelCount): PersonnelCount => clonePersonnelCount(entry)
