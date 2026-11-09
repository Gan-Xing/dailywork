'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { SignedBillWorkPlanPanel } from '@/components/value/SignedBillWorkPlanPanel'
import { formatWorkQuantity, unassignedWorkCalculationRecords, workPlanReadiness, workPlanReadinessClass } from '@/lib/value/boqWorkPlanDisplay'
import type { Locale } from '@/lib/i18n'
import type { BoqWorkPlanPostResponse, BoqWorkPlansResponse } from '@/lib/value/boqWorkPlans'
import type { SignedCalculationRecord, SignedCalculationReviewDto } from '@/lib/value/signedBillCalculations'
import type { SignedBillLine, SignedBillRevisionDto } from '@/lib/value/signedBills'

type RowFilter = 'measured' | 'all' | 'pending' | 'completed-unmeasured'
type Props = {
  revision: SignedBillRevisionDto
  locale: Locale
  search: string
  canEdit: boolean
  formatValue: (value: string | null | undefined) => string
  onOpenFile: (fileId: number) => void
}

const labels = {
  zh: {
    code: '原价号', designation: '工作内容 / 单位', price: '原单单价 HT', previous: '以前', current: '本期', cumulative: '累计',
    quantity: '工程量', amount: '工程金额 HT', expand: '展开计量与剩余', collapse: '收起明细', loading: '正在读取道路计算明细…',
    loadError: '计算明细读取失败', retry: '重新读取', unavailable: '此版本尚未导入道路计算细行；请打开原件核对。',
    sourceRule: '明细逐单元格提取 Excel 原值；PDF 只核项目期次、汇总与签章，未逐细行核验尺寸。',
    totalRule: '上方为签字版本汇总原值，下方为计算底稿细行。细行与小计可能不等于汇总，不能相加后再次累计。',
    measured: '已计量', all: '全部计量状态', pending: '0 / 空白待核', completedUnmeasured: '有证据的完成未计量',
    includeSubtotal: '同时显示原表小计（不参与再次合计）', noRows: '此价号在当前筛选下没有计算细行。',
    noRoadBreakdown: '原件未列道路拆分，可勾选“同时显示原表小计”查看；这不表示尚未导入。',
    noCompletion: '没有同时具备完成证据与未计量原值的细行；空白、零值或候选记录不代表已完成。',
    road: '道路 / 位置', side: '侧别', pk: 'PK 起讫', detail: '计算细行', itemHeader: '原表项目量值行', subtotal: '原表小计 · 不重复累计',
    description: '部位 / 工作说明', dimensions: '尺寸原值', formula: '原表公式 / 计算量', calculated: '计算量原值',
    note: '文字备注', notePlaceholder: '填写本细行的核查备注', save: '保存备注', saving: '正在保存…',
    saved: '备注已保存', noteError: '备注保存失败', conflict: '备注已被更新，请重新读取后核对；当前草稿已保留。',
    storedNote: '当前已保存备注', sourceNote: '原表说明', unknown: '未有完成证据', completed: '有完成证据', adjustment: '调整 / 冲回',
    unmeasured: '原值未计量', unknownBilling: '计量原值待核', template: '原模板补充项', templateHelp: '以下项目在原模板中存在，未归档为签字版本量价行；空白单价和金额保持空白。',
    candidates: '待匹配的现场候选', candidateHelp: '以下现场记录尚未与本价号的项目、道路、PK、侧别及累计口径逐项闭合，仅供核对，不计为完成未计量。',
    unassigned: '未分配价号的原表细行（待核）', unassignedHelp: '以下原表细行尚未确定对应价号，未计入任何价号分组。数量保持原值，不根据相似价号或相同数值自动挂接。',
    sourceBlank: '原件空白', none: '—', rowCount: '条底稿行', measuredCount: '条已计量', sourceSheet: '计算底稿', noLines: '没有匹配的量价明细。',
    workPlanTitle: '计量与剩余明细', workPlanLoading: '正在读取剩余确认…', workPlanError: '剩余确认读取失败',
    remaining: '待计量', unconfirmed: '未确认', confirmedItems: '项已有确认', planItems: '项可逐项确认',
    workPlanRule: '下列行数是底稿记录数，不是工程量。待计量数量须逐价号、按原单位确认；不同单位不合计。',
    planUnavailable: '此行未建立可确认范围，请重新读取或核对当前版本。',
    sourceActivities: '未定价待核事项',
  },
  fr: {
    code: 'Prix source', designation: 'Désignation / unité', price: 'P.U. source HT', previous: 'Précédent', current: 'Présent', cumulative: 'Cumulé',
    quantity: 'Quantité', amount: 'Montant travaux HT', expand: 'Voir les mesures et le restant', collapse: 'Réduire le détail', loading: 'Chargement des calculs par voie…',
    loadError: 'Impossible de lire le détail', retry: 'Relire', unavailable: 'Le détail par voie n’est pas encore importé pour cette version. Consultez la pièce originale.',
    sourceRule: 'Valeurs Excel extraites cellule par cellule ; le PDF a été vérifié pour le projet, le décompte, les totaux et les signatures, sans contrôle visuel de chaque dimension.',
    totalRule: 'Les valeurs de la version signée restent en haut. Le détail et ses sous-totaux peuvent différer de ce résumé et ne doivent pas être additionnés une seconde fois.',
    measured: 'Mesuré', all: 'Tous les états de mesure', pending: 'Zéro / vide à vérifier', completedUnmeasured: 'Achevé non mesuré, avec preuves',
    includeSubtotal: 'Afficher les sous-totaux source, sans les additionner à nouveau', noRows: 'Aucune ligne pour ce prix avec ce filtre.',
    noRoadBreakdown: 'La pièce ne détaille pas les voies. Cochez les sous-totaux source pour les consulter ; le décompte est bien importé.',
    noCompletion: 'Aucune ligne ne réunit une preuve d’achèvement et une valeur source non mesurée. Un vide, un zéro ou un candidat ne prouve pas l’achèvement.',
    road: 'Voie / emplacement', side: 'Côté', pk: 'PK début / fin', detail: 'Ligne de calcul', itemHeader: 'Quantité portée sur la ligne de prix source', subtotal: 'Sous-total source · non cumulable',
    description: 'Ouvrage / description', dimensions: 'Dimensions source', formula: 'Formule / quantité calculée', calculated: 'Quantité calculée source',
    note: 'Observation', notePlaceholder: 'Observation de vérification pour cette ligne', save: 'Enregistrer', saving: 'Enregistrement…',
    saved: 'Observation enregistrée', noteError: 'Échec de l’enregistrement', conflict: 'Cette observation a changé. Relisez-la avant de réessayer ; votre brouillon est conservé.',
    storedNote: 'Observation actuellement conservée', sourceNote: 'Note source', unknown: 'Achèvement non prouvé', completed: 'Achèvement documenté', adjustment: 'Ajustement / reprise',
    unmeasured: 'Non mesuré dans la source', unknownBilling: 'Valeur mesurée à vérifier', template: 'Lignes complémentaires du modèle', templateHelp: 'Présentes dans le modèle, ces lignes ne sont pas archivées comme lignes de prix de la version signée. Les prix et montants vides restent vides.',
    candidates: 'Faits de chantier à rapprocher', candidateHelp: 'Ces faits ne sont pas encore rapprochés avec le projet, le prix, la voie, le PK, le côté et le même cumul. Ils ne sont pas classés comme achevés non mesurés.',
    unassigned: 'Lignes source sans prix affecté, à vérifier', unassignedHelp: 'Ces lignes ne sont affectées à aucun groupe de prix. Les quantités source sont conservées, sans rapprochement automatique par numéro similaire ou valeur identique.',
    sourceBlank: 'Vide dans la pièce', none: '—', rowCount: 'lignes de calcul', measuredCount: 'mesurées', sourceSheet: 'Calcul original', noLines: 'Aucune ligne de prix correspondante.',
    workPlanTitle: 'Mesures et restant à mesurer', workPlanLoading: 'Chargement des confirmations du restant…', workPlanError: 'Impossible de lire les confirmations du restant',
    remaining: 'Restant à mesurer', unconfirmed: 'Non confirmé', confirmedItems: 'prix avec confirmation', planItems: 'prix à vérifier individuellement',
    workPlanRule: 'Les nombres de lignes désignent des enregistrements, pas des quantités. Confirmez le restant pour chaque prix dans son unité ; les unités différentes ne s’additionnent pas.',
    planUnavailable: 'Aucun périmètre confirmable pour cette ligne. Relisez ou vérifiez la version sélectionnée.',
    sourceActivities: 'Travaux sans prix à vérifier',
  },
}

