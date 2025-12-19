'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

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

export default function SubmissionsTable({ rows }: { rows: SubmissionRow[] }) {
  const [selected, setSelected] = useState<number[]>([])
  const [data, setData] = useState<SubmissionRow[]>(rows)
  const [loadingAction, setLoadingAction] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(() => defaultVisibleColumns)
  const [showColumnSelector, setShowColumnSelector] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement | null>(null)

  const columnOptions: ColumnOption[] = useMemo(
    () => [
      { key: 'code', label: '编号' },
      { key: 'submissionNumber', label: '提交单编号' },
      { key: 'rawCode', label: '原始编号' },
      { key: 'docId', label: '文档ID' },
      { key: 'status', label: '状态' },
      { key: 'projectName', label: '项目名称' },
      { key: 'projectCode', label: '项目编码' },
      { key: 'contractNumbers', label: '合同编号' },
      { key: 'bordereauNumber', label: '清单编号' },
      { key: 'subject', label: '主题' },
      { key: 'senderOrg', label: '发件单位' },
      { key: 'senderDate', label: '提交时间' },
      { key: 'senderLastName', label: '发件人姓' },
      { key: 'senderFirstName', label: '发件人名' },
      { key: 'senderTime', label: '发件时间' },
      { key: 'recipientOrg', label: '收件单位' },
      { key: 'recipientDate', label: '收件日期' },
      { key: 'recipientLastName', label: '收件人姓' },
      { key: 'recipientFirstName', label: '收件人名' },
      { key: 'recipientTime', label: '收件时间' },
      { key: 'comments', label: '提交单备注' },
      { key: 'submissionCreatedAt', label: '创建时间' },
      { key: 'submissionUpdatedAt', label: '提交单更新时间' },
      { key: 'designation', label: '明细' },
      { key: 'quantity', label: '数量' },
      { key: 'observation', label: '明细备注' },
      { key: 'itemId', label: '明细ID' },
      { key: 'itemOrder', label: '明细序号' },
      { key: 'itemCreatedAt', label: '明细创建时间' },
      { key: 'itemUpdatedAt', label: '明细更新时间' },
      { key: 'title', label: '标题' },
      { key: 'documentType', label: '单据类型' },
      { key: 'documentRemark', label: '文档备注' },
      { key: 'documentData', label: '文档数据' },
      { key: 'documentFiles', label: '附件' },
      { key: 'documentCreatedAt', label: '文档创建时间' },
      { key: 'documentUpdatedAt', label: '文档更新时间' },
      { key: 'templateName', label: '模板名称' },
      { key: 'templateVersion', label: '模板版本' },
      { key: 'templateId', label: '模板ID' },
      { key: 'createdBy', label: '创建人' },
      { key: 'createdById', label: '创建人ID' },
      { key: 'updatedBy', label: '更新人' },
      { key: 'updatedById', label: '更新人ID' },
      { key: 'action', label: '操作' },
    ],
    [],
  )

  const allSelected = selected.length > 0 && selected.length === new Set(data.map((r) => r.docId)).size
  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)
  const columnCount = columnOptions.filter((option) => isVisible(option.key)).length + 1

  useEffect(() => {
    setData(rows)
    setSelected([])
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
    if (allSelected) setSelected([])
    else setSelected(Array.from(new Set(data.map((r) => r.docId))))
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

  const callBulk = async (body: Record<string, unknown>) => {
    setLoadingAction(true)
    try {
      const res = await fetch('/api/documents/submissions/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...body, ids: Array.from(new Set(selected)) }),
      })
      const json = (await res.json()) as { message?: string; count?: number }
      if (!res.ok) throw new Error(json.message ?? '批量操作失败')
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
            {displayValue(row.status)}
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
        return (
          <div className="flex justify-end gap-2 text-xs font-semibold">
            <Link href={href} className="rounded-full bg-emerald-500 px-3 py-1 text-white shadow">
              编辑
            </Link>
            <button
              type="button"
              className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
            >
              导出 PDF
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
        <span>提交单</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={columnSelectorRef}>
            <button
              type="button"
              className="flex min-w-[140px] items-center justify-between rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              onClick={() => setShowColumnSelector((prev) => !prev)}
            >
              <span className="truncate">
                {visibleColumns.length ? `已选 ${visibleColumns.length} 列` : '未选择列'}
              </span>
              <span className="text-xs text-slate-400">⌕</span>
            </button>
            {showColumnSelector ? (
              <div className="absolute right-0 z-10 mt-2 w-80 max-w-sm rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-500">
                  <button className="text-emerald-600 hover:underline" onClick={handleSelectAllColumns}>
                    全选
                  </button>
                  <div className="flex gap-2">
                    <button className="text-slate-500 hover:underline" onClick={handleRestoreDefaultColumns}>
                      恢复默认
                    </button>
                    <button className="text-slate-500 hover:underline" onClick={handleClearColumns}>
                      清空
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
            disabled={!selected.length || loadingAction}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            批量完成
          </button>
          <button
            type="button"
            onClick={() => callBulk({ action: 'archive', ids: selected })}
            disabled={!selected.length || loadingAction}
            className="rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            批量归档
          </button>
          <button
            type="button"
            onClick={() => callBulk({ action: 'delete', ids: selected })}
            disabled={!selected.length || loadingAction}
            className="rounded-full border border-rose-300 px-3 py-1 text-[11px] font-semibold text-rose-700 hover:border-rose-400 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            批量删除
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-max w-full divide-y divide-slate-100">
          <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            <tr>
              <th className="px-4 py-3 text-left">
                <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="全选" />
              </th>
              {columnOptions.map((option) =>
                isVisible(option.key) ? (
                  <th
                    key={option.key}
                    className={`px-4 py-3 text-left ${option.key === 'action' ? 'text-right' : ''}`}
                  >
                    {option.label}
                  </th>
                ) : null,
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row) => {
              const checked = selected.includes(row.docId)
              return (
                <tr key={`${row.docId}-${row.itemId ?? 'na'}`} className="text-sm text-slate-800">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOne(row.docId)}
                      aria-label={`选择 ${row.code}`}
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
                  暂无提交单，点击“新建提交单”开始。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}
