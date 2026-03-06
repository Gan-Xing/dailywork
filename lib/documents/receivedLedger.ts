import type { ReceivedDocumentLedgerStatus } from '@prisma/client'

import type { Locale } from '@/lib/i18n'

export const RECEIVED_DOCUMENT_LEDGER_CATEGORIES = [
  'ROAD_DRAWING',
  'STRUCTURE_DRAWING',
  'GEOTECH_SURVEY',
  'APPROVAL_CERTIFICATE',
  'METHOD_STATEMENT',
  'OTHER_TECHNICAL_FILE',
] as const

export type ReceivedDocumentLedgerCategory =
  (typeof RECEIVED_DOCUMENT_LEDGER_CATEGORIES)[number]

export const RECEIVED_DOCUMENT_LEDGER_FILE_CATEGORY = 'received-document' as const
export const RECEIVED_DOCUMENT_LEDGER_FILE_ENTITY_TYPE =
  'received-document-ledger' as const
export const RECEIVED_DOCUMENT_LEDGER_FILE_PURPOSE_MAIN = 'main-pdf' as const

export const RECEIVED_DOCUMENT_LEDGER_STATUSES: ReceivedDocumentLedgerStatus[] = [
  'RECEIVED',
  'PENDING_COMPLETION',
  'VOID',
]

const categoryLabels: Record<Locale, Record<ReceivedDocumentLedgerCategory, string>> = {
  zh: {
    ROAD_DRAWING: '道路施工图',
    STRUCTURE_DRAWING: '结构物图纸',
    GEOTECH_SURVEY: '地勘与调查',
    APPROVAL_CERTIFICATE: '审批与合格文件',
    METHOD_STATEMENT: '施工方案与工艺文件',
    OTHER_TECHNICAL_FILE: '其他技术文件',
  },
  fr: {
    ROAD_DRAWING: 'Plan de voirie',
    STRUCTURE_DRAWING: "Plan d'ouvrage",
    GEOTECH_SURVEY: 'Geotechnique et sondage',
    APPROVAL_CERTIFICATE: 'Agrement et certificat',
    METHOD_STATEMENT: "Procedure d'execution",
    OTHER_TECHNICAL_FILE: 'Autre document technique',
  },
}

const statusLabels: Record<Locale, Record<ReceivedDocumentLedgerStatus, string>> = {
  zh: {
    RECEIVED: '已接收',
    PENDING_COMPLETION: '待补全',
    VOID: '作废',
  },
  fr: {
    RECEIVED: 'Recu',
    PENDING_COMPLETION: 'A completer',
    VOID: 'Annule',
  },
}

export const isReceivedDocumentLedgerCategory = (
  value: string,
): value is ReceivedDocumentLedgerCategory =>
  RECEIVED_DOCUMENT_LEDGER_CATEGORIES.includes(
    value as ReceivedDocumentLedgerCategory,
  )

export const isReceivedDocumentLedgerStatus = (
  value: string,
): value is ReceivedDocumentLedgerStatus =>
  RECEIVED_DOCUMENT_LEDGER_STATUSES.includes(value as ReceivedDocumentLedgerStatus)

export const getReceivedDocumentLedgerCategoryLabel = (
  locale: Locale,
  category: ReceivedDocumentLedgerCategory,
) => categoryLabels[locale][category]

export const getReceivedDocumentLedgerStatusLabel = (
  locale: Locale,
  status: ReceivedDocumentLedgerStatus,
) => statusLabels[locale][status]
