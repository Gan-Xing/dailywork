import type { DailyReport } from './reportState'
import { cloneReport } from './reportUtils'

export type LogExtractionOutput = {
  observations: {
    security: string
    environment: string
    general: string
    special: string
  }
  works: {
    preparation: string
    earthwork: string
    pavement: string
    drainage: string
    safety: string
    geotech: string
    otherWork: string
  }
  controls: {
    beTopo: string
    quarry: string
    subcontract: string
    other: string
  }
}

export const DEFAULT_LOG_EXTRACTION_PROMPT = `请你从原始日志中抽取信息，仅填入所选日期对应的日报。
抽取范围严格限定：安全与环境观察（安保、环境、总体观察、特殊事件）；施工内容（前期准备、土方工程、路面工程、排水与涵洞、安保与交安、岩土/试验、其他）；Contrôles（技术/测量、采石场、分包工程、其他事项）。
规则：安保缺失必须填“RAS”，其他字段缺失保持空白；施工内容空白表示无作业；输出仅中文。`

export const createEmptyLogExtractionOutput = (): LogExtractionOutput => ({
  observations: {
    security: 'RAS',
    environment: '',
    general: '',
    special: '',
  },
  works: {
    preparation: '',
    earthwork: '',
    pavement: '',
    drainage: '',
    safety: '',
    geotech: '',
    otherWork: '',
  },
  controls: {
    beTopo: '',
    quarry: '',
    subcontract: '',
    other: '',
  },
})

const readString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

export const normalizeLogExtractionOutput = (value: unknown): LogExtractionOutput => {
  const empty = createEmptyLogExtractionOutput()
  if (!value || typeof value !== 'object') return empty
  const record = value as Partial<LogExtractionOutput>
  const observations = (record.observations ?? {}) as Partial<LogExtractionOutput['observations']>
  const works = (record.works ?? {}) as Partial<LogExtractionOutput['works']>
  const controls = (record.controls ?? {}) as Partial<LogExtractionOutput['controls']>

  return {
    observations: {
      security: readString(observations.security) || 'RAS',
      environment: readString(observations.environment),
      general: readString(observations.general),
      special: readString(observations.special),
    },
    works: {
      preparation: readString(works.preparation),
      earthwork: readString(works.earthwork),
      pavement: readString(works.pavement),
      drainage: readString(works.drainage),
      safety: readString(works.safety),
      geotech: readString(works.geotech),
      otherWork: readString(works.otherWork),
    },
    controls: {
      beTopo: readString(controls.beTopo),
      quarry: readString(controls.quarry),
      subcontract: readString(controls.subcontract),
      other: readString(controls.other),
    },
  }
}

const normalizeSegment = (value: string) =>
  value
    .replace(/[\s，,。；;：:、]/g, '')
    .trim()
    .toLowerCase()

const isRas = (value: string) => value.trim().toUpperCase() === 'RAS'

const splitSegments = (value: string) => {
  const segments = value
    .split(/[\n；;。]+/)
    .map((item) => item.trim())
    .filter(Boolean)
  return segments.length ? segments : value.trim() ? [value.trim()] : []
}

const mergeNarrativeText = (existing: string, incoming: string, enforceRas = false) => {
  const next = incoming.trim()
  const current = existing.trim()

  if (!next) {
    return enforceRas && !current ? 'RAS' : current
  }

  if (isRas(next) && current && !isRas(current)) {
    return current
  }

  if (!current || isRas(current)) {
    return enforceRas && !next ? 'RAS' : next
  }

  const nextSegments = splitSegments(next)
  const currentSegments = splitSegments(current)
  const normalizedNext = new Set(nextSegments.map(normalizeSegment))
  const merged = [...nextSegments]
  currentSegments.forEach((segment) => {
    if (!normalizedNext.has(normalizeSegment(segment))) {
      merged.push(segment)
    }
  })

  const mergedText = merged.join('；')
  if (enforceRas && !mergedText.trim()) return 'RAS'
  return mergedText
}

export const mapReportToLogExtractionOutput = (report: DailyReport): LogExtractionOutput => ({
  observations: {
    security: report.observations?.surete?.zh ?? '',
    environment: report.observations?.environnement?.zh ?? '',
    general: report.observations?.constatations?.zh ?? '',
    special: report.observations?.evenements?.zh ?? '',
  },
  works: {
    preparation: report.works?.preparation?.zh ?? '',
    earthwork: report.works?.terrassement?.zh ?? '',
    pavement: report.works?.chaussee?.zh ?? '',
    drainage: report.works?.assainissement?.zh ?? '',
    safety: report.works?.['securite-signalisation']?.zh ?? '',
    geotech: report.works?.geotechnique?.zh ?? '',
    otherWork: report.works?.divers?.zh ?? '',
  },
  controls: {
    beTopo: report.additional?.beTopo?.zh ?? '',
    quarry: report.additional?.carriere?.zh ?? '',
    subcontract: report.additional?.sousTraites?.zh ?? '',
    other: report.additional?.divers?.zh ?? '',
  },
})

