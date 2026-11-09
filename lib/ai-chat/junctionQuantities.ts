import { Prisma, type ValueBillReviewRecord } from '@prisma/client'

import { asValueBillObject } from '../value/valueBillTimeline'

export const MAX_JUNCTION_RECORDS = 1000

export type JunctionSide = 'CG' | 'CD'
export type JunctionReview = {
  id: number
  key: string
  projectCode: string
  attachmentNumber: number
  sourceFileName: string | null
}
export type JunctionRecord = Pick<ValueBillReviewRecord,
  | 'id' | 'reviewId' | 'recordId' | 'status' | 'issueId'
  | 'boqCode' | 'boqNameZh' | 'boqNameFr' | 'unit'
  | 'roadSlug' | 'roadZh' | 'roadRaw' | 'sideCode' | 'sideZh'
  | 'pkStart' | 'pkEnd' | 'quantity' | 'formula' | 'note'
  | 'sourceExcelRow' | 'source' | 'data'
> & { review: JunctionReview }

export type JunctionScope = {
  projectCode?: string
  reviewKey?: string
  roadSlug?: string
  side?: JunctionSide
  canonicalPk?: string
}

export type JunctionCoverage = {
  complete: boolean
  total: number | null
  returned: number
  reason: 'all_matching_records_returned' | 'not_found_record' | 'scope_limit_exceeded'
}

export const isCanonicalJunctionPk = (value: unknown): value is string =>
  typeof value === 'string' && /^PK(?:0|[1-9]\d*)\+\d{3}(?:\.\d+)?$/.test(value)

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const sideCode = (value: unknown): string | null =>
  text(asValueBillObject(value).code) ?? text(value)

export const getJunctionIdentities = (record: JunctionRecord) => {
  const data = asValueBillObject(record.data)
  const amorce = asValueBillObject(data.amorce)
  const junction = asValueBillObject(data.junction)
  const roadSlug = record.roadSlug
  // Component sides may differ from the explicitly assigned mainline junction side.
  const assignedSide = sideCode(amorce.mainlinePositionSide)
    ?? sideCode(amorce.roadSide)
    ?? text(amorce.sideCode)
    ?? sideCode(data.junctionMainlineSide)
  const canonicalPks = [text(data.canonicalPk), text(amorce.canonicalPk), text(junction.canonicalPk)]
    .filter((pk): pk is string => pk !== null)
  const canonicalPk = canonicalPks[0]
  const type = text(data.type) ?? text(data.recordType) ?? ''
  if (
    data.isJunction === false
    || data.alignment === 'MAINLINE'
    || /^(?:MAINLINE|主线)$/i.test(type)
    || !(data.isJunction === true || /amorce|平交/i.test(type))
    || !isCanonicalJunctionPk(canonicalPk)
    || !roadSlug
    || (text(junction.roadSlug) !== null && junction.roadSlug !== roadSlug)
  ) return []
  // Conflicting canonical assignments must not silently select either junction.
  if (canonicalPks.some((pk) => pk !== canonicalPk)) return []
  const explicitScope = Array.isArray(junction.sideScope)
    ? junction.sideScope.map(sideCode).filter((side): side is JunctionSide => side === 'CG' || side === 'CD')
    : []
  const fallbackSide = record.sideCode ?? sideCode(data.side)
  const sides: JunctionSide[] = assignedSide === 'CG' || assignedSide === 'CD'
    ? [assignedSide]
    : explicitScope.length ? Array.from(new Set(explicitScope)).sort()
      : assignedSide === null && (fallbackSide === 'CG' || fallbackSide === 'CD') ? [fallbackSide] : []
  return sides.map((side) => ({
    projectCode: record.review.projectCode,
    reviewKey: record.review.key,
    roadSlug,
    side,
    canonicalPk,
  }))
}

export const getJunctionIdentity = (record: JunctionRecord, side?: JunctionSide) =>
  getJunctionIdentities(record).find((identity) => side === undefined || identity.side === side) ?? null

