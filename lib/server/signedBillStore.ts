import { createHash } from 'node:crypto'

import { Prisma, type BoqBillRevision, type FileAsset } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import {
  SIGNED_BILL_ENTITY_TYPE,
  SIGNED_BILL_PERIOD_ENTITY_TYPE,
  SignedBillError,
  assertSignedBillActivation,
  billDecimal,
  billPeriodIndex,
  billText,
  canonicalBillJson,
  parseSignedBillAdjustments,
  parseSignedBillLines,
  parseSignedBillSource,
  parseSignedBillSummary,
  positiveBillInteger,
  type ActivateSignedBillInput,
  type BillJson,
  type CreateSignedBillInput,
  type SignedBillAdjustment,
  type SignedBillFileDto,
  type SignedBillLine,
  type SignedBillReconciliation,
  type SignedBillRevisionDto,
  type SignedBillSource,
  type SignedBillStatus,
  type SignedBillSummary,
} from '@/lib/value/signedBills'

// Prisma's Decimal implementation, locally configured to avoid changing other stores.
const ExactDecimal = Prisma.Decimal.clone({ precision: 80 })
type Tx = Prisma.TransactionClient
const DAY_MS = 24 * 60 * 60 * 1000
const PERIOD_BASE = Date.UTC(2000, 0, 1)
const CONTENT_HASH_VERSION = 2
const asJson = (value: unknown) => value as Prisma.InputJsonValue
const decimal = (value: string | null) => value === null ? null : new Prisma.Decimal(value)
const stringDecimal = (value: Prisma.Decimal | null) => value?.toFixed() ?? null

export const reconcileSignedBill = (input: {
  grossHt: string | null
  netHt: string | null
  vatAmount: string | null
  netTtc: string | null
  lines: SignedBillLine[]
  adjustments: SignedBillAdjustment[]
  summary: SignedBillSummary
}): SignedBillReconciliation => {
  const items = input.lines.filter((line) => !line.rowType || line.rowType === 'ITEM')
  const sum = (values: string[]) => values.reduce((total, value) => total.plus(value), new ExactDecimal(0))
  const lineTotal = items.length && items.every((line) => line.amount !== null)
    ? sum(items.map((line) => line.amount as string)) : null
  const knownLineTotal = sum(items.flatMap((line) => line.amount === null ? [] : [line.amount]))
  const adjustment = sum(input.adjustments.map((row) => row.effectHt))
  const net = input.grossHt === null ? null : new ExactDecimal(input.grossHt).plus(adjustment)
  const vat = input.netHt !== null && input.summary.vatRate != null
    ? new ExactDecimal(input.netHt).times(input.summary.vatRate) : null
  const ttc = input.netHt !== null && input.vatAmount !== null
    ? new ExactDecimal(input.netHt).plus(input.vatAmount) : null
  const difference = (calculated: InstanceType<typeof ExactDecimal> | null, stated: string | null) =>
    calculated !== null && stated !== null ? calculated.minus(stated).toFixed() : null
  return {
    lineAmountTotal: lineTotal?.toFixed() ?? null,
    knownLineAmountTotal: knownLineTotal.toFixed(),
    missingLineAmountCount: items.filter((line) => line.amount === null).length,
    adjustmentTotalHt: adjustment.toFixed(),
    computedNetHt: net?.toFixed() ?? null,
    computedVatAmount: vat?.toFixed() ?? null,
    computedNetTtc: ttc?.toFixed() ?? null,
    lineGrossDifferenceHt: difference(lineTotal, input.grossHt),
    netHtDifference: difference(net, input.netHt),
    vatDifference: difference(vat, input.vatAmount),
    netTtcDifference: difference(ttc, input.netTtc),
  }
}

const requireObject = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SignedBillError('请求体须为对象')
  return value as Record<string, unknown>
}
const optionalBoolean = (value: unknown, label: string) => {
  if (value !== undefined && typeof value !== 'boolean') throw new SignedBillError(`${label}须为布尔值`)
  return value === true
}
const optionalFileId = (value: unknown) => value == null ? null : positiveBillInteger(value, '文件ID')
const expectedId = (body: Record<string, unknown>) => {
  if (!Object.prototype.hasOwnProperty.call(body, 'expectedCurrentRevisionId')) throw new SignedBillError('请提供当前版本ID，无当前版本时须明确为null')
  return body.expectedCurrentRevisionId === null ? null : positiveBillInteger(body.expectedCurrentRevisionId, '当前版本ID')
}

