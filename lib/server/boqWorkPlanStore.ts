import { createHash } from 'node:crypto'
import { Prisma, type BoqBillRevision, type BoqWorkPlan } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BoqWorkPlanError, type BoqWorkConfirmedSnapshot, type BoqWorkDraft, type BoqWorkMatchPreflightInput, type BoqWorkMatchPreflightResponse, type BoqWorkPlanDto, type BoqWorkPlanItemDto, type BoqWorkPlanPostResponse, type BoqWorkPlansResponse } from '@/lib/value/boqWorkPlans'
import { buildBoqWorkSummary, emptyBoqWorkSummary, normalizeWorkUnit, parseBoqWorkPlanInput, WorkDecimal, workDecimal, workId } from '@/lib/value/boqWorkPlanRules'
import { defaultBoqWorkPlanPrice } from '@/lib/value/boqWorkPriceDefaults'
import type { SignedBillLine } from '@/lib/value/signedBills'
import type { SignedCalculationItem } from '@/lib/value/signedBillCalculations'

type Db = Prisma.TransactionClient
type RecordObject = Record<string, unknown>
const obj = (v: unknown): RecordObject => v && typeof v === 'object' && !Array.isArray(v) ? v as RecordObject : {}
const canonical = (v: unknown): unknown => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((key) => [key, canonical((v as RecordObject)[key])])) : v
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(canonical(v ?? null))).digest('hex')
const json = (v: unknown) => v as Prisma.InputJsonValue
const conflict = (message: string): never => { throw new BoqWorkPlanError(message, 409) }

/** Only source business data is fingerprinted; manual record.note/updatedAt are excluded. */
export function workBaselineHash(input: { revisions: unknown[]; manifests: unknown[]; recordSources: unknown[] }) {
  const revisions = input.revisions.map((v) => { const r = obj(v); return { id: r.id, periodIndex: r.periodIndex, status: r.status, isCurrent: r.isCurrent, contentSha256: r.contentSha256 } }).sort((a, b) => Number(a.id) - Number(b.id))
  const manifests = input.manifests.map((v) => { const r = obj(v), m = obj(r.meta ?? v); return { revisionId: r.entityId ?? r.revisionId, fileId: r.fileId, format: m.format, reviewKey: m.reviewKey, sourceSha256: m.sourceSha256, extractionSha256: m.extractionSha256, items: m.items, correctionHistory: m.correctionHistory } }).sort((a, b) => String(a.revisionId).localeCompare(String(b.revisionId)))
  const recordSources = input.recordSources.map((v) => { const r = obj(v); return { recordId: r.recordId ?? r.id, source: r.source } }).sort((a, b) => String(a.recordId).localeCompare(String(b.recordId)))
  return hash({ revisions, manifests, recordSources })
}

export function sourceWorkItems(revision: Pick<BoqBillRevision, 'linesJson'>, templateItems: SignedCalculationItem[]): BoqWorkPlanItemDto[] {
  const lines = revision.linesJson as unknown as SignedBillLine[]
  if (!Array.isArray(lines)) throw new BoqWorkPlanError('原账单量价格式无效', 409)
  const items: BoqWorkPlanItemDto[] = lines.filter((line) => !line.rowType || line.rowType === 'ITEM').map((line) => ({ lineKey: line.key, sourceKind: 'SIGNED_LINE', sourceRow: typeof line.evidence?.sourceRow === 'number' ? line.evidence.sourceRow : null, boqItemId: line.boqItemId, code: line.sourceCode, designation: line.designation, unit: line.unit, sourceUnitPrice: line.unitPrice, previousQuantity: line.previousQuantity, currentQuantity: line.quantity, cumulativeQuantity: line.cumulativeQuantity, cumulativeAmountHt: line.cumulativeAmount, state: 'UNCONFIRMED', plan: null, summary: emptyBoqWorkSummary(line.cumulativeQuantity) }))
  const allSignedKeys = new Set(lines.map((line) => line.key))
  for (const item of templateItems) {
    if (allSignedKeys.has(item.lineKey)) continue
    if (!Number.isSafeInteger(item.sourceRow) || item.sourceRow <= 0 || item.lineKey !== `xlsx-row-${item.sourceRow}`) throw new BoqWorkPlanError('补充模板项定位无效', 409)
    items.push({ lineKey: item.lineKey, sourceKind: 'TEMPLATE_ITEM', sourceRow: item.sourceRow, boqItemId: null, code: item.code || null, designation: item.designation, unit: item.unit, sourceUnitPrice: item.unitPrice, previousQuantity: item.previousQuantity, currentQuantity: item.currentQuantity, cumulativeQuantity: item.cumulativeQuantity, cumulativeAmountHt: item.cumulativeAmountHt, state: 'UNCONFIRMED', plan: null, summary: emptyBoqWorkSummary(null) })
  }
  if (new Set(items.map((item) => item.lineKey)).size !== items.length) throw new BoqWorkPlanError('原件条目定位重复', 409)
  return items
}

