'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import { Modal } from '@/components/Modal'
import { SignedBillCalculationRows } from '@/components/value/SignedBillCalculationRows'
import { useToast } from '@/components/ToastProvider'
import type { Locale } from '@/lib/i18n'
import type { CreateSignedBillInput, SignedBillAdjustment, SignedBillRevisionDto } from '@/lib/value/signedBills'

type Props = { projectId: number | null; projectName: string; locale: Locale; initialPeriod?: string; initialRevisionId?: number }
type PeriodFile = {
  id: number
  originalName: string
  mimeType: string
  links?: Array<{ purpose?: string | null }>
}
type ArchiveForm = {
  periodIndex: string
  signedAt: string
  signedPdfFileId: string
  calculationFileId: string
  grossHt: string
  netHt: string
  vatAmount: string
  netTtc: string
  advanceRecovery: string
  retentionWithheld: string
  retentionRelease: string
  materialDeduction: string
  otherAdjustment: string
  changeReason: string
  confirmed: boolean
  activate: boolean
  reusePeriodFiles: boolean
}

const text = {
  zh: {
    title: '签字账单', description: '按原件保存的正式版本；编制计量和现场道路数据保持独立。',
    period: '账单期次', latest: '当前正式版', history: '历史预览', draft: '编制快照', version: '版本',
    loading: '正在加载签字账单…', loadError: '无法加载签字账单', empty: '此项目尚无已归档账单，可从编制计量创建快照并核对原件。',
    retry: '重新加载', selectProject: '请先选择项目。', currentCount: '个期次有当前正式版',
    gross: '工程毛额 HT', net: '签认净应付 HT', vat: '原单税额 TVA', ttc: '签认净应付 TTC',
    sourceTotals: '以上金额直接取自所选版本，不按全局清单单价重新计算。',
    previewNote: '当前正在预览历史或编制版本，不参与当前正式展示，也不会再次累计。',
    signedDate: '原件签字日期', unknownDate: '原件日期未确认', pdf: '打开签字 PDF', excel: '打开 Excel 底稿',
    files: '本期文件中心', fileError: '无法打开原件，请检查文件查看权限。',
    adjustments: '扣项与退还（HT）', adjustmentEmpty: '此版本未单列扣项；空白不代表已证明扣项为零。',
    previous: '前期', current: '本期', cumulative: '累计', sourceSummary: '所选原单的前期与累计',
    summaryNote: '累计为该版本原单所列快照，可能与后来修订的历史版本合计不同；期0是否包含以来源说明为准。',
    includeAdvance: '原单此累计口径含期0预付款。', items: '计量与剩余明细', search: '搜索价号或工程名称',
    code: '原价号', designation: '工作内容 / 单位', price: '本期单价 HT', quantity: '工程量', amount: '工程金额 HT',
    noLines: '此版本未保存逐项明细。', noMatches: '没有匹配的明细。', evidence: '原件定位',
    versions: '本期版本记录', reason: '修订 / 归档依据', created: '归档时间', activate: '选用此正式版',
    activateTitle: '选择正式展示版本', activateHelp: '选择已核实原件的版本用于正式展示。历史记录会保留，编制计量及财务节点不会随之改变。',
    activationReason: '本次选版依据', activateSubmit: '确认选用', cancel: '取消', busy: '正在保存…',
    archive: '归档 / 新建修订', archiveTitle: '从编制计量归档一个新版本',
    archiveHelp: '本期明细从当前编制计量生成快照，不会读取或解析 PDF/Excel 中的工程量。请逐条核对编制值与原件，再填写已签原单金额并关联原件；本操作不替代现场道路计量，也不提供数字签署。',
    existingFiles: '查找本期已关联原件', fileId: '文件资产 ID', pickPdf: '选作签字 PDF', pickExcel: '选作计算底稿',
    noFiles: '没有匹配的已归档原件；可更改文件名搜索或在文件中心检查关联。', fileLookupError: '无法读取本期原件列表。',
    optional: '可留空', decimalHelp: '金额单位 FCFA，小数使用点号；不得为凑平金额修改工程量。',
    reuseFiles: '复用本期已归档原件', choosePdf: '签字 PDF 原件', chooseExcel: 'Excel 计算底稿',
    autoFile: '按本期已关联主文件复用', otherFiles: '搜索其他已归档文件', advancedFiles: '高级：按文件 ID 指定（可选）',
    fileSearch: '按文件名搜索', findFiles: '查找文件',
    deductionsHelp: '扣留、扣回和材料金额填正数，系统按负向影响保存；退还填正数，其他调整按实际正负号填写。',
    confirmSource: '我已核对所选 PDF 的现有签章、明细数量及上述原单金额；没有根据文件名推定签章。',
    activateOnSave: '归档后用作本期当前正式版', saveDraft: '保存编制快照', saveSigned: '归档签字版本',
    saved: '新版本已保存', activated: '当前正式版已更新', saveError: '保存失败，请重试',
    requiredTotals: '归档签字版需填写毛HT、净HT、税额和净TTC，并确认已核原PDF。', invalidDecimal: '请使用有效的十进制金额。',
    requiredPeriod: '请输入大于0的整数期次；期0预付款不在正式工程账单中。', requiredReason: '请填写本次归档或修订依据。',
    advance: '预付款扣回', retention: '质保金扣留', refund: '质保金退还', material: '材料扣减', other: '其他调整',
    source: '原件与核查说明', historyReason: '未单列修订说明', noOriginal: '尚未关联此类原件',
    reconciliation: '复核计算与原单差异', reconciliationHelp: '原单金额始终保留。计算差异供核对，不会自动改数量或增加扣项凑平。',
    grossDifference: '逐项合计与毛HT差额', netDifference: '净HT差额', vatDifference: '税额差额', ttcDifference: '净TTC差额',
    signedValue: '原单值', calculatedValue: '复核计算值', difference: '计算值减原单值',
    incompleteAmounts: '逐项金额尚有空白，不能据此宣称金额闭合。已知行金额合计', missingAmounts: '缺少金额的行数',
  },
  fr: {
    title: 'Décomptes signés', description: 'Versions conservées selon les pièces originales, indépendantes des calculs de travail et des données de chantier.',
    period: 'Décompte', latest: 'Version officielle actuelle', history: 'Aperçu historique', draft: 'Calcul de travail', version: 'Version',
    loading: 'Chargement des décomptes…', loadError: 'Impossible de charger les décomptes', empty: 'Aucun décompte archivé pour ce projet. Créez un instantané de travail puis vérifiez les originaux.',
    retry: 'Recharger', selectProject: 'Sélectionnez un projet.', currentCount: 'décomptes avec une version officielle actuelle',
    gross: 'Travaux bruts HT', net: 'Net à payer HT signé', vat: 'TVA de la pièce', ttc: 'Net à payer TTC signé',
    sourceTotals: 'Montants conservés dans la version sélectionnée, sans recalcul au prix du catalogue.',
    previewNote: 'Cet aperçu historique ou de travail ne modifie pas la version officielle et ne s’ajoute pas une seconde fois aux cumuls.',
    signedDate: 'Date de signature de la pièce', unknownDate: 'Date de la pièce non confirmée', pdf: 'Ouvrir le PDF signé', excel: 'Ouvrir le calcul Excel',
    files: 'Pièces du décompte', fileError: 'Impossible d’ouvrir la pièce. Vérifiez les droits de consultation.',
    adjustments: 'Retenues et restitutions (HT)', adjustmentEmpty: 'Aucun ajustement détaillé dans cette version ; une case vide ne prouve pas un montant nul.',
    previous: 'Précédent', current: 'Présent', cumulative: 'Cumulé', sourceSummary: 'Précédent et cumulé de la pièce sélectionnée',
    summaryNote: 'Cumuls indiqués par cette version de la pièce. Ils peuvent différer de versions historiques révisées ultérieurement ; voir le périmètre de l’avance n°0 dans la source.',
    includeAdvance: 'Ce cumul de la pièce inclut l’avance du décompte n°0.', items: 'Mesures et travaux restant à mesurer', search: 'Rechercher un prix ou une désignation',
    code: 'N° de prix source', designation: 'Désignation / unité', price: 'Prix unitaire HT', quantity: 'Quantité', amount: 'Montant travaux HT',
    noLines: 'Aucun détail de prix conservé dans cette version.', noMatches: 'Aucun détail correspondant.', evidence: 'Références sources',
    versions: 'Historique des versions', reason: 'Motif / justification', created: 'Date d’archivage', activate: 'Utiliser cette version',
    activateTitle: 'Choisir la version officielle', activateHelp: 'Sélectionnez la version dont la pièce a été vérifiée. L’historique, les calculs de travail et les étapes financières restent conservés.',
    activationReason: 'Justification de ce choix', activateSubmit: 'Confirmer le choix', cancel: 'Annuler', busy: 'Enregistrement…',
    archive: 'Archiver / nouvelle révision', archiveTitle: 'Archiver une nouvelle version depuis les calculs de travail',
    archiveHelp: 'Le détail est figé depuis les calculs de travail, sans lecture automatique des quantités du PDF/Excel. Vérifiez chaque ligne avec l’original, saisissez les montants signés et associez les pièces. Ce n’est pas une signature électronique.',
    existingFiles: 'Chercher les pièces déjà associées', fileId: 'ID du fichier', pickPdf: 'Choisir comme PDF signé', pickExcel: 'Choisir comme calcul Excel',
    noFiles: 'Aucune pièce correspondante. Modifiez la recherche ou vérifiez les associations dans le centre de fichiers.', fileLookupError: 'Impossible de charger les pièces associées.',
    optional: 'Facultatif', decimalHelp: 'Montants en FCFA, point décimal. Ne modifiez pas les quantités pour équilibrer un montant.',
    reuseFiles: 'Réutiliser les pièces archivées de ce décompte', choosePdf: 'PDF signé original', chooseExcel: 'Calcul Excel original',
    autoFile: 'Réutiliser la pièce principale associée', otherFiles: 'Rechercher d’autres pièces archivées', advancedFiles: 'Avancé : préciser un ID de fichier (facultatif)',
    fileSearch: 'Rechercher par nom de fichier', findFiles: 'Rechercher les fichiers',
    deductionsHelp: 'Saisissez les retenues et récupérations en positif ; leur effet sera négatif. Restitution positive ; autres ajustements avec leur signe réel.',
    confirmSource: 'J’ai vérifié les signatures existantes du PDF, les quantités détaillées et les montants indiqués ; le nom du fichier ne constitue pas une preuve de signature.',
    activateOnSave: 'Utiliser cette version comme version officielle actuelle', saveDraft: 'Conserver le calcul de travail', saveSigned: 'Archiver la version signée',
    saved: 'Nouvelle version conservée', activated: 'Version officielle actualisée', saveError: 'Échec de l’enregistrement',
    requiredTotals: 'Pour une version signée, indiquez les quatre totaux et confirmez la vérification du PDF.', invalidDecimal: 'Saisissez un montant décimal valide.',
    requiredPeriod: 'Saisissez un numéro entier supérieur à 0 ; l’avance n°0 est distincte des décomptes de travaux.', requiredReason: 'Indiquez le motif d’archivage ou de révision.',
    advance: 'Récupération d’avance', retention: 'Retenue de garantie', refund: 'Restitution de garantie', material: 'Déduction matériaux', other: 'Autre ajustement',
    source: 'Pièces et observations de vérification', historyReason: 'Aucun motif détaillé', noOriginal: 'Pièce non associée',
    reconciliation: 'Rapprochement du calcul et de la pièce', reconciliationHelp: 'Les montants de la pièce restent conservés. Aucun écart ne modifie les quantités ni ne crée un ajustement fictif.',
    grossDifference: 'Écart détail / brut HT', netDifference: 'Écart net HT', vatDifference: 'Écart TVA', ttcDifference: 'Écart net TTC',
    signedValue: 'Valeur de la pièce', calculatedValue: 'Valeur recalculée', difference: 'Calcul moins pièce',
    incompleteAmounts: 'Des montants de lignes restent vides ; le rapprochement n’est pas établi. Total des montants connus', missingAmounts: 'Lignes sans montant',
  },
}

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-200'
const buttonClass = 'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-50'