export const parseSignedBillDate = (value: unknown): string | null => {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new SignedBillError('签字日期须为YYYY-MM-DD或空')
  const date = new Date(`${value}T00:00:00.000Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new SignedBillError('签字日期无效')
  return value
}

export const parseCreateSignedBillInput = (value: unknown) => {
  const body = requireObject(value)
  const projectId = positiveBillInteger(body.projectId, '项目ID')
  const periodIndex = billPeriodIndex(body.periodIndex)
  const status = body.status ?? 'DRAFT'
  if (status !== 'DRAFT' && status !== 'SIGNED') throw new SignedBillError('账单版本状态无效')
  const currency = body.currency === undefined ? 'XOF' : billText(body.currency, '币种', 3)
  if (!/^[A-Z]{3}$/.test(currency)) throw new SignedBillError('币种须为三位大写代码')
  const activate = optionalBoolean(body.activate, '激活标记')
  const fromMeasurement = optionalBoolean(body.fromMeasurement, '计量快照标记')
  const reusePeriodFiles = optionalBoolean(body.reusePeriodFiles, '复用原件标记')
  const isSignedConfirmed = optionalBoolean(body.isSignedConfirmed, '签字核实标记')
  if (activate && status !== 'SIGNED') throw new SignedBillError('草稿不能设为正式版本')
  if (fromMeasurement && body.lines !== undefined) throw new SignedBillError('计量快照不能同时指定导入行')
  const headlines = {
    grossHt: billDecimal(body.grossHt, '签字工程HT', 10),
    netHt: billDecimal(body.netHt, '签字净HT', 10),
    vatAmount: billDecimal(body.vatAmount, '签字税额', 10),
    netTtc: billDecimal(body.netTtc, '签字净TTC', 10),
  }
  if (status === 'SIGNED' && (!isSignedConfirmed || Object.values(headlines).some((amount) => amount === null))) {
    throw new SignedBillError('签字版本须核实PDF签字并填写四项原件总额')
  }
  return {
    projectId, periodIndex, status: status as SignedBillStatus, currency, activate, fromMeasurement, reusePeriodFiles,
    signedAt: parseSignedBillDate(body.signedAt),
    signedPdfFileId: optionalFileId(body.signedPdfFileId),
    calculationFileId: optionalFileId(body.calculationFileId),
    ...headlines,
    lines: fromMeasurement ? [] : parseSignedBillLines(body.lines ?? []),
    adjustments: parseSignedBillAdjustments(body.adjustments ?? []),
    summary: parseSignedBillSummary(body.summary),
    source: parseSignedBillSource(body.source),
    changeReason: billText(body.changeReason, '版本说明'),
    expectedCurrentRevisionId: activate ? expectedId(body) : null,
  }
}

const lockPeriod = async (tx: Tx, projectId: number, periodIndex: number) => {
  // Independent of existing measurement locks; all revision numbering/selection uses this lock.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dailywork:signed-bill'), hashtext(${`${projectId}:${periodIndex}`}))`
}

const buildWorkingSnapshot = async (tx: Tx, projectId: number, periodIndex: number) => {
  const period = new Date(PERIOD_BASE + periodIndex * DAY_MS)
  const measurements = await tx.boqMeasurement.findMany({
    where: { projectId, period },
    include: { boqItem: true },
    orderBy: [{ boqItem: { sortOrder: 'asc' } }, { id: 'asc' }],
  })
  const lines: SignedBillLine[] = []
  const adjustments: SignedBillAdjustment[] = []
  for (const row of measurements) {
    const item = row.boqItem
    if (item.projectId !== projectId || item.sheetType !== 'ACTUAL') throw new SignedBillError('本期计量包含非本项目实际清单')
    if (item.code.toUpperCase() === 'AVANCE') {
      if (row.amount !== null) adjustments.push({ key: `measurement-${row.id}-advance`, kind: 'ADVANCE_RECOVERY', label: '编制计量预付款扣回', effectHt: row.amount.toFixed(), evidence: { measurementId: row.id, updatedAt: row.updatedAt.toISOString() } })
      continue
    }
    if (item.tone !== 'ITEM') continue
    const price = row.unitPrice ?? item.unitPrice
    lines.push({
      key: `measurement-${row.id}`,
      boqItemId: item.id,
      sourceCode: item.code || null,
      designation: item.designationFr || item.designationZh,
      unit: item.unit,
      unitPrice: stringDecimal(price),
      previousQuantity: null,
      quantity: row.quantity.toFixed(),
      cumulativeQuantity: null,
      previousAmount: null,
      amount: row.amount?.toFixed() ?? (price === null ? null : new ExactDecimal(row.quantity.toFixed()).times(price.toFixed()).toFixed()),
      cumulativeAmount: null,
      evidence: { measurementId: row.id, updatedAt: row.updatedAt.toISOString(), priceSource: row.unitPrice === null ? 'working-boq-price' : 'measurement-price', note: row.note },
    })
  }
  if (!lines.length) throw new SignedBillError('该期没有可生成快照的本期工程计量')
  return {
    lines,
    adjustments: parseSignedBillAdjustments(adjustments),
    measurementSnapshot: { periodIndex, measurements: measurements.map((row) => ({ id: row.id, updatedAt: row.updatedAt.toISOString() })), scope: 'current-period-working-values-only; previous/cumulative unknown' } as BillJson,
  }
}

const loadAndValidateFiles = async (tx: Tx, input: ReturnType<typeof parseCreateSignedBillInput>) => {
  const entityId = `${input.projectId}:${input.periodIndex}`
  if (input.reusePeriodFiles) {
    const links = await tx.fileAssetLink.findMany({ where: { entityType: SIGNED_BILL_PERIOD_ENTITY_TYPE, entityId, purpose: { in: ['bill-pdf', 'calculation-xlsx'] } } })
    for (const [field, purpose] of [['signedPdfFileId', 'bill-pdf'], ['calculationFileId', 'calculation-xlsx']] as const) {
      if (input[field] !== null) continue
      const ids = Array.from(new Set(links.filter((link) => link.purpose === purpose).map((link) => link.fileId)))
      if (ids.length > 1) throw new SignedBillError(`第${input.periodIndex}期有多个${purpose}，请明确文件ID`)
      input[field] = ids[0] ?? null
    }
  }
  if (input.status === 'SIGNED' && input.signedPdfFileId === null) throw new SignedBillError('签字版本必须关联PDF原件')
  const ids = Array.from(new Set([input.signedPdfFileId, input.calculationFileId, ...(input.source.files ?? []).map((file) => file.fileId)].filter((id): id is number => id !== null)))
  const files = ids.length ? await tx.fileAsset.findMany({ where: { id: { in: ids } }, include: { links: { where: { entityType: SIGNED_BILL_PERIOD_ENTITY_TYPE }, select: { entityId: true } } }, orderBy: { id: 'asc' } }) : []
  if (files.length !== ids.length) throw new SignedBillError('部分来源文件不存在')
  for (const file of files) {
    if (file.category !== 'measurement') throw new SignedBillError(`文件${file.id}不属于计量资料，不能归档至签字账单`)
    if (file.links.some((link) => link.entityId !== entityId)) throw new SignedBillError(`文件${file.id}属于其他项目或期次`)
    const reference = input.source.files?.find((entry) => entry.fileId === file.id)
    if (reference?.sha256 && reference.sha256.toLowerCase() !== file.checksum?.toLowerCase()) throw new SignedBillError(`文件${file.id}的来源校验值不一致`)
  }
  const pdf = files.find((file) => file.id === input.signedPdfFileId)
  if (pdf && pdf.mimeType.toLowerCase() !== 'application/pdf') throw new SignedBillError('签字原件须为PDF文件')
  const calculation = files.find((file) => file.id === input.calculationFileId)
  if (calculation && !/\.(xlsx?|xlsm|ods)$/i.test(calculation.originalName)) throw new SignedBillError('计算底稿须为电子表格文件')
  input.source = {
    ...input.source,
    headlineDecimalText: { grossHt: input.grossHt, netHt: input.netHt, vatAmount: input.vatAmount, netTtc: input.netTtc },
    files: files.map((file) => ({
      ...input.source.files?.find((entry) => entry.fileId === file.id),
      fileId: file.id,
      sha256: file.checksum,
      role: file.id === input.signedPdfFileId ? 'SIGNED_PDF' : file.id === input.calculationFileId ? 'CALCULATION' : 'EVIDENCE',
    })),
    assetMetadata: files.map((file) => ({ fileId: file.id, originalName: file.originalName, mimeType: file.mimeType, size: file.size, sha256: file.checksum })),
  }
  return files
}

const validateBoqMappings = async (tx: Tx, projectId: number, lines: SignedBillLine[]) => {
  const ids = Array.from(new Set(lines.flatMap((line) => line.boqItemId === null ? [] : [line.boqItemId])))
  const count = ids.length ? await tx.boqItem.count({ where: { id: { in: ids }, projectId, sheetType: 'ACTUAL' } }) : 0
  if (count !== ids.length) throw new SignedBillError('清单映射不属于本项目实际清单')
}

const revisionDocument = (input: ReturnType<typeof parseCreateSignedBillInput>) => ({
  projectId: input.projectId, periodIndex: input.periodIndex, status: input.status,
  currency: input.currency, signedAt: input.signedAt,
  signedPdfFileId: input.signedPdfFileId, calculationFileId: input.calculationFileId,
  grossHt: input.grossHt, netHt: input.netHt, vatAmount: input.vatAmount, netTtc: input.netTtc,
  lines: input.lines, adjustments: input.adjustments, summary: input.summary, source: input.source,
})

const documentSha256 = (document: ReturnType<typeof revisionDocument>) =>
  createHash('sha256').update(canonicalBillJson(document)).digest('hex')

const contentHashSource = (source: SignedBillSource): SignedBillSource => {
  const content: SignedBillSource = { ...source, contentHashVersion: CONTENT_HASH_VERSION }
  // Omit only display names at known file-metadata paths, never nested source evidence.
  for (const key of ['files', 'assetMetadata']) {
    const entries = content[key]
    if (Array.isArray(entries)) content[key] = entries.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry
      const metadata = { ...entry }
      delete metadata.originalName
      return metadata
    })
  }
  return content
}