export function hasDocumentedUnmeasuredCompletion(record: SignedCalculationRecord) {
  return record.billingState === 'UNMEASURED' && record.completionState === 'COMPLETED' && Boolean(record.completionEvidence?.trim())
}

export function filterCalculationRecords(records: SignedCalculationRecord[], lineKey: string, filter: RowFilter, includeSubtotals = false) {
  return records.filter((record) => {
    if (!record.lineKeys.includes(lineKey)) return false
    const measuredHeader = record.rowType === 'ITEM_HEADER' && (record.billingState === 'MEASURED' || record.billingState === 'ADJUSTMENT')
    if (record.rowType !== 'DETAIL' && !measuredHeader && !(includeSubtotals && record.rowType === 'SUBTOTAL')) return false
    if (filter === 'measured') return record.billingState === 'MEASURED' || record.billingState === 'ADJUSTMENT'
    if (filter === 'pending') return record.billingState === 'UNKNOWN' || (record.billingState === 'UNMEASURED' && !hasDocumentedUnmeasuredCompletion(record))
    if (filter === 'completed-unmeasured') return hasDocumentedUnmeasuredCompletion(record)
    return true
  })
}

export function supplementaryCalculationLines(review: SignedCalculationReviewDto | null, archivedLines: SignedBillLine[]): SignedBillLine[] {
  const archivedKeys = new Set(archivedLines.map((line) => line.key))
  return (review?.items ?? []).filter((item) => !item.archivedLine && !archivedKeys.has(item.lineKey)).map((item) => ({
    key: item.lineKey, rowType: 'ITEM', boqItemId: null, sourceCode: item.code || null, designation: item.designation,
    unit: item.unit, unitPrice: item.unitPrice, previousQuantity: item.previousQuantity, quantity: item.currentQuantity,
    cumulativeQuantity: item.cumulativeQuantity, previousAmount: item.previousAmountHt, amount: item.currentAmountHt,
    cumulativeAmount: item.cumulativeAmountHt, evidence: { sourceRow: item.sourceRow },
  }))
}