/** Unpriced activities are anchored to real, unmapped source headers, never invented BoQ leaves. */
export function sourceActivityWorkItems(records: Array<{ recordId: string; data: unknown; unit: string | null }>): BoqWorkPlanItemDto[] {
  const rows = records.map((record) => ({ record, row: obj(record.data) })).filter(({ record, row }) => typeof record.recordId === 'string' && record.recordId.length > 0 && record.recordId.length <= 200 && typeof row.sourceSheet === 'string' && row.sourceSheet.trim() && Number.isSafeInteger(row.sourceRow) && Number(row.sourceRow) > 0)
    .sort((a, b) => String(a.row.sourceSheet).localeCompare(String(b.row.sourceSheet)) || Number(a.row.sourceRow) - Number(b.row.sourceRow) || a.record.recordId.localeCompare(b.record.recordId))
  const unmapped = (row: RecordObject) => Array.isArray(row.templateLeafRows) && row.templateLeafRows.length === 0
  const text = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null
  const items: BoqWorkPlanItemDto[] = []
  for (let index = 0; index < rows.length; index++) {
    const { record, row } = rows[index]
    if (row.rowType !== 'ITEM_HEADER' || !unmapped(row)) continue
    const designation = text(row.descriptionOriginal) ?? text(row.structureNameOriginal)
    if (!designation || designation === text(row.roadNameOriginal)) continue
    const details: string[] = []
    for (let next = index + 1; next < rows.length; next++) {
      const candidate = rows[next]
      if (candidate.row.sourceSheet !== row.sourceSheet || candidate.row.rowType === 'ITEM_HEADER') break
      if (candidate.row.rowType === 'DETAIL' && unmapped(candidate.row)) details.push(candidate.record.recordId)
    }
    if (!details.length) continue
    const unit = text(obj(row.unit).value) ?? text(record.unit)
    items.push({ lineKey: record.recordId, sourceKind: 'SOURCE_ACTIVITY', sourceRecordIds: details, sourceRow: Number(row.sourceRow), boqItemId: null, code: null, designation, unit, sourceUnitPrice: null, previousQuantity: null, currentQuantity: null, cumulativeQuantity: null, cumulativeAmountHt: null, state: 'UNCONFIRMED', plan: null, summary: emptyBoqWorkSummary(null) })
  }
  if (new Set(items.map((item) => item.lineKey)).size !== items.length) throw new BoqWorkPlanError('未分配原件条目定位重复', 409)
  return items
}

