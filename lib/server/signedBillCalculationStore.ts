import { Prisma, type ValueBillReviewRecord } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { SignedBillError } from '@/lib/value/signedBills'
import { classifyCalculationBilling, type CalculationQuantityField, type SignedCalculationItem, type SignedCalculationQuantityCorrection, type SignedCalculationRecord, type SignedCalculationReviewDto, type SignedCalculationUnitCorrection } from '@/lib/value/signedBillCalculations'
import { listSignedBillCompletionCandidates } from '@/lib/server/signedBillCompletionEvidence'

type SourceCell = { value?: string | null; numericValue?: string | null; formula?: string | null; cell?: string; verticalMergeAnchorEvidence?: { range: string; anchorCell: string; anchorValue: string | null } }
type SourceRow = {
  templateLeafRows?: number[]; rowType: string; sourceSheet: string; sourceRow: number; sourceRange: string
  roadNameOriginal?: string | null; structureNameOriginal?: string | null; descriptionOriginal?: string | null
  side?: SourceCell; pkStart?: SourceCell; pkEnd?: SourceCell; unit?: SourceCell
  previousQuantity?: SourceCell; currentQuantity?: SourceCell; cumulativeQuantity?: SourceCell
  dimensionsByOriginalColumn?: Record<string, SourceCell>; dimensionLabelsByOriginalColumn?: Record<string, string>
  sourceNote?: string | null
}
type CalculationManifest = {
  format: 'SIGNED_CALCULATION_V1'; reviewKey: string; sourceSha256: string
  projectId: number; periodIndex: number; items: SignedCalculationItem[]
  coverage: NonNullable<SignedCalculationReviewDto['coverage']>; sourceVerification: string
}
const numeric = (cell?: SourceCell) => cell?.numericValue ?? null
const value = (cell?: SourceCell) => cell?.value ?? null
const locationValue = (cell?: SourceCell) => value(cell) ?? cell?.verticalMergeAnchorEvidence?.anchorValue ?? null

const quantityFields: CalculationQuantityField[] = ['previousQuantity', 'currentQuantity', 'cumulativeQuantity', 'calculatedQuantity']
const correctionError = (message: string): never => { throw new SignedBillError(`明细修正依据不匹配：${message}`, 409) }
const correctionObject = (input: unknown, label: string) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return correctionError(`${label}格式无效`)
  return input as Record<string, unknown>
}
const correctionText = (input: unknown, label: string) => {
  if (typeof input !== 'string' || !input.trim() || input.includes('\0')) return correctionError(`${label}不能为空`)
  return input.trim()
}
const correctionNumeric = (input: unknown, label: string): string | null => {
  if (input === null) return null
  if (typeof input !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(input)) return correctionError(`${label}须为十进制字符串或空值`)
  return input
}

function sourceCorrections(record: ValueBillReviewRecord, row: SourceRow, originalUnit: string | null, calculatedCell?: SourceCell) {
  const source = record.source && typeof record.source === 'object' && !Array.isArray(record.source) ? record.source as Record<string, unknown> : {}
  const cells = { previousQuantity: row.previousQuantity, currentQuantity: row.currentQuantity, cumulativeQuantity: row.cumulativeQuantity, calculatedQuantity: calculatedCell }
  const corrections: SignedCalculationQuantityCorrection[] = []
  if (source.quantityCorrections !== undefined) {
    if (!Array.isArray(source.quantityCorrections) || source.quantityCorrections.length > quantityFields.length) return correctionError('数量修正须为最多四个字段的数组')
    const seen = new Set<CalculationQuantityField>()
    for (const input of source.quantityCorrections) {
      const entry = correctionObject(input, '数量修正')
      if (typeof entry.field !== 'string' || !quantityFields.includes(entry.field as CalculationQuantityField)) return correctionError('数量字段无效')
      const field = entry.field as CalculationQuantityField
      if (seen.has(field)) return correctionError('同一数量字段重复修正')
      seen.add(field)
      if (typeof entry.cell !== 'string' || !/^[A-Z]{1,3}[1-9]\d*$/.test(entry.cell) || entry.cell !== cells[field]?.cell) return correctionError('原单元格定位不一致')
      const oldNumericValue = correctionNumeric(entry.oldNumericValue, '修正前数量')
      const newNumericValue = correctionNumeric(entry.newNumericValue, '修正后数量')
      if (oldNumericValue !== numeric(cells[field])) return correctionError('修正前数量与原始保存值不一致')
      corrections.push({ field, cell: entry.cell, oldNumericValue, newNumericValue, reason: correctionText(entry.reason, '数量修正原因'), evidence: correctionText(entry.evidence, '数量修正证据') })
    }
  }
  let unitCorrection: SignedCalculationUnitCorrection | null = null
  if (source.unitCorrection !== undefined) {
    const entry = correctionObject(source.unitCorrection, '单位修正')
    if (entry.oldUnit !== null && typeof entry.oldUnit !== 'string') return correctionError('修正前单位格式无效')
    if (entry.oldUnit !== originalUnit) return correctionError('修正前单位与原始显示单位不一致')
    const newUnit = correctionText(entry.newUnit, '修正后单位')
    if (newUnit.length > 32 || /[\r\n\t]/.test(newUnit)) return correctionError('修正后单位须为32字以内的单行文字')
    unitCorrection = { oldUnit: entry.oldUnit, newUnit, reason: correctionText(entry.reason, '单位修正原因'), evidence: correctionText(entry.evidence, '单位修正证据') }
  }
  return { corrections, unitCorrection }
}

