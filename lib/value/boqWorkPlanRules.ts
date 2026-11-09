import { Prisma } from '@prisma/client'
import { BoqWorkPlanError, type BoqWorkConfirmedSnapshot, type BoqWorkPlanItemDto, type BoqWorkPlanPostInput, type BoqWorkPrice, type BoqWorkScope, type BoqWorkSummary } from './boqWorkPlans'
import { workScopePrice } from './boqWorkPriceDefaults'

export const WorkDecimal = Prisma.Decimal.clone({ precision: 80 })
const object = (v: unknown, label: string) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new BoqWorkPlanError(`${label}格式无效`); return v as Record<string, unknown> }
const text = (v: unknown, label: string, max = 2000) => { if (typeof v !== 'string' || v.includes('\0') || v.length > max) throw new BoqWorkPlanError(`${label}格式无效`); return v.trim() }
const optionalText = (v: unknown, label: string, max = 2000) => v == null ? null : text(v, label, max) || null
const bool = (v: unknown, label: string) => { if (typeof v !== 'boolean') throw new BoqWorkPlanError(`${label}须明确填写`); return v }
export const workId = (v: unknown, label: string) => { if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) throw new BoqWorkPlanError(`${label}无效`); return v }
export function workDecimal(v: unknown, label: string, allowNegative = false): string | null {
  if (v === null) return null
  if (typeof v !== 'string' || !/^-?\d+(?:\.\d+)?$/.test(v)) throw new BoqWorkPlanError(`${label}须为十进制字符串或空值`)
  const [whole, fraction = ''] = v.replace(/^-/, '').split('.')
  if (whole.replace(/^0+/, '').length > 20 || fraction.length > 18 || (!allowNegative && new WorkDecimal(v).lt(0))) throw new BoqWorkPlanError(`${label}超出精度或范围`)
  return v
}
export const normalizeWorkUnit = (v: string) => v.toLowerCase().replace(/\s/g, '').replace(/²/g, '2').replace(/³/g, '3').replace(/^ml$/, 'm')
export function parseWorkPrice(value: unknown): BoqWorkPrice | null {
  if (value == null) return null
  const p = object(value, '价格'), basis = text(p.basis, '价格依据', 32)
  if (!['ORIGINAL', 'APPROVED_CHANGE', 'PROVISIONAL', 'UNKNOWN'].includes(basis)) throw new BoqWorkPlanError('价格依据无效')
  const result: BoqWorkPrice = { unitPrice: workDecimal(p.unitPrice, '单价'), confirmed: bool(p.confirmed, '价格确认'), basis: basis as BoqWorkPrice['basis'], evidence: text(p.evidence, '价格证据') }
  if (result.confirmed && (result.unitPrice === null || result.basis === 'UNKNOWN' || !result.evidence)) throw new BoqWorkPlanError('确认价格须填写单价、明确依据和证据')
  return result
}
export function parseBoqWorkPlanInput(value: unknown): BoqWorkPlanPostInput {
  const p = object(value, '待计量计划'), lineKey = text(p.lineKey, '原件条目', 200), remark = optionalText(p.reason, '备注')
  if (!lineKey) throw new BoqWorkPlanError('请填写原件条目')
  if (!Object.prototype.hasOwnProperty.call(p, 'expectedVersion') || (p.expectedVersion !== null && (typeof p.expectedVersion !== 'number' || !Number.isSafeInteger(p.expectedVersion) || p.expectedVersion <= 0))) throw new BoqWorkPlanError('请提供当前版本，无计划时须明确为null')
  if (!['save-draft', 'confirm', 'confirm-none'].includes(String(p.action))) throw new BoqWorkPlanError('操作类型无效')
  const action = p.action as BoqWorkPlanPostInput['action']
  const reason = remark || { 'save-draft': '页面保存待计量草稿', confirm: '页面确认待计量范围', 'confirm-none': '页面确认无剩余' }[action]
  if (typeof p.baselineHash !== 'string' || !/^[a-f0-9]{64}$/.test(p.baselineHash)) throw new BoqWorkPlanError('缺少有效账单基线，请刷新')
  if (!Array.isArray(p.scopes) || p.scopes.length > 500) throw new BoqWorkPlanError('范围清单格式无效或超过500行')
  const scopes: BoqWorkScope[] = p.scopes.map((v) => {
    const r = object(v, '范围行'), id = text(r.id, '范围ID', 36).toLowerCase(), completionState = text(r.completionState, '完成状态', 32), scopeBasis = text(r.scopeBasis, '合同范围', 32)
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new BoqWorkPlanError('范围ID须为稳定UUID')
    if (!['COMPLETED', 'NOT_COMPLETED', 'UNKNOWN'].includes(completionState) || !['ORIGINAL', 'APPROVED_CHANGE', 'PENDING_CHANGE'].includes(scopeBasis)) throw new BoqWorkPlanError('范围或完成状态无效')
    const quantity = workDecimal(r.quantity, '剩余量'), quantityConfirmed = bool(r.quantityConfirmed, '数量确认')
    if (quantityConfirmed && quantity === null) throw new BoqWorkPlanError('确认数量不能留空')
    return { id, description: text(r.description, '范围说明'), roadId: r.roadId == null ? null : workId(r.roadId, '道路'), startPk: optionalText(r.startPk, '起点', 100), endPk: optionalText(r.endPk, '终点', 100), side: optionalText(r.side, '侧别', 80), spec: optionalText(r.spec, '规格', 500), unit: optionalText(r.unit, '单位', 32), completionState: completionState as BoqWorkScope['completionState'], scopeBasis: scopeBasis as BoqWorkScope['scopeBasis'], quantity, quantityConfirmed, quantityEvidence: text(r.quantityEvidence, '数量依据'), approvalEvidence: text(r.approvalEvidence, '批准依据'), price: parseWorkPrice(r.price) }
  })
  if (new Set(scopes.map((r) => r.id)).size !== scopes.length) throw new BoqWorkPlanError('范围ID重复')
  const result: BoqWorkPlanPostInput = { lineKey, expectedVersion: p.expectedVersion as number | null, action, scopeComplete: bool(p.scopeComplete, '范围完整性'), scopes, reason, baselineHash: p.baselineHash }
  if (Object.prototype.hasOwnProperty.call(p, 'price')) result.price = parseWorkPrice(p.price)
  if (result.action === 'confirm-none' && (!result.scopeComplete || scopes.length !== 0)) throw new BoqWorkPlanError('确认无剩余须明确范围完整且清单为空')
  if (result.action === 'confirm') {
    if (!scopes.length || scopes.some((r) => !r.quantityConfirmed || r.quantity === null || !r.unit || !r.description)) throw new BoqWorkPlanError('确认范围须逐行填写说明、确认非空数量和单位')
    for (const scope of scopes) if (!scope.quantityEvidence) scope.quantityEvidence = remark || '页面逐行确认数量'
    if (scopes.some((r) => r.scopeBasis === 'APPROVED_CHANGE' && !r.approvalEvidence)) throw new BoqWorkPlanError('已批变更须填写批准依据')
  }
  return result
}

