'use client'

import { FinanceLedgerCaseStatus, FinanceLedgerStage } from '@prisma/client'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import { useToast } from '@/components/ToastProvider'
import {
  DEFAULT_FINANCE_LEDGER_SORT_STACK,
  FINANCE_LEDGER_STAGES,
  type FinanceLedgerSortField,
  type FinanceLedgerSortSpec,
} from '@/lib/finance/ledgerConstants'
import { locales, type Locale } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
}

type LedgerProject = {
  id: number
  name: string
  code: string | null
}

type LedgerEvent = {
  id: number
  caseId: number
  stage: FinanceLedgerStage
  occurredAt: string
  note: string | null
  payload: Record<string, unknown>
  createdBy: number | null
  updatedBy: number | null
  createdAt: string
  updatedAt: string
}

type LedgerCase = {
  id: number
  sequence: number
  projectId: number
  projectName: string
  projectCode: string | null
  periodIndex: number
  status: FinanceLedgerCaseStatus
  currentStage: FinanceLedgerStage | null
  nextStage: FinanceLedgerStage | null
  enteredCurrentStageAt: string | null
  accountAmount: number | null
  invoiceAmount: number | null
  advanceAmount: number | null
  chequeAmount: number | null
  invoiceNumber: string | null
  receiptChequeNumber: string | null
  remark: string | null
  constructionStartedAt: string | null
  constructionFinishedAt: string | null
  waitingDays: number
  overdueDays: number
  isOverdue: boolean
  cycleDays: number | null
  stageDates: Record<FinanceLedgerStage, string | null>
  events: LedgerEvent[]
  createdAt: string
  updatedAt: string
}

type LedgerInsights = {
  summary: {
    caseCount: number
    totalAccountAmount: number
    totalInvoiceAmount: number
    totalChequeAmount: number
    receiptRate: number
    averageCycleDays: number
    overdueCount: number
  }
  stageFunnel: {
    stage: FinanceLedgerStage
    count: number
    amount: number
  }[]
  projectProgress: {
    projectId: number
    projectName: string
    projectCode: string | null
    stageCounts: { stage: FinanceLedgerStage; count: number; amount: number }[]
  }[]
  monthlyFlow: {
    month: string
    invoiceAmount: number
    chequeAmount: number
    cumulativeInvoiceAmount: number
    cumulativeChequeAmount: number
  }[]
  agingBuckets: {
    bucket: '0-7' | '8-15' | '16-30' | '31-60' | '60+'
    count: number
    amount: number
  }[]
  transitionStats: {
    fromStage: FinanceLedgerStage
    toStage: FinanceLedgerStage
    count: number
    averageDays: number
    p90Days: number
    slaDays: number
    overdueCount: number
    overdueRate: number
    impactAmount: number
    overdueImpactAmount: number
  }[]
  bottlenecks: {
    fromStage: FinanceLedgerStage
    toStage: FinanceLedgerStage
    count: number
    averageDays: number
    p90Days: number
    slaDays: number
    overdueCount: number
    overdueRate: number
    impactAmount: number
    overdueImpactAmount: number
  }[]
}

type LedgerMetadata = {
  projects: LedgerProject[]
  stages: FinanceLedgerStage[]
  statuses: FinanceLedgerCaseStatus[]
}

type LedgerFilters = {
  projectId: string
  status: 'all' | FinanceLedgerCaseStatus
  stage: 'all' | FinanceLedgerStage
  overdue: 'all' | 'true' | 'false'
  search: string
  page: number
  pageSize: number
  sortStack: FinanceLedgerSortSpec[]
}

type LedgerCreateForm = {
  projectId: string
  periodIndex: string
}

type LedgerCaseForm = {
  status: FinanceLedgerCaseStatus
  accountAmount: string
  invoiceAmount: string
  advanceAmount: string
  chequeAmount: string
  invoiceNumber: string
  receiptChequeNumber: string
  remark: string
  constructionStartedAt: string
  constructionFinishedAt: string
  stageDates: Record<FinanceLedgerStage, string>
}

type LedgerEventForm = {
  stage: FinanceLedgerStage
  occurredAt: string
  note: string
  accountAmount: string
  invoiceAmount: string
  advanceAmount: string
  chequeAmount: string
  invoiceNumber: string
  receiptChequeNumber: string
  remark: string
}

type PageTab = 'liste' | 'progression' | 'delais'

type LedgerListColumnKey =
  | 'sequence'
  | 'project'
  | 'period'
  | 'constructionStartedAt'
  | 'constructionFinishedAt'
  | 'stage'
  | 'accountAmount'
  | 'invoiceAmount'
  | 'chequeAmount'
  | 'waitingDays'
  | 'overdueDays'
  | 'remark'
  | 'updatedAt'

const pageSizeOptions = [10, 20, 50, 100]
const LEDGER_COLUMN_STORAGE_KEY = 'finance-ledger-visible-columns'
const LEDGER_ACTION_COLUMN_MIN_WIDTH = 72
const LEDGER_MIN_TABLE_WIDTH = 720
const ledgerColumnKeys: LedgerListColumnKey[] = [
  'sequence',
  'project',
  'period',
  'constructionStartedAt',
  'constructionFinishedAt',
  'stage',
  'accountAmount',
  'invoiceAmount',
  'chequeAmount',
  'waitingDays',
  'overdueDays',
  'remark',
  'updatedAt',
]
const defaultVisibleLedgerColumns: LedgerListColumnKey[] = ledgerColumnKeys.filter((key) => key !== 'remark')
const ledgerColumnMinWidthMap: Record<LedgerListColumnKey, number> = {
  sequence: 56,
  project: 150,
  period: 58,
  constructionStartedAt: 96,
  constructionFinishedAt: 96,
  stage: 92,
  accountAmount: 92,
  invoiceAmount: 92,
  chequeAmount: 92,
  waitingDays: 72,
  overdueDays: 84,
  remark: 140,
  updatedAt: 112,
}

const containsCjk = (value: string) => /[\u3400-\u9fff]/.test(value)

const humanizeIdentifier = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const frProjectNameByCode: Record<string, string> = {
  'project-bondoukou-city': 'Projet municipal de Bondoukou',
  'project-bondoukou-border': 'Projet frontalier de Bondoukou',
  'project-bondoukou-supply': "Projet d'approvisionnement de Bondoukou",
  'project-tanda-city': 'Projet municipal de Tanda',
  'project-anibilekrou-city': "Projet municipal d'Agnibilékrou",
  'project-abidjan-office': "Bureau d'Abidjan",
}

const stageLabels: Record<Locale, Record<FinanceLedgerStage, string>> = {
  fr: {
    SITE_SIGNED: 'Signature site PTO',
    HQ_BILL_RECEIVED: 'Réception décompte siège',
    BE_CONFIRMED: 'BE confirmé',
    BE_DELIVERED: 'BE transmis',
    HQ_INVOICE_RECEIVED: 'Réception facture siège',
    CHEQUE_ISSUED: 'Chèque émis',
    CHEQUE_RECEIVED: 'Chèque reçu',
  },
  zh: {
    SITE_SIGNED: 'PTO 现场签字',
    HQ_BILL_RECEIVED: '总部收到账单',
    BE_CONFIRMED: 'BE 确认',
    BE_DELIVERED: 'BE 送达',
    HQ_INVOICE_RECEIVED: '总部收票',
    CHEQUE_ISSUED: '支票开具',
    CHEQUE_RECEIVED: '支票收款',
  },
}

const statusLabels: Record<Locale, Record<FinanceLedgerCaseStatus, string>> = {
  fr: {
    IN_PROGRESS: 'En cours',
    DONE: 'Terminé',
    BLOCKED: 'Bloqué',
  },
  zh: {
    IN_PROGRESS: '进行中',
    DONE: '已完成',
    BLOCKED: '阻塞',
  },
}

