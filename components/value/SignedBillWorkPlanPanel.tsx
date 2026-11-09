'use client'

import React, { useEffect, useState, type SetStateAction } from 'react'

import type { Locale } from '@/lib/i18n'
import { changedWorkDraftScopes, formatWorkQuantity, sourceActivityRecords, workPlanAllowedActions, workPlanReadinessClass, workScopeReadiness } from '@/lib/value/boqWorkPlanDisplay'
import { defaultBoqWorkPlanPrice, isSignedWorkPrice, signedWorkPrice, workScopePrice } from '@/lib/value/boqWorkPriceDefaults'
import type { SignedCalculationRecord } from '@/lib/value/signedBillCalculations'
import type {
  BoqWorkDraft,
  BoqWorkPlanItemDto,
  BoqWorkPlanPostInput,
  BoqWorkPlanPostResponse,
  BoqWorkPlansResponse,
  BoqWorkPrice,
  BoqWorkScope,
} from '@/lib/value/boqWorkPlans'

const labels = {
  zh: {
    title: '计量与剩余确认', measured: '累计已计量', completed: '已完成待计量', unfinished: '未完成待计量',
    unknown: '未确认', unknownCompletion: '完成状态未确认的待计量量', forecast: '已批准范围预计最终量',
    includingPending: '含待批范围的预计最终量', pending: '其中待批变更量', remainingAmount: '已批准范围剩余估值 HT',
    pendingAmount: '待批范围情景估值 HT', forecastAmount: '已批准范围预计最终金额 HT', priceMissing: '项单价尚未确认',
    noPlan: '剩余未确认', draft: '有草稿', confirmed: '已确认',
    confirmedNone: '无剩余', needsReview: '需重新核对', lastConfirmed: '草稿未计入，显示上次确认结果。',
    scopeIncomplete: '范围未核全，预计最终量未确认。',
    readOnly: '历史版本，只读。', noPermission: '只读',
    edit: '编辑', close: '收起', add: '添加明细', remove: '删除', scope: '明细',
    description: '工作内容', road: '道路', noRoad: '未指定', locationFields: '道路 / 部位（选填）',
    side: '侧别', startPk: 'PK 起点', endPk: 'PK 终点', spec: '部位 / 规格', unit: '单位',
    completion: '现场完成状态', completionUnknown: '未确认完成状态', completionDone: '已完成', completionNotDone: '未完成',
    basis: '范围依据', original: '原合同范围', approved: '已批准变更', pendingChange: '待批 / 有争议变更',
    quantity: '待计量数量', quantityConfirmed: '数量已核实', quantityEvidence: '数量依据',
    approvalEvidence: '批准依据（已批准变更必填）', scopePrice: '此范围单独单价', usePlanPrice: '留空时使用本价号待计量单价',
    price: '单价 HT', sourcePrice: '签字单价 HT', useSourcePrice: '恢复签字价',
    priceConfirmed: '已核实此单价', priceBasis: '单价依据', provisional: '暂定 / 待批', priceUnknown: '单价依据未确认',
    priceEvidence: '单价依据', inheritedPrice: '沿用签字价', specialPrice: '改价', originalPriceOnly: '变更范围需单独定价。',
    scopeComplete: '已核对全部剩余',
    reason: '备注（选填）', save: '暂存', confirm: '保存', confirmNone: '无剩余',
    noneHelp: '确认本价号已无剩余待计量？',
    noneSubmit: '确认无剩余', cancel: '取消', saving: '保存中…', saved: '已暂存',
    confirmationSaved: '已保存', saveError: '保存失败，请重试', conflict: '记录已更新，请刷新核对。当前填写已保留。',
    discardDraft: '重新读取并放弃本地填写', rebaseDraft: '保留填写并核对最新版本',
    conflictHelp: '保存已暂停。保留填写会读取最新版本和账单基线，不自动合并他人更改；保存前请重新核对。',
    refreshError: '无法读取可核对的最新版本，当前填写仍已保留。', invalidRoad: '范围道路已不存在或不属于本项目，请重新核对。',
    invalidDecimal: '数量和单价须为非负十进制数，使用点号且不含千分位。',
    requiredScope: '请添加明细，或选择“无剩余”。',
    requiredQuantity: '确认前请填写各范围数量并勾选已核实数量。', requiredPrice: '请填写要确认的单价。',
    requiredPriceEvidence: '确认单价前请选择依据并填写说明。', requiredUnit: '确认数量前请填写单位，并与本价号单位一致。',
    requiredDescription: '确认前请逐行填写工作范围说明。', requiredApproval: '已批准变更需填写批准依据。',
    confirmedScopes: '已确认的待计量范围', note: '依据 / 备注', location: '道路 / 部位 / PK', stagePrice: '完成状态 / 单价',
    stale: '账单已更新，请重新核对剩余。',
    staleScopes: '上次确认（待核对）',
    historical: '历史快照，非最新预计。',
    templateItem: '未关联签字行，已计量及最终量待核。',
    savedAt: '上次确认', by: '用户', noDraft: '暂无明细', scopeCount: '条待计量范围',
    pendingSummary: '待计量总量', draftScopes: '草稿待核', draftHelp: '以下新增或变化明细未计入已确认合计。',
    quantityPending: '数量待核', unitPending: '单位待核', pricePending: '单价待核', pendingScope: '待计量',
    activityTitle: '未定价待核事项', activityHelp: '原表无价号、单价待核；仅可暂存，不计入正式量价。',
    sourceQuantity: '原表计算量', sourceBilling: '原计量量', sourcePrevious: '以前', sourceCurrent: '本期', sourceCumulative: '累计',
    activityLoading: '关联原表明细尚未读取。',
  },
  fr: {
    title: 'Mesures et restant à confirmer', measured: 'Cumul mesuré', completed: 'Achevé restant à mesurer', unfinished: 'Non achevé restant à mesurer',
    unknown: 'Non confirmé', unknownCompletion: 'Restant dont l’achèvement est inconnu', forecast: 'Quantité finale prévue, périmètre approuvé',
    includingPending: 'Quantité finale prévue, avec changements en attente', pending: 'Dont changements en attente', remainingAmount: 'Estimation du restant approuvé HT',
    pendingAmount: 'Scénario des changements en attente HT', forecastAmount: 'Montant final prévu, périmètre approuvé HT', priceMissing: 'prix non confirmés',
    noPlan: 'Restant non confirmé', draft: 'Brouillon', confirmed: 'Confirmé',
    confirmedNone: 'Aucun restant', needsReview: 'À rapprocher', lastConfirmed: 'Dernière confirmation affichée ; brouillon exclu.',
    scopeIncomplete: 'Périmètre incomplet ; quantité finale non confirmée.',
    readOnly: 'Version historique, lecture seule.', noPermission: 'Lecture seule',
    edit: 'Modifier', close: 'Réduire', add: 'Ajouter un détail', remove: 'Supprimer', scope: 'Détail',
    description: 'Désignation', road: 'Voie', noRoad: 'Non choisie', locationFields: 'Voie / ouvrage (facultatif)',
    side: 'Côté', startPk: 'PK début', endPk: 'PK fin', spec: 'Ouvrage / spécification', unit: 'Unité',
    completion: 'État d’achèvement', completionUnknown: 'Achèvement non confirmé', completionDone: 'Achevé', completionNotDone: 'Non achevé',
    basis: 'Justification du périmètre', original: 'Marché initial', approved: 'Modification approuvée', pendingChange: 'Modification en attente / contestée',
    quantity: 'Quantité restante', quantityConfirmed: 'Quantité vérifiée', quantityEvidence: 'Calcul / justification',
    approvalEvidence: 'Preuve d’approbation (requise pour une modification approuvée)', scopePrice: 'Prix propre à ce périmètre', usePlanPrice: 'Sans prix propre, le prix du restant de cette ligne est utilisé',
    price: 'P.U. HT', sourcePrice: 'P.U. signé HT', useSourcePrice: 'Rétablir le P.U. signé',
    priceConfirmed: 'Prix vérifié', priceBasis: 'Justification du prix', provisional: 'Provisoire / en attente', priceUnknown: 'Justification non confirmée',
    priceEvidence: 'Justification du prix', inheritedPrice: 'P.U. signé repris', specialPrice: 'Modifier le prix', originalPriceOnly: 'Les modifications nécessitent leur propre prix.',
    scopeComplete: 'Tout le restant a été vérifié',
    reason: 'Observation (facultative)', save: 'Brouillon', confirm: 'Enregistrer', confirmNone: 'Aucun restant',
    noneHelp: 'Confirmer qu’il ne reste plus rien à mesurer pour ce prix ?',
    noneSubmit: 'Confirmer aucun restant', cancel: 'Annuler', saving: 'Enregistrement…', saved: 'Brouillon enregistré',
    confirmationSaved: 'Enregistré', saveError: 'Échec de l’enregistrement', conflict: 'Données modifiées : rechargez pour vérifier. Votre saisie est conservée.',
    discardDraft: 'Recharger et abandonner ma saisie', rebaseDraft: 'Garder ma saisie et vérifier la dernière version',
    conflictHelp: 'Enregistrement suspendu. La conservation recharge la version et la base actuelles, sans fusion automatique ; vérifiez avant de réenregistrer.',
    refreshError: 'Impossible de vérifier la dernière version ; votre saisie reste conservée.', invalidRoad: 'Voie absente ou hors projet ; vérifiez le périmètre.',
    invalidDecimal: 'Quantités et prix : décimaux positifs ou nuls, point décimal, sans séparateur de milliers.',
    requiredScope: 'Ajoutez un périmètre restant ou confirmez explicitement son absence.',
    requiredQuantity: 'Renseignez et vérifiez les quantités de chaque périmètre avant de confirmer.', requiredPrice: 'Renseignez le prix à confirmer.',
    requiredPriceEvidence: 'Choisissez et justifiez la base du prix avant de le confirmer.', requiredUnit: 'Renseignez une unité identique à celle de ce prix avant de confirmer.',
    requiredDescription: 'Décrivez chaque périmètre avant de confirmer.', requiredApproval: 'Indiquez la preuve d’approbation de la modification.',
    confirmedScopes: 'Périmètres restants confirmés', note: 'Justification / observation', location: 'Voie / ouvrage / PK', stagePrice: 'Achèvement / prix',
    stale: 'Décompte modifié : vérifiez de nouveau le restant.',
    staleScopes: 'Dernière confirmation (à vérifier)',
    historical: 'Instantané historique, non la prévision actuelle.',
    templateItem: 'Ligne signée non associée ; cumul mesuré et quantité finale à vérifier.',
    savedAt: 'Dernière confirmation', by: 'Utilisateur', noDraft: 'Aucun détail', scopeCount: 'périmètres restants',
    pendingSummary: 'Quantité totale restant à mesurer', draftScopes: 'Brouillon à vérifier', draftHelp: 'Ces détails ajoutés ou modifiés sont exclus des totaux confirmés.',
    quantityPending: 'Quantité à vérifier', unitPending: 'Unité à vérifier', pricePending: 'Prix à vérifier', pendingScope: 'Restant à mesurer',
    activityTitle: 'Travaux sans prix à vérifier', activityHelp: 'Sans prix associé dans la source ; brouillon uniquement, exclu des quantités et montants signés.',
    sourceQuantity: 'Quantité calculée source', sourceBilling: 'Mesures source', sourcePrevious: 'Précédent', sourceCurrent: 'Présent', sourceCumulative: 'Cumulé',
    activityLoading: 'Les détails source associés ne sont pas encore chargés.',
  },
}

