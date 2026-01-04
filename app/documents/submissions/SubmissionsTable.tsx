'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { formatCopy, locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

const SUBMISSION_COLUMN_STORAGE_KEY = 'submission-visible-columns'

export type SubmissionRow = {
  docId: number
  itemId: number | null
  itemOrder: number | null
  code: string
  rawCode?: string
  title: string
  designation: string
  quantity: number | null
  observation: string
  status: string
  templateId?: string | null
  templateName?: string | null
  templateVersion?: number | null
  documentType: string
  documentRemark: string
  documentData: unknown | null
  documentFiles: unknown | null
  documentCreatedAt: string
  documentUpdatedAt: string
  createdBy?: string
  createdById?: number | null
  updatedBy?: string
  updatedById?: number | null
  submissionNumber?: number | null
  projectName: string
  projectCode: string
  contractNumbers: string[]
  bordereauNumber: number | null
  subject: string
  senderOrg: string
  senderDate: string
  senderLastName: string
  senderFirstName: string
  senderTime: string
  recipientOrg: string
  recipientDate: string
  recipientLastName: string
  recipientFirstName: string
  recipientTime: string
  comments: string
  submissionCreatedAt: string
  submissionUpdatedAt: string
  itemCreatedAt: string
  itemUpdatedAt: string
}

type ColumnKey =
  | 'code'
  | 'submissionNumber'
  | 'rawCode'
  | 'docId'
  | 'status'
  | 'projectName'
  | 'projectCode'
  | 'contractNumbers'
  | 'bordereauNumber'
  | 'subject'
  | 'senderOrg'
  | 'senderDate'
  | 'senderLastName'
  | 'senderFirstName'
  | 'senderTime'
  | 'recipientOrg'
  | 'recipientDate'
  | 'recipientLastName'
  | 'recipientFirstName'
  | 'recipientTime'
  | 'comments'
  | 'submissionCreatedAt'
  | 'submissionUpdatedAt'
  | 'designation'
  | 'quantity'
  | 'observation'
  | 'itemId'
  | 'itemOrder'
  | 'itemCreatedAt'
  | 'itemUpdatedAt'
  | 'title'
  | 'documentType'
  | 'documentRemark'
  | 'documentData'
  | 'documentFiles'
  | 'documentCreatedAt'
  | 'documentUpdatedAt'
  | 'templateName'
  | 'templateVersion'
  | 'templateId'
  | 'createdBy'
  | 'createdById'
  | 'updatedBy'
  | 'updatedById'
  | 'action'

type ColumnOption = {
  key: ColumnKey
  label: string
}

type SortDirection = 'asc' | 'desc'
type SortState = { key: ColumnKey; direction: SortDirection } | null

const defaultVisibleColumns: ColumnKey[] = [
  'code',
  'projectName',
  'projectCode',
  'contractNumbers',
  'subject',
  'senderDate',
  'submissionCreatedAt',
  'designation',
  'quantity',
  'observation',
  'status',
  'createdBy',
  'documentUpdatedAt',
  'action',
]

const signatureKeys = new Set(['signature', 'senderSignature', 'recipientSignature'])
const sortableColumns = new Set<ColumnKey>(['code', 'subject', 'senderDate', 'submissionCreatedAt', 'designation'])

const formatJson = (value: unknown) => {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, (key, val) => (signatureKeys.has(key) ? undefined : val))
  } catch {
    return String(value)
  }
}

const formatContractNumbers = (value: string[]) => {
  if (!value?.length) return ''
  return value.join(', ')
}

const formatTemplateName = (name?: string | null) => {
  if (!name) return ''
  return name.replace(/\s+v\d+$/i, '').trim()
}

const displayValue = (value: unknown) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string') return value.trim() ? value : '—'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  return String(value)
}

const parseDateValue = (value: string) => {
  if (!value) return null
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? null : timestamp
}

const parseNumberFromString = (value: string) => {
  const match = value.match(/(\d+)/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeText = (value: string) => value.trim().toLowerCase()

const isEmptySortValue = (value: string | number | null) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

const getSortValue = (row: SubmissionRow, key: ColumnKey): string | number | null => {
  switch (key) {
    case 'code': {
      if (typeof row.submissionNumber === 'number') return row.submissionNumber
      const numeric = parseNumberFromString(row.code)
      return numeric ?? normalizeText(row.code)
    }
    case 'subject':
      return normalizeText(row.subject)
    case 'designation':
      return normalizeText(row.designation)
    case 'senderDate': {
      const parsed = parseDateValue(row.senderDate)
      return parsed ?? normalizeText(row.senderDate)
    }
    case 'submissionCreatedAt': {
      const parsed = parseDateValue(row.submissionCreatedAt)
      return parsed ?? normalizeText(row.submissionCreatedAt)
    }
    default:
      return null
  }
}

const compareSortValues = (a: string | number | null, b: string | number | null, locale: string) => {
  const aEmpty = isEmptySortValue(a)
  const bEmpty = isEmptySortValue(b)
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1
  if (bEmpty) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), locale, { numeric: true, sensitivity: 'base' })
}