// Formatting only: signed decimal strings never pass through Number/Math.round.
export function formatSourceDecimal(value: string | null | undefined, locale: Locale) {
  if (value === null || value === undefined || value === '') return '—'
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return value
  const [whole, fraction] = value.split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'fr' ? '\u202f' : ',')
  return fraction ? `${grouped}${locale === 'fr' ? ',' : '.'}${fraction}` : grouped
}

function Evidence({ value, label, onOpenFile }: { value: unknown; label: string; onOpenFile?: (fileId: number) => void }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const source = value as Record<string, unknown>
  const sheet = typeof source.sheet === 'string' ? source.sheet : null
  const row = typeof source.sourceRow === 'number' ? source.sourceRow : null
  const page = typeof source.page === 'number' ? source.page : null
  const locator = [sheet ? `${sheet}${row === null ? '' : ` · ${row}`}` : null, page === null ? null : `PDF · p.${page}`].filter(Boolean).join(' · ')
  if (!locator) return null
  return <p className="mt-2 text-xs text-slate-500">{label}：{typeof source.fileId === 'number' && onOpenFile ? <button type="button" className="text-emerald-800 underline" onClick={() => onOpenFile(source.fileId as number)}>{locator}</button> : locator}</p>
}

function emptyForm(period: string, revision?: SignedBillRevisionDto): ArchiveForm {
  const adjustment = (kind: SignedBillAdjustment['kind']) => {
    const effect = revision?.adjustments.find((item) => item.kind === kind)?.effectHt ?? ''
    return effect.startsWith('-') ? effect.slice(1) : effect
  }
  return {
    periodIndex: period, signedAt: '', signedPdfFileId: String(revision?.signedPdfFileId ?? ''),
    calculationFileId: String(revision?.calculationFileId ?? ''), grossHt: revision?.grossHt ?? '',
    netHt: revision?.netHt ?? '', vatAmount: revision?.vatAmount ?? '', netTtc: revision?.netTtc ?? '',
    advanceRecovery: adjustment('ADVANCE_RECOVERY'), retentionWithheld: adjustment('RETENTION_WITHHELD'),
    retentionRelease: adjustment('RETENTION_RELEASE'), materialDeduction: adjustment('MATERIAL_DEDUCTION'),
    otherAdjustment: revision?.adjustments.find((item) => item.kind === 'OTHER')?.effectHt ?? '',
    changeReason: '', confirmed: false, activate: false, reusePeriodFiles: true,
  }
}