const ledgerText: Record<
  Locale,
  {
    projectFallbackPrefix: string
    metadataLoadError: string
    listLoadError: string
    insightsLoadError: string
    detailLoadError: string
    requiredProjectPeriod: string
    invalidPeriod: string
    invalidAmount: string
    invalidConstructionRange: string
    invalidStageSequence: string
    invalidStageChronology: string
    requiredDate: string
    createCaseFailed: string
    updateCaseFailed: string
    deleteCaseFailed: string
    saveStageFailed: string
    createCaseSuccess: string
    updateCaseSuccess: string
    deleteCaseSuccess: string
    saveStageSuccess: string
    deleteCaseConfirm: (sequence: number) => string
    accessDeniedHint: string
    breadcrumbHome: string
    breadcrumbFinance: string
    breadcrumbLedger: string
    pageTitle: string
    pageSubtitle: string
    tabEntries: string
    tabLedger: string
    listTab: string
    progressionTab: string
    delaysTab: string
    createCaseButton: string
    summaryCases: string
    summaryAccountAmount: string
    summaryInvoiceAmount: string
    summaryChequeAmount: string
    summaryReceiptRate: string
    summaryOverdueCases: string
    labelProject: string
    labelStatus: string
    labelStage: string
    labelOverdue: string
    labelSearch: string
    optionAllProjects: string
    optionAll: string
    optionAllStages: string
    optionOverdue: string
    optionOnTime: string
    searchPlaceholder: string
    applyFilters: string
    resetFilters: string
    columnSelectorLabel: string
    columnSelectorSelected: (count: number) => string
    columnSelectorNone: string
    columnSelectorAll: string
    columnSelectorDefault: string
    columnSelectorClear: string
    colNumber: string
    colPeriod: string
    colConstructionStart: string
    colConstructionEnd: string
    colAccount: string
    colInvoice: string
    colCheque: string
    colWaiting: string
    colRemark: string
    colUpdatedAt: string
    colActions: string
    loading: string
    emptyCases: string
    details: string
    edit: string
    deleting: string
    delete: string
    onTime: string
    dayShort: string
    pagination: (total: number, page: number, totalPages: number) => string
    pageSize: string
    previous: string
    next: string
    analysing: string
    stageFunnel: string
    monthlyFlow: string
    colMonth: string
    colInvoiceCumulative: string
    colChequeCumulative: string
    noData: string
    agingCurrent: string
    transitionsSla: string
    colTransition: string
    colCount: string
    colAverage: string
    colDelayRate: string
    colImpact: string
    daysSuffix: string
    caseLabel: string
    close: string
    timeline: string
    notFilled: string
    fill: string
    createCaseTitle: string
    createCaseSubtitle: string
    none: string
    cancel: string
    creating: string
    create: string
    editCaseTitle: (sequence: number) => string
    accountAmount: string
    invoiceAmount: string
    advanceAmount: string
    chequeAmount: string
    invoiceNumber: string
    receiptChequeNumber: string
    remark: string
    stageNote: string
    constructionStartedAt: string
    constructionFinishedAt: string
    stageDatesTitle: string
    saving: string
    save: string
    editStage: string
    fillStage: string
    stageDate: string
  }
> = {
  fr: {
    projectFallbackPrefix: 'Projet',
    metadataLoadError: 'Impossible de charger les métadonnées',
    listLoadError: 'Impossible de charger la liste',
    insightsLoadError: 'Impossible de charger les analyses',
    detailLoadError: 'Impossible de charger le dossier',
    requiredProjectPeriod: 'Projet et période obligatoires',
    invalidPeriod: 'Période invalide',
    invalidAmount: 'Montant invalide',
    invalidConstructionRange: 'La date de fin des travaux doit être postérieure à la date de début',
    invalidStageSequence: 'Les dates des étapes doivent être remplies dans l’ordre, sans trou',
    invalidStageChronology: 'La date d’une étape ne peut pas être antérieure à son étape précédente',
    requiredDate: 'Date obligatoire',
    createCaseFailed: 'Création impossible',
    updateCaseFailed: 'Mise à jour impossible',
    deleteCaseFailed: 'Suppression impossible',
    saveStageFailed: "Échec de l'enregistrement de l'étape",
    createCaseSuccess: 'Dossier créé',
    updateCaseSuccess: 'Dossier mis à jour',
    deleteCaseSuccess: 'Dossier supprimé',
    saveStageSuccess: 'Étape enregistrée',
    deleteCaseConfirm: (sequence) => `Supprimer le dossier #${sequence} ?`,
    accessDeniedHint: 'Veuillez demander la permission finance:view.',
    breadcrumbHome: 'Accueil',
    breadcrumbFinance: 'Finance',
    breadcrumbLedger: 'Tableau de suivi',
    pageTitle: 'Tableau de suivi des factures et encaissements',
    pageSubtitle: 'Créer un dossier unique par projet+période, puis renseigner les étapes au fil du temps.',
    tabEntries: 'Entrées',
    tabLedger: 'Tableau de suivi',
    listTab: 'Liste',
    progressionTab: 'Progression',
    delaysTab: 'Délais',
    createCaseButton: 'Nouveau dossier',
    summaryCases: 'Dossiers',
    summaryAccountAmount: 'Montant compte',
    summaryInvoiceAmount: 'Montant facture',
    summaryChequeAmount: 'Montant chèque',
    summaryReceiptRate: 'Taux encaissement',
    summaryOverdueCases: 'Dossiers en retard',
    labelProject: 'Projet',
    labelStatus: 'Statut',
    labelStage: 'Étape',
    labelOverdue: 'Retard',
    labelSearch: 'Recherche',
    optionAllProjects: 'Tous les projets',
    optionAll: 'Tous',
    optionAllStages: 'Toutes',
    optionOverdue: 'En retard',
    optionOnTime: 'Dans le délai',
    searchPlaceholder: 'Projet, facture, note…',
    applyFilters: 'Appliquer',
    resetFilters: 'Réinitialiser',
    columnSelectorLabel: 'Colonnes',
    columnSelectorSelected: (count) => `${count} colonnes sélectionnées`,
    columnSelectorNone: 'Aucune colonne',
    columnSelectorAll: 'Tout sélectionner',
    columnSelectorDefault: 'Par défaut',
    columnSelectorClear: 'Tout masquer',
    colNumber: 'Numéro',
    colPeriod: 'Période',
    colConstructionStart: 'Début travaux',
    colConstructionEnd: 'Fin travaux',
    colAccount: 'Compte',
    colInvoice: 'Facture',
    colCheque: 'Chèque',
    colWaiting: 'Attente',
    colRemark: 'Note',
    colUpdatedAt: 'Mis à jour',
    colActions: 'Actions',
    loading: 'Chargement...',
    emptyCases: 'Aucun dossier',
    details: 'Détails',
    edit: 'Modifier',
    deleting: 'Suppression...',
    delete: 'Supprimer',
    onTime: 'OK',
    dayShort: 'j',
    pagination: (total, page, totalPages) => `${total} dossiers · page ${page}/${totalPages}`,
    pageSize: 'Taille',
    previous: 'Précédent',
    next: 'Suivant',
    analysing: 'Analyse en cours...',
    stageFunnel: 'Entonnoir des étapes',
    monthlyFlow: 'Flux mensuel',
    colMonth: 'Mois',
    colInvoiceCumulative: 'Cumul facture',
    colChequeCumulative: 'Cumul chèque',
    noData: 'Aucune donnée',
    agingCurrent: 'Aging actuel',
    transitionsSla: 'Transitions et SLA',
    colTransition: 'Transition',
    colCount: 'Nb',
    colAverage: 'Moyenne',
    colDelayRate: 'Retard %',
    colImpact: 'Impact',
    daysSuffix: 'jours',
    caseLabel: 'Dossier',
    close: 'Fermer',
    timeline: 'Timeline des étapes',
    notFilled: 'Non renseigné',
    fill: 'Renseigner',
    createCaseTitle: 'Nouveau dossier',
    createCaseSubtitle: 'Créer le couple unique Projet + Période.',
    none: 'Aucune',
    cancel: 'Annuler',
    creating: 'Création...',
    create: 'Créer',
    editCaseTitle: (sequence) => `Modifier le dossier #${sequence}`,
    accountAmount: 'Montant compte',
    invoiceAmount: 'Montant facture',
    advanceAmount: 'Acompte',
    chequeAmount: 'Montant chèque',
    invoiceNumber: 'Numéro facture',
    receiptChequeNumber: 'Numéro chèque reçu',
    remark: 'Note',
    stageNote: "Note d'étape",
    constructionStartedAt: 'Début de construction',
    constructionFinishedAt: 'Fin de construction',
    stageDatesTitle: 'Dates de jalons',
    saving: 'Enregistrement...',
    save: 'Enregistrer',
    editStage: 'Modifier étape',
    fillStage: 'Renseigner étape',
    stageDate: 'Date étape',
  },
  zh: {
    projectFallbackPrefix: '项目',
    metadataLoadError: '加载元数据失败',
    listLoadError: '加载列表失败',
    insightsLoadError: '加载分析失败',
    detailLoadError: '加载台账详情失败',
    requiredProjectPeriod: '项目和期数必填',
    invalidPeriod: '期数无效',
    invalidAmount: '金额格式错误',
    invalidConstructionRange: '施工结束日期不能早于施工开始日期',
    invalidStageSequence: '阶段日期必须按顺序连续填写，不能跳过前置阶段',
    invalidStageChronology: '后续阶段日期不能早于前置阶段',
    requiredDate: '日期必填',
    createCaseFailed: '创建台账失败',
    updateCaseFailed: '更新台账失败',
    deleteCaseFailed: '删除台账失败',
    saveStageFailed: '保存阶段失败',
    createCaseSuccess: '台账已创建',
    updateCaseSuccess: '台账已更新',
    deleteCaseSuccess: '台账已删除',
    saveStageSuccess: '阶段已保存',
    deleteCaseConfirm: (sequence) => `确认删除台账 #${sequence} 吗？`,
    accessDeniedHint: '请联系管理员开通 finance:view 权限。',
    breadcrumbHome: '首页',
    breadcrumbFinance: '财务记账',
    breadcrumbLedger: '台账跟踪',
    pageTitle: '发票与收款台账跟踪',
    pageSubtitle: '按“项目+期数”建立唯一台账，并按阶段补录信息。',
    tabEntries: '财务记账',
    tabLedger: '台账跟踪',
    listTab: '列表',
    progressionTab: '进展',
    delaysTab: '时效',
    createCaseButton: '新建台账',
    summaryCases: '台账数',
    summaryAccountAmount: '账单金额',
    summaryInvoiceAmount: '发票金额',
    summaryChequeAmount: '支票金额',
    summaryReceiptRate: '收款率',
    summaryOverdueCases: '超时台账',
    labelProject: '项目',
    labelStatus: '状态',
    labelStage: '阶段',
    labelOverdue: '超时',
    labelSearch: '搜索',
    optionAllProjects: '全部项目',
    optionAll: '全部',
    optionAllStages: '全部阶段',
    optionOverdue: '已超时',
    optionOnTime: '未超时',
    searchPlaceholder: '项目、路段、发票号、备注…',
    applyFilters: '应用筛选',
    resetFilters: '重置',
    columnSelectorLabel: '显示列',
    columnSelectorSelected: (count) => `已选 ${count} 列`,
    columnSelectorNone: '未选择列',
    columnSelectorAll: '全选',
    columnSelectorDefault: '恢复默认',
    columnSelectorClear: '清空',
    colNumber: '编号',
    colPeriod: '期次',
    colConstructionStart: '施工开始',
    colConstructionEnd: '施工结束',
    colAccount: '账单',
    colInvoice: '发票',
    colCheque: '支票',
    colWaiting: '等待',
    colRemark: '备注',
    colUpdatedAt: '更新时间',
    colActions: '操作',
    loading: '加载中...',
    emptyCases: '暂无台账',
    details: '详情',
    edit: '编辑',
    deleting: '删除中...',
    delete: '删除',
    onTime: '正常',
    dayShort: '天',
    pagination: (total, page, totalPages) => `共 ${total} 条 · 第 ${page}/${totalPages} 页`,
    pageSize: '每页',
    previous: '上一页',
    next: '下一页',
    analysing: '分析计算中...',
    stageFunnel: '阶段漏斗',
    monthlyFlow: '月度流转',
    colMonth: '月份',
    colInvoiceCumulative: '累计发票',
    colChequeCumulative: '累计支票',
    noData: '暂无数据',
    agingCurrent: '当前等待时长',
    transitionsSla: '阶段转换与 SLA',
    colTransition: '阶段转换',
    colCount: '数量',
    colAverage: '平均',
    colDelayRate: '超时率',
    colImpact: '影响金额',
    daysSuffix: '天',
    caseLabel: '台账',
    close: '关闭',
    timeline: '阶段时间线',
    notFilled: '未填写',
    fill: '登记',
    createCaseTitle: '新建台账',
    createCaseSubtitle: '先创建唯一“项目 + 期数”，后续按阶段补录。',
    none: '无',
    cancel: '取消',
    creating: '创建中...',
    create: '创建',
    editCaseTitle: (sequence) => `编辑台账 #${sequence}`,
    accountAmount: '账单金额',
    invoiceAmount: '发票金额',
    advanceAmount: '预付款',
    chequeAmount: '支票金额',
    invoiceNumber: '发票号',
    receiptChequeNumber: '收款支票号',
    remark: '备注',
    stageNote: '阶段备注',
    constructionStartedAt: '施工开始时间',
    constructionFinishedAt: '施工结束时间',
    stageDatesTitle: '流程节点日期',
    saving: '保存中...',
    save: '保存',
    editStage: '编辑阶段',
    fillStage: '登记阶段',
    stageDate: '阶段日期',
  },
}