type SubmissionsTableProps = {
  rows: SubmissionRow[]
  canUpdate?: boolean
  canDelete?: boolean
  canView?: boolean
}

export default function SubmissionsTable({ rows, canUpdate = false, canDelete = false, canView = false }: SubmissionsTableProps) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const [selected, setSelected] = useState<number[]>([])
  const [data, setData] = useState<SubmissionRow[]>(rows)
  const [loadingAction, setLoadingAction] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => defaultVisibleColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const [sortState, setSortState] = useState<SortState>(null)
  const [page, setPage] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [pageSize, setPageSize] = useState(20)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)

  const columnLabels = copy.submissionsTable.columns

  const columnOptions: ColumnOption[] = useMemo(
    () => [
      { key: 'code', label: columnLabels.code },
      { key: 'submissionNumber', label: columnLabels.submissionNumber },
      { key: 'rawCode', label: columnLabels.rawCode },
      { key: 'docId', label: columnLabels.docId },
      { key: 'status', label: columnLabels.status },
      { key: 'projectName', label: columnLabels.projectName },
      { key: 'projectCode', label: columnLabels.projectCode },
      { key: 'contractNumbers', label: columnLabels.contractNumbers },
      { key: 'bordereauNumber', label: columnLabels.bordereauNumber },
      { key: 'subject', label: columnLabels.subject },
      { key: 'senderOrg', label: columnLabels.senderOrg },
      { key: 'senderDate', label: columnLabels.senderDate },
      { key: 'senderLastName', label: columnLabels.senderLastName },
      { key: 'senderFirstName', label: columnLabels.senderFirstName },
      { key: 'senderTime', label: columnLabels.senderTime },
      { key: 'recipientOrg', label: columnLabels.recipientOrg },
      { key: 'recipientDate', label: columnLabels.recipientDate },
      { key: 'recipientLastName', label: columnLabels.recipientLastName },
      { key: 'recipientFirstName', label: columnLabels.recipientFirstName },
      { key: 'recipientTime', label: columnLabels.recipientTime },
      { key: 'comments', label: columnLabels.comments },
      { key: 'submissionCreatedAt', label: columnLabels.submissionCreatedAt },
      { key: 'submissionUpdatedAt', label: columnLabels.submissionUpdatedAt },
      { key: 'designation', label: columnLabels.designation },
      { key: 'quantity', label: columnLabels.quantity },
      { key: 'observation', label: columnLabels.observation },
      { key: 'itemId', label: columnLabels.itemId },
      { key: 'itemOrder', label: columnLabels.itemOrder },
      { key: 'itemCreatedAt', label: columnLabels.itemCreatedAt },
      { key: 'itemUpdatedAt', label: columnLabels.itemUpdatedAt },
      { key: 'title', label: columnLabels.title },
      { key: 'documentType', label: columnLabels.documentType },
      { key: 'documentRemark', label: columnLabels.documentRemark },
      { key: 'documentData', label: columnLabels.documentData },
      { key: 'documentFiles', label: columnLabels.documentFiles },
      { key: 'documentCreatedAt', label: columnLabels.documentCreatedAt },
      { key: 'documentUpdatedAt', label: columnLabels.documentUpdatedAt },
      { key: 'templateName', label: columnLabels.templateName },
      { key: 'templateVersion', label: columnLabels.templateVersion },
      { key: 'templateId', label: columnLabels.templateId },
      { key: 'createdBy', label: columnLabels.createdBy },
      { key: 'createdById', label: columnLabels.createdById },
      { key: 'updatedBy', label: columnLabels.updatedBy },
      { key: 'updatedById', label: columnLabels.updatedById },
      { key: 'action', label: columnLabels.action },
    ],
    [columnLabels],
  )

  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)
  const columnCount = columnOptions.filter((option) => isVisible(option.key)).length + 1
  const sortedData = useMemo(() => {
    if (!sortState) return data
    const { key, direction } = sortState
    const multiplier = direction === 'asc' ? 1 : -1
    const stabilized = data.map((row, index) => ({ row, index }))
    stabilized.sort((a, b) => {
      const result = compareSortValues(getSortValue(a.row, key), getSortValue(b.row, key), locale)
      if (result !== 0) return result * multiplier
      return a.index - b.index
    })
    return stabilized.map((item) => item.row)
  }, [data, sortState, locale])
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize))
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedData.slice(start, start + pageSize)
  }, [page, pageSize, sortedData])
  const pageDocIds = useMemo(() => Array.from(new Set(pagedData.map((row) => row.docId))), [pagedData])
  const allSelected = pageDocIds.length > 0 && pageDocIds.every((id) => selected.includes(id))
  const dataDocIds = useMemo(() => new Set(data.map((row) => row.docId)), [data])

  useEffect(() => {
    setData(rows)
    setSelected([])
    setPage(1)
    setPageInput('1')
  }, [rows])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setShowColumnSelector(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  useEffect(() => {
    setSelected((prev) => prev.filter((id) => dataDocIds.has(id)))
  }, [dataDocIds])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const stored = localStorage.getItem(SUBMISSION_COLUMN_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored)
      if (!Array.isArray(parsed)) return
      const filtered = parsed.filter((item) =>
        typeof item === 'string' && columnOptions.some((option) => option.key === item),
      ) as ColumnKey[]
      const trimmed = stored.trim()
      if (filtered.length || trimmed === '[]') {
        const ensured: ColumnKey[] = filtered.includes('action') ? filtered : [...filtered, 'action']
        setVisibleColumns(ensured)
        return
      }
      setVisibleColumns(defaultVisibleColumns)
    } catch (error) {
      console.error('Failed to load visible columns', error)
    }
  }, [columnOptions])

  const persistVisibleColumns = (next: ColumnKey[]) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SUBMISSION_COLUMN_STORAGE_KEY, JSON.stringify(next))
      } catch (error) {
        console.error('Failed to persist visible columns', error)
      }
    }
    setVisibleColumns(next)
  }

  const handleSelectAllColumns = () => persistVisibleColumns(columnOptions.map((option) => option.key))
  const handleRestoreDefaultColumns = () => persistVisibleColumns([...defaultVisibleColumns])
  const handleClearColumns = () => persistVisibleColumns([])

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => prev.filter((id) => !pageDocIds.includes(id)))
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...pageDocIds])))
    }
  }

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const toggleColumnVisibility = (key: ColumnKey) => {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((item) => item !== key)
      : [...visibleColumns, key]
    persistVisibleColumns(next)
  }

  const toggleSort = (key: ColumnKey) => {
    if (!sortableColumns.has(key)) return
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' }
      if (prev.direction === 'asc') return { key, direction: 'desc' }
      return null
    })
  }

  const callBulk = async (body: Record<string, unknown>) => {
    if (body.action === 'delete' && !canDelete) {
      alert(copy.submissionsTable.alerts.noDelete)
      return
    }
    if (body.action !== 'delete' && !canUpdate) {
      alert(copy.submissionsTable.alerts.noEdit)
      return
    }
    setLoadingAction(true)
    try {
      const res = await fetch('/api/documents/submissions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...body, ids: Array.from(new Set(selected)) }),
      })
      const json = (await res.json()) as { message?: string; count?: number }
      if (!res.ok) throw new Error(json.message ?? copy.submissionsTable.alerts.bulkError)
      if (body.action === 'delete') {
        setData((prev) => prev.filter((r) => !selected.includes(r.docId)))
      }
      if (body.action === 'archive' || body.action === 'status') {
        setData((prev) =>
          prev.map((r) => (selected.includes(r.docId) && body.status ? { ...r, status: body.status as string } : r)),
        )
      }
      setSelected([])
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setLoadingAction(false)
    }
  }

  const renderCell = (row: SubmissionRow, key: ColumnKey) => {
    switch (key) {
      case 'code':
        return <span className="font-semibold text-slate-900">{displayValue(row.code)}</span>
      case 'submissionNumber':
        return displayValue(row.submissionNumber)
      case 'rawCode':
        return displayValue(row.rawCode)
      case 'docId':
        return displayValue(row.docId)
      case 'status':
        return (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-center text-[11px] font-semibold text-emerald-700">
            {displayValue(copy.status.document[row.status] ?? row.status)}
          </span>
        )
      case 'projectName':
        return displayValue(row.projectName)
      case 'projectCode':
        return displayValue(row.projectCode)
      case 'contractNumbers':
        return displayValue(formatContractNumbers(row.contractNumbers))
      case 'bordereauNumber':
        return displayValue(row.bordereauNumber)
      case 'subject':
        return displayValue(row.subject)
      case 'senderOrg':
        return displayValue(row.senderOrg)
      case 'senderDate':
        return displayValue(row.senderDate)
      case 'senderLastName':
        return displayValue(row.senderLastName)
      case 'senderFirstName':
        return displayValue(row.senderFirstName)
      case 'senderTime':
        return displayValue(row.senderTime)
      case 'recipientOrg':
        return displayValue(row.recipientOrg)
      case 'recipientDate':
        return displayValue(row.recipientDate)
      case 'recipientLastName':
        return displayValue(row.recipientLastName)
      case 'recipientFirstName':
        return displayValue(row.recipientFirstName)
      case 'recipientTime':
        return displayValue(row.recipientTime)
      case 'comments':
        return displayValue(row.comments)
      case 'submissionCreatedAt':
        return displayValue(row.submissionCreatedAt)
      case 'submissionUpdatedAt':
        return displayValue(row.submissionUpdatedAt)
      case 'designation':
        return displayValue(row.designation)
      case 'quantity':
        return displayValue(row.quantity)
      case 'observation':
        return displayValue(row.observation)
      case 'itemId':
        return displayValue(row.itemId)
      case 'itemOrder':
        return displayValue(row.itemOrder)
      case 'itemCreatedAt':
        return displayValue(row.itemCreatedAt)
      case 'itemUpdatedAt':
        return displayValue(row.itemUpdatedAt)
      case 'title':
        return displayValue(row.title)
      case 'documentType':
        return displayValue(row.documentType)
      case 'documentRemark':
        return displayValue(row.documentRemark)
      case 'documentData': {
        const formatted = formatJson(row.documentData)
        return formatted ? formatted : '—'
      }
      case 'documentFiles': {
        const formatted = formatJson(row.documentFiles)
        return formatted ? formatted : '—'
      }
      case 'documentCreatedAt':
        return displayValue(row.documentCreatedAt)
      case 'documentUpdatedAt':
        return displayValue(row.documentUpdatedAt)
      case 'templateName': {
        const name = formatTemplateName(row.templateName)
        return displayValue(name)
      }
      case 'templateVersion':
        return displayValue(row.templateVersion)
      case 'templateId':
        return displayValue(row.templateId)
      case 'createdBy':
        return displayValue(row.createdBy)
      case 'createdById':
        return displayValue(row.createdById)
      case 'updatedBy':
        return displayValue(row.updatedBy)
      case 'updatedById':
        return displayValue(row.updatedById)
      case 'action': {
        const href = row.submissionNumber
          ? `/documents/submissions/${row.submissionNumber}`
          : `/documents/submissions/${row.docId}`
        const actionLabel = canUpdate ? copy.submissionsTable.actions.edit : copy.submissionsTable.actions.view
        return (
          <div className="flex justify-end gap-2 text-xs font-semibold">
            {canView || canUpdate ? (
              <Link href={href} className="rounded-full bg-emerald-500 px-3 py-1 text-white shadow">
                {actionLabel}
              </Link>
            ) : null}
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
            >
              {copy.submissionsTable.actions.export}
            </button>
          </div>
        )
      }
      default:
        return '—'
    }
  }

  const cellClassName = (key: ColumnKey) => {
    if (key === 'action') return 'px-4 py-3 text-right text-xs'
    if (key === 'documentData' || key === 'documentFiles') {
      return 'px-4 py-3 text-xs text-slate-500 whitespace-pre-wrap break-all max-w-[360px]'
    }
    if (key === 'comments' || key === 'documentRemark' || key === 'subject' || key === 'title' || key === 'projectName') {
      return 'px-4 py-3 text-xs text-slate-700 whitespace-pre-wrap break-words max-w-[260px]'
    }
    return 'px-4 py-3 text-xs text-slate-700 whitespace-nowrap'
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
        <span>{copy.submissionsTable.title}</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={columnSelectorRef}>
            <button
              type="button"
              className="flex min-w-[140px] items-center justify-between rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              onClick={() => setShowColumnSelector((prev) => !prev)}
            >
              <span className="truncate">
                {visibleColumns.length
                  ? formatCopy(copy.submissionsTable.columnSelector.selectedTemplate, { count: visibleColumns.length })
                  : copy.submissionsTable.columnSelector.noneSelected}
              </span>
              <span className="text-xs text-slate-400">⌕</span>
            </button>
            {showColumnSelector ? (
              <div className="absolute right-0 z-10 mt-2 w-80 max-w-sm rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-500">
                  <button className="text-emerald-600 hover:underline" onClick={handleSelectAllColumns}>
                    {copy.submissionsTable.columnSelector.selectAll}
                  </button>
                  <div className="flex gap-2">
                    <button className="text-slate-500 hover:underline" onClick={handleRestoreDefaultColumns}>
                      {copy.submissionsTable.columnSelector.restoreDefault}
                    </button>
                    <button className="text-slate-500 hover:underline" onClick={handleClearColumns}>
                      {copy.submissionsTable.columnSelector.clear}
                    </button>
                  </div>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto p-2 text-xs">
                  {columnOptions.map((option) => (
                    <label
                      key={option.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        checked={visibleColumns.includes(option.key)}
                        onChange={() => toggleColumnVisibility(option.key)}
                      />
                      <span className="break-words whitespace-normal">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => callBulk({ action: 'status', ids: selected, status: 'FINAL' })}
            disabled={!selected.length || loadingAction || !canUpdate}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.submissionsTable.bulkActions.complete}
          </button>
          <button
            type="button"
            onClick={() => callBulk({ action: 'archive', ids: selected })}
            disabled={!selected.length || loadingAction || !canUpdate}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.submissionsTable.bulkActions.archive}
          </button>
          <button
            type="button"
            onClick={() => callBulk({ action: 'delete', ids: selected })}
            disabled={!selected.length || loadingAction || !canDelete}
            className="rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copy.submissionsTable.bulkActions.delete}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-max w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={copy.submissionsTable.aria.selectAll}
                />
              </th>
              {columnOptions.map((option) =>
                isVisible(option.key) ? (
                  <th
                    key={option.key}
                    className={`px-4 py-3 text-left ${option.key === 'action' ? 'text-right' : ''}`}
                    aria-sort={
                      sortableColumns.has(option.key)
                        ? sortState?.key === option.key
                          ? sortState.direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                  >
                    {sortableColumns.has(option.key) ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(option.key)}
                        className="group inline-flex items-center gap-2 text-left"
                      >
                        <span>{option.label}</span>
                        <span className="text-[10px] text-slate-400 group-hover:text-slate-600">
                          {sortState?.key === option.key ? (sortState.direction === 'asc' ? '^' : 'v') : '-'}
                        </span>
                      </button>
                    ) : (
                      option.label
                    )}
                  </th>
                ) : null,
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedData.map((row) => {
              const checked = selected.includes(row.docId)
              return (
                <tr key={`${row.docId}-${row.itemId ?? 'na'}`} className="text-sm text-slate-800">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(row.docId)}
                      aria-label={formatCopy(copy.submissionsTable.aria.selectRow, { code: row.code })}
                    />
                  </td>
                  {columnOptions.map((option) =>
                    isVisible(option.key) ? (
                      <td key={option.key} className={cellClassName(option.key)}>
                        {renderCell(row, option.key)}
                      </td>
                    ) : null,
                  )}
                </tr>
              )
            })}
            {!data.length ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-500">
                  {copy.submissionsTable.empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-600">
        <span>
          {formatCopy(copy.submissionsTable.pagination.summary, {
            total: sortedData.length,
            page,
            totalPages,
          })}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="text-slate-400">{copy.submissionsTable.pagination.pageSizeLabel}</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const value = Number(e.target.value)
                if (!Number.isFinite(value)) return
                setPageSize(value)
                setPage(1)
              }}
              className="h-8 rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
              aria-label={copy.submissionsTable.pagination.pageSizeLabel}
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            {copy.submissionsTable.pagination.prev}
          </button>
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <input
              type="number"
              min={1}
              max={totalPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={() => {
                const value = Number(pageInput)
                if (!Number.isFinite(value)) {
                  setPageInput(String(page))
                  return
                }
                const next = Math.min(totalPages, Math.max(1, Math.round(value)))
                if (next !== page) setPage(next)
                setPageInput(String(next))
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = Number(pageInput)
                  const next = Number.isFinite(value) ? Math.min(totalPages, Math.max(1, Math.round(value))) : page
                  if (next !== page) setPage(next)
                  setPageInput(String(next))
                }
              }}
              className="h-8 w-14 rounded-full border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
              aria-label={copy.submissionsTable.pagination.goTo}
            />
            <span className="text-slate-400">/ {totalPages}</span>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700 hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            {copy.submissionsTable.pagination.next}
          </button>
        </div>
      </div>
    </div>
  )
}