export const mergeReportWithExtractionOutput = (
  report: DailyReport,
  output: LogExtractionOutput,
): { report: DailyReport; mergedOutput: LogExtractionOutput } => {
  const next = cloneReport(report)

  next.observations.surete.zh = mergeNarrativeText(
    report.observations.surete.zh,
    output.observations.security,
    true,
  )
  next.observations.environnement.zh = mergeNarrativeText(
    report.observations.environnement.zh,
    output.observations.environment,
  )
  next.observations.constatations.zh = mergeNarrativeText(
    report.observations.constatations.zh,
    output.observations.general,
  )
  next.observations.evenements.zh = mergeNarrativeText(
    report.observations.evenements.zh,
    output.observations.special,
  )

  next.works.preparation.zh = mergeNarrativeText(
    report.works.preparation.zh,
    output.works.preparation,
  )
  next.works.terrassement.zh = mergeNarrativeText(
    report.works.terrassement.zh,
    output.works.earthwork,
  )
  next.works.chaussee.zh = mergeNarrativeText(
    report.works.chaussee.zh,
    output.works.pavement,
  )
  next.works.assainissement.zh = mergeNarrativeText(
    report.works.assainissement.zh,
    output.works.drainage,
  )
  next.works['securite-signalisation'].zh = mergeNarrativeText(
    report.works['securite-signalisation'].zh,
    output.works.safety,
  )
  next.works.geotechnique.zh = mergeNarrativeText(
    report.works.geotechnique.zh,
    output.works.geotech,
  )
  next.works.divers.zh = mergeNarrativeText(
    report.works.divers.zh,
    output.works.otherWork,
  )

  next.additional.beTopo.zh = mergeNarrativeText(
    report.additional.beTopo.zh,
    output.controls.beTopo,
  )
  next.additional.carriere.zh = mergeNarrativeText(
    report.additional.carriere.zh,
    output.controls.quarry,
  )
  next.additional.sousTraites.zh = mergeNarrativeText(
    report.additional.sousTraites.zh,
    output.controls.subcontract,
  )
  next.additional.divers.zh = mergeNarrativeText(
    report.additional.divers.zh,
    output.controls.other,
  )

  return {
    report: next,
    mergedOutput: mapReportToLogExtractionOutput(next),
  }
}

const FIELD_LABELS: Array<{ path: string; labels: string[] }> = [
  { path: 'observations.security', labels: ['安保', '安全', '巡查', '门禁', '巡逻', 'Sûreté'] },
  { path: 'observations.environment', labels: ['环境', '扬尘', '噪音', '水土保持', 'Environnement'] },
  { path: 'observations.general', labels: ['总体观察', '现场总体观察', '总体', 'Constatations'] },
  { path: 'observations.special', labels: ['特殊事件', '事故', '封路', '重要来访', 'Evènements particuliers'] },
  { path: 'works.preparation', labels: ['前期准备', 'Préparation'] },
  { path: 'works.earthwork', labels: ['土方工程', '土方', 'Terrassement'] },
  { path: 'works.pavement', labels: ['路面工程', '路面', 'Chaussee'] },
  { path: 'works.drainage', labels: ['排水与涵洞', '排水', '涵洞', 'Assainissement'] },
  { path: 'works.safety', labels: ['安保与交安', '交安', 'Sécurité et Signalisation'] },
  { path: 'works.geotech', labels: ['岩土/试验', '岩土', '试验', 'Géotechnique'] },
  { path: 'works.otherWork', labels: ['其他', 'Divers'] },
  { path: 'controls.beTopo', labels: ['技术/测量', 'BE/Topo', 'BE / Topographie'] },
  { path: 'controls.quarry', labels: ['采石场', 'Carrière'] },
  { path: 'controls.subcontract', labels: ['分包工程', '分包', 'Travaux sous-traités'] },
  { path: 'controls.other', labels: ['其他事项', 'Observations / Divers'] },
]

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const parseLogExtractionOutputFromText = (text: string): LogExtractionOutput => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const result: Record<string, string[]> = {}

  for (const line of lines) {
    for (const matcher of FIELD_LABELS) {
      for (const label of matcher.labels) {
        const regex = new RegExp(`^${escapeRegex(label)}\\s*[:：]\\s*(.+)$`, 'i')
        const match = line.match(regex)
        if (!match) continue
        if (!result[matcher.path]) result[matcher.path] = []
        result[matcher.path].push(match[1].trim())
      }
    }
  }

  const output = createEmptyLogExtractionOutput()
  Object.entries(result).forEach(([path, values]) => {
    const merged = values.filter(Boolean).join('；')
    if (!merged) return
    if (path.startsWith('observations.')) {
      const key = path.replace('observations.', '') as keyof LogExtractionOutput['observations']
      output.observations[key] = merged
      return
    }
    if (path.startsWith('works.')) {
      const key = path.replace('works.', '') as keyof LogExtractionOutput['works']
      output.works[key] = merged
      return
    }
    if (path.startsWith('controls.')) {
      const key = path.replace('controls.', '') as keyof LogExtractionOutput['controls']
      output.controls[key] = merged
    }
  })

  if (!output.observations.security.trim()) {
    output.observations.security = 'RAS'
  }

  return output
}