export const filterJunctionRecords = (records: readonly JunctionRecord[], scope: JunctionScope) =>
  records.filter((record) => {
    if (record.reviewId !== record.review.id) return false
    return getJunctionIdentities(record).some((identity) => Object.entries(scope).every(([key, value]) =>
      value === undefined || identity[key as keyof typeof identity] === value,
    ))
  }).sort((left, right) => compareText(left.review.key, right.review.key)
    || compareText(left.roadSlug, right.roadSlug)
    || compareText(getJunctionIdentity(left)?.side, getJunctionIdentity(right)?.side)
    || compareText(getJunctionIdentity(left)?.canonicalPk, getJunctionIdentity(right)?.canonicalPk)
    || compareText(left.boqCode, right.boqCode)
    || (left.sourceExcelRow ?? Number.MAX_SAFE_INTEGER) - (right.sourceExcelRow ?? Number.MAX_SAFE_INTEGER)
    || compareText(left.recordId, right.recordId)
    || left.id - right.id)

const compareText = (left: unknown, right: unknown) => {
  const a = String(left ?? ''), b = String(right ?? '')
  return a < b ? -1 : a > b ? 1 : 0
}

export const junctionDecimalString = (value: unknown): string | null => {
  if (Prisma.Decimal.isDecimal(value)) return value.toFixed()
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value)
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)) return null
  const decimal = new Prisma.Decimal(raw)
  return decimal.isFinite() ? decimal.toFixed() : null
}

// Preserve arbitrary item-specific dimensions/formulas, not just one measurement schema.
const copyDetails = (value: unknown, key = ''): unknown => {
  if (/quantit/i.test(key)) {
    const decimal = junctionDecimalString(value)
    if (decimal !== null) return decimal
  }
  if (Array.isArray(value)) return value.map((entry) => copyDetails(entry, key))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([name, entry]) => [name, copyDetails(entry, name)]))
  }
  return value ?? null
}

export const junctionSourceUrl = (scope: { reviewKey: string; roadSlug?: string; side?: string; canonicalPk?: string }) => {
  // URL parsers normalize encoded dot-only segments as path traversal too.
  if (!scope.reviewKey || scope.reviewKey === '.' || scope.reviewKey === '..') throw new Error('invalid_review_key')
  const segment = encodeURIComponent(scope.reviewKey).replace(/\./g, '%2E')
  const params = new URLSearchParams()
  for (const key of ['roadSlug', 'side', 'canonicalPk'] as const) {
    if (scope[key] !== undefined) params.set(key, scope[key])
  }
  const query = params.toString()
  return `/value/bill-review/${segment}${query ? `?${query}` : ''}`
}