export function SignedBillsPanel({ projectId, projectName, locale, initialPeriod, initialRevisionId }: Props) {
  const t = text[locale]
  const { addToast } = useToast()
  const [revisions, setRevisions] = useState<SignedBillRevisionDto[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [period, setPeriod] = useState(initialPeriod ?? '')
  const [previewId, setPreviewId] = useState<number | null>(initialRevisionId ?? null)
  const [search, setSearch] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [form, setForm] = useState<ArchiveForm>(() => emptyForm('1'))
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [periodFiles, setPeriodFiles] = useState<PeriodFile[]>([])
  const [fileLookupStatus, setFileLookupStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [fileSearch, setFileSearch] = useState('')
  const [activation, setActivation] = useState<SignedBillRevisionDto | null>(null)
  const [activationReason, setActivationReason] = useState('')
  const [activationConfirmed, setActivationConfirmed] = useState(false)
  const fileLookupController = useRef<AbortController | null>(null)

  useEffect(() => () => fileLookupController.current?.abort(), [])

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/value/signed-bills?projectId=${projectId}`, { credentials: 'include', signal })
      const payload = await response.json() as { revisions?: SignedBillRevisionDto[]; message?: string }
      if (!response.ok) throw new Error(payload.message ?? t.loadError)
      if (signal?.aborted) return
      const rows = payload.revisions ?? []
      setRevisions(rows)
      setPeriod((previous) => {
        if (rows.some((row) => String(row.periodIndex) === previous)) return previous
        const official = rows.filter((row) => row.isCurrent && row.status === 'SIGNED')
        const candidates = official.length ? official : rows
        return candidates.length ? String(Math.max(...candidates.map((row) => row.periodIndex))) : ''
      })
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : t.loadError)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [projectId, t.loadError])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/auth/session', { credentials: 'include', signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: { user?: { permissions?: string[] } } | null) => {
        if (!controller.signal.aborted) setCanEdit(payload?.user?.permissions?.includes('value:update') ?? false)
      }).catch(() => {})
    return () => controller.abort()
  }, [])

  const periods = useMemo(() => Array.from(new Set(revisions.map((row) => row.periodIndex))).sort((a, b) => b - a), [revisions])
  const periodRevisions = useMemo(() => revisions.filter((row) => String(row.periodIndex) === period).sort((a, b) => b.revision - a.revision), [period, revisions])
  const current = periodRevisions.find((row) => row.isCurrent && row.status === 'SIGNED')
  const selected = periodRevisions.find((row) => row.id === previewId) ?? current ?? periodRevisions[0]
  const netLabel = selected?.status === 'DRAFT' ? (locale === 'fr' ? 'Net à payer HT de travail' : '编制净应付 HT') : t.net
  const ttcLabel = selected?.status === 'DRAFT' ? (locale === 'fr' ? 'Net à payer TTC de travail' : '编制净应付 TTC') : t.ttc
  const officialCount = revisions.filter((row) => row.isCurrent && row.status === 'SIGNED').length
  const reconciliationRows = selected ? [
    { label: t.gross, original: selected.grossHt, computed: selected.reconciliation.lineAmountTotal, difference: selected.reconciliation.lineGrossDifferenceHt },
    { label: netLabel, original: selected.netHt, computed: selected.reconciliation.computedNetHt, difference: selected.reconciliation.netHtDifference },
    { label: t.vat, original: selected.vatAmount, computed: selected.reconciliation.computedVatAmount, difference: selected.reconciliation.vatDifference },
    { label: ttcLabel, original: selected.netTtc, computed: selected.reconciliation.computedNetTtc, difference: selected.reconciliation.netTtcDifference },
  ] : []
  const hasReconciliationDifference = reconciliationRows.some((row) => row.difference !== null && !/^-?0+(?:\.0+)?$/.test(row.difference))
  const fileCenterUrl = projectId && period ? `/documents/files?category=measurement&entityType=boq-bill-period&entityId=${encodeURIComponent(`${projectId}:${period}`)}` : '/documents/files?category=measurement'

  const openFile = async (fileId: number) => {
    try {
      const response = await fetch(`/api/files/${fileId}?includeUrl=1`, { credentials: 'include' })
      const payload = await response.json() as { file?: { url?: string }; message?: string }
      if (!response.ok || !payload.file?.url) throw new Error(payload.message ?? t.fileError)
      const anchor = document.createElement('a')
      anchor.href = payload.file.url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } catch (cause) { addToast(cause instanceof Error ? cause.message : t.fileError, { tone: 'danger' }) }
  }

  const lookupFiles = useCallback(async () => {
    if (!projectId || !/^\d+$/.test(form.periodIndex)) return
    fileLookupController.current?.abort()
    const controller = new AbortController()
    fileLookupController.current = controller
    setFileLookupStatus('loading')
    try {
      const scope = form.reusePeriodFiles ? `&entityType=boq-bill-period&entityId=${encodeURIComponent(`${projectId}:${form.periodIndex}`)}` : ''
      const response = await fetch(`/api/files?category=measurement${scope}&search=${encodeURIComponent(fileSearch)}&pageSize=200`, { credentials: 'include', signal: controller.signal })
      const payload = await response.json() as { items?: PeriodFile[]; message?: string }
      if (!response.ok) throw new Error(payload.message ?? t.fileLookupError)
      if (controller.signal.aborted) return
      setPeriodFiles((payload.items ?? []).filter((file) => file.mimeType === 'application/pdf' || file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel')))
      setFileLookupStatus('done')
    } catch { if (!controller.signal.aborted) setFileLookupStatus('error') }
  }, [projectId, form.periodIndex, form.reusePeriodFiles, fileSearch, t.fileLookupError])

  useEffect(() => {
    if (showArchive) void lookupFiles()
    return () => fileLookupController.current?.abort()
  }, [lookupFiles, showArchive])

  const saveRevision = async (signed: boolean) => {
    if (!projectId) return
    setFormError(null)
    if (!/^\d+$/.test(form.periodIndex) || Number(form.periodIndex) < 1) { setFormError(t.requiredPeriod); return }
    if (!form.changeReason.trim()) { setFormError(t.requiredReason); return }
    const decimalFields = [form.grossHt, form.netHt, form.vatAmount, form.netTtc, form.advanceRecovery, form.retentionWithheld, form.retentionRelease, form.materialDeduction, form.otherAdjustment]
    if (decimalFields.some((value) => value !== '' && !/^-?\d+(?:\.\d+)?$/.test(value.trim()))) { setFormError(t.invalidDecimal); return }
    if (signed && (!form.confirmed || (!form.signedPdfFileId && !form.reusePeriodFiles) || [form.grossHt, form.netHt, form.vatAmount, form.netTtc].some((value) => !value.trim()))) { setFormError(t.requiredTotals); return }
    const adjustmentInputs: Array<[string, SignedBillAdjustment['kind'], string, boolean]> = [
      ['advance', 'ADVANCE_RECOVERY', form.advanceRecovery, true], ['retention', 'RETENTION_WITHHELD', form.retentionWithheld, true],
      ['refund', 'RETENTION_RELEASE', form.retentionRelease, false], ['material', 'MATERIAL_DEDUCTION', form.materialDeduction, true], ['other', 'OTHER', form.otherAdjustment, false],
    ]
    const labels: Record<string, string> = { advance: t.advance, retention: t.retention, refund: t.refund, material: t.material, other: t.other }
    const adjustments = adjustmentInputs.filter(([, , value]) => value.trim() !== '').map(([key, kind, value, deduct]) => ({
      key, kind, label: labels[key], effectHt: deduct ? `-${value.trim().replace(/^-/, '')}` : value.trim(),
    }))
    setSaving(true)
    try {
      const body: CreateSignedBillInput = { projectId, periodIndex: Number(form.periodIndex), status: signed ? 'SIGNED' : 'DRAFT', currency: 'XOF', fromMeasurement: true, reusePeriodFiles: form.reusePeriodFiles,
          signedAt: form.signedAt || null, signedPdfFileId: form.signedPdfFileId ? Number(form.signedPdfFileId) : null,
          calculationFileId: form.calculationFileId ? Number(form.calculationFileId) : null,
          grossHt: form.grossHt.trim() || null, netHt: form.netHt.trim() || null, vatAmount: form.vatAmount.trim() || null, netTtc: form.netTtc.trim() || null,
          adjustments, changeReason: form.changeReason.trim(), isSignedConfirmed: signed && form.confirmed, activate: signed && form.activate,
          expectedCurrentRevisionId: revisions.find((row) => row.periodIndex === Number(form.periodIndex) && row.isCurrent && row.status === 'SIGNED')?.id ?? null,
          source: { verification: signed ? 'Existing PDF signatures and entered document header checked by the archiving user.' : 'Working measurement snapshot; signatures not confirmed.' },
        }
      const response = await fetch('/api/value/signed-bills', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json() as { revision?: SignedBillRevisionDto; message?: string }
      if (!response.ok) throw new Error(payload.message ?? t.saveError)
      setPeriod(form.periodIndex)
      setPreviewId(payload.revision?.id ?? null)
      setShowArchive(false)
      await load()
      addToast(t.saved, { tone: 'success' })
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : t.saveError) } finally { setSaving(false) }
  }

  const activateRevision = async (event: FormEvent) => {
    event.preventDefault()
    if (!activation || !activationReason.trim() || !activationConfirmed) return
    setSaving(true)
    setFormError(null)
    try {
      const expectedCurrent = revisions.find((row) => row.periodIndex === activation.periodIndex && row.isCurrent && row.status === 'SIGNED')
      const response = await fetch(`/api/value/signed-bills/${activation.id}/activate`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedCurrentRevisionId: expectedCurrent?.id ?? null, reason: activationReason.trim() }) })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message ?? t.saveError)
      setPreviewId(null)
      setActivation(null)
      await load()
      addToast(t.activated, { tone: 'success' })
    } catch (cause) { setFormError(cause instanceof Error ? cause.message : t.saveError) } finally { setSaving(false) }
  }

  const editField = <K extends keyof ArchiveForm>(key: K, value: ArchiveForm[K]) => setForm((previous) => ({
    ...previous, [key]: value,
    ...(key !== 'confirmed' && key !== 'activate' && key !== 'changeReason' ? { confirmed: false } : {}),
  }))
  const adjustmentLabels: Record<SignedBillAdjustment['kind'], string> = { ADVANCE_RECOVERY: t.advance, RETENTION_WITHHELD: t.retention, RETENTION_RELEASE: t.refund, MATERIAL_DEDUCTION: t.material, OTHER: t.other }

  return <section className="space-y-5 p-6" aria-label={t.title}>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold text-slate-900">{t.title}</h2><p className="mt-1 text-sm text-slate-600">{t.description}</p><p className="mt-1 text-xs text-slate-500">{officialCount} {t.currentCount}</p></div>
      {canEdit && projectId ? <button type="button" className={buttonClass} onClick={() => { setForm(emptyForm(period || '1', selected)); setFormError(null); setPeriodFiles([]); setFileSearch(''); setFileLookupStatus('idle'); setShowArchive(true) }}>{t.archive}</button> : null}
    </div>
    {!projectId ? <p className="text-sm text-slate-500">{t.selectProject}</p> : loading ? <p role="status" className="text-sm text-slate-500">{t.loading}</p> : error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error} <button type="button" onClick={() => void load()} className="ml-3 underline">{t.retry}</button></div> : !selected ? <p className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-600">{t.empty}</p> : <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <label className="text-sm font-semibold text-slate-700"><span className="mb-1 block">{t.period}</span><select className={inputClass} value={period} onChange={(event) => { setPeriod(event.target.value); setPreviewId(null); setSearch('') }}>{periods.map((index) => <option key={index} value={index}>{locale === 'fr' ? `Décompte n°${index}` : `第${index}期`}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-2 text-sm"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${selected.isCurrent ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{selected.isCurrent && selected.status === 'SIGNED' ? t.latest : selected.status === 'DRAFT' ? t.draft : t.history} · {t.version} {selected.revision}</span><span className="text-slate-500">{t.signedDate}：{selected.signedAt?.slice(0, 10) ?? t.unknownDate}</span></div>
      </div>
      {!selected.isCurrent || selected.status !== 'SIGNED' ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{t.previewNote}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{([[t.gross, selected.grossHt], [netLabel, selected.netHt], [t.vat, selected.vatAmount], [ttcLabel, selected.netTtc]] as const).map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-slate-500">{label}</p><p className="mt-2 break-words text-2xl font-semibold tabular-nums text-slate-900">{formatSourceDecimal(value, locale)}</p><p className="mt-1 text-xs text-slate-400">{selected.currency}</p></div>)}</div>
      <p className="text-xs text-slate-500">{t.sourceTotals}</p>
      <div className="flex flex-wrap gap-2">{selected.signedPdfFileId ? <button className={buttonClass} type="button" onClick={() => void openFile(selected.signedPdfFileId!)}>{t.pdf}</button> : <span className="py-2 text-xs text-slate-400">PDF：{t.noOriginal}</span>}{selected.calculationFileId ? <button className={buttonClass} type="button" onClick={() => void openFile(selected.calculationFileId!)}>{t.excel}</button> : null}<a className={buttonClass} href={fileCenterUrl} target="_blank" rel="noreferrer">{t.files}</a></div>
      <div className="rounded-2xl border border-slate-200 p-4"><h3 className="text-sm font-semibold text-slate-900">{t.adjustments}</h3>{selected.adjustments.length ? <dl className="mt-3 divide-y divide-slate-100">{selected.adjustments.map((adjustment) => <div key={adjustment.key} className="flex flex-wrap justify-between gap-2 py-2"><dt className="text-sm text-slate-600">{adjustmentLabels[adjustment.kind]}{adjustment.label && adjustment.label !== adjustmentLabels[adjustment.kind] ? ` · ${adjustment.label}` : ''}<Evidence value={adjustment.evidence} label={t.evidence} onOpenFile={(fileId) => void openFile(fileId)} /></dt><dd className="text-right text-sm font-semibold tabular-nums text-slate-900">{formatSourceDecimal(adjustment.effectHt, locale)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-slate-500">{t.adjustmentEmpty}</p>}</div>
      <details className={`rounded-2xl border p-4 ${hasReconciliationDifference ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200'}`} open={hasReconciliationDifference}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">{t.reconciliation}</summary>
        <p className="mt-3 text-xs text-slate-500">{t.reconciliationHelp}</p>
        {selected.reconciliation.missingLineAmountCount > 0 ? <p className="mt-2 text-xs text-amber-800">{t.incompleteAmounts}：{formatSourceDecimal(selected.reconciliation.knownLineAmountTotal, locale)} HT；{t.missingAmounts}：{selected.reconciliation.missingLineAmountCount}。</p> : null}
        <div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="py-2 text-left">HT / TVA / TTC</th><th className="px-3 py-2 text-right">{t.signedValue}</th><th className="px-3 py-2 text-right">{t.calculatedValue}</th><th className="px-3 py-2 text-right">{t.difference}</th></tr></thead><tbody>{reconciliationRows.map((row) => <tr key={row.label} className="border-b border-slate-100"><th className="py-2 text-left font-medium text-slate-600">{row.label}</th>{[row.original, row.computed, row.difference].map((value, index) => <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums" key={index}>{formatSourceDecimal(value, locale)}</td>)}</tr>)}</tbody></table></div>
      </details>
      <details className="rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-900">{t.sourceSummary}</summary><div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b border-slate-100 text-left text-xs text-slate-500"><th className="py-2 pr-4">{t.amount}</th><th className="px-4 py-2 text-right">{t.previous}</th><th className="px-4 py-2 text-right">{t.current}</th><th className="px-4 py-2 text-right">{t.cumulative}</th></tr></thead><tbody>{([[t.gross, selected.summary.previousGrossHt, selected.grossHt, selected.summary.cumulativeGrossHt], [netLabel, selected.summary.previousNetHt, selected.netHt, selected.summary.cumulativeNetHt], [ttcLabel, selected.summary.previousNetTtc, selected.netTtc, selected.summary.cumulativeNetTtc]] as const).map(([label, previous, present, cumulative]) => <tr key={label} className="border-b border-slate-50"><th className="py-2 pr-4 text-left font-medium text-slate-600">{label}</th>{[previous, present, cumulative].map((value, index) => <td key={index} className="px-4 py-2 text-right tabular-nums">{formatSourceDecimal(value, locale)}</td>)}</tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">{t.summaryNote} {selected.summary.includesAdvancePeriodZero ? t.includeAdvance : ''}</p></details>
      <div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-sm font-semibold text-slate-900">{t.items} ({selected.lines.length})</h3><input className={`${inputClass} sm:max-w-xs`} aria-label={t.search} type="search" placeholder={t.search} value={search} onChange={(event) => setSearch(event.target.value)} /></div><SignedBillCalculationRows key={selected.id} revision={selected} locale={locale} search={search} canEdit={canEdit} formatValue={(value) => formatSourceDecimal(value, locale)} onOpenFile={(fileId) => void openFile(fileId)} /></div>
      <details className="rounded-2xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-900">{t.source}</summary><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{selected.changeReason || t.historyReason}</p><ul className="mt-3 space-y-2 text-xs text-slate-500">{selected.source.notes?.map((note, index) => <li className="whitespace-pre-wrap" key={index}>{note}</li>)}</ul></details>
      <div><h3 className="mb-3 text-sm font-semibold text-slate-900">{t.versions}</h3><div className="space-y-2">{periodRevisions.map((revision) => <div key={revision.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${revision.id === selected.id ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200'}`}><button className="min-w-0 flex-1 text-left" type="button" onClick={() => setPreviewId(revision.id)}><span className="text-sm font-semibold text-slate-800">{t.version} {revision.revision} · {revision.isCurrent && revision.status === 'SIGNED' ? t.latest : revision.status === 'DRAFT' ? t.draft : t.history}</span><span className="mt-1 block text-xs text-slate-500">{t.created}：{revision.createdAt.slice(0, 19).replace('T', ' ')} UTC</span><span className="mt-1 block whitespace-pre-wrap text-xs text-slate-600">{revision.changeReason || t.historyReason}</span></button>{canEdit && revision.status === 'SIGNED' && !revision.isCurrent ? <button className={buttonClass} type="button" onClick={() => { setActivation(revision); setActivationReason(''); setActivationConfirmed(false); setFormError(null) }}>{t.activate}</button> : null}</div>)}</div></div>
    </>}
    <Modal open={showArchive} title={t.archiveTitle} subtitle={`${projectName} · ${t.archiveHelp}`} onClose={() => { if (!saving) setShowArchive(false) }} widthClassName="max-w-3xl">
      <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void saveRevision(true) }}>
        <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">{t.period}<input type="number" min={1} step={1} required className={`mt-1 ${inputClass}`} value={form.periodIndex} onChange={(event) => { fileLookupController.current?.abort(); setForm(emptyForm(event.target.value, revisions.find((row) => String(row.periodIndex) === event.target.value && row.isCurrent))); setPeriodFiles([]); setFileLookupStatus('idle') }} /></label><label className="text-sm font-semibold text-slate-700">{t.signedDate} ({t.optional})<input type="date" className={`mt-1 ${inputClass}`} value={form.signedAt} onChange={(event) => editField('signedAt', event.target.value)} /></label></div>
        <div className="space-y-3 rounded-xl border border-slate-200 p-4">
          <label className="flex items-start gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" className="mt-1" checked={form.reusePeriodFiles} onChange={(event) => { editField('reusePeriodFiles', event.target.checked); setPeriodFiles([]); setFileSearch('') }} /><span>{t.reuseFiles}</span></label>
          {!form.reusePeriodFiles ? <label className="block text-xs text-slate-600">{t.fileSearch}<input className={`mt-1 ${inputClass}`} type="search" placeholder={t.otherFiles} value={fileSearch} onChange={(event) => setFileSearch(event.target.value)} /></label> : null}
          <div className="grid gap-4 sm:grid-cols-2">{([['signedPdfFileId', t.choosePdf, true], ['calculationFileId', t.chooseExcel, false]] as const).map(([key, label, pdf]) => {
            const candidates = periodFiles.filter((file) => pdf ? file.mimeType === 'application/pdf' : file.mimeType !== 'application/pdf')
            const selectedFile = revisions.flatMap((revision) => revision.files).find((file) => String(file.id) === form[key])
            return <label key={key} className="text-sm font-semibold text-slate-700">{label}<select className={`mt-1 ${inputClass}`} value={form[key]} onChange={(event) => editField(key, event.target.value)}><option value="">{form.reusePeriodFiles ? t.autoFile : t.optional}</option>{form[key] && !candidates.some((file) => String(file.id) === form[key]) ? <option value={form[key]}>{selectedFile?.originalName ?? t.noOriginal}</option> : null}{candidates.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}</select></label>
          })}</div>
          {fileLookupStatus === 'loading' ? <p className="text-xs text-slate-500" role="status">{t.loading}</p> : fileLookupStatus === 'error' ? <p className="text-sm text-rose-700">{t.fileLookupError} <button className="underline" type="button" onClick={() => void lookupFiles()}>{t.retry}</button></p> : fileLookupStatus === 'done' && !periodFiles.length ? <p className="text-xs text-slate-500">{t.noFiles}</p> : null}
          <details className="text-xs text-slate-500"><summary className="cursor-pointer">{t.advancedFiles}</summary><div className="mt-2 grid gap-3 sm:grid-cols-2">{([['signedPdfFileId', t.choosePdf], ['calculationFileId', t.chooseExcel]] as const).map(([key, label]) => <label key={key}>{label} · {t.fileId}<input type="number" min={1} step={1} className={`mt-1 ${inputClass}`} value={form[key]} onChange={(event) => editField(key, event.target.value)} /></label>)}</div></details>
        </div>
        <div><p className="mb-2 text-xs text-slate-500">{t.decimalHelp}</p><div className="grid gap-4 sm:grid-cols-2">{([['grossHt', t.gross], ['netHt', t.net], ['vatAmount', t.vat], ['netTtc', t.ttc]] as const).map(([key, label]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}<input inputMode="decimal" className={`mt-1 ${inputClass}`} value={form[key]} onChange={(event) => editField(key, event.target.value)} /></label>)}</div></div>
        <details className="rounded-xl border border-slate-200 p-3" open><summary className="cursor-pointer text-sm font-semibold text-slate-700">{t.adjustments}</summary><p className="my-2 text-xs text-slate-500">{t.deductionsHelp}</p><div className="grid gap-3 sm:grid-cols-2">{([['advanceRecovery', t.advance], ['retentionWithheld', t.retention], ['retentionRelease', t.refund], ['materialDeduction', t.material], ['otherAdjustment', t.other]] as const).map(([key, label]) => <label key={key} className="text-xs font-semibold text-slate-600">{label}<input inputMode="decimal" className={`mt-1 ${inputClass}`} placeholder={t.optional} value={form[key]} onChange={(event) => editField(key, event.target.value)} /></label>)}</div></details>
        <label className="block text-sm font-semibold text-slate-700">{t.reason}<textarea required rows={3} className={`mt-1 ${inputClass}`} value={form.changeReason} onChange={(event) => editField('changeReason', event.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm text-slate-700"><input className="mt-1" type="checkbox" checked={form.confirmed} onChange={(event) => editField('confirmed', event.target.checked)} /><span>{t.confirmSource}</span></label><label className="flex items-start gap-2 text-sm text-slate-700"><input className="mt-1" type="checkbox" checked={form.activate} onChange={(event) => editField('activate', event.target.checked)} /><span>{t.activateOnSave}</span></label>
        {formError ? <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{formError}</p> : null}<div className="flex flex-wrap justify-end gap-2"><button type="button" className={buttonClass} disabled={saving} onClick={() => setShowArchive(false)}>{t.cancel}</button><button type="button" className={buttonClass} disabled={saving} onClick={() => void saveRevision(false)}>{saving ? t.busy : t.saveDraft}</button><button type="submit" disabled={saving || !form.confirmed} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? t.busy : t.saveSigned}</button></div>
      </form>
    </Modal>
    <Modal open={activation !== null} title={t.activateTitle} subtitle={t.activateHelp} onClose={() => { if (!saving) setActivation(null) }} widthClassName="max-w-xl"><form className="space-y-4" onSubmit={(event) => void activateRevision(event)}><p className="text-sm font-semibold text-slate-800">{projectName} · {t.period} {activation?.periodIndex} · {t.version} {activation?.revision}</p><p className="text-sm text-slate-700">{t.ttc}：{formatSourceDecimal(activation?.netTtc, locale)} {activation?.currency}</p><label className="block text-sm text-slate-700">{t.activationReason}<textarea required rows={3} className={`mt-1 ${inputClass}`} value={activationReason} onChange={(event) => setActivationReason(event.target.value)} /></label><label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={activationConfirmed} onChange={(event) => setActivationConfirmed(event.target.checked)} /><span>{t.confirmSource}</span></label>{formError ? <p role="alert" className="text-sm text-rose-700">{formError}</p> : null}<div className="flex justify-end gap-2"><button type="button" className={buttonClass} disabled={saving} onClick={() => setActivation(null)}>{t.cancel}</button><button type="submit" disabled={saving || !activationReason.trim() || !activationConfirmed} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? t.busy : t.activateSubmit}</button></div></form></Modal>
  </section>
}