async function context(revisionId: number, db: Db = prisma) {
  workId(revisionId, '账单版本')
  const revision = await db.boqBillRevision.findUnique({ where: { id: revisionId }, include: { calculationFile: { select: { id: true, checksum: true } }, project: { select: { code: true } } } })
  if (!revision) throw new BoqWorkPlanError('账单版本不存在', 404)
  const current = await db.boqBillRevision.findMany({ where: { projectId: revision.projectId, isCurrent: true, status: 'SIGNED' }, orderBy: { periodIndex: 'desc' } })
  const relevant = current.some((r) => r.id === revisionId) ? current : [...current, revision]
  const links = await db.fileAssetLink.findMany({ where: { entityType: 'signed-bill-revision', entityId: { in: relevant.map((r) => String(r.id)) }, purpose: 'calculation-review' }, orderBy: { id: 'asc' } })
  const selectedLinks = links.filter((link) => link.entityId === String(revisionId))
  if (selectedLinks.length > 1) conflict('所选账单计算明细关联重复')
  const selected = selectedLinks[0], manifest = obj(selected?.meta)
  if (selected && (selected.fileId !== revision.calculationFileId || manifest.format !== 'SIGNED_CALCULATION_V1' || manifest.projectId !== revision.projectId || manifest.periodIndex !== revision.periodIndex || manifest.sourceSha256 !== revision.calculationFile?.checksum)) conflict('补充模板与账单原件不匹配')
  const reviewKeys = links.map((link) => obj(link.meta).reviewKey).filter((v): v is string => typeof v === 'string')
  const reviews = reviewKeys.length ? await db.valueBillReview.findMany({ where: { key: { in: reviewKeys } }, select: { id: true, key: true, projectCode: true, sourceSha256: true, attachmentNumber: true } }) : []
  const selectedReview = selected ? reviews.find((r) => r.key === manifest.reviewKey) : undefined
  if (selected && (!selectedReview || selectedReview.projectCode !== revision.project.code || selectedReview.sourceSha256 !== manifest.sourceSha256 || selectedReview.attachmentNumber !== revision.periodIndex)) conflict('补充模板底稿的项目、期次或原件哈希不匹配')
  const sources = reviews.length ? await db.valueBillReviewRecord.findMany({ where: { reviewId: { in: reviews.map((r) => r.id) } }, select: { recordId: true, source: true } }) : []
  const baselineHash = workBaselineHash({ revisions: relevant, manifests: links, recordSources: sources })
  const editAllowed = revision.status === 'SIGNED' && revision.isCurrent && current[0]?.id === revision.id
  const activityRecords = selectedReview ? await db.valueBillReviewRecord.findMany({ where: { reviewId: selectedReview.id }, select: { recordId: true, data: true, unit: true }, orderBy: [{ sourceExcelRow: 'asc' }, { id: 'asc' }] }) : []
  const items = [...sourceWorkItems(revision, Array.isArray(manifest.items) ? manifest.items as SignedCalculationItem[] : []), ...sourceActivityWorkItems(activityRecords)]
  if (new Set(items.map((item) => item.lineKey)).size !== items.length) conflict('原件条目定位重复')
  const [plans, roads] = await Promise.all([
    db.boqWorkPlan.findMany({ where: { projectId: revision.projectId, anchorRevisionId: revisionId } }),
    db.roadSection.findMany({ where: { projectId: revision.projectId }, select: { id: true, name: true, slug: true }, orderBy: { id: 'asc' } }),
  ])
  return { revision, current, items, plans, roads, baselineHash, editAllowed }
}

function planRoadsValid(plan: BoqWorkPlan, roads: Array<{ id: number }>) {
  const draft = plan.draftJson as unknown as BoqWorkDraft, confirmed = plan.confirmedSnapshotJson as unknown as BoqWorkConfirmedSnapshot | null
  const roadIds = new Set(roads.map((road) => road.id))
  return [...draft.scopes, ...(confirmed?.scopes ?? [])].every((scope) => scope.roadId === null || roadIds.has(scope.roadId))
}

function present(item: BoqWorkPlanItemDto, plan: BoqWorkPlan | undefined, baselineHash: string, editAllowed: boolean, roads: Array<{ id: number }>): BoqWorkPlanItemDto {
  if (!plan) return item
  const draft = plan.draftJson as unknown as BoqWorkDraft, confirmed = plan.confirmedSnapshotJson as unknown as BoqWorkConfirmedSnapshot | null
  const stale = editAllowed && ((confirmed ? confirmed.baselineHash : draft.baselineHash) !== baselineHash || !planRoadsValid(plan, roads))
  const state = stale ? 'NEEDS_REVIEW' : plan.state as BoqWorkPlanDto['state']
  return { ...item, state, plan: { id: plan.id, version: plan.version, state, draft, confirmedSnapshot: confirmed, updatedAt: plan.updatedAt.toISOString() }, summary: buildBoqWorkSummary(item, stale ? null : confirmed, baselineHash, editAllowed) }
}

export async function listBoqWorkPlans(revisionId: number): Promise<BoqWorkPlansResponse> {
  const c = await context(revisionId)
  return { revisionId, projectId: c.revision.projectId, periodIndex: c.revision.periodIndex, baselineHash: c.baselineHash, editAllowed: c.editAllowed, readOnlyReason: c.editAllowed ? null : '只有项目最新期的当前签字版本可编辑；历史版本只读。', items: c.items.map((item) => present(item, c.plans.find((p) => p.anchorLineKey === item.lineKey), c.baselineHash, c.editAllowed, c.roads)), roads: c.roads }
}