const inputClass = 'mt-1 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100'
const buttonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
const emptyPrice = (): BoqWorkPrice => ({ unitPrice: null, confirmed: false, basis: 'UNKNOWN', evidence: '' })
const optionalText = (value: string | null) => value?.trim() || null

export function emptyWorkScope(unit: string | null, id: string): BoqWorkScope {
  return { id, description: '', roadId: null, startPk: null, endPk: null, side: null, spec: null, unit,
    completionState: 'UNKNOWN', scopeBasis: 'ORIGINAL', quantity: null, quantityConfirmed: false,
    quantityEvidence: '', approvalEvidence: '', price: null }
}

export function initialWorkPlanDraft(item: BoqWorkPlanItemDto, revisionId: number, baselineHash: string): BoqWorkDraft {
  const draft = item.plan?.draft ?? { scopeComplete: false, scopes: [], price: null, baselineHash }
  return { ...draft, price: defaultBoqWorkPlanPrice(item, revisionId, draft.scopes, draft.price) }
}

export function workPlanPostInput(item: BoqWorkPlanItemDto, draft: BoqWorkDraft, action: BoqWorkPlanPostInput['action'], reason: string, baselineHash: string): BoqWorkPlanPostInput {
  const price = (value: BoqWorkPrice | null): BoqWorkPrice | null => value ? { ...value, unitPrice: optionalText(value.unitPrice), evidence: value.evidence.trim() } : null
  return {
    lineKey: item.lineKey, expectedVersion: item.plan?.version ?? null, action,
    scopeComplete: action === 'confirm-none' ? true : draft.scopeComplete,
    scopes: action === 'confirm-none' ? [] : draft.scopes.map((scope) => ({ ...scope,
      description: scope.description.trim(), startPk: optionalText(scope.startPk), endPk: optionalText(scope.endPk),
      side: optionalText(scope.side), spec: optionalText(scope.spec), unit: optionalText(scope.unit), quantity: optionalText(scope.quantity),
      quantityEvidence: scope.quantityEvidence.trim(), approvalEvidence: scope.approvalEvidence.trim(), price: price(scope.price),
    })),
    price: price(draft.price), reason: reason.trim(), baselineHash,
  }
}