export function signedCalculationRecordDto(record: ValueBillReviewRecord): SignedCalculationRecord {
  const row = record.data as unknown as SourceRow
  const billingNote = (record.source as { billingReviewReason?: string } | null)?.billingReviewReason ?? null
  const dimensions = Object.entries(row.dimensionsByOriginalColumn ?? {}).filter(([column, cell]) => !['K', 'L'].includes(column) && cell.value != null)
  const result = [row.dimensionsByOriginalColumn?.L, row.dimensionsByOriginalColumn?.K].find((cell) => cell?.numericValue != null)
  const originalUnit = value(row.unit) ?? record.unit
  const { corrections, unitCorrection } = sourceCorrections(record, row, originalUnit, result)
  const quantities = { previousQuantity: numeric(row.previousQuantity), currentQuantity: numeric(row.currentQuantity), cumulativeQuantity: numeric(row.cumulativeQuantity), calculatedQuantity: numeric(result) }
  for (const correction of corrections) quantities[correction.field] = correction.newNumericValue
  const previous = quantities.previousQuantity, current = quantities.currentQuantity, cumulative = quantities.cumulativeQuantity
  const quantityLabels = { previousQuantity: '以前量', currentQuantity: '本期量', cumulativeQuantity: '累计量', calculatedQuantity: '计算量' }
  const correctedDisplay = [
    ...corrections.map((correction) => `${quantityLabels[correction.field]} ${row.sourceSheet}!${correction.cell}：${correction.oldNumericValue ?? '原空白'} → ${correction.newNumericValue ?? '空白'}。${correction.reason}；依据：${correction.evidence}`),
    ...(unitCorrection ? [`单位：${unitCorrection.oldUnit ?? '原空白'} → ${unitCorrection.newUnit}。${unitCorrection.reason}；依据：${unitCorrection.evidence}`] : []),
  ]
  return {
    id: record.id, recordId: record.recordId, lineKeys: (row.templateLeafRows ?? []).map((n) => `xlsx-row-${n}`), rowType: row.rowType,
    road: row.roadNameOriginal ?? null, structure: row.structureNameOriginal ?? null, description: row.descriptionOriginal ?? null,
    side: locationValue(row.side), pkStart: locationValue(row.pkStart), pkEnd: locationValue(row.pkEnd), unit: unitCorrection?.newUnit ?? originalUnit,
    locationNote: [row.side, row.pkStart, row.pkEnd].flatMap((cell) => cell?.verticalMergeAnchorEvidence ? [`原表合并格 ${cell.verticalMergeAnchorEvidence.range}（${cell.verticalMergeAnchorEvidence.anchorCell}）`] : []).join('；') || null,
    dimensions: dimensions.map(([column, cell]) => ({ label: row.dimensionLabelsByOriginalColumn?.[column] ?? ({ F: 'Long', G: 'Larg', H: 'H (原列)', I: 'I (原列)', J: 'Ratio' }[column] ?? column), value: value(cell), cell: cell.cell ?? `${column}${row.sourceRow}` })),
    calculatedQuantity: quantities.calculatedQuantity, formula: result?.formula ?? record.formula,
    previousQuantity: previous, currentQuantity: current, cumulativeQuantity: cumulative,
    billingState: billingNote ? 'UNKNOWN' : classifyCalculationBilling(previous, current, cumulative), billingNote, completionState: 'UNKNOWN', completionEvidence: null,
    correctionNote: correctedDisplay.length ? `已核修正显示（原件原值保留）：\n${correctedDisplay.join('\n')}` : null, quantityCorrections: corrections, unitCorrection,
    sourceNote: row.sourceNote ?? null, note: record.note, updatedAt: record.updatedAt.toISOString(),
    sourceSheet: row.sourceSheet, sourceRow: row.sourceRow, sourceRange: row.sourceRange,
  }
}