const photoIds = (record: JunctionRecord) => {
  const data = asValueBillObject(record.data)
  const raw = asValueBillObject(asValueBillObject(record.source).raw)
  const binding = asValueBillObject(data.photoBinding)
  const evidence = Array.isArray(data.siteEvidence) ? data.siteEvidence : [data.siteEvidence]
  const ids = [
    ...(Array.isArray(raw.siteEvidenceFileAssetIds) ? raw.siteEvidenceFileAssetIds : []),
    ...(Array.isArray(binding.fileAssetIds) ? binding.fileAssetIds : []),
    ...evidence.map((entry) => asValueBillObject(entry).fileAssetId),
  ].filter((id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0)
  return Array.from(new Set(ids)).sort((a, b) => a - b)
}

export const mapJunctionQuantity = (record: JunctionRecord, side?: JunctionSide) => {
  const identities = getJunctionIdentities(record)
  const identity = getJunctionIdentity(record, side)
  if (!identity) throw new Error('not_a_canonical_junction_record')
  const data = asValueBillObject(record.data)
  const source = asValueBillObject(record.source)
  const amorce = asValueBillObject(data.amorce)
  return {
    ...identity,
    recordId: record.recordId,
    review: record.review,
    road: { slug: record.roadSlug, nameZh: record.roadZh, raw: record.roadRaw },
    recordPk: { start: record.pkStart, end: record.pkEnd },
    boq: { code: record.boqCode, nameZh: record.boqNameZh, nameFr: record.boqNameFr, unit: record.unit ?? text(data.unit) },
    component: data.component ?? null,
    recordSide: record.sideCode,
    canonicalSideScope: identities.map((entry) => entry.side),
    sharedAcrossSides: identities.length > 1,
    quantity: junctionDecimalString(data.quantity) ?? junctionDecimalString(record.quantity),
    storedQuantity: junctionDecimalString(record.quantity),
    quantities: Object.fromEntries(Object.entries(data)
      .filter(([key, value]) => /quantit/i.test(key) && (value === null || junctionDecimalString(value) !== null))
      .map(([key, value]) => [key, junctionDecimalString(value)])),
    formula: record.formula ?? data.formula ?? null,
    dimensions: copyDetails(data.dimensions ?? data.rawDimensions ?? null),
    measurement: {
      status: data.measurementStatus ?? null,
      period: data.period ?? null,
    },
    confirmation: {
      status: record.status,
      userConfirmed: typeof data.userConfirmed === 'boolean' ? data.userConfirmed : null,
      reviewConclusion: data.reviewConclusion ?? null,
      confirmedAt: data.confirmedAt ?? null,
    },
    issueId: record.issueId,
    note: record.note,
    originalBillPk: data.originalBillPk ?? null,
    originalBillPks: data.originalBillPks ?? amorce.originalBillPks ?? [],
    source: {
      ...asValueBillObject(copyDetails(source)),
      sourceFile: source.sourceFile ?? record.review.sourceFileName,
      sheet: source.sheet ?? null,
      excelRow: record.sourceExcelRow ?? source.excelRow ?? null,
    },
    photos: photoIds(record).map((fileAssetId) => ({
      fileAssetId,
      url: `/api/files/${fileAssetId}?includeUrl=1`,
    })),
    details: copyDetails(data),
    sourceUrl: junctionSourceUrl(identity),
  }
}

export const buildJunctionPayload = (
  records: readonly JunctionRecord[],
  scope: JunctionScope,
  candidateTotal = records.length,
  mode: 'list' | 'quantities' = 'quantities',
) => {
  const bounded = records.slice(0, MAX_JUNCTION_RECORDS)
  const complete = candidateTotal <= MAX_JUNCTION_RECORDS && candidateTotal === bounded.length
  const matching = filterJunctionRecords(bounded, scope)
  const quantities = matching.flatMap((record) => getJunctionIdentities(record)
    .filter((identity) => scope.side === undefined || identity.side === scope.side)
    .map((identity) => mapJunctionQuantity(record, identity.side)))
  const groups = new Map<string, { identity: NonNullable<ReturnType<typeof getJunctionIdentity>>; records: typeof quantities }>()
  for (const record of quantities) {
    const { projectCode, reviewKey, roadSlug, side, canonicalPk } = record
    const identity = { projectCode, reviewKey, roadSlug, side, canonicalPk }
    const key = JSON.stringify(identity)
    const group = groups.get(key) ?? { identity, records: [] }
    group.records.push(record)
    groups.set(key, group)
  }
  const junctions = Array.from(groups.values()).map(({ identity, records: entries }) => ({
    ...identity,
    recordCount: entries.length,
    recordIds: entries.map((entry) => entry.recordId),
    boqCodes: Array.from(new Set(entries.map((entry) => entry.boq.code))).sort(compareText),
    sharedRecordIds: entries.filter((entry) => entry.sharedAcrossSides).map((entry) => entry.recordId),
    sourceUrl: junctionSourceUrl(identity),
  }))
  const returned = mode === 'list' ? junctions.length : quantities.length
  const coverage: JunctionCoverage = {
    complete,
    total: complete ? returned : null,
    returned,
    reason: !complete ? 'scope_limit_exceeded' : returned ? 'all_matching_records_returned' : 'not_found_record',
  }
  return {
    status: !complete ? 'partial' : returned ? 'found' : 'not_found_record',
    physicalPresence: 'unknown',
    notice: 'not_found_record is not physically_absent. Record coverage does not establish physical existence or completeness of site work. Shared-across-sides records retain one quantity and must not be summed twice.',
    scope,
    coverage,
    recordCoverage: { ...coverage, total: complete ? matching.length : null, returned: matching.length },
    candidateTotal,
    scanned: bounded.length,
    junctions,
    ...(mode === 'quantities' ? { records: quantities } : {}),
    sources: [
      ...Array.from(new Set(junctions.map((junction) => junction.sourceUrl))).map((url) => ({ key: 'value-bill-review', url })),
      ...Array.from(new Set(quantities.flatMap((record) => record.photos.map((photo) => photo.url))))
        .map((url) => ({ key: 'value-bill-review-photo', url })),
    ],
    preserveFullContent: true,
  }
}

export const formatJunctionPayload = (payload: unknown): string => JSON.stringify(payload, (_key, value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => compareText(left, right)))
}, 2)