const stageTone: Record<FinanceLedgerCaseStatus, string> = {
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
  BLOCKED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-100',
}

const formatDateInput = (value: string | null) => (value ? value.split('T')[0] : '')

const formatNumber = (value: number | null | undefined, locale: Locale) => {
  if (value == null || !Number.isFinite(value)) return '—'
  const localeId = locale === 'fr' ? 'fr-FR' : 'zh-CN'
  return new Intl.NumberFormat(localeId, { maximumFractionDigits: 2 }).format(value)
}

const formatDateTime = (value: string | null, locale: Locale) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const localeId = locale === 'fr' ? 'fr-FR' : 'zh-CN'
  return new Intl.DateTimeFormat(localeId, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const parseMaybeNumber = (value: string) => {
  const normalized = value.trim()
  if (!normalized) return undefined
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

const toInputNumberOrNull = (value: string) => {
  const parsed = parseMaybeNumber(value)
  if (parsed === undefined) return null
  if (!Number.isFinite(parsed)) return NaN
  return parsed
}

const resolveProjectName = (project: LedgerProject, locale: Locale) => {
  if (locale !== 'fr') return project.name
  if (project.code && frProjectNameByCode[project.code]) return frProjectNameByCode[project.code]
  if (!containsCjk(project.name)) return project.name
  if (project.code) return humanizeIdentifier(project.code)
  return `${ledgerText[locale].projectFallbackPrefix} #${project.id}`
}

const resolveCaseProjectName = (item: LedgerCase, locale: Locale) => {
  if (locale !== 'fr') return item.projectName
  if (item.projectCode && frProjectNameByCode[item.projectCode]) return frProjectNameByCode[item.projectCode]
  if (!containsCjk(item.projectName)) return item.projectName
  if (item.projectCode) return humanizeIdentifier(item.projectCode)
  return `${ledgerText[locale].projectFallbackPrefix} #${item.projectId}`
}

const defaultCreateForm: LedgerCreateForm = {
  projectId: '',
  periodIndex: '',
}

const buildEmptyStageDateForm = (): Record<FinanceLedgerStage, string> => ({
  SITE_SIGNED: '',
  HQ_BILL_RECEIVED: '',
  BE_CONFIRMED: '',
  BE_DELIVERED: '',
  HQ_INVOICE_RECEIVED: '',
  CHEQUE_ISSUED: '',
  CHEQUE_RECEIVED: '',
})

const defaultCaseForm: LedgerCaseForm = {
  status: 'IN_PROGRESS',
  accountAmount: '',
  invoiceAmount: '',
  advanceAmount: '',
  chequeAmount: '',
  invoiceNumber: '',
  receiptChequeNumber: '',
  remark: '',
  constructionStartedAt: '',
  constructionFinishedAt: '',
  stageDates: buildEmptyStageDateForm(),
}

const defaultEventForm = (stage: FinanceLedgerStage): LedgerEventForm => ({
  stage,
  occurredAt: formatDateInput(new Date().toISOString()),
  note: '',
  accountAmount: '',
  invoiceAmount: '',
  advanceAmount: '',
  chequeAmount: '',
  invoiceNumber: '',
  receiptChequeNumber: '',
  remark: '',
})

const defaultFilters: LedgerFilters = {
  projectId: 'all',
  status: 'all',
  stage: 'all',
  overdue: 'all',
  search: '',
  page: 1,
  pageSize: 20,
  sortStack: DEFAULT_FINANCE_LEDGER_SORT_STACK,
}

export default function FinanceLedgerPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = ledgerText[locale]
  const { addToast } = useToast()

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [metadata, setMetadata] = useState<LedgerMetadata | null>(null)
  const [cases, setCases] = useState<LedgerCase[]>([])
  const [totalCases, setTotalCases] = useState(0)
  const [filters, setFilters] = useState<LedgerFilters>(defaultFilters)
  const [filterDraft, setFilterDraft] = useState<LedgerFilters>(defaultFilters)
  const [activeTab, setActiveTab] = useState<PageTab>('liste')
  const [loading, setLoading] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<LedgerInsights | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createForm, setCreateForm] = useState<LedgerCreateForm>(defaultCreateForm)

  const [editingCase, setEditingCase] = useState<LedgerCase | null>(null)
  const [caseSaving, setCaseSaving] = useState(false)
  const [caseForm, setCaseForm] = useState<LedgerCaseForm>(defaultCaseForm)

  const [detailCase, setDetailCase] = useState<LedgerCase | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LedgerEvent | null>(null)
  const [eventForm, setEventForm] = useState<LedgerEventForm>(defaultEventForm('SITE_SIGNED'))
  const [eventSaving, setEventSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<LedgerListColumnKey[]>([...defaultVisibleLedgerColumns])
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)

  const canView = session?.permissions.includes('finance:view') ?? false
  const canEdit = session?.permissions.includes('finance:edit') ?? false
  const ledgerActionColumnWidth = canEdit ? 120 : LEDGER_ACTION_COLUMN_MIN_WIDTH
  const visibleColumnCount = visibleColumns.length + 1
  const ledgerTableMinWidth = useMemo(() => {
    const columnsWidth = visibleColumns.reduce((sum, key) => sum + ledgerColumnMinWidthMap[key], 0)
    return Math.min(980, Math.max(LEDGER_MIN_TABLE_WIDTH, columnsWidth + ledgerActionColumnWidth))
  }, [ledgerActionColumnWidth, visibleColumns])

  const columnOptions = useMemo<Array<{ key: LedgerListColumnKey; label: string }>>(
    () => [
      { key: 'sequence', label: t.colNumber },
      { key: 'project', label: t.labelProject },
      { key: 'period', label: t.colPeriod },
      { key: 'constructionStartedAt', label: t.colConstructionStart },
      { key: 'constructionFinishedAt', label: t.colConstructionEnd },
      { key: 'stage', label: t.labelStage },
      { key: 'accountAmount', label: t.colAccount },
      { key: 'invoiceAmount', label: t.colInvoice },
      { key: 'chequeAmount', label: t.colCheque },
      { key: 'waitingDays', label: t.colWaiting },
      { key: 'overdueDays', label: t.labelOverdue },
      { key: 'remark', label: t.colRemark },
      { key: 'updatedAt', label: t.colUpdatedAt },
    ],
    [t],
  )

  const persistVisibleColumns = useCallback((next: LedgerListColumnKey[]) => {
    setVisibleColumns(next)
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(LEDGER_COLUMN_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Failed to persist ledger columns', error)
    }
  }, [])

  const toggleVisibleColumn = (key: LedgerListColumnKey) => {
    persistVisibleColumns(
      visibleColumns.includes(key)
        ? visibleColumns.filter((item) => item !== key)
        : [...visibleColumns, key],
    )
  }

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' })
      const data = (await res.json()) as { user?: SessionUser | null }
      setSession(data.user ?? null)
    } catch {
      setSession(null)
    } finally {
      setAuthLoaded(true)
    }
  }, [])

  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/ledger/metadata', { credentials: 'include' })
      const data = (await res.json()) as LedgerMetadata & { message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? t.metadataLoadError)
      }
      setMetadata(data)
      if (data.projects.length && !createForm.projectId) {
        setCreateForm((prev) => ({ ...prev, projectId: String(data.projects[0].id) }))
      }
    } catch (error) {
      setMessage((error as Error).message)
    }
  }, [createForm.projectId, t])

  const buildQuery = useCallback((source: LedgerFilters) => {
    const query = new URLSearchParams()
    if (source.projectId !== 'all') query.append('projectId', source.projectId)
    if (source.status !== 'all') query.append('status', source.status)
    if (source.stage !== 'all') query.append('stage', source.stage)
    if (source.overdue !== 'all') query.append('overdue', source.overdue)
    if (source.search.trim()) query.append('search', source.search.trim())
    query.append('page', String(source.page))
    query.append('pageSize', String(source.pageSize))
    source.sortStack.forEach((sort) => query.append('sort', `${sort.field}:${sort.order}`))
    return query
  }, [])

  const fetchCases = useCallback(
    async (source: LedgerFilters) => {
      setLoading(true)
      try {
        const query = buildQuery(source)
        const res = await fetch(`/api/finance/ledger/cases?${query.toString()}`, {
          credentials: 'include',
        })
        const data = (await res.json()) as {
          cases?: LedgerCase[]
          total?: number
          message?: string
        }
        if (!res.ok) {
          throw new Error(data.message ?? t.listLoadError)
        }
        setCases(data.cases ?? [])
        setTotalCases(data.total ?? 0)
      } catch (error) {
        setCases([])
        setTotalCases(0)
        setMessage((error as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [buildQuery, t],
  )

  const fetchInsights = useCallback(
    async (source: LedgerFilters) => {
      setInsightsLoading(true)
      try {
        const query = buildQuery({
          ...source,
          page: 1,
          pageSize: 200,
        })
        const res = await fetch(`/api/finance/ledger/insights?${query.toString()}`, {
          credentials: 'include',
        })
        const data = (await res.json()) as { insights?: LedgerInsights; message?: string }
        if (!res.ok) {
          throw new Error(data.message ?? t.insightsLoadError)
        }
        setInsights(data.insights ?? null)
      } catch (error) {
        setInsights(null)
        setMessage((error as Error).message)
      } finally {
        setInsightsLoading(false)
      }
    },
    [buildQuery, t],
  )

  const loadCaseDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/finance/ledger/cases/${id}`, {
        credentials: 'include',
      })
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) {
        throw new Error(data.message ?? t.detailLoadError)
      }
      setDetailCase(data.case ?? null)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setDetailLoading(false)
    }
  }, [addToast, t])

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  useEffect(() => {
    if (!canView) return
    void fetchMetadata()
  }, [canView, fetchMetadata])

  useEffect(() => {
    if (!canView) return
    void fetchCases(filters)
    void fetchInsights(filters)
  }, [canView, filters, fetchCases, fetchInsights])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(LEDGER_COLUMN_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return
      const filtered = parsed.filter(
        (item): item is LedgerListColumnKey =>
          typeof item === 'string' && ledgerColumnKeys.includes(item as LedgerListColumnKey),
      )
      if (filtered.length || stored.trim() === '[]') {
        setVisibleColumns(filtered)
      }
    } catch (error) {
      console.error('Failed to load ledger columns', error)
    }
  }, [])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!columnSelectorRef.current) return
      if (!columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [])

  const detailEventsByStage = useMemo(() => {
    const map = new Map<FinanceLedgerStage, LedgerEvent>()
    detailCase?.events.forEach((event) => map.set(event.stage, event))
    return map
  }, [detailCase?.events])

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCases / Math.max(filters.pageSize, 1))),
    [filters.pageSize, totalCases],
  )

  const handleSort = (field: FinanceLedgerSortField) => {
    setFilters((prev) => {
      const existing = prev.sortStack.find((item) => item.field === field)
      const nextOrder: FinanceLedgerSortSpec['order'] = existing?.order === 'asc' ? 'desc' : 'asc'
      const filtered = prev.sortStack.filter((item) => item.field !== field)
      const nextStack: FinanceLedgerSortSpec[] = [{ field, order: nextOrder }, ...filtered].slice(0, 4)
      return { ...prev, sortStack: nextStack, page: 1 }
    })
  }

  const sortIndicator = (field: FinanceLedgerSortField) => {
    const index = filters.sortStack.findIndex((item) => item.field === field)
    if (index < 0) return '↕'
    const arrow = filters.sortStack[index].order === 'asc' ? '↑' : '↓'
    return `${arrow}${index + 1}`
  }

  const sortAria = (field: FinanceLedgerSortField): 'none' | 'ascending' | 'descending' | 'other' => {
    const index = filters.sortStack.findIndex((item) => item.field === field)
    if (index < 0) return 'none'
    if (index > 0) return 'other'
    return filters.sortStack[index].order === 'asc' ? 'ascending' : 'descending'
  }

  const isVisibleColumn = (key: LedgerListColumnKey) => visibleColumns.includes(key)

  const openCreateModal = () => {
    if (!metadata?.projects.length) return
    setCreateForm({
      projectId: String(metadata.projects[0].id),
      periodIndex: '',
    })
    setShowCreateModal(true)
  }

  const handleCreate = async () => {
    if (!createForm.projectId || !createForm.periodIndex.trim()) {
      addToast(t.requiredProjectPeriod, { tone: 'warning' })
      return
    }
    const periodIndex = Number(createForm.periodIndex)
    if (!Number.isInteger(periodIndex) || periodIndex < 0) {
      addToast(t.invalidPeriod, { tone: 'warning' })
      return
    }

    setCreateSaving(true)
    try {
      const res = await fetch('/api/finance/ledger/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          projectId: Number(createForm.projectId),
          periodIndex,
        }),
      })
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) throw new Error(data.message ?? t.createCaseFailed)
      addToast(t.createCaseSuccess, { tone: 'success' })
      setShowCreateModal(false)
      await fetchCases(filters)
      await fetchInsights(filters)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setCreateSaving(false)
    }
  }

  const openEditCaseModal = (item: LedgerCase) => {
    const stageDateForm = FINANCE_LEDGER_STAGES.reduce(
      (acc, stage) => {
        acc[stage] = formatDateInput(item.stageDates[stage])
        return acc
      },
      buildEmptyStageDateForm(),
    )
    setEditingCase(item)
    setCaseForm({
      status: item.status,
      accountAmount: item.accountAmount == null ? '' : String(item.accountAmount),
      invoiceAmount: item.invoiceAmount == null ? '' : String(item.invoiceAmount),
      advanceAmount: item.advanceAmount == null ? '' : String(item.advanceAmount),
      chequeAmount: item.chequeAmount == null ? '' : String(item.chequeAmount),
      invoiceNumber: item.invoiceNumber ?? '',
      receiptChequeNumber: item.receiptChequeNumber ?? '',
      remark: item.remark ?? '',
      constructionStartedAt: formatDateInput(item.constructionStartedAt),
      constructionFinishedAt: formatDateInput(item.constructionFinishedAt),
      stageDates: stageDateForm,
    })
  }

  const handleUpdateCase = async () => {
    if (!editingCase) return
    const accountAmount = toInputNumberOrNull(caseForm.accountAmount)
    const invoiceAmount = toInputNumberOrNull(caseForm.invoiceAmount)
    const advanceAmount = toInputNumberOrNull(caseForm.advanceAmount)
    const chequeAmount = toInputNumberOrNull(caseForm.chequeAmount)
    if ([accountAmount, invoiceAmount, advanceAmount, chequeAmount].some((item) => Number.isNaN(item))) {
      addToast(t.invalidAmount, { tone: 'warning' })
      return
    }

    if (
      caseForm.constructionStartedAt &&
      caseForm.constructionFinishedAt &&
      caseForm.constructionFinishedAt < caseForm.constructionStartedAt
    ) {
      addToast(t.invalidConstructionRange, { tone: 'warning' })
      return
    }

    const stageDates = FINANCE_LEDGER_STAGES.reduce(
      (acc, stage) => {
        acc[stage] = caseForm.stageDates[stage] || null
        return acc
      },
      {} as Record<FinanceLedgerStage, string | null>,
    )
    const filledStages = FINANCE_LEDGER_STAGES.filter((stage) => Boolean(stageDates[stage]))
    for (let index = 1; index < filledStages.length; index += 1) {
      const prevStage = filledStages[index - 1]
      const currentStage = filledStages[index]
      if ((stageDates[currentStage] ?? '') < (stageDates[prevStage] ?? '')) {
        addToast(t.invalidStageChronology, { tone: 'warning' })
        return
      }
    }

    setCaseSaving(true)
    try {
      const res = await fetch(`/api/finance/ledger/cases/${editingCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          status: caseForm.status,
          accountAmount,
          invoiceAmount,
          advanceAmount,
          chequeAmount,
          invoiceNumber: caseForm.invoiceNumber || null,
          receiptChequeNumber: caseForm.receiptChequeNumber || null,
          remark: caseForm.remark || null,
          constructionStartedAt: caseForm.constructionStartedAt || null,
          constructionFinishedAt: caseForm.constructionFinishedAt || null,
          stageDates,
        }),
      })
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) throw new Error(data.message ?? t.updateCaseFailed)
      addToast(t.updateCaseSuccess, { tone: 'success' })
      setEditingCase(null)
      await fetchCases(filters)
      await fetchInsights(filters)
      if (detailCase?.id === editingCase.id) {
        await loadCaseDetail(editingCase.id)
      }
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setCaseSaving(false)
    }
  }

  const handleDeleteCase = async (item: LedgerCase) => {
    const confirmed = window.confirm(t.deleteCaseConfirm(item.sequence))
    if (!confirmed) return
    setDeletingId(item.id)
    try {
      const res = await fetch(`/api/finance/ledger/cases/${item.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(data.message ?? t.deleteCaseFailed)
      addToast(t.deleteCaseSuccess, { tone: 'success' })
      if (detailCase?.id === item.id) {
        setDetailCase(null)
      }
      await fetchCases(filters)
      await fetchInsights(filters)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setDeletingId(null)
    }
  }

  const openCreateEventModal = (stage: FinanceLedgerStage) => {
    setEditingEvent(null)
    setEventForm(defaultEventForm(stage))
    setShowEventModal(true)
  }

  const openEditEventModal = (event: LedgerEvent) => {
    setEditingEvent(event)
    setEventForm({
      stage: event.stage,
      occurredAt: formatDateInput(event.occurredAt),
      note: event.note ?? '',
      accountAmount:
        event.payload.accountAmount == null ? '' : String(event.payload.accountAmount),
      invoiceAmount:
        event.payload.invoiceAmount == null ? '' : String(event.payload.invoiceAmount),
      advanceAmount:
        event.payload.advanceAmount == null ? '' : String(event.payload.advanceAmount),
      chequeAmount:
        event.payload.chequeAmount == null ? '' : String(event.payload.chequeAmount),
      invoiceNumber:
        event.payload.invoiceNumber == null ? '' : String(event.payload.invoiceNumber),
      receiptChequeNumber:
        event.payload.receiptChequeNumber == null ? '' : String(event.payload.receiptChequeNumber),
      remark: event.payload.remark == null ? '' : String(event.payload.remark),
    })
    setShowEventModal(true)
  }

  const handleSaveEvent = async () => {
    if (!detailCase) return
    if (!eventForm.occurredAt) {
      addToast(t.requiredDate, { tone: 'warning' })
      return
    }
    const accountAmount = toInputNumberOrNull(eventForm.accountAmount)
    const invoiceAmount = toInputNumberOrNull(eventForm.invoiceAmount)
    const advanceAmount = toInputNumberOrNull(eventForm.advanceAmount)
    const chequeAmount = toInputNumberOrNull(eventForm.chequeAmount)
    if ([accountAmount, invoiceAmount, advanceAmount, chequeAmount].some((item) => Number.isNaN(item))) {
      addToast(t.invalidAmount, { tone: 'warning' })
      return
    }

    setEventSaving(true)
    try {
      const payload = {
        stage: eventForm.stage,
        occurredAt: eventForm.occurredAt,
        note: eventForm.note || null,
        accountAmount,
        invoiceAmount,
        advanceAmount,
        chequeAmount,
        invoiceNumber: eventForm.invoiceNumber || null,
        receiptChequeNumber: eventForm.receiptChequeNumber || null,
        remark: eventForm.remark || null,
      }

      const res = await fetch(
        editingEvent
          ? `/api/finance/ledger/events/${editingEvent.id}`
          : `/api/finance/ledger/cases/${detailCase.id}/events`,
        {
          method: editingEvent ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        },
      )
      const data = (await res.json()) as { case?: LedgerCase; message?: string }
      if (!res.ok) throw new Error(data.message ?? t.saveStageFailed)
      addToast(t.saveStageSuccess, { tone: 'success' })
      setShowEventModal(false)
      setEditingEvent(null)
      await fetchCases(filters)
      await fetchInsights(filters)
      await loadCaseDetail(detailCase.id)
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setEventSaving(false)
    }
  }

  const applyFilters = () => {
    setFilters((prev) => ({ ...filterDraft, page: 1, pageSize: prev.pageSize }))
  }

  const clearFilters = () => {
    setFilterDraft(defaultFilters)
    setFilters(defaultFilters)
  }

  const changePage = (page: number) => {
    const next = Math.min(Math.max(1, page), totalPages)
    setFilters((prev) => ({ ...prev, page: next }))
  }

  const changePageSize = (size: number) => {
    setFilters((prev) => ({ ...prev, pageSize: size, page: 1 }))
    setFilterDraft((prev) => ({ ...prev, pageSize: size, page: 1 }))
  }

  const tabs = [
    {
      key: 'entries',
      label: t.tabEntries,
      href: '/finance',
      active: false,
    },
    {
      key: 'ledger',
      label: t.tabLedger,
      href: '/finance/ledger',
      active: true,
    },
  ]

  if (authLoaded && !canView) {
    return <AccessDenied permissions={['finance:view']} hint={t.accessDeniedHint} />
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="finance-ledger-header z-30 py-4"
        breadcrumbs={[
          { label: t.breadcrumbHome, href: '/' },
          { label: t.breadcrumbFinance, href: '/finance' },
          { label: t.breadcrumbLedger },
        ]}
        title={t.pageTitle}
        subtitle={t.pageSubtitle}
        tabs={tabs}
        locale={locale}
        onLocaleChange={setLocale}
        localeVariant="light"
        breadcrumbVariant="light"
      />

      <section className="mx-auto w-full max-w-[1700px] space-y-4 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('liste')}
                className={`rounded-md px-3 py-1.5 ${activeTab === 'liste' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
              >
                {t.listTab}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('progression')}
                className={`rounded-md px-3 py-1.5 ${
                  activeTab === 'progression' ? 'bg-white text-slate-900' : 'text-slate-600'
                }`}
              >
                {t.progressionTab}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('delais')}
                className={`rounded-md px-3 py-1.5 ${activeTab === 'delais' ? 'bg-white text-slate-900' : 'text-slate-600'}`}
              >
                {t.delaysTab}
              </button>
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                {t.createCaseButton}
              </button>
            ) : null}
          </div>

          {insights ? (
            <div className="mb-4 grid gap-3 md:grid-cols-6">
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t.summaryCases}</p>
                <p className="mt-1 text-lg font-semibold">{insights.summary.caseCount}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t.summaryAccountAmount}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.totalAccountAmount, locale)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t.summaryInvoiceAmount}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.totalInvoiceAmount, locale)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t.summaryChequeAmount}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.totalChequeAmount, locale)}</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t.summaryReceiptRate}</p>
                <p className="mt-1 text-lg font-semibold">{formatNumber(insights.summary.receiptRate, locale)}%</p>
              </article>
              <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">{t.summaryOverdueCases}</p>
                <p className="mt-1 text-lg font-semibold text-rose-700">{insights.summary.overdueCount}</p>
              </article>
            </div>
          ) : null}

          {message ? (
            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {message}
            </p>
          ) : null}

          {activeTab === 'liste' ? (
            <>
              <div className="mb-4 grid gap-3 md:grid-cols-12">
                <label className="text-sm md:col-span-3">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t.labelProject}</span>
                  <select
                    value={filterDraft.projectId}
                    onChange={(event) => setFilterDraft((prev) => ({ ...prev, projectId: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">{t.optionAllProjects}</option>
                    {metadata?.projects.map((project) => (
                      <option key={project.id} value={String(project.id)}>
                        {resolveProjectName(project, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-3">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t.labelStatus}</span>
                  <select
                    value={filterDraft.status}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        status: event.target.value as LedgerFilters['status'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">{t.optionAll}</option>
                    <option value="IN_PROGRESS">{statusLabels[locale].IN_PROGRESS}</option>
                    <option value="DONE">{statusLabels[locale].DONE}</option>
                    <option value="BLOCKED">{statusLabels[locale].BLOCKED}</option>
                  </select>
                </label>
                <label className="text-sm md:col-span-3">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t.labelStage}</span>
                  <select
                    value={filterDraft.stage}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        stage: event.target.value as LedgerFilters['stage'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">{t.optionAllStages}</option>
                    {FINANCE_LEDGER_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stageLabels[locale][stage]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm md:col-span-3">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t.labelOverdue}</span>
                  <select
                    value={filterDraft.overdue}
                    onChange={(event) =>
                      setFilterDraft((prev) => ({
                        ...prev,
                        overdue: event.target.value as LedgerFilters['overdue'],
                      }))
                    }
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">{t.optionAll}</option>
                    <option value="true">{t.optionOverdue}</option>
                    <option value="false">{t.optionOnTime}</option>
                  </select>
                </label>
                <label className="text-sm md:col-span-6">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">{t.labelSearch}</span>
                  <input
                    value={filterDraft.search}
                    onChange={(event) => setFilterDraft((prev) => ({ ...prev, search: event.target.value }))}
                    placeholder={t.searchPlaceholder}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="text-sm md:col-span-3" ref={columnSelectorRef}>
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t.columnSelectorLabel}
                  </span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowColumnSelector((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-800 shadow-sm hover:bg-slate-50"
                    >
                      <span className="truncate">
                        {visibleColumns.length
                          ? t.columnSelectorSelected(visibleColumns.length)
                          : t.columnSelectorNone}
                      </span>
                      <span className="text-xs text-slate-500">⌕</span>
                    </button>
                    {showColumnSelector ? (
                      <div className="absolute right-0 z-30 mt-2 w-full min-w-[240px] rounded-lg border border-slate-200 bg-white shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 text-xs text-slate-600">
                          <button
                            type="button"
                            className="text-emerald-700 hover:underline"
                            onClick={() => persistVisibleColumns([...ledgerColumnKeys])}
                          >
                            {t.columnSelectorAll}
                          </button>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-slate-600 hover:underline"
                              onClick={() => persistVisibleColumns([...defaultVisibleLedgerColumns])}
                            >
                              {t.columnSelectorDefault}
                            </button>
                            <button
                              type="button"
                              className="text-slate-600 hover:underline"
                              onClick={() => persistVisibleColumns([])}
                            >
                              {t.columnSelectorClear}
                            </button>
                          </div>
                        </div>
                        <div className="max-h-64 space-y-1 overflow-y-auto p-2 text-sm">
                          {columnOptions.map((column) => (
                            <label
                              key={column.key}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={visibleColumns.includes(column.key)}
                                onChange={() => toggleVisibleColumn(column.key)}
                              />
                              <span className="truncate">{column.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-end gap-2 md:col-span-3">
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
                  >
                    {t.applyFilters}
                  </button>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    {t.resetFilters}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto overflow-y-visible rounded-2xl border border-slate-200">
                <table
                  className="w-full border-separate border-spacing-0 text-left text-[12px] leading-5"
                  style={{ minWidth: `${ledgerTableMinWidth}px` }}
                >
                  <thead className="sticky top-0 z-20 border-b border-slate-200 bg-slate-100/95 shadow-sm">
                    <tr className="text-[12px] font-semibold text-slate-700 [&>th]:!px-2 [&>th]:!py-3">
                      {isVisibleColumn('sequence') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('sequence')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('sequence')}>
                            {t.colNumber} {sortIndicator('sequence')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('project') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('project')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('project')}>
                            {t.labelProject} {sortIndicator('project')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('period') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('period')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('period')}>
                            {t.colPeriod} {sortIndicator('period')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('constructionStartedAt') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('constructionStartedAt')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('constructionStartedAt')}>
                            {t.colConstructionStart} {sortIndicator('constructionStartedAt')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('constructionFinishedAt') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('constructionFinishedAt')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('constructionFinishedAt')}>
                            {t.colConstructionEnd} {sortIndicator('constructionFinishedAt')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('stage') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('stage')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('stage')}>
                            {t.labelStage} {sortIndicator('stage')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('accountAmount') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('accountAmount')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('accountAmount')}>
                            {t.colAccount} {sortIndicator('accountAmount')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('invoiceAmount') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('invoiceAmount')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('invoiceAmount')}>
                            {t.colInvoice} {sortIndicator('invoiceAmount')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('chequeAmount') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('chequeAmount')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('chequeAmount')}>
                            {t.colCheque} {sortIndicator('chequeAmount')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('waitingDays') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('waitingDays')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('waitingDays')}>
                            {t.colWaiting} {sortIndicator('waitingDays')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('overdueDays') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('overdueDays')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('overdueDays')}>
                            {t.labelOverdue} {sortIndicator('overdueDays')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('remark') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('remark')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('remark')}>
                            {t.colRemark} {sortIndicator('remark')}
                          </button>
                        </th>
                      ) : null}
                      {isVisibleColumn('updatedAt') ? (
                        <th className="px-3 py-2" aria-sort={sortAria('updatedAt')}>
                          <button type="button" className="font-semibold" onClick={() => handleSort('updatedAt')}>
                            {t.colUpdatedAt} {sortIndicator('updatedAt')}
                          </button>
                        </th>
                      ) : null}
                      <th
                        className="px-3 py-2 text-right"
                        style={{
                          minWidth: `${ledgerActionColumnWidth}px`,
                          width: `${ledgerActionColumnWidth}px`,
                        }}
                      >
                        {t.colActions}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={visibleColumnCount} className="px-3 py-6 text-center text-slate-500">
                          {t.loading}
                        </td>
                      </tr>
                    ) : !cases.length ? (
                      <tr>
                        <td colSpan={visibleColumnCount} className="px-3 py-6 text-center text-slate-500">
                          {t.emptyCases}
                        </td>
                      </tr>
                    ) : (
                      cases.map((item, index) => (
                        <tr
                          key={item.id}
                          className="odd:bg-white even:bg-slate-50/40 hover:bg-emerald-50/40 [&>td]:!px-2 [&>td]:!py-2"
                        >
                          {isVisibleColumn('sequence') ? (
                            <td className="font-semibold text-slate-800">
                              {(filters.page - 1) * filters.pageSize + index + 1}
                            </td>
                          ) : null}
                          {isVisibleColumn('project') ? (
                            <td className="max-w-[240px] truncate px-3 py-2" title={resolveCaseProjectName(item, locale)}>
                              {resolveCaseProjectName(item, locale)}
                            </td>
                          ) : null}
                          {isVisibleColumn('period') ? <td>{`P${item.periodIndex}`}</td> : null}
                          {isVisibleColumn('constructionStartedAt') ? <td>{formatDateInput(item.constructionStartedAt) || '—'}</td> : null}
                          {isVisibleColumn('constructionFinishedAt') ? <td>{formatDateInput(item.constructionFinishedAt) || '—'}</td> : null}
                          {isVisibleColumn('stage') ? (
                            <td className="px-3 py-2">
                              {item.currentStage ? (
                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${stageTone[item.status]}`}>
                                  {stageLabels[locale][item.currentStage]}
                                </span>
                              ) : (
                                '—'
                              )}
                            </td>
                          ) : null}
                          {isVisibleColumn('accountAmount') ? <td>{formatNumber(item.accountAmount, locale)}</td> : null}
                          {isVisibleColumn('invoiceAmount') ? <td>{formatNumber(item.invoiceAmount, locale)}</td> : null}
                          {isVisibleColumn('chequeAmount') ? <td>{formatNumber(item.chequeAmount, locale)}</td> : null}
                          {isVisibleColumn('waitingDays') ? <td>{item.waitingDays}</td> : null}
                          {isVisibleColumn('overdueDays') ? (
                            <td className="px-3 py-2">
                              {item.isOverdue ? (
                                <span className="rounded-full bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
                                  +{item.overdueDays} {t.dayShort}
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                                  {t.onTime}
                                </span>
                              )}
                            </td>
                          ) : null}
                          {isVisibleColumn('remark') ? (
                            <td className="max-w-[260px] truncate px-3 py-2" title={item.remark ?? '—'}>
                              {item.remark || '—'}
                            </td>
                          ) : null}
                          {isVisibleColumn('updatedAt') ? <td>{formatDateTime(item.updatedAt, locale)}</td> : null}
                          <td
                            className="px-3 py-2 text-right"
                            style={{
                              minWidth: `${ledgerActionColumnWidth}px`,
                              width: `${ledgerActionColumnWidth}px`,
                            }}
                          >
                            <div className="flex flex-wrap justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => void loadCaseDetail(item.id)}
                                className="rounded border border-slate-200 px-1.5 py-1 text-xs hover:bg-slate-50"
                              >
                                {t.details}
                              </button>
                              {canEdit ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditCaseModal(item)}
                                    className="rounded border border-slate-200 px-1.5 py-1 text-xs hover:bg-slate-50"
                                  >
                                    {t.edit}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={deletingId === item.id}
                                    onClick={() => void handleDeleteCase(item)}
                                    className="rounded border border-rose-200 px-1.5 py-1 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    {deletingId === item.id ? t.deleting : t.delete}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
                <p>{t.pagination(totalCases, filters.page, totalPages)}</p>
                <div className="flex items-center gap-2">
                  <label>
                    <span className="mr-2 text-xs uppercase tracking-wide text-slate-500">{t.pageSize}</span>
                    <select
                      value={filters.pageSize}
                      onChange={(event) => changePageSize(Number(event.target.value))}
                      className="rounded border border-slate-200 px-2 py-1"
                    >
                      {pageSizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => changePage(filters.page - 1)}
                    disabled={filters.page <= 1}
                    className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50"
                  >
                    {t.previous}
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(filters.page + 1)}
                    disabled={filters.page >= totalPages}
                    className="rounded border border-slate-200 px-3 py-1 disabled:opacity-50"
                  >
                    {t.next}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === 'progression' ? (
            <div className="space-y-4">
              {insightsLoading ? <p className="text-sm text-slate-500">{t.analysing}</p> : null}
              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.stageFunnel}</h3>
                <div className="mt-3 space-y-2">
                  {insights?.stageFunnel.map((item) => {
                    const maxCount = Math.max(...(insights.stageFunnel.map((entry) => entry.count) || [1]), 1)
                    const width = maxCount ? Math.max((item.count / maxCount) * 100, item.count ? 10 : 0) : 0
                    return (
                      <div key={item.stage} className="grid grid-cols-12 items-center gap-2 text-sm">
                        <span className="col-span-3 text-slate-600">{stageLabels[locale][item.stage]}</span>
                        <div className="col-span-7 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${width}%` }} />
                        </div>
                        <span className="col-span-2 text-right font-semibold">{item.count}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.monthlyFlow}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[720px] text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2 text-left">{t.colMonth}</th>
                        <th className="px-2 py-2 text-right">{t.colInvoice}</th>
                        <th className="px-2 py-2 text-right">{t.colCheque}</th>
                        <th className="px-2 py-2 text-right">{t.colInvoiceCumulative}</th>
                        <th className="px-2 py-2 text-right">{t.colChequeCumulative}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {insights?.monthlyFlow.length ? (
                        insights.monthlyFlow.map((row) => (
                          <tr key={row.month}>
                            <td className="px-2 py-2">{row.month}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.invoiceAmount, locale)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.chequeAmount, locale)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.cumulativeInvoiceAmount, locale)}</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.cumulativeChequeAmount, locale)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="px-2 py-3 text-slate-500" colSpan={5}>
                            {t.noData}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          ) : null}

          {activeTab === 'delais' ? (
            <div className="space-y-4">
              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.agingCurrent}</h3>
                <div className="mt-3 space-y-2">
                  {insights?.agingBuckets.map((bucket) => {
                    const maxCount = Math.max(...(insights.agingBuckets.map((item) => item.count) || [1]), 1)
                    const width = maxCount ? Math.max((bucket.count / maxCount) * 100, bucket.count ? 8 : 0) : 0
                    return (
                      <div key={bucket.bucket} className="grid grid-cols-12 items-center gap-2 text-sm">
                        <span className="col-span-3 text-slate-600">{bucket.bucket} {t.daysSuffix}</span>
                        <div className="col-span-7 h-2 rounded-full bg-slate-100">
                          <div className="h-2 rounded-full bg-amber-500" style={{ width: `${width}%` }} />
                        </div>
                        <span className="col-span-2 text-right font-semibold">{bucket.count}</span>
                      </div>
                    )
                  })}
                </div>
              </article>

              <article className="rounded-xl border border-slate-200 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.transitionsSla}</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[920px] text-sm">
                    <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-2 py-2 text-left">{t.colTransition}</th>
                        <th className="px-2 py-2 text-right">{t.colCount}</th>
                        <th className="px-2 py-2 text-right">{t.colAverage}</th>
                        <th className="px-2 py-2 text-right">P90</th>
                        <th className="px-2 py-2 text-right">SLA</th>
                        <th className="px-2 py-2 text-right">{t.colDelayRate}</th>
                        <th className="px-2 py-2 text-right">{t.colImpact}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {insights?.transitionStats.length ? (
                        insights.transitionStats.map((row) => (
                          <tr key={`${row.fromStage}-${row.toStage}`}>
                            <td className="px-2 py-2">
                              {stageLabels[locale][row.fromStage]} → {stageLabels[locale][row.toStage]}
                            </td>
                            <td className="px-2 py-2 text-right">{row.count}</td>
                            <td className="px-2 py-2 text-right">{row.averageDays} {t.dayShort}</td>
                            <td className="px-2 py-2 text-right">{row.p90Days} {t.dayShort}</td>
                            <td className="px-2 py-2 text-right">{row.slaDays} {t.dayShort}</td>
                            <td className="px-2 py-2 text-right">{row.overdueRate}%</td>
                            <td className="px-2 py-2 text-right">{formatNumber(row.overdueImpactAmount, locale)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={7} className="px-2 py-3 text-slate-500">
                            {t.noData}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </article>
            </div>
          ) : null}
        </div>
      </section>

      {detailCase ? (
        <aside className="fixed inset-0 z-40 bg-slate-900/40">
          <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">{t.caseLabel}</p>
                  <h2 className="text-lg font-semibold text-slate-900">#{detailCase.sequence}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailCase(null)}
                  className="rounded border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50"
                >
                  {t.close}
                </button>
              </div>
              {detailLoading ? <p className="mt-2 text-sm text-slate-500">{t.loading}</p> : null}
            </div>
            <div className="space-y-5 px-5 py-4">
              <article className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                <p>
                  <span className="text-slate-500">{t.labelProject}: </span>
                  <strong>{resolveCaseProjectName(detailCase, locale)}</strong>
                </p>
                <p>
                  <span className="text-slate-500">{t.colPeriod}: </span>
                  <strong>{`P${detailCase.periodIndex}`}</strong>
                </p>
                <p>
                  <span className="text-slate-500">{t.labelStatus}: </span>
                  <strong>{statusLabels[locale][detailCase.status]}</strong>
                </p>
                <p>
                  <span className="text-slate-500">{t.constructionStartedAt}: </span>
                  <strong>{formatDateInput(detailCase.constructionStartedAt) || '—'}</strong>
                </p>
                <p>
                  <span className="text-slate-500">{t.constructionFinishedAt}: </span>
                  <strong>{formatDateInput(detailCase.constructionFinishedAt) || '—'}</strong>
                </p>
              </article>

              <article className="rounded-xl border border-slate-200 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t.timeline}</h3>
                </div>
                <div className="space-y-2">
                  {FINANCE_LEDGER_STAGES.map((stage) => {
                    const event = detailEventsByStage.get(stage)
                    const canFill = !event && detailCase.nextStage === stage && canEdit
                    return (
                      <div key={stage} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-800">{stageLabels[locale][stage]}</p>
                            <p className="text-xs text-slate-500">
                              {event ? formatDateInput(event.occurredAt) : t.notFilled}
                            </p>
                            {event?.note ? <p className="mt-1 text-xs text-slate-600">{event.note}</p> : null}
                          </div>
                          {canEdit ? (
                            event ? (
                              <button
                                type="button"
                                onClick={() => openEditEventModal(event)}
                                className="rounded border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                              >
                                {t.edit}
                              </button>
                            ) : canFill ? (
                              <button
                                type="button"
                                onClick={() => openCreateEventModal(stage)}
                                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                              >
                                {t.fill}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </div>
          </div>
        </aside>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-3 sm:p-6">
          <div className="mx-auto flex min-h-full items-start justify-center">
            <div className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">{t.createCaseTitle}</h2>
                <p className="text-sm text-slate-500">{t.createCaseSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                aria-label={t.close}
                title={t.close}
              >
                &times;
              </button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.labelProject}</span>
                <select
                  value={createForm.projectId}
                  onChange={(event) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      projectId: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  {metadata?.projects.map((project) => (
                    <option key={project.id} value={String(project.id)}>
                      {resolveProjectName(project, locale)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.colPeriod}</span>
                <input
                  type="number"
                  min={0}
                  value={createForm.periodIndex}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, periodIndex: event.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  placeholder="0, 1, 2..."
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={createSaving}
                onClick={() => void handleCreate()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {createSaving ? t.creating : t.create}
              </button>
            </div>
          </div>
        </div>
        </div>
      ) : null}

      {editingCase ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-3 sm:p-6">
          <div className="mx-auto flex min-h-full items-start justify-center">
            <div className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">{t.editCaseTitle(editingCase.sequence)}</h2>
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                aria-label={t.close}
                title={t.close}
              >
                &times;
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.labelStatus}</span>
                  <select
                    value={caseForm.status}
                    onChange={(event) =>
                      setCaseForm((prev) => ({ ...prev, status: event.target.value as FinanceLedgerCaseStatus }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="IN_PROGRESS">{statusLabels[locale].IN_PROGRESS}</option>
                    <option value="BLOCKED">{statusLabels[locale].BLOCKED}</option>
                    <option value="DONE">{statusLabels[locale].DONE}</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.accountAmount}</span>
                  <input
                    value={caseForm.accountAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, accountAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.invoiceAmount}</span>
                  <input
                    value={caseForm.invoiceAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, invoiceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.advanceAmount}</span>
                  <input
                    value={caseForm.advanceAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, advanceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.chequeAmount}</span>
                  <input
                    value={caseForm.chequeAmount}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, chequeAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.invoiceNumber}</span>
                  <input
                    value={caseForm.invoiceNumber}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.receiptChequeNumber}</span>
                  <input
                    value={caseForm.receiptChequeNumber}
                    onChange={(event) =>
                      setCaseForm((prev) => ({ ...prev, receiptChequeNumber: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.constructionStartedAt}</span>
                  <input
                    type="date"
                    value={caseForm.constructionStartedAt}
                    onChange={(event) =>
                      setCaseForm((prev) => ({ ...prev, constructionStartedAt: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.constructionFinishedAt}</span>
                  <input
                    type="date"
                    value={caseForm.constructionFinishedAt}
                    onChange={(event) =>
                      setCaseForm((prev) => ({ ...prev, constructionFinishedAt: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <div className="md:col-span-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.stageDatesTitle}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {FINANCE_LEDGER_STAGES.map((stage) => (
                      <label key={stage} className="text-sm">
                        <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                          {stageLabels[locale][stage]}
                        </span>
                        <input
                          type="date"
                          value={caseForm.stageDates[stage]}
                          onChange={(event) =>
                            setCaseForm((prev) => ({
                              ...prev,
                              stageDates: {
                                ...prev.stageDates,
                                [stage]: event.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 px-3 py-2"
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.remark}</span>
                  <textarea
                    value={caseForm.remark}
                    onChange={(event) => setCaseForm((prev) => ({ ...prev, remark: event.target.value }))}
                    className="h-24 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setEditingCase(null)}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={caseSaving}
                onClick={() => void handleUpdateCase()}
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {caseSaving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
        </div>
      ) : null}

      {showEventModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-3 sm:p-6">
          <div className="mx-auto flex min-h-full items-start justify-center">
            <div className="my-2 flex max-h-[calc(100vh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-6 sm:max-h-[calc(100vh-3rem)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold">
                {editingEvent ? t.editStage : t.fillStage}: {stageLabels[locale][eventForm.stage]}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false)
                  setEditingEvent(null)
                }}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
                aria-label={t.close}
                title={t.close}
              >
                &times;
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.stageDate}</span>
                  <input
                    type="date"
                    value={eventForm.occurredAt}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.accountAmount}</span>
                  <input
                    value={eventForm.accountAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, accountAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.invoiceAmount}</span>
                  <input
                    value={eventForm.invoiceAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, invoiceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.advanceAmount}</span>
                  <input
                    value={eventForm.advanceAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, advanceAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.chequeAmount}</span>
                  <input
                    value={eventForm.chequeAmount}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, chequeAmount: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.invoiceNumber}</span>
                  <input
                    value={eventForm.invoiceNumber}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.receiptChequeNumber}</span>
                  <input
                    value={eventForm.receiptChequeNumber}
                    onChange={(event) =>
                      setEventForm((prev) => ({ ...prev, receiptChequeNumber: event.target.value }))
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">{t.stageNote}</span>
                  <textarea
                    value={eventForm.note}
                    onChange={(event) => setEventForm((prev) => ({ ...prev, note: event.target.value }))}
                    className="h-20 w-full rounded-lg border border-slate-200 px-3 py-2"
                  />
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false)
                  setEditingEvent(null)
                }}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={eventSaving}
                onClick={() => void handleSaveEvent()}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {eventSaving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
        </div>
      ) : null}
    </main>
  )
}