async function calculationContext(id: number, db: Prisma.TransactionClient = prisma) {
  const revision = await db.boqBillRevision.findUnique({ where: { id }, include: { calculationFile: true, project: { select: { code: true } } } })
  if (!revision) throw new SignedBillError('账单版本不存在', 404)
  const links = await db.fileAssetLink.findMany({ where: { entityType: 'signed-bill-revision', entityId: String(id), purpose: 'calculation-review', fileId: revision.calculationFileId ?? -1 } })
  if (!links.length) return { revision, manifest: null, review: null }
  if (links.length !== 1) throw new SignedBillError('明细关联重复，请核对归档', 409)
  const manifest = links[0].meta as unknown as CalculationManifest
  if (manifest?.format !== 'SIGNED_CALCULATION_V1' || manifest.projectId !== revision.projectId || manifest.periodIndex !== revision.periodIndex || manifest.sourceSha256 !== revision.calculationFile?.checksum) throw new SignedBillError('明细与所选账单原件不匹配', 409)
  const review = await db.valueBillReview.findUnique({ where: { key: manifest.reviewKey } })
  const projectCode = revision.project?.code
  if (!review || typeof projectCode !== 'string' || !projectCode.trim() || review.projectCode !== projectCode || review.sourceSha256 !== manifest.sourceSha256 || review.attachmentNumber !== revision.periodIndex) throw new SignedBillError('明细底稿关联异常', 409)
  return { revision, manifest, review }
}

export async function getSignedCalculationReview(id: number): Promise<SignedCalculationReviewDto> {
  const { revision, manifest, review } = await calculationContext(id)
  if (!manifest || !review) return { revisionId: id, available: false, items: [], records: [] }
  const [records, completionCandidates] = await Promise.all([
    prisma.valueBillReviewRecord.findMany({ where: { reviewId: review.id }, orderBy: [{ sourceExcelRow: 'asc' }, { id: 'asc' }] }),
    listSignedBillCompletionCandidates(revision.projectId, revision.periodIndex),
  ])
  return { revisionId: id, available: true, reviewKey: review.key, sourceFileId: revision.calculationFileId!, sourceFileName: review.sourceFileName ?? '', sourceSha256: manifest.sourceSha256, importedAt: review.importedAt.toISOString(), sourceVerification: manifest.sourceVerification, coverage: manifest.coverage, items: manifest.items, records: records.map(signedCalculationRecordDto), completionCandidates }
}

export function parseCalculationNote(input: unknown) {
  if (!input || typeof input !== 'object') throw new SignedBillError('备注参数无效')
  const payload = input as Record<string, unknown>
  if (typeof payload.recordId !== 'number' || !Number.isSafeInteger(payload.recordId) || payload.recordId <= 0) throw new SignedBillError('明细ID无效')
  if (typeof payload.note !== 'string' || payload.note.length > 2000 || payload.note.includes('\0')) throw new SignedBillError('备注须为2000字以内的文字')
  if (typeof payload.expectedUpdatedAt !== 'string' || !Number.isFinite(Date.parse(payload.expectedUpdatedAt))) throw new SignedBillError('缺少备注版本，请刷新后重试')
  return { recordId: payload.recordId, note: payload.note.trim() || null, expectedUpdatedAt: new Date(payload.expectedUpdatedAt) }
}

export async function updateSignedCalculationNote(revisionId: number, input: unknown, actorId: number) {
  const { recordId, note, expectedUpdatedAt } = parseCalculationNote(input)
  return prisma.$transaction(async (tx) => {
    const { manifest, review } = await calculationContext(revisionId, tx)
    if (!manifest || !review) throw new SignedBillError('本期尚未导入计算明细', 404)
    const record = await tx.valueBillReviewRecord.findFirst({ where: { id: recordId, reviewId: review.id } })
    if (!record) throw new SignedBillError('明细不属于所选账单', 404)
    if (record.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new SignedBillError('备注已被其他人更新，请刷新后核对', 409)
    if (record.note === note) return signedCalculationRecordDto(record)
    const changed = await tx.valueBillReviewRecord.updateMany({ where: { id: recordId, reviewId: review.id, updatedAt: expectedUpdatedAt }, data: { note } })
    if (changed.count !== 1) throw new SignedBillError('备注已被其他人更新，请刷新后核对', 409)
    await tx.boqBillRevisionEvent.create({ data: { revisionId, kind: 'DETAIL_NOTE_UPDATED', reason: '计算明细文字备注', actorId, payload: { recordId, reviewKey: review.key, sourceSha256: manifest.sourceSha256, oldNote: record.note, newNote: note } } })
    return signedCalculationRecordDto(await tx.valueBillReviewRecord.findUniqueOrThrow({ where: { id: recordId } }))
  })
}