const selectCurrent = async (tx: Tx, target: BoqBillRevision, expected: number | null, actorId: number, reason: string) => {
  const current = await tx.boqBillRevision.findFirst({ where: { projectId: target.projectId, periodIndex: target.periodIndex, isCurrent: true } })
  assertSignedBillActivation(target, current?.id ?? null, expected)
  if (current?.id === target.id) return target
  if (current) await tx.boqBillRevision.update({ where: { id: current.id }, data: { isCurrent: false } })
  const selected = await tx.boqBillRevision.update({ where: { id: target.id }, data: { isCurrent: true, activatedAt: new Date(), activatedById: actorId } })
  await tx.boqBillRevisionEvent.create({ data: { revisionId: target.id, kind: 'ACTIVATED', reason, actorId, payload: { previousRevisionId: current?.id ?? null, selectedRevisionId: target.id } } })
  return selected
}

const revisionDto = (row: BoqBillRevision, files: FileAsset[]): SignedBillRevisionDto => {
  const lines = row.linesJson as unknown as SignedBillLine[]
  const adjustments = row.adjustmentsJson as unknown as SignedBillAdjustment[]
  const summary = row.summaryJson as unknown as SignedBillSummary
  const source = row.sourceJson as unknown as SignedBillSource
  const ids = new Set([row.signedPdfFileId, row.calculationFileId, ...(source.files ?? []).map((entry) => entry.fileId)])
  const headlines = { grossHt: stringDecimal(row.grossHt), netHt: stringDecimal(row.netHt), vatAmount: stringDecimal(row.vatAmount), netTtc: stringDecimal(row.netTtc) }
  return {
    id: row.id, projectId: row.projectId, periodIndex: row.periodIndex, revision: row.revision,
    status: row.status, isCurrent: row.isCurrent, currency: row.currency,
    signedAt: row.signedAt?.toISOString().slice(0, 10) ?? null,
    signedPdfFileId: row.signedPdfFileId, calculationFileId: row.calculationFileId,
    ...headlines, lines, adjustments, summary, source,
    changeReason: row.changeReason, contentSha256: row.contentSha256,
    createdAt: row.createdAt.toISOString(), createdById: row.createdById,
    verifiedAt: row.verifiedAt?.toISOString() ?? null, verifiedById: row.verifiedById,
    activatedAt: row.activatedAt?.toISOString() ?? null, activatedById: row.activatedById,
    files: files.filter((file) => ids.has(file.id)).map((file): SignedBillFileDto => ({
      id: file.id,
      role: file.id === row.signedPdfFileId ? 'SIGNED_PDF' : file.id === row.calculationFileId ? 'CALCULATION' : 'EVIDENCE',
      originalName: file.originalName, mimeType: file.mimeType, size: file.size, checksum: file.checksum,
      downloadApiUrl: `/api/files/${file.id}?includeUrl=1`,
    })),
    reconciliation: reconcileSignedBill({ ...headlines, lines, adjustments, summary }),
  }
}