export async function saveBoqWorkPlan(revisionId: number, body: unknown, actorId: number): Promise<BoqWorkPlanPostResponse> {
  const input = parseBoqWorkPlanInput(body); workId(actorId, '用户')
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('dailywork:boq-work'), hashtext(${`${revisionId}:${input.lineKey}`}))`
    const c = await context(revisionId, tx), item = c.items.find((r) => r.lineKey === input.lineKey)
    if (!item) throw new BoqWorkPlanError('该条目不属于所选原件', 404)
    if (item.sourceKind === 'SOURCE_ACTIVITY' && input.action !== 'save-draft') throw new BoqWorkPlanError('未分配价号的原件事项只能暂存待核，不能确认或核销')
    if (!c.editAllowed) conflict('历史期次或非当前签字版本不可编辑')
    if (input.baselineHash !== c.baselineHash) conflict('账单或原件核查数据已变化，请重新核对')
    const existing = c.plans.find((p) => p.anchorLineKey === input.lineKey)
    if ((existing?.version ?? null) !== input.expectedVersion) conflict('计划已被其他人更新，请刷新核对')
    if (item.boqItemId !== null && !await tx.boqItem.findFirst({ where: { id: item.boqItemId, projectId: c.revision.projectId } })) conflict('原件清单项目归属不一致')
    if (input.scopes.some((scope) => scope.roadId !== null && !c.roads.some((road) => road.id === scope.roadId))) throw new BoqWorkPlanError('范围道路不属于本项目')
    if (input.action === 'confirm' && (!item.unit || input.scopes.some((scope) => !scope.unit || normalizeWorkUnit(scope.unit) !== normalizeWorkUnit(item.unit!)))) throw new BoqWorkPlanError('原件单位未明确或范围单位不一致，请先保存草稿核对；不自动换算')
    const priorScopes = existing ? await tx.boqWorkScope.findMany({ where: { planId: existing.id } }) : []
    const usedIds = input.scopes.map((scope) => scope.id)
    if (usedIds.length && await tx.boqWorkScope.count({ where: { id: { in: usedIds }, ...(existing ? { planId: { not: existing.id } } : {}) } })) throw new BoqWorkPlanError('范围ID已属于其他计划')
    if (priorScopes.length) {
      const allocations = await tx.boqWorkAllocation.findMany({ where: { scopeId: { in: priorScopes.map((scope) => scope.id) } }, select: { scopeId: true } })
      const oldDraft = existing!.draftJson as unknown as BoqWorkDraft
      for (const allocation of allocations) {
        const before = oldDraft.scopes.find((s) => s.id === allocation.scopeId), after = input.scopes.find((s) => s.id === allocation.scopeId)
        if (!before || !after || hash(before) !== hash(after)) conflict('已有核销量的范围不能删除或改写，请先明确冲回')
      }
    }
    const version = (existing?.version ?? 0) + 1
    const oldDraft = existing?.draftJson as unknown as BoqWorkDraft | undefined
    const price = defaultBoqWorkPlanPrice(item, revisionId, input.scopes, input.price === undefined ? oldDraft?.price ?? null : input.price)
    const draft: BoqWorkDraft = { scopeComplete: input.scopeComplete, scopes: input.scopes, price, baselineHash: c.baselineHash }
    const previousConfirmed = existing?.confirmedSnapshotJson as unknown as BoqWorkConfirmedSnapshot | null ?? null
    const confirmed: BoqWorkConfirmedSnapshot | null = input.action === 'save-draft' ? previousConfirmed : { ...draft, action: input.action, version, signedCumulativeQuantity: item.sourceKind === 'TEMPLATE_ITEM' ? null : item.cumulativeQuantity, signedCumulativeAmountHt: item.sourceKind === 'TEMPLATE_ITEM' ? null : item.cumulativeAmountHt, confirmedAt: new Date().toISOString(), confirmedById: actorId, reason: input.reason }
    const state = input.action === 'save-draft' ? 'DRAFT' : input.action === 'confirm-none' ? 'CONFIRMED_NONE' : 'CONFIRMED'
    let saved: BoqWorkPlan
    const data = { version, state, draftJson: json(draft), confirmedSnapshotJson: confirmed ? json(confirmed) : Prisma.DbNull, updatedById: actorId }
    if (existing) {
      const changed = await tx.boqWorkPlan.updateMany({ where: { id: existing.id, version: input.expectedVersion! }, data })
      if (changed.count !== 1) conflict('计划版本冲突，请刷新')
      saved = await tx.boqWorkPlan.findUniqueOrThrow({ where: { id: existing.id } })
    } else {
      saved = await tx.boqWorkPlan.create({ data: { ...data, projectId: c.revision.projectId, anchorRevisionId: revisionId, anchorLineKey: item.lineKey, boqItemId: item.boqItemId, createdById: actorId } })
      await tx.boqWorkBinding.create({ data: { projectId: c.revision.projectId, planId: saved.id, signedRevisionId: revisionId, lineKey: item.lineKey, sourceKind: item.sourceKind, sourceHash: c.baselineHash } })
    }
    await tx.boqWorkScope.updateMany({ where: { planId: saved.id }, data: { isActive: false } })
    for (let i = 0; i < input.scopes.length; i++) {
      const scope = input.scopes[i], { id, price, ...fields } = scope
      const scopeData = { ...fields, quantity: scope.quantity === null ? null : new Prisma.Decimal(scope.quantity), priceJson: price ? json(price) : Prisma.DbNull, sortOrder: i, isActive: true }
      await tx.boqWorkScope.upsert({ where: { id }, create: { id, planId: saved.id, ...scopeData }, update: scopeData })
    }
    await tx.boqWorkEvent.create({ data: { planId: saved.id, version, kind: input.action, beforeJson: existing ? json({ draft: existing.draftJson, confirmedSnapshot: existing.confirmedSnapshotJson }) : Prisma.DbNull, afterJson: json({ draft, confirmedSnapshot: confirmed }), actorId, reason: input.reason } })
    return { item: present(item, saved, c.baselineHash, c.editAllowed, c.roads), baselineHash: c.baselineHash }
  }, { isolationLevel: 'Serializable', timeout: 30000 })
}

export async function previewBoqWorkMatch(revisionId: number, body: unknown): Promise<BoqWorkMatchPreflightResponse> {
  const p = obj(body), c = await context(revisionId), lineKey = p.lineKey
  if (typeof lineKey !== 'string' || typeof p.expectedVersion !== 'number' || p.baselineHash !== c.baselineHash) conflict('匹配基线或版本无效，请刷新')
  if (c.items.some((item) => item.lineKey === lineKey && item.sourceKind === 'SOURCE_ACTIVITY')) throw new BoqWorkPlanError('未分配价号的原件事项只能暂存待核，不能核销')
  const plan = c.plans.find((r) => r.anchorLineKey === lineKey)
  if (!plan || plan.version !== p.expectedVersion || !c.editAllowed) throw new BoqWorkPlanError('计划不存在、已更新或当前版本只读', 409)
  if (!planRoadsValid(plan, c.roads)) conflict('范围道路已不存在或不属于本项目，请重新核对')
  const storedSnapshot = plan.confirmedSnapshotJson as unknown as BoqWorkConfirmedSnapshot | null
  if (!storedSnapshot || storedSnapshot.baselineHash !== c.baselineHash) throw new BoqWorkPlanError('请先确认当前基线下的剩余范围', 409)
  const snapshot = storedSnapshot
  if (!Array.isArray(p.proposals) || p.proposals.length > 500) throw new BoqWorkPlanError('匹配清单无效')
  const unsupportedReason = p.proposals.length ? '非空核销匹配暂不支持：尚无经验证的后续账单绑定流程；未验证匹配且未写入。' : null
  const proposals: BoqWorkMatchPreflightInput['proposals'] = [], errors: string[] = unsupportedReason ? [unsupportedReason] : []
  const scopeTotals = new Map<string, InstanceType<typeof WorkDecimal>>(), sourceTotals = new Map<string, InstanceType<typeof WorkDecimal>>()
  for (const raw of p.proposals) {
    const r = obj(raw), sourceRevisionId = workId(r.signedRevisionId, '源账单'), deltaQuantity = workDecimal(r.deltaQuantity, '核销增量', true)
    if (typeof r.scopeId !== 'string' || typeof r.lineKey !== 'string' || deltaQuantity === null || new WorkDecimal(deltaQuantity).eq(0)) throw new BoqWorkPlanError('匹配须明确范围、原件条目和非零正负增量')
    const scope = snapshot.scopes.find((s) => s.id === r.scopeId)
    if (!scope) throw new BoqWorkPlanError('匹配范围不属于此计划')
    if (new WorkDecimal(deltaQuantity).lt(0)) errors.push('负向冲回须明确原核销关联和原因；本阶段仅列为待核')
    if (new WorkDecimal(deltaQuantity).gt(0) && scope.completionState !== 'COMPLETED') errors.push('该范围完成事实尚未确认，结构匹配不能代替完工确认')
    const sourceRevision = c.current.find((s) => s.id === sourceRevisionId)
    const source = (sourceRevision?.linesJson as unknown as SignedBillLine[] | undefined)?.find((s) => s.key === r.lineKey && (!s.rowType || s.rowType === 'ITEM'))
    const bound = Boolean(await prisma.boqWorkBinding.findFirst({ where: { planId: plan.id, signedRevisionId: sourceRevisionId, lineKey: r.lineKey } }))
    if (sourceRevision && sourceRevision.periodIndex <= c.revision.periodIndex) errors.push('基线期及更早账单已包含在签字累计量中，不能再次核销；须等待明确绑定的后续账单')
    if (!source || !bound) errors.push('原件条目未明确绑定本计划，不能按价号字符串自动匹配')
    if (source && (!source.unit || !scope.unit || normalizeWorkUnit(source.unit) !== normalizeWorkUnit(scope.unit))) errors.push('原件与范围单位不一致')
    if (source?.quantity === null || source?.quantity === undefined) errors.push('原件本期数量为空，不能核销')
    const key = `${sourceRevisionId}:${r.lineKey}`, amount = new WorkDecimal(deltaQuantity)
    scopeTotals.set(scope.id, (scopeTotals.get(scope.id) ?? new WorkDecimal(0)).plus(amount)); sourceTotals.set(key, (sourceTotals.get(key) ?? new WorkDecimal(0)).plus(amount))
    proposals.push({ scopeId: scope.id, signedRevisionId: sourceRevisionId, lineKey: r.lineKey, deltaQuantity })
  }
  const bindings = await prisma.boqWorkBinding.findMany({ where: { planId: plan.id }, select: { id: true, signedRevisionId: true, lineKey: true } })
  const existing = await prisma.boqWorkAllocation.findMany({ where: { OR: [{ scopeId: { in: snapshot.scopes.map((s) => s.id) } }, { bindingId: { in: bindings.map((binding) => binding.id) } }] } })
  let sourceCapacity = new WorkDecimal(0)
  for (const [key, amount] of Array.from(sourceTotals.entries())) {
    const [rev, ...parts] = key.split(':'), source = (c.current.find((r) => r.id === Number(rev))?.linesJson as unknown as SignedBillLine[] | undefined)?.find((r) => r.key === parts.join(':'))
    const bindingIds = bindings.filter((binding) => binding.signedRevisionId === Number(rev) && binding.lineKey === parts.join(':')).map((binding) => binding.id)
    const alreadyAllocated = existing.filter((allocation) => bindingIds.includes(allocation.bindingId)).reduce((n, allocation) => n.plus(allocation.deltaQuantity.toFixed()), new WorkDecimal(0))
    if (source?.quantity != null) {
      const quantity = new WorkDecimal(source.quantity), combined = alreadyAllocated.plus(amount)
      sourceCapacity = sourceCapacity.plus(quantity.minus(alreadyAllocated))
      if ((quantity.gte(0) && (combined.lt(0) || combined.gt(quantity))) || (quantity.lt(0) && (combined.gt(0) || combined.lt(quantity)))) errors.push('匹配正负增量连同既有核销超出原件本期量')
    }
  }
  const remainingAfter = snapshot.scopes.map((s) => {
    if (s.quantity === null) return { scopeId: s.id, quantity: null }
    const allocated = existing.filter((a) => a.scopeId === s.id).reduce((n, a) => n.plus(a.deltaQuantity.toFixed()), new WorkDecimal(0)), proposed = scopeTotals.get(s.id) ?? new WorkDecimal(0)
    if (allocated.plus(proposed).lt(0)) errors.push('负向冲回超过此前已核销量')
    const left = new WorkDecimal(s.quantity).minus(allocated).minus(proposed)
    if (left.lt(0)) errors.push('核销量超过该范围确认的剩余量')
    return { scopeId: s.id, quantity: left.toFixed() }
  })
  return { valid: errors.length === 0, matched: false, unsupportedReason, errors: Array.from(new Set(errors)), proposals, signedDeltaTotal: sourceCapacity.toFixed(), allocatedDeltaTotal: proposals.reduce((n, r) => n.plus(r.deltaQuantity), new WorkDecimal(0)).toFixed(), remainingAfter, written: false }
}