export const renderJunctionAnswer = (payload: ReturnType<typeof buildJunctionPayload>, locale = 'zh') => {
  const fr = locale === 'fr'
  const detail = (value: unknown) => value === null || value === undefined ? (fr ? 'Non précisé' : '未明确')
    : typeof value === 'object' ? JSON.stringify(value) : String(value)
  const lines = [payload.coverage.complete
    ? (fr ? `Tous les enregistrements correspondants : ${payload.coverage.returned}.` : `已完整查询当前范围的系统记录，共 ${payload.coverage.returned} 条。`)
    : (fr ? 'Résultats partiels : réduisez le périmètre.' : '当前结果不完整，请缩小道路或账单范围，不能据此声称全部已列出。')]
  if (!payload.junctions.length) lines.push(fr
    ? "Aucun enregistrement correspondant trouvé ; cela ne prouve pas l'absence sur le terrain."
    : '未找到对应系统记录，不代表现场没有该结构物。')
  if (payload.records) {
    payload.records.forEach((record, index) => {
      const side = record.side === 'CG' ? (fr ? 'Gauche' : '左侧') : (fr ? 'Droite' : '右侧')
      lines.push('', `${index + 1}. ${record.boq.code ?? '?'} ${detail(fr ? record.boq.nameFr : record.boq.nameZh)}：${detail(record.quantity)} ${record.boq.unit ?? ''}`,
        `${record.road.nameZh ?? record.roadSlug} ${record.canonicalPk} ${side} Amorce`,
        `${fr ? 'Métré' : '计量状态'}：${detail(record.measurement.status ?? record.measurement.period)}；${fr ? 'Confirmé' : '用户确认'}：${record.confirmation.userConfirmed === true ? (fr ? 'Oui' : '已确认') : record.confirmation.userConfirmed === false ? (fr ? 'Non' : '未确认') : (fr ? 'Non précisé' : '未明确')}`)
      if (record.formula) lines.push(`${fr ? 'Calcul' : '计算依据'}：${detail(record.formula)}`)
      if (record.dimensions) lines.push(`${fr ? 'Dimensions' : '详细尺寸'}：${detail(record.dimensions)}`)
      if (record.storedQuantity !== null && record.storedQuantity !== record.quantity) lines.push(`${fr ? 'Valeur système distincte' : '系统列值另为'}：${record.storedQuantity}；${fr ? 'À vérifier' : '差异需核对'}`)
      lines.push(`${fr ? 'Source' : '来源'}：${record.review.key}；${fr ? 'Ligne Excel' : 'Excel行'} ${detail(record.source.excelRow)}；ID ${record.recordId}`)
      if (record.sharedAcrossSides) lines.push(fr ? 'Enregistrement commun aux deux côtés : ne pas compter deux fois.' : '此记录两侧共用，不可重复累计。')
      if (record.note) lines.push(`${fr ? 'Note' : '备注'}：${record.note}`)
      record.photos.forEach((photo) => lines.push(`[${fr ? 'Photo' : '照片'} ${photo.fileAssetId}](${photo.url})`))
    })
  } else {
    payload.junctions.forEach((junction, index) => lines.push(
      `${index + 1}. ${junction.roadSlug} ${junction.canonicalPk} ${junction.side === 'CG' ? (fr ? 'Gauche' : '左侧') : (fr ? 'Droite' : '右侧')} Amorce；${junction.recordCount} ${fr ? 'enregistrements' : '条记录'}；${junction.reviewKey}`,
    ))
  }
  lines.push('', fr ? 'Lecture seule : aucun métré ni lien photo modifié.' : '本次仅查询，未新增或修改工程量及照片绑定。')
  return lines.join('\n')
}