export function workPlanInputError(input: BoqWorkPlanPostInput, locale: Locale) {
  const t = labels[locale]
  const valid = (value: string | null) => value === null || /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/.test(value)
  const prices = [input.price ?? null, ...input.scopes.map((scope) => scope.price)]
  if (input.scopes.some((scope) => !valid(scope.quantity)) || prices.some((price) => price && !valid(price.unitPrice))) return t.invalidDecimal
  if (prices.some((price) => price?.confirmed && price.unitPrice === null)) return t.requiredPrice
  if (prices.some((price) => price?.confirmed && (price.basis === 'UNKNOWN' || !price.evidence))) return t.requiredPriceEvidence
  if (input.action === 'confirm' && !input.scopes.length) return t.requiredScope
  if (input.action === 'confirm' && input.scopes.some((scope) => scope.quantity === null || !scope.quantityConfirmed)) return t.requiredQuantity
  if (input.action === 'confirm' && input.scopes.some((scope) => !scope.description)) return t.requiredDescription
  if (input.action === 'confirm' && input.scopes.some((scope) => scope.scopeBasis === 'APPROVED_CHANGE' && !scope.approvalEvidence)) return t.requiredApproval
  return null
}

type SummaryProps = {
  item: BoqWorkPlanItemDto
  locale: Locale
  formatValue: (value: string | null | undefined) => string
}