function lineSource(line: SignedBillLine) {
  const sheet = typeof line.evidence?.sheet === 'string' ? line.evidence.sheet : null
  const row = typeof line.evidence?.sourceRow === 'number' ? line.evidence.sourceRow : null
  return sheet || row !== null ? `${sheet ?? 'Excel'}${row === null ? '' : ` · ${row}`}` : null
}

export function SignedBillCalculationRows({ revision, locale, search, canEdit, formatValue, onOpenFile }: Props) {
  const t = labels[locale]
  const [review, setReview] = useState<SignedCalculationReviewDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [filter, setFilter] = useState<RowFilter>('measured')
  const [includeSubtotals, setIncludeSubtotals] = useState(false)
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [savingNotes, setSavingNotes] = useState<Record<number, boolean>>({})
  const [noteMessages, setNoteMessages] = useState<Record<number, { message: string; failed: boolean }>>({})
  const [workPlans, setWorkPlans] = useState<BoqWorkPlansResponse | null>(null)
  const [workPlansLoading, setWorkPlansLoading] = useState(true)
  const [workPlansError, setWorkPlansError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/value/signed-bills/${revision.id}/calculation-review`, { credentials: 'include', signal })
      const payload = await response.json() as SignedCalculationReviewDto & { message?: string }
      if (!response.ok) throw new Error(payload.message ?? t.loadError)
      if (payload.revisionId !== revision.id) throw new Error(t.loadError)
      if (!signal?.aborted) setReview(payload)
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : t.loadError)
    } finally { if (!signal?.aborted) setLoading(false) }
  }, [revision.id, t.loadError])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const loadWorkPlans = useCallback(async (signal?: AbortSignal) => {
    setWorkPlansLoading(true)
    setWorkPlansError(null)
    try {
      const response = await fetch(`/api/value/signed-bills/${revision.id}/work-plans`, { credentials: 'include', signal })
      const payload = await response.json() as BoqWorkPlansResponse & { message?: string }
      if (!response.ok) throw new Error(payload.message ?? t.workPlanError)
      if (payload.revisionId !== revision.id || !Array.isArray(payload.items)) throw new Error(t.workPlanError)
      if (!signal?.aborted) setWorkPlans(payload)
    } catch (cause) {
      if (!signal?.aborted) setWorkPlansError(cause instanceof Error ? cause.message : t.workPlanError)
    } finally { if (!signal?.aborted) setWorkPlansLoading(false) }
  }, [revision.id, t.workPlanError])

  useEffect(() => {
    const controller = new AbortController()
    void loadWorkPlans(controller.signal)
    return () => controller.abort()
  }, [loadWorkPlans])

  const savedWorkPlan = (response: BoqWorkPlanPostResponse) => setWorkPlans((previous) => previous ? {
    ...previous, baselineHash: response.baselineHash,
    items: previous.items.map((item) => item.lineKey === response.item.lineKey ? response.item : item),
  } : previous)

  const supplementary = useMemo(() => supplementaryCalculationLines(review, revision.lines), [review, revision.lines])
  const unassigned = useMemo(() => unassignedWorkCalculationRecords(review?.records ?? [], workPlans?.items ?? []), [review, workPlans])
  const matchesSearch = (line: SignedBillLine) => `${line.sourceCode ?? ''} ${line.designation}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  const lines = revision.lines.filter(matchesSearch)
  const extraLines = supplementary.filter(matchesSearch)
  const sourceActivities = (workPlans?.items ?? []).filter((item) => item.sourceKind === 'SOURCE_ACTIVITY' && `${item.designation} ${item.unit ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const confirmableItems = (workPlans?.items ?? []).filter((item) => item.sourceKind !== 'SOURCE_ACTIVITY')

  const saveNote = async (record: SignedCalculationRecord) => {
    const note = drafts[record.id] ?? record.note ?? ''
    setSavingNotes((previous) => ({ ...previous, [record.id]: true }))
    setNoteMessages((previous) => ({ ...previous, [record.id]: { message: '', failed: false } }))
    try {
      const response = await fetch(`/api/value/signed-bills/${revision.id}/calculation-review`, {
        method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: record.id, note, expectedUpdatedAt: record.updatedAt }),
      })
      const payload = await response.json() as { record?: SignedCalculationRecord; message?: string }
      if (!response.ok || !payload.record) throw new Error(response.status === 409 ? `${payload.message ?? ''} ${t.conflict}`.trim() : payload.message ?? t.noteError)
      const updated = payload.record
      setReview((previous) => previous ? { ...previous, records: previous.records.map((item) => item.id === updated.id ? updated : item) } : previous)
      setDrafts((previous) => { const next = { ...previous }; delete next[record.id]; return next })
      setNoteMessages((previous) => ({ ...previous, [record.id]: { message: t.saved, failed: false } }))
    } catch (cause) {
      setNoteMessages((previous) => ({ ...previous, [record.id]: { message: cause instanceof Error ? cause.message : t.noteError, failed: true } }))
    } finally { setSavingNotes((previous) => ({ ...previous, [record.id]: false })) }
  }

  const noteCell = (record: SignedCalculationRecord) => {
    const value = drafts[record.id] ?? record.note ?? ''
    const dirty = value !== (record.note ?? '')
    const message = noteMessages[record.id]
    return <div className="sbcr-note"><span className="sbcr-cell-label">{t.note}</span>{canEdit ? <>
      <textarea aria-label={`${t.note} · ${record.sourceSheet}!${record.sourceRange}`} rows={2} maxLength={2000} disabled={savingNotes[record.id]} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white p-2 text-center text-xs text-slate-800 focus:border-emerald-400 focus:outline-none disabled:opacity-60" placeholder={t.notePlaceholder} value={value} onChange={(event) => { const nextValue = event.target.value; setDrafts((previous) => ({ ...previous, [record.id]: nextValue })); setNoteMessages((previous) => ({ ...previous, [record.id]: { message: '', failed: false } })) }} />
      {dirty ? <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-500">{t.storedNote}：{record.note || t.none}</p> : null}
      <button type="button" disabled={!dirty || savingNotes[record.id]} className="mt-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" onClick={() => void saveNote(record)}>{savingNotes[record.id] ? t.saving : t.save}</button>
      {message?.message ? <p role={message.failed ? 'alert' : 'status'} className={`mt-1 text-xs ${message.failed ? 'text-rose-700' : 'text-emerald-700'}`}>{message.message}{message.failed ? <button type="button" className="ml-2 underline" onClick={() => void load()}>{t.retry}</button> : null}</p> : null}
    </> : <p className="whitespace-pre-wrap break-words text-xs text-slate-700">{record.note || t.none}</p>}</div>
  }

  const renderRecord = (record: SignedCalculationRecord) => {
    const billingLabel = record.billingState === 'MEASURED' ? t.measured : record.billingState === 'ADJUSTMENT' ? t.adjustment : record.billingState === 'UNMEASURED' ? t.unmeasured : t.unknownBilling
    const completed = record.completionState === 'COMPLETED' && Boolean(record.completionEvidence?.trim())
    return <div key={record.id} className={`sbcr-detail-row ${record.rowType === 'SUBTOTAL' ? 'bg-amber-50/60' : 'bg-white'}`}>
      <div className="sbcr-location"><span className="sbcr-cell-label">{t.road}</span><p className="font-semibold text-slate-800">{record.road || t.none}</p><p className="mt-1 text-slate-500">{t.side}：{record.side || t.none}</p><p className="mt-1 text-slate-500">{t.pk}：{record.pkStart ?? t.none} → {record.pkEnd ?? t.none}</p>{record.locationNote ? <p className="mt-1 break-words text-[11px] text-slate-400">{record.locationNote}</p> : null}<span className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{record.rowType === 'SUBTOTAL' ? t.subtotal : record.rowType === 'ITEM_HEADER' ? t.itemHeader : t.detail}</span></div>
      <div><span className="sbcr-cell-label">{t.description}</span><p className="whitespace-pre-wrap break-words text-slate-700">{[record.structure, record.description].filter(Boolean).join(' · ') || t.none}</p><div className="mt-2 flex flex-wrap justify-center gap-1"><span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800">{billingLabel}</span><span className={`rounded px-2 py-0.5 text-[11px] ${completed ? 'bg-blue-50 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>{completed ? t.completed : t.unknown}</span></div>{record.billingNote ? <p className="mt-2 whitespace-pre-wrap break-words text-xs text-amber-800">{record.billingNote}</p> : null}{record.correctionNote ? <p className="mt-2 whitespace-pre-wrap break-words rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-xs text-emerald-900">{record.correctionNote}</p> : null}{completed ? <p className="mt-2 whitespace-pre-wrap text-xs text-blue-800">{record.completionEvidence}</p> : null}{record.sourceNote ? <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{t.sourceNote}：{record.sourceNote}</p> : null}
        <details className="mt-2"><summary className="cursor-pointer text-xs font-semibold text-slate-600">{t.dimensions} · {t.formula}</summary><dl className="mt-2 grid grid-cols-2 gap-2">{record.dimensions.map((dimension, index) => <div key={`${dimension.cell}-${index}`} className="rounded bg-slate-50 p-2"><dt className="text-[11px] text-slate-500">{dimension.label} · {dimension.cell}</dt><dd className="mt-1 break-words tabular-nums text-slate-800">{dimension.value === null ? t.sourceBlank : formatValue(dimension.value)}</dd></div>)}</dl><p className="mt-2 break-words tabular-nums text-xs text-slate-700">{t.calculated}：{formatValue(record.calculatedQuantity)} {record.unit ?? ''}</p><p className="mt-2 whitespace-pre-wrap break-all font-mono text-xs text-slate-600">{record.formula || t.sourceBlank}</p></details>
      </div>
      <div className="sbcr-detail-quantities">{([['previousQuantity', t.previous], ['currentQuantity', t.current], ['cumulativeQuantity', t.cumulative]] as const).map(([key, label]) => <div key={key}><span className="sbcr-cell-label">{label} · {record.unit ?? t.quantity}</span><p className={`break-words tabular-nums ${key === 'currentQuantity' ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{formatValue(record[key])}</p></div>)}</div>
      {noteCell(record)}
    </div>
  }

  const renderLine = (line: SignedBillLine, templateOnly = false) => {
    const isExpanded = expanded[line.key] ?? false
    const records = review?.records ?? []
    const matching = filterCalculationRecords(records, line.key, filter, includeSubtotals)
    const detailCount = filterCalculationRecords(records, line.key, 'all').length
    const measuredCount = filterCalculationRecords(records, line.key, 'measured').length
    const hasSubtotal = records.some((record) => record.rowType === 'SUBTOTAL' && record.lineKeys.includes(line.key))
    const itemNotes = review?.items.find((item) => item.lineKey === line.key)?.notes ?? []
    const candidates = (review?.completionCandidates ?? []).filter((candidate) => candidate.code === line.sourceCode)
    const workPlan = workPlans?.items.find((item) => item.lineKey === line.key)
    const readiness = workPlanReadiness(workPlan)
    const remainingLabel = workPlan?.summary.remainingQuantity === null || !workPlan || workPlan.state === 'NEEDS_REVIEW'
      ? t.unconfirmed : `${formatWorkQuantity(workPlan.summary.remainingQuantity, t.unconfirmed)} ${workPlan.unit ?? ''}`.trim()
    const summarySource = lineSource(line)
    const values = [line.unitPrice, line.previousQuantity, line.quantity, line.cumulativeQuantity, line.previousAmount, line.amount, line.cumulativeAmount]
    const cellLabels = [t.price, `${t.previous} · ${t.quantity}`, `${t.current} · ${t.quantity}`, `${t.cumulative} · ${t.quantity}`, `${t.previous} · ${t.amount}`, `${t.current} · ${t.amount}`, `${t.cumulative} · ${t.amount}`]
    return <div key={line.key} className="sbcr-item">
      <div className="sbcr-main-row">
        <button type="button" className="sbcr-item-toggle text-center" aria-expanded={isExpanded} aria-controls={`calculation-${revision.id}-${line.key}`} onClick={() => setExpanded((previous) => ({ ...previous, [line.key]: !previous[line.key] }))}>
          <span className="sbcr-main-code font-semibold text-slate-800">{line.sourceCode ?? t.none}</span><span className="sbcr-main-title"><span className="block break-words text-slate-800">{line.designation}</span><span className="mt-1 block text-[11px] text-slate-500">{line.unit ?? t.none}{line.rowType === 'SUBTOTAL' ? ` · ${t.subtotal}` : ''}{templateOnly ? ` · ${t.template}` : ''}</span><span className="mt-2 block text-xs font-semibold text-emerald-800">{isExpanded ? '▾' : '▸'} {isExpanded ? t.collapse : t.expand}{review?.available ? ` · ${measuredCount} ${t.measuredCount} / ${detailCount} ${t.rowCount}` : ''}</span>{line.rowType !== 'SUBTOTAL' && line.rowType !== 'NOTE' ? <span data-work-state={readiness} className={`mt-1 block text-xs ${readiness === 'none' ? 'text-blue-800' : `rounded-lg border px-2 py-1 font-semibold ${workPlanReadinessClass(readiness)}`}`}>{t.remaining}：{remainingLabel}</span> : null}</span>
        </button>
        {values.map((value, index) => <div key={index} className={`sbcr-main-value sbcr-value-${index} ${index === 2 || index === 5 ? 'font-semibold text-slate-900' : 'text-slate-600'}`}><span className="sbcr-cell-label">{cellLabels[index]}</span><span className="break-words tabular-nums">{formatValue(value)}</span></div>)}
      </div>
      {isExpanded ? <div id={`calculation-${revision.id}-${line.key}`} className="border-t border-slate-200 bg-slate-50/70 p-3 sm:p-4">
        {workPlansLoading ? <p role="status" className="mb-3 text-center text-xs text-slate-500">{t.workPlanLoading}</p> : workPlansError ? <p role="alert" className="mb-3 text-center text-xs text-rose-700">{workPlansError} <button type="button" className="underline" onClick={() => void loadWorkPlans()}>{t.retry}</button></p> : workPlan && workPlans ? <SignedBillWorkPlanPanel item={workPlan} revisionId={revision.id} baselineHash={workPlans.baselineHash} roads={workPlans.roads} editAllowed={canEdit && workPlans.editAllowed} readOnlyReason={workPlans.readOnlyReason} permissionReadOnly={!canEdit} locale={locale} formatValue={formatValue} onSaved={savedWorkPlan} /> : line.rowType !== 'SUBTOTAL' && line.rowType !== 'NOTE' ? <p className="mb-3 text-center text-xs text-slate-500">{t.planUnavailable}</p> : null}
        <div className="mb-3 flex flex-wrap items-center gap-2">{(review?.sourceFileId ?? revision.calculationFileId) ? <button type="button" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-800" onClick={() => onOpenFile((review?.sourceFileId ?? revision.calculationFileId)!)}>{summarySource ?? t.sourceSheet}</button> : null}<p className="text-xs text-slate-500">{t.totalRule}</p></div>
        {loading ? <p role="status" className="text-sm text-slate-500">{t.loading}</p> : error ? <p role="alert" className="text-sm text-rose-700">{error} <button type="button" className="underline" onClick={() => void load()}>{t.retry}</button></p> : !review?.available ? <p className="text-sm text-slate-500">{t.unavailable}</p> : <>
          {itemNotes.length ? <aside className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><ul className="space-y-2">{itemNotes.map((note, index) => <li key={index} className="whitespace-pre-wrap break-words">{note}</li>)}</ul></aside> : null}
          {matching.length ? <div className="sbcr-detail-table"><div className="sbcr-detail-head" aria-hidden="true"><span>{t.road} / {t.side} / PK</span><span>{t.description} / {t.dimensions}</span><span>{t.previous} / {t.current} / {t.cumulative}</span><span>{t.note}</span></div>{matching.map(renderRecord)}</div> : <p className="rounded-lg border border-dashed border-slate-200 bg-white p-3 text-sm text-slate-500">{filter === 'completed-unmeasured' ? t.noCompletion : detailCount === 0 && hasSubtotal && !includeSubtotals ? t.noRoadBreakdown : t.noRows}</p>}
          {filter !== 'measured' && candidates.length ? <details className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3"><summary className="cursor-pointer text-xs font-semibold text-amber-900">{t.candidates} ({candidates.length})</summary><p className="mt-2 text-xs text-amber-800">{t.candidateHelp}</p>{candidates.map((candidate) => <div key={candidate.id} className="mt-2 border-t border-amber-200 pt-2 text-xs text-slate-700"><p>{candidate.road ?? t.none} · {candidate.side ?? t.none} · PK {candidate.pkStart ?? t.none} → {candidate.pkEnd ?? t.none}</p><p className="mt-1">{formatValue(candidate.quantity)} {candidate.unit ?? ''}</p><p className="mt-1 whitespace-pre-wrap">{candidate.note}</p></div>)}</details> : null}
        </>}
      </div> : null}
    </div>
  }

  return <div className="sbcr-root" style={{ containerType: 'inline-size', containerName: 'signed-calculation' }}>
    <div className="mb-3 space-y-2 rounded-xl border border-blue-200 bg-blue-50/40 p-3 text-center">
      <h4 className="text-sm font-semibold text-slate-800">{t.workPlanTitle}</h4>
      <p className="text-xs text-slate-600">{t.workPlanRule}</p>
      {workPlansLoading ? <p role="status" className="text-xs text-slate-500">{t.workPlanLoading}</p> : workPlansError ? <p role="alert" className="text-xs text-rose-700">{workPlansError} <button type="button" className="underline" onClick={() => void loadWorkPlans()}>{t.retry}</button></p> : workPlans ? <p className="text-xs text-slate-600">{confirmableItems.filter((item) => item.plan?.confirmedSnapshot && item.state !== 'NEEDS_REVIEW').length} {t.confirmedItems} / {confirmableItems.length} {t.planItems}</p> : null}
    </div>
    <div className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-600">{review?.available ? review.sourceVerification || t.sourceRule : loading ? t.loading : error ? null : t.unavailable}</p>
      {error ? <p role="alert" className="text-xs text-rose-700">{error} <button type="button" className="underline" onClick={() => void load()}>{t.retry}</button></p> : null}
      <div className="flex flex-wrap gap-1.5" aria-label={locale === 'fr' ? 'Filtrer les détails' : '细行筛选'}>{([['measured', t.measured], ['all', t.all], ['pending', t.pending], ['completed-unmeasured', t.completedUnmeasured]] as const).map(([value, label]) => <button type="button" key={value} disabled={!review?.available} aria-pressed={filter === value} className={`rounded-lg border px-2 py-1.5 text-xs font-semibold disabled:opacity-50 ${filter === value ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-600'}`} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <label className="flex items-start gap-2 text-xs text-slate-600"><input type="checkbox" disabled={!review?.available} checked={includeSubtotals} onChange={(event) => setIncludeSubtotals(event.target.checked)} className="mt-0.5" /><span>{t.includeSubtotal}</span></label>
    </div>
    <div aria-label={locale === 'fr' ? 'Prix et calculs par voie' : '价号与道路计算明细'} className="sbcr-table">
      <div className="sbcr-main-head" aria-hidden="true"><span>{t.code}</span><span>{t.designation}</span><span>{t.price}</span>{[t.previous, t.current, t.cumulative, t.previous, t.current, t.cumulative].map((label, index) => <span key={index}>{label}<br /><span className="font-normal">{index < 3 ? t.quantity : t.amount}</span></span>)}</div>
      {lines.map((line) => renderLine(line))}
      {!lines.length && !extraLines.length ? <p className="p-4 text-sm text-slate-500">{t.noLines}</p> : null}
    </div>
    {extraLines.length ? <div className="mt-4"><h4 className="text-sm font-semibold text-slate-800">{t.template} ({extraLines.length})</h4><p className="my-2 text-xs text-slate-500">{t.templateHelp}</p><div className="sbcr-table">{extraLines.map((line) => renderLine(line, true))}</div></div> : null}
    {sourceActivities.length && workPlans ? <section className="mt-4 space-y-3" aria-label={t.sourceActivities}><h4 className="text-center text-sm font-semibold text-rose-900">{t.sourceActivities} ({sourceActivities.length})</h4>{sourceActivities.map((item) => <SignedBillWorkPlanPanel key={item.lineKey} item={item} revisionId={revision.id} baselineHash={workPlans.baselineHash} roads={workPlans.roads} editAllowed={canEdit && workPlans.editAllowed} readOnlyReason={workPlans.readOnlyReason} permissionReadOnly={!canEdit} sourceRecords={review?.records ?? []} locale={locale} formatValue={formatValue} onSaved={savedWorkPlan} />)}</section> : null}
    {review?.available && unassigned.length ? <details className="mt-4 rounded-xl border border-amber-200 bg-amber-50/40 p-3"><summary className="cursor-pointer text-sm font-semibold text-amber-900">{t.unassigned} ({unassigned.length})</summary><p className="my-3 text-xs text-amber-800">{t.unassignedHelp}</p><div className="sbcr-detail-table">{unassigned.map(renderRecord)}</div></details> : null}
    <style>{`
      .sbcr-root { min-width: 0; }
      .sbcr-table { border: 1px solid #e2e8f0; border-radius: .75rem; overflow: hidden; }
      .sbcr-item + .sbcr-item { border-top: 1px solid #e2e8f0; }
      .sbcr-main-head, .sbcr-detail-head { display: none; }
      .sbcr-main-head, .sbcr-main-row, .sbcr-detail-head, .sbcr-detail-row { text-align: center; }
      .sbcr-main-row { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .75rem; padding: .85rem; font-size: .75rem; }
      .sbcr-item-toggle { display: flex; grid-column: 1/-1; gap: .75rem; min-width: 0; width: 100%; }
      .sbcr-main-code { flex: 0 0 3.5rem; overflow-wrap: anywhere; }
      .sbcr-main-title { min-width: 0; flex: 1; }
      .sbcr-item-toggle:focus-visible .sbcr-main-title { outline: 2px solid #10b981; outline-offset: 4px; border-radius: .25rem; }
      .sbcr-main-value { min-width: 0; }
      .sbcr-value-0 { grid-column: 1/-1; padding-bottom: .5rem; border-bottom: 1px solid #f1f5f9; }
      .sbcr-cell-label { display: block; margin-bottom: .25rem; font-size: .65rem; color: #64748b; font-weight: 400; }
      .sbcr-detail-table { display: grid; gap: .75rem; }
      .sbcr-detail-row { display: grid; gap: .85rem; min-width: 0; padding: .85rem; border: 1px solid #e2e8f0; border-radius: .65rem; font-size: .75rem; }
      .sbcr-detail-row > div { min-width: 0; }
      .sbcr-detail-quantities { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: .5rem; padding: .65rem; border-radius: .5rem; background: #f8fafc; }
      .sbcr-note { border-top: 1px solid #e2e8f0; padding-top: .75rem; }
      @container signed-calculation (min-width: 1000px) {
        .sbcr-main-head, .sbcr-main-row { display: grid; grid-template-columns: 4rem minmax(10rem,2.3fr) repeat(7,minmax(4.5rem,1fr)); gap: .65rem; padding: .75rem; align-items: start; }
        .sbcr-main-head { background: #f8fafc; font-size: .65rem; color: #475569; font-weight: 600; align-items: center; }
        .sbcr-item-toggle { display: contents; }
        .sbcr-main-code { grid-column: 1; }
        .sbcr-main-title { grid-column: 2; }
        .sbcr-main-value { text-align: center; }
        .sbcr-value-0 { grid-column: auto; border: 0; padding: 0; }
        .sbcr-main-row > .sbcr-main-value > .sbcr-cell-label { display: none; }
        .sbcr-detail-head, .sbcr-detail-row { display: grid; grid-template-columns: minmax(8rem,1.1fr) minmax(13rem,1.8fr) minmax(13rem,1.6fr) minmax(11rem,1.2fr); gap: .75rem; }
        .sbcr-detail-head { padding: 0 .85rem; font-size: .65rem; font-weight: 600; color: #64748b; }
        .sbcr-detail-row { border-radius: .5rem; }
        .sbcr-note { border: 0; padding: 0; }
      }
    `}</style>
  </div>
}