export function emptyBoqWorkSummary(measured: string | null): BoqWorkSummary {
  return { signedCumulativeQuantity: measured, completedUnbilledQuantity: null, notCompletedUnbilledQuantity: null, unknownCompletionQuantity: null, approvedRemainingQuantity: null, pendingRemainingQuantity: null, remainingQuantity: null, forecastFinalQuantity: null, forecastIncludingPendingQuantity: null, remainingAmountHt: null, pendingAmountHt: null, forecastFinalAmountHt: null, missingPriceCount: 0, ready: false }
}

export function buildBoqWorkSummary(item: Pick<BoqWorkPlanItemDto, 'cumulativeQuantity' | 'cumulativeAmountHt'> & Partial<Pick<BoqWorkPlanItemDto, 'sourceKind'>>, snapshot: BoqWorkConfirmedSnapshot | null, baselineHash: string, editAllowed: boolean): BoqWorkSummary {
  const historical = !editAllowed && snapshot !== null
  const measured = item.sourceKind === 'TEMPLATE_ITEM' ? null : historical ? snapshot!.signedCumulativeQuantity : item.cumulativeQuantity
  const measuredAmount = item.sourceKind === 'TEMPLATE_ITEM' ? null : historical ? snapshot!.signedCumulativeAmountHt : item.cumulativeAmountHt
  const result = { ...emptyBoqWorkSummary(measured), historical }
  if (!snapshot || (!historical && snapshot.baselineHash !== baselineHash)) return result
  const sum = (rows: BoqWorkScope[]) => rows.reduce((n, r) => n.plus(r.quantity!), new WorkDecimal(0)).toFixed()
  const known = snapshot.scopes.filter((r) => r.quantityConfirmed && r.quantity !== null)
  result.completedUnbilledQuantity = sum(known.filter((r) => r.completionState === 'COMPLETED'))
  result.notCompletedUnbilledQuantity = sum(known.filter((r) => r.completionState === 'NOT_COMPLETED'))
  result.unknownCompletionQuantity = sum(known.filter((r) => r.completionState === 'UNKNOWN'))
  if (!snapshot.scopeComplete || known.length !== snapshot.scopes.length) return result
  const approved = known.filter((r) => r.scopeBasis !== 'PENDING_CHANGE'), pending = known.filter((r) => r.scopeBasis === 'PENDING_CHANGE')
  result.approvedRemainingQuantity = sum(approved); result.pendingRemainingQuantity = sum(pending); result.remainingQuantity = sum(known); result.ready = true
  result.forecastFinalQuantity = measured === null ? null : new WorkDecimal(measured).plus(result.approvedRemainingQuantity).toFixed()
  result.forecastIncludingPendingQuantity = measured === null ? null : new WorkDecimal(measured).plus(result.remainingQuantity).toFixed()
  const amount = (rows: BoqWorkScope[], approvedOnly: boolean) => {
    let total = new WorkDecimal(0), missing = false
    for (const row of rows) {
      if (new WorkDecimal(row.quantity!).eq(0)) continue
      const price = workScopePrice(row, snapshot.price)
      if (!price?.confirmed || price.unitPrice === null || price.basis === 'UNKNOWN' || (approvedOnly && price.basis === 'PROVISIONAL')) { result.missingPriceCount++; missing = true; continue }
      total = total.plus(new WorkDecimal(row.quantity!).times(price.unitPrice))
    }
    return missing ? null : total.toFixed()
  }
  result.remainingAmountHt = amount(approved, true); result.pendingAmountHt = amount(pending, false)
  result.forecastFinalAmountHt = result.remainingAmountHt === null || measuredAmount === null ? null : new WorkDecimal(measuredAmount).plus(result.remainingAmountHt).toFixed()
  return result
}