export const listSignedBillRevisions = async ({ projectId, periodIndex }: { projectId: number; periodIndex?: number }): Promise<SignedBillRevisionDto[]> => {
  positiveBillInteger(projectId, '项目ID')
  if (periodIndex !== undefined) billPeriodIndex(periodIndex)
  const rows = await prisma.boqBillRevision.findMany({ where: { projectId, ...(periodIndex === undefined ? {} : { periodIndex }) }, orderBy: [{ periodIndex: 'desc' }, { revision: 'desc' }] })
  const ids = Array.from(new Set(rows.flatMap((row) => [row.signedPdfFileId, row.calculationFileId, ...((row.sourceJson as unknown as SignedBillSource).files ?? []).map((file) => file.fileId)]).filter((id): id is number => id !== null)))
  const files = ids.length ? await prisma.fileAsset.findMany({ where: { id: { in: ids } } }) : []
  return rows.map((row) => revisionDto(row, files))
}

export const createSignedBillRevision = async (payload: CreateSignedBillInput | unknown, actorId: number): Promise<{ revision: SignedBillRevisionDto; reused: boolean }> => {
  const input = parseCreateSignedBillInput(payload)
  positiveBillInteger(actorId, '操作用户ID')
  return prisma.$transaction(async (tx) => {
    await lockPeriod(tx, input.projectId, input.periodIndex)
    const project = await tx.project.findUnique({ where: { id: input.projectId }, select: { id: true, name: true, code: true } })
    if (!project) throw new SignedBillError('项目不存在', 404)
    if (input.fromMeasurement) {
      const snapshot = await buildWorkingSnapshot(tx, input.projectId, input.periodIndex)
      input.lines = snapshot.lines
      if (!input.adjustments.some((row) => row.kind === 'ADVANCE_RECOVERY')) input.adjustments.push(...snapshot.adjustments)
      input.source = { ...input.source, measurementSnapshot: snapshot.measurementSnapshot }
    }
    if (!input.lines.length) throw new SignedBillError('账单必须包含本期工程行')
    await validateBoqMappings(tx, input.projectId, input.lines)
    const files = await loadAndValidateFiles(tx, input)
    input.source = { ...input.source, contentHashVersion: CONTENT_HASH_VERSION }
    const document = revisionDocument(input)
    const contentSha256 = documentSha256({ ...document, source: contentHashSource(document.source) })
    let existing = await tx.boqBillRevision.findUnique({ where: { projectId_periodIndex_contentSha256: { projectId: input.projectId, periodIndex: input.periodIndex, contentSha256 } } })
    if (!existing) {
      const candidates = await tx.boqBillRevision.findMany({ where: { projectId: input.projectId, periodIndex: input.periodIndex }, orderBy: { revision: 'asc' } })
      existing = candidates.find((candidate) => {
        const source = candidate.sourceJson as unknown as SignedBillSource
        if (!source || typeof source !== 'object' || Array.isArray(source) || source.contentHashVersion !== undefined) return false
        const legacyDocument = { ...document, source }
        // Prove the full legacy digest using its frozen source and the requested content.
        // Reuse it as-is; never rehash persisted snapshots, links or audit events in place.
        return documentSha256({ ...legacyDocument, source: contentHashSource(source) }) === contentSha256
          && documentSha256(legacyDocument) === candidate.contentSha256
      }) ?? null
    }
    if (existing) {
      // A retried create of the already selected document is a no-op, even if its first response was lost.
      const row = input.activate && !existing.isCurrent ? await selectCurrent(tx, existing, input.expectedCurrentRevisionId, actorId, input.changeReason) : existing
      return { revision: revisionDto(row, files), reused: true }
    }
    const last = await tx.boqBillRevision.aggregate({ where: { projectId: input.projectId, periodIndex: input.periodIndex }, _max: { revision: true } })
    const row = await tx.boqBillRevision.create({ data: {
      projectId: input.projectId, periodIndex: input.periodIndex, revision: (last._max.revision ?? 0) + 1,
      status: input.status, currency: input.currency, signedAt: input.signedAt === null ? null : new Date(`${input.signedAt}T00:00:00.000Z`),
      signedPdfFileId: input.signedPdfFileId, calculationFileId: input.calculationFileId,
      grossHt: decimal(input.grossHt), netHt: decimal(input.netHt), vatAmount: decimal(input.vatAmount), netTtc: decimal(input.netTtc),
      linesJson: asJson(input.lines), adjustmentsJson: asJson(input.adjustments), summaryJson: asJson(input.summary), sourceJson: asJson(input.source),
      contentSha256, changeReason: input.changeReason, createdById: actorId,
      verifiedAt: input.status === 'SIGNED' ? new Date() : null,
      verifiedById: input.status === 'SIGNED' ? actorId : null,
    } })
    await tx.boqBillRevisionEvent.create({ data: { revisionId: row.id, kind: 'CREATED', reason: input.changeReason, actorId, payload: { contentSha256, signatureConfirmed: input.status === 'SIGNED', fromMeasurement: input.fromMeasurement } } })
    if (files.length) await tx.fileAssetLink.createMany({ data: files.map((file) => ({
      fileId: file.id, entityType: SIGNED_BILL_ENTITY_TYPE, entityId: String(row.id),
      purpose: file.id === input.signedPdfFileId ? 'signed-pdf' : file.id === input.calculationFileId ? 'calculation-xlsx' : 'evidence',
      label: `第${input.periodIndex}期 · 版本${row.revision} · ${file.originalName}`,
      meta: {
        projectId: input.projectId, projectName: project.name, projectCode: project.code,
        periodIndex: input.periodIndex, revision: row.revision, sha256: file.checksum, contentSha256,
        designationZh: `第${input.periodIndex}期 · 签字账单版本${row.revision}`,
        designationFr: `Attachement n° ${input.periodIndex} · Révision ${row.revision}`,
      },
      createdById: actorId,
    })) })
    const selected = input.activate ? await selectCurrent(tx, row, input.expectedCurrentRevisionId, actorId, input.changeReason) : row
    return { revision: revisionDto(selected, files), reused: false }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 })
}

export const activateSignedBillRevision = async (id: number, payload: ActivateSignedBillInput | unknown, actorId: number): Promise<SignedBillRevisionDto> => {
  positiveBillInteger(id, '版本ID')
  positiveBillInteger(actorId, '操作用户ID')
  const body = requireObject(payload)
  const expected = expectedId(body)
  const reason = billText(body.reason, '切换原因')
  const identity = await prisma.boqBillRevision.findUnique({ where: { id }, select: { projectId: true, periodIndex: true } })
  if (!identity) throw new SignedBillError('账单版本不存在', 404)
  await prisma.$transaction(async (tx) => {
    await lockPeriod(tx, identity.projectId, identity.periodIndex)
    const target = await tx.boqBillRevision.findUnique({ where: { id } })
    if (!target) throw new SignedBillError('账单版本不存在', 404)
    await selectCurrent(tx, target, expected, actorId, reason)
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, maxWait: 10000, timeout: 20000 })
  const revisions = await listSignedBillRevisions(identity)
  const selected = revisions.find((row) => row.id === id)
  if (!selected) throw new SignedBillError('账单版本不存在', 404)
  return selected
}