export function WorkPlanQuantitySummary({ item, locale, formatValue }: SummaryProps) {
  const t = labels[locale]
  const value = (quantity: string | null) => quantity === null ? t.unknown : `${formatWorkQuantity(quantity, t.unknown)}${item.unit ? ` ${item.unit}` : ''}`
  const summary = item.state === 'NEEDS_REVIEW' ? { ...item.summary,
    completedUnbilledQuantity: null, notCompletedUnbilledQuantity: null, unknownCompletionQuantity: null,
    remainingQuantity: null, forecastFinalQuantity: null, forecastIncludingPendingQuantity: null,
    pendingRemainingQuantity: null, remainingAmountHt: null, forecastFinalAmountHt: null, pendingAmountHt: null,
  } : item.summary
  const cards = [[t.measured, summary.signedCumulativeQuantity], [t.completed, summary.completedUnbilledQuantity], [t.unfinished, summary.notCompletedUnbilledQuantity]] as const
  return <div className="space-y-3 text-center">
    {item.summary.historical ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{t.historical}</p> : null}
    <div className="grid gap-2 sm:grid-cols-3">{cards.map(([label, quantity], index) => <div key={label} className={`rounded-xl border p-3 ${index === 0 ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-200 bg-white'}`}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-lg font-semibold tabular-nums text-slate-900">{value(quantity)}</p></div>)}</div>
    <dl className="grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg bg-white p-2"><dt className="text-slate-500">{t.forecast}</dt><dd className="mt-1 break-words font-semibold tabular-nums text-slate-800">{value(summary.forecastFinalQuantity)}</dd></div><div className="rounded-lg bg-white p-2"><dt className="text-slate-500">{t.pendingSummary}</dt><dd className="mt-1 break-words font-semibold tabular-nums text-slate-800">{value(summary.remainingQuantity)}</dd></div></dl>
    {summary.unknownCompletionQuantity !== null && !/^0(?:\.0+)?$/.test(summary.unknownCompletionQuantity) ? <p className="text-xs text-amber-800">{t.unknownCompletion}：{value(summary.unknownCompletionQuantity)}</p> : null}
    {summary.pendingRemainingQuantity !== null && !/^0(?:\.0+)?$/.test(summary.pendingRemainingQuantity) ? <p className="text-xs text-amber-800">{t.pending}：{value(summary.pendingRemainingQuantity)} · {t.includingPending}：{value(summary.forecastIncludingPendingQuantity)}</p> : null}
    <dl className="grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-slate-500">{t.remainingAmount}</dt><dd className="mt-1 tabular-nums text-slate-700">{summary.remainingAmountHt === null ? t.unknown : formatValue(summary.remainingAmountHt)}</dd></div><div><dt className="text-slate-500">{t.forecastAmount}</dt><dd className="mt-1 tabular-nums text-slate-700">{summary.forecastFinalAmountHt === null ? t.unknown : formatValue(summary.forecastFinalAmountHt)}</dd></div></dl>
    {summary.pendingAmountHt !== null ? <p className="text-xs text-amber-800">{t.pendingAmount}：{formatValue(summary.pendingAmountHt)}</p> : null}
    {summary.missingPriceCount > 0 ? <p className="text-xs text-amber-800">{summary.missingPriceCount} {t.priceMissing}</p> : null}
  </div>
}

type ScopeListProps = SummaryProps & { roads: BoqWorkPlansResponse['roads'] }

function WorkPlanScopeList({ item, roads, locale, formatValue, scopes, price: planPrice, isDraft = false }: ScopeListProps & { scopes: BoqWorkScope[]; price: BoqWorkPrice | null; isDraft?: boolean }) {
  const t = labels[locale]
  const completionLabel = (scope: BoqWorkScope) => scope.completionState === 'COMPLETED' ? t.completionDone : scope.completionState === 'NOT_COMPLETED' ? t.completionNotDone : t.completionUnknown
  const basisLabel = (scope: BoqWorkScope) => scope.scopeBasis === 'PENDING_CHANGE' ? t.pendingChange : scope.scopeBasis === 'APPROVED_CHANGE' ? t.approved : t.original
  const missingLabels = { quantity: t.quantityPending, unit: t.unitPending, price: t.pricePending }
  return <details className="rounded-xl border border-slate-200 bg-white p-3" open>
    <summary className="cursor-pointer text-xs font-semibold text-slate-700">{isDraft ? t.draftScopes : item.state === 'NEEDS_REVIEW' ? t.staleScopes : t.confirmedScopes} ({scopes.length})</summary>
    {isDraft ? <p className="mt-2 text-xs text-slate-500">{t.draftHelp}</p> : null}
    <div className="mt-3 space-y-2">{scopes.map((scope) => {
      const price = workScopePrice(scope, planPrice)
      const baseReadiness = workScopeReadiness(scope, item.unit, planPrice)
      const readiness = item.sourceKind === 'SOURCE_ACTIVITY' ? { state: 'missing' as const, missing: baseReadiness.missing.includes('price') ? baseReadiness.missing : [...baseReadiness.missing, 'price' as const] } : baseReadiness
      const road = roads.find((candidate) => candidate.id === scope.roadId)
      return <div className="sbwp-confirmed-scope" data-work-state={readiness.state} data-scope-version={isDraft ? 'draft' : 'confirmed'} key={scope.id}>
        <div><p className="text-[11px] text-slate-500">{t.location}</p><p className="mt-1 whitespace-pre-wrap break-words font-semibold text-slate-700">{scope.description || t.unknown}</p><p className="mt-1 break-words text-slate-500">{[road?.name, scope.side, scope.spec].filter(Boolean).join(' · ')}</p>{scope.startPk !== null || scope.endPk !== null ? <p className="mt-1 break-words text-slate-500">PK {scope.startPk ?? '—'} → {scope.endPk ?? '—'}</p> : null}</div>
        <div><p className="text-[11px] text-slate-500">{t.quantity}</p><p className="mt-1 break-words font-semibold tabular-nums text-slate-800">{scope.quantity !== null ? `${formatWorkQuantity(scope.quantity, t.unknown)} ${scope.unit ?? ''}` : t.unknown}</p>{readiness.state !== 'none' ? <p className={`mt-2 rounded-lg border px-2 py-1 text-[11px] font-semibold ${workPlanReadinessClass(readiness.state)}`}>{readiness.missing.length ? readiness.missing.map((field) => missingLabels[field]).join(' · ') : t.pendingScope}</p> : null}</div>
        <div><p className="text-[11px] text-slate-500">{t.stagePrice}</p><p className="mt-1 text-slate-700">{completionLabel(scope)}</p><p className="mt-1 text-slate-500">{basisLabel(scope)}</p><p className="mt-1 break-words tabular-nums text-slate-700">HT {price?.unitPrice !== null && price?.unitPrice !== undefined ? formatValue(price.unitPrice) : t.unknown}</p>{price ? <p className="mt-1 text-slate-500">{t.priceBasis}：{price.basis === 'ORIGINAL' ? t.original : price.basis === 'APPROVED_CHANGE' ? t.approved : price.basis === 'PROVISIONAL' ? t.provisional : t.priceUnknown}</p> : null}</div>
        <div className="sbwp-confirmed-note"><p className="text-[11px] text-slate-500">{t.note}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{[scope.quantityEvidence, scope.approvalEvidence, price?.evidence].filter(Boolean).join('\n') || '—'}</p></div>
      </div>
    })}</div>
    <style>{`
      .sbwp-confirmed-scope { display: grid; gap: .75rem; border: 1px solid #e2e8f0; border-radius: .6rem; padding: .75rem; font-size: .75rem; text-align: center; }
      .sbwp-confirmed-scope[data-work-state="missing"] { border-color: #fda4af; background: #fff1f2; }
      .sbwp-confirmed-scope[data-work-state="remaining"] { border-color: #fcd34d; background: #fffbeb; }
      .sbwp-confirmed-scope > div { min-width: 0; }
      .sbwp-confirmed-note { border-top: 1px solid #e2e8f0; padding-top: .75rem; }
      @container signed-calculation (min-width: 1000px) {
        .sbwp-confirmed-scope { grid-template-columns: minmax(9rem,1.5fr) minmax(7rem,1fr) minmax(9rem,1.1fr) minmax(11rem,1.5fr); }
        .sbwp-confirmed-note { border: 0; padding: 0; }
      }
    `}</style>
  </details>
}

export function WorkPlanConfirmedScopes(props: ScopeListProps) {
  const snapshot = props.item.plan?.confirmedSnapshot
  return snapshot?.scopes.length ? <WorkPlanScopeList {...props} scopes={snapshot.scopes} price={snapshot.price} /> : null
}

export function WorkPlanDraftScopes(props: ScopeListProps) {
  const scopes = changedWorkDraftScopes(props.item)
  return scopes.length ? <WorkPlanScopeList {...props} scopes={scopes} price={props.item.plan!.draft.price} isDraft /> : null
}

export function WorkPlanSourceActivityRecords({ item, records, locale }: { item: BoqWorkPlanItemDto; records: SignedCalculationRecord[]; locale: Locale }) {
  const t = labels[locale]
  const linked = sourceActivityRecords(item, records)
  return linked.length ? <div className="space-y-2">{linked.map((record) => <div key={record.recordId} className="sbwp-source-activity-record rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-xs" data-source-record-id={record.recordId}>
    <div><p className="text-[11px] text-slate-500">{t.location}</p><p className="mt-1 break-words font-semibold text-slate-800">{[record.road, record.side].filter(Boolean).join(' · ') || t.unknown}</p><p className="mt-1 break-words text-slate-600">PK {record.pkStart ?? '—'} → {record.pkEnd ?? '—'}</p></div>
    <div><p className="text-[11px] text-slate-500">{t.sourceQuantity}</p><p className="mt-1 break-words font-semibold tabular-nums text-slate-800">{formatWorkQuantity(record.calculatedQuantity, t.unknown)} {record.unit ?? ''}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{[record.structure, record.description].filter(Boolean).join(' · ')}</p></div>
    <div><p className="text-[11px] text-slate-500">{t.sourceBilling}</p>{([[t.sourcePrevious, record.previousQuantity], [t.sourceCurrent, record.currentQuantity], [t.sourceCumulative, record.cumulativeQuantity]] as const).map(([label, quantity]) => <p key={label} className="mt-1 tabular-nums text-slate-600">{label}：{formatWorkQuantity(quantity)} {quantity === null ? '' : record.unit ?? ''}</p>)}</div>
    <div className="border-t border-rose-200 pt-2"><p className="text-[11px] text-slate-500">{t.note}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{[record.note, record.sourceNote, record.billingNote].filter(Boolean).join('\n') || '—'}</p></div>
  </div>)}<style>{`
    .sbwp-source-activity-record { display: grid; gap: .75rem; }
    .sbwp-source-activity-record > div { min-width: 0; }
    @container signed-calculation (min-width: 1000px) {
      .sbwp-source-activity-record { grid-template-columns: minmax(9rem,1.5fr) minmax(7rem,1fr) minmax(9rem,1.1fr) minmax(11rem,1.5fr); }
      .sbwp-source-activity-record > div:last-child { border: 0; padding: 0; }
    }
  `}</style></div> : <p className="text-xs text-rose-800">{t.activityLoading}</p>
}

type Props = SummaryProps & {
  revisionId: number
  baselineHash: string
  roads: BoqWorkPlansResponse['roads']
  editAllowed: boolean
  readOnlyReason: string | null
  permissionReadOnly?: boolean
  sourceRecords?: SignedCalculationRecord[]
  onSaved: (response: BoqWorkPlanPostResponse) => void
}

const editorState = (item: BoqWorkPlanItemDto, revisionId: number, baselineHash: string) => ({
  item, revisionId, baselineHash, draft: initialWorkPlanDraft(item, revisionId, baselineHash), reason: '', conflict: false,
})
type EditorState = ReturnType<typeof editorState>
const sameEditorLine = (editor: EditorState, item: BoqWorkPlanItemDto, revisionId: number) => editor.revisionId === revisionId && editor.item.lineKey === item.lineKey && editor.item.sourceKind === item.sourceKind
const editorServerKey = (item: BoqWorkPlanItemDto, revisionId: number, baselineHash: string) => JSON.stringify([item.plan?.version ?? null, item.state, baselineHash, initialWorkPlanDraft(item, revisionId, baselineHash)])
const editorIsCurrent = (editor: EditorState, item: BoqWorkPlanItemDto, revisionId: number, baselineHash: string) => sameEditorLine(editor, item, revisionId) && editorServerKey(editor.item, editor.revisionId, editor.baselineHash) === editorServerKey(item, revisionId, baselineHash)

export function SignedBillWorkPlanPanel({ item, revisionId, baselineHash, roads, editAllowed, readOnlyReason, permissionReadOnly = false, sourceRecords = [], locale, formatValue, onSaved }: Props) {
  const t = labels[locale]
  const sourceActivity = item.sourceKind === 'SOURCE_ACTIVITY'
  const allowedActions = workPlanAllowedActions(item)
  const [editor, setEditor] = useState(() => editorState(item, revisionId, baselineHash))
  const { draft, reason } = editor
  const conflicted = editor.conflict || !editorIsCurrent(editor, item, revisionId, baselineHash)
  const setDraft = (update: SetStateAction<BoqWorkDraft>) => setEditor((previous) => ({ ...previous, draft: typeof update === 'function' ? update(previous.draft) : update }))
  const setReason = (value: string) => setEditor((previous) => ({ ...previous, reason: value }))
  const [editing, setEditing] = useState(false)
  const [noneConfirmation, setNoneConfirmation] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null)

  useEffect(() => {
    setEditor((previous) => {
      if (sameEditorLine(previous, item, revisionId)) {
        const dirty = previous.reason !== '' || JSON.stringify(previous.draft) !== JSON.stringify(initialWorkPlanDraft(previous.item, previous.revisionId, previous.baselineHash))
        if (dirty || previous.conflict) return editorIsCurrent(previous, item, revisionId, baselineHash) ? previous : { ...previous, conflict: true }
      }
      return editorState(item, revisionId, baselineHash)
    })
    setNoneConfirmation(false)
  }, [item, revisionId, baselineHash])

  const updateScope = (id: string, patch: Partial<BoqWorkScope>) => setDraft((previous) => ({ ...previous, scopes: previous.scopes.map((scope) => scope.id === id ? { ...scope, ...patch } : scope) }))
  const updatePrice = (id: string | null, patch: Partial<BoqWorkPrice>) => {
    if (id === null) setDraft((previous) => ({ ...previous, price: defaultBoqWorkPlanPrice(item, revisionId, previous.scopes, { ...(previous.price ?? emptyPrice()), ...patch }) }))
    else setDraft((previous) => ({ ...previous, scopes: previous.scopes.map((scope) => scope.id === id ? { ...scope, price: { ...(scope.price ?? emptyPrice()), ...patch } } : scope) }))
  }
  const save = async (action: BoqWorkPlanPostInput['action']) => {
    if (saving || conflicted || !editAllowed || !allowedActions.includes(action)) return
    const input = workPlanPostInput(editor.item, draft, action, reason, editor.baselineHash)
    const invalid = workPlanInputError(input, locale)
    if (invalid) { setMessage({ text: invalid, failed: true }); return }
    if (action === 'confirm' && (!item.unit || input.scopes.some((scope) => !scope.unit))) { setMessage({ text: t.requiredUnit, failed: true }); return }
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/value/signed-bills/${revisionId}/work-plans`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) })
      const payload = await response.json() as BoqWorkPlanPostResponse & { message?: string }
      if (!response.ok) {
        if (response.status === 409) setEditor((previous) => ({ ...previous, conflict: true }))
        throw new Error(response.status === 409 ? t.conflict : payload.message ?? t.saveError)
      }
      if (payload.item?.lineKey !== item.lineKey || typeof payload.baselineHash !== 'string') throw new Error(t.saveError)
      setEditor((previous) => sameEditorLine(previous, item, revisionId) ? editorState(payload.item, revisionId, payload.baselineHash) : previous)
      onSaved(payload)
      setNoneConfirmation(false)
      setMessage({ text: action === 'save-draft' ? t.saved : t.confirmationSaved, failed: false })
    } catch (cause) { setMessage({ text: cause instanceof Error ? cause.message : t.saveError, failed: true }) }
    finally { setSaving(false) }
  }

  const resolveConflict = async (keepDraft: boolean) => {
    if (saving) return
    setSaving(true)
    setMessage(null)
    try {
      const response = await fetch(`/api/value/signed-bills/${revisionId}/work-plans`, { credentials: 'include', cache: 'no-store' })
      const payload = await response.json() as BoqWorkPlansResponse
      const latest = payload.items?.find((candidate) => candidate.lineKey === item.lineKey && candidate.sourceKind === item.sourceKind)
      if (!response.ok || payload.revisionId !== revisionId || !/^[a-f0-9]{64}$/.test(payload.baselineHash) || !latest || (latest.plan !== null && (!Number.isSafeInteger(latest.plan.version) || latest.plan.version <= 0)) || (keepDraft && !payload.editAllowed)) throw new Error(t.refreshError)
      if (keepDraft) {
        const invalid = workPlanInputError(workPlanPostInput(latest, draft, 'save-draft', reason, payload.baselineHash), locale)
        if (invalid) throw new Error(invalid)
        if (!Array.isArray(payload.roads) || draft.scopes.some((scope) => scope.roadId !== null && !payload.roads.some((road) => road.id === scope.roadId))) throw new Error(t.invalidRoad)
      }
      // Only this explicit action adopts new concurrency tokens for a dirty draft.
      setEditor((previous) => sameEditorLine(previous, item, revisionId) ? {
        ...editorState(latest, revisionId, payload.baselineHash),
        ...(keepDraft ? { draft: { ...previous.draft, baselineHash: payload.baselineHash }, reason: previous.reason } : {}),
      } : previous)
      setNoneConfirmation(false)
      onSaved({ item: latest, baselineHash: payload.baselineHash })
    } catch (cause) { setMessage({ text: cause instanceof Error ? cause.message : t.refreshError, failed: true }) }
    finally { setSaving(false) }
  }

  const priceEditor = (price: BoqWorkPrice | null, id: string | null) => <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">{t.price}<input className={inputClass} inputMode="decimal" value={price?.unitPrice ?? ''} placeholder={t.unknown} onChange={(event) => updatePrice(id, { unitPrice: event.target.value || null, confirmed: false })} /></label><label className="text-xs font-semibold text-slate-600">{t.priceBasis}<select className={inputClass} value={price?.basis ?? 'UNKNOWN'} onChange={(event) => updatePrice(id, { basis: event.target.value as BoqWorkPrice['basis'], confirmed: false })}><option value="UNKNOWN">{t.priceUnknown}</option><option value="ORIGINAL">{t.original}</option><option value="APPROVED_CHANGE">{t.approved}</option><option value="PROVISIONAL">{t.provisional}</option></select></label></div>
    <label className="block text-xs font-semibold text-slate-600">{t.priceEvidence}<textarea className={inputClass} rows={2} value={price?.evidence ?? ''} onChange={(event) => updatePrice(id, { evidence: event.target.value, confirmed: false })} /></label>
    {sourceActivity ? <p className="text-xs font-semibold text-rose-800">{t.pricePending}</p> : id === null && isSignedWorkPrice(item, price) ? <p className="text-xs font-semibold text-emerald-800">{t.inheritedPrice}</p> : <label className="flex items-start justify-center gap-2 text-xs text-slate-700"><input className="mt-0.5" type="checkbox" checked={price?.confirmed ?? false} onChange={(event) => updatePrice(id, { confirmed: event.target.checked })} /><span>{t.priceConfirmed}</span></label>}
  </div>

  const stateLabel = item.state === 'CONFIRMED_NONE' ? t.confirmedNone : item.state === 'CONFIRMED' ? t.confirmed : item.state === 'NEEDS_REVIEW' ? t.needsReview : item.state === 'DRAFT' ? t.draft : t.unknown
  const displayPrice = draft.price?.basis === 'ORIGINAL' && draft.scopes.length > 0 && !draft.scopes.some((scope) => scope.scopeBasis === 'ORIGINAL') ? null : draft.price
  return <section className={`mb-4 space-y-3 rounded-xl border p-3 text-center sm:p-4 ${sourceActivity ? 'border-rose-200 bg-rose-50/40' : 'border-blue-200 bg-blue-50/40'}`} aria-label={sourceActivity ? t.activityTitle : t.title} data-source-kind={item.sourceKind}>
    <div className="flex flex-wrap items-center justify-center gap-2"><h4 className="break-words text-sm font-semibold text-slate-900">{sourceActivity ? item.designation : t.title}</h4><span className={`rounded-full border px-2 py-0.5 text-xs ${sourceActivity ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-600'}`}>{sourceActivity ? t.activityTitle : stateLabel}</span></div>
    {sourceActivity ? <><p className="text-xs text-rose-800">{t.activityHelp}</p><WorkPlanSourceActivityRecords item={item} records={sourceRecords} locale={locale} /></> : null}
    {item.sourceKind === 'TEMPLATE_ITEM' ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{t.templateItem}</p> : null}
    {item.state === 'NEEDS_REVIEW' ? <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">{t.stale}</p> : null}
    {!sourceActivity ? <><WorkPlanQuantitySummary item={item} locale={locale} formatValue={formatValue} /><WorkPlanConfirmedScopes item={item} roads={roads} locale={locale} formatValue={formatValue} /></> : null}
    <WorkPlanDraftScopes item={item} roads={roads} locale={locale} formatValue={formatValue} />
    {!item.plan?.confirmedSnapshot ? <p className="text-xs text-slate-500">{t.noPlan}</p> : <><p className="text-xs text-slate-500">{t.savedAt}：{item.plan.confirmedSnapshot.confirmedAt.slice(0, 19).replace('T', ' ')} UTC · {t.by} {item.plan.confirmedSnapshot.confirmedById}</p>{item.state === 'DRAFT' ? <p className="text-xs text-amber-800">{t.lastConfirmed}</p> : null}{!item.plan.confirmedSnapshot.scopeComplete ? <p className="text-xs text-amber-800">{t.scopeIncomplete}</p> : null}</>}
    {!editAllowed ? <p className="rounded-lg bg-slate-100 p-2 text-xs text-slate-600">{permissionReadOnly ? t.noPermission : locale === 'zh' && readOnlyReason ? readOnlyReason : t.readOnly}</p> : <button type="button" className={buttonClass} onClick={() => setEditing((previous) => !previous)}>{editing ? t.close : t.edit}</button>}
    {conflicted ? <div role="alert" data-work-plan-conflict className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900"><p>{t.conflict}</p><p>{t.conflictHelp}</p><div className="flex flex-wrap justify-center gap-2"><button type="button" className={buttonClass} disabled={saving} onClick={() => void resolveConflict(false)}>{t.discardDraft}</button><button type="button" className={buttonClass} disabled={saving || !editAllowed} onClick={() => void resolveConflict(true)}>{t.rebaseDraft}</button></div></div> : null}
    {editing && editAllowed ? <form className="space-y-4 border-t border-blue-200 pt-4" onSubmit={(event) => { event.preventDefault(); void save(sourceActivity ? 'save-draft' : 'confirm') }}>
      <fieldset className="space-y-4" disabled={saving}>
        <legend className="sr-only">{t.title}</legend>
        {draft.scopes.length === 0 ? <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">{t.noDraft}</p> : <div className="space-y-3">{draft.scopes.map((scope, index) => <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3" key={scope.id}>
          <div className="flex flex-wrap items-center justify-between gap-2"><h5 className="text-xs font-semibold text-slate-700">{t.scope} {index + 1}</h5><button type="button" className="text-xs text-rose-700 underline" onClick={() => setDraft((previous) => ({ ...previous, scopes: previous.scopes.filter((row) => row.id !== scope.id) }))}>{t.remove}</button></div>
          <label className="block text-xs font-semibold text-slate-600">{t.description}<textarea className={inputClass} rows={2} value={scope.description} onChange={(event) => updateScope(scope.id, { description: event.target.value, quantityConfirmed: false })} /></label>
          <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.locationFields}</summary><div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">{t.road}<select className={inputClass} value={scope.roadId ?? ''} onChange={(event) => updateScope(scope.id, { roadId: event.target.value ? Number(event.target.value) : null, quantityConfirmed: false })}><option value="">{t.noRoad}</option>{roads.map((road) => <option key={road.id} value={road.id}>{road.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600">{t.side}<input className={inputClass} value={scope.side ?? ''} onChange={(event) => updateScope(scope.id, { side: event.target.value || null, quantityConfirmed: false })} /></label></div>
            <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-slate-600">{t.startPk}<input className={inputClass} value={scope.startPk ?? ''} onChange={(event) => updateScope(scope.id, { startPk: event.target.value || null, quantityConfirmed: false })} /></label><label className="text-xs font-semibold text-slate-600">{t.endPk}<input className={inputClass} value={scope.endPk ?? ''} onChange={(event) => updateScope(scope.id, { endPk: event.target.value || null, quantityConfirmed: false })} /></label><label className="text-xs font-semibold text-slate-600">{t.spec}<input className={inputClass} value={scope.spec ?? ''} onChange={(event) => updateScope(scope.id, { spec: event.target.value || null, quantityConfirmed: false })} /></label></div>
          </div></details>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">{t.completion}<select className={inputClass} value={scope.completionState} onChange={(event) => updateScope(scope.id, { completionState: event.target.value as BoqWorkScope['completionState'], quantityConfirmed: false })}><option value="UNKNOWN">{t.completionUnknown}</option><option value="COMPLETED">{t.completionDone}</option><option value="NOT_COMPLETED">{t.completionNotDone}</option></select></label><label className="text-xs font-semibold text-slate-600">{t.basis}<select className={inputClass} value={scope.scopeBasis} onChange={(event) => updateScope(scope.id, { scopeBasis: event.target.value as BoqWorkScope['scopeBasis'], quantityConfirmed: false })}><option value="ORIGINAL">{t.original}</option><option value="APPROVED_CHANGE">{t.approved}</option><option value="PENDING_CHANGE">{t.pendingChange}</option></select></label></div>
          <div className="grid gap-3 sm:grid-cols-3"><label className="text-xs font-semibold text-slate-600 sm:col-span-2">{t.quantity}<input className={inputClass} inputMode="decimal" value={scope.quantity ?? ''} placeholder={t.unknown} onChange={(event) => updateScope(scope.id, { quantity: event.target.value || null, quantityConfirmed: false })} /></label><label className="text-xs font-semibold text-slate-600">{t.unit}<input className={inputClass} value={scope.unit ?? ''} onChange={(event) => updateScope(scope.id, { unit: event.target.value || null, quantityConfirmed: false })} /></label></div>
          <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.quantityEvidence}</summary><textarea aria-label={t.quantityEvidence} className={inputClass} rows={2} value={scope.quantityEvidence} onChange={(event) => updateScope(scope.id, { quantityEvidence: event.target.value, quantityConfirmed: false })} /></details>
          {scope.scopeBasis === 'APPROVED_CHANGE' ? <label className="block text-xs font-semibold text-slate-600">{t.approvalEvidence}<textarea className={inputClass} rows={2} value={scope.approvalEvidence} onChange={(event) => updateScope(scope.id, { approvalEvidence: event.target.value, quantityConfirmed: false })} /></label> : null}
          <label className="flex items-start justify-center gap-2 text-xs text-slate-700"><input className="mt-0.5" type="checkbox" checked={scope.quantityConfirmed} onChange={(event) => updateScope(scope.id, { quantityConfirmed: event.target.checked })} /><span>{t.quantityConfirmed}</span></label>
          <details className="rounded-lg border border-slate-200 p-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.scopePrice}</summary><p className="my-2 text-xs text-slate-500">{t.usePlanPrice}</p><label className="mb-2 flex justify-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={scope.price !== null} onChange={(event) => updateScope(scope.id, { price: event.target.checked ? emptyPrice() : null })} /><span>{t.scopePrice}</span></label>{scope.price ? priceEditor(scope.price, scope.id) : null}</details>
        </div>)}</div>}
        <button className={buttonClass} type="button" onClick={() => setDraft((previous) => ({ ...previous, scopes: [...previous.scopes, emptyWorkScope(item.unit, crypto.randomUUID())] }))}>{t.add}</button>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-start justify-center gap-x-4 gap-y-2"><p className="text-sm font-semibold text-slate-800">{t.price}：{displayPrice?.confirmed && displayPrice.unitPrice !== null ? `${formatValue(displayPrice.unitPrice)} FCFA${item.unit ? `/${item.unit}` : ''}` : t.unknown}</p>
            <details className="min-w-0"><summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.specialPrice}</summary><div className="mt-3 space-y-2"><p className="text-xs text-slate-500">{t.sourcePrice}：{item.sourceUnitPrice === null ? t.unknown : formatValue(item.sourceUnitPrice)}</p>{signedWorkPrice(item, revisionId) !== null ? <button type="button" className={buttonClass} onClick={() => setDraft((previous) => ({ ...previous, price: signedWorkPrice(item, revisionId) }))}>{t.useSourcePrice}</button> : null}{priceEditor(draft.price, null)}</div></details>
          </div>
          {draft.scopes.some((scope) => scope.scopeBasis !== 'ORIGINAL') ? <p className="mt-2 text-xs text-amber-800">{t.originalPriceOnly}</p> : null}
        </div>
        {!sourceActivity ? <label className="flex items-start justify-center gap-2 text-xs text-slate-700"><input className="mt-0.5" type="checkbox" checked={draft.scopeComplete} onChange={(event) => setDraft((previous) => ({ ...previous, scopeComplete: event.target.checked }))} /><span>{t.scopeComplete}</span></label> : null}
        <label className="block text-xs font-semibold text-slate-600">{t.reason}<textarea className={inputClass} rows={1} value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="flex flex-wrap justify-center gap-2"><button type="button" className={buttonClass} disabled={conflicted} onClick={() => void save('save-draft')}>{saving ? t.saving : t.save}</button>{allowedActions.includes('confirm') ? <button type="submit" disabled={conflicted} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? t.saving : t.confirm}</button> : null}{allowedActions.includes('confirm-none') ? <button type="button" className={buttonClass} disabled={conflicted} onClick={() => setNoneConfirmation(true)}>{t.confirmNone}</button> : null}</div>
        {noneConfirmation && allowedActions.includes('confirm-none') ? <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-3"><p className="text-xs text-amber-900">{t.noneHelp}</p><div className="flex flex-wrap justify-center gap-2"><button type="button" className={buttonClass} onClick={() => setNoneConfirmation(false)}>{t.cancel}</button><button type="button" className="rounded-lg bg-amber-800 px-3 py-2 text-xs font-semibold text-white" onClick={() => void save('confirm-none')}>{t.noneSubmit}</button></div></div> : null}
      </fieldset>
    </form> : null}
    {message ? <p role={message.failed ? 'alert' : 'status'} className={`rounded-lg p-2 text-xs ${message.failed ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>{message.text}</p> : null}
  </section>
}
