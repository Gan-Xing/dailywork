'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { useToast } from '@/components/ToastProvider'
import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export type LetterRow = {
  id: number
  documentId: number
  code: string
  status: 'DRAFT' | 'FINAL' | 'ARCHIVED'
  subject: string
  projectId: number
  projectName: string
  recipientLabel: string
  updatedAt: string
  attachments: number
}

type ProjectOption = { id: number; name: string }

type Props = {
  rows: LetterRow[]
  projects: ProjectOption[]
  canCreate: boolean
  canView: boolean
  canUpdate: boolean
  canDelete: boolean
}

const formatDate = (value: string) => value || '—'

export function LettersPageClient({
  rows,
  projects,
  canCreate,
  canView,
  canUpdate,
  canDelete,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const { addToast } = useToast()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [projectFilter, setProjectFilter] = useState('ALL')
  const [letterRows, setLetterRows] = useState(rows)

  const filteredRows = useMemo(() => {
    const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return letterRows.filter((row) => {
      if (statusFilter !== 'ALL' && row.status !== statusFilter) return false
      if (projectFilter !== 'ALL' && String(row.projectId) !== projectFilter) return false
      if (!tokens.length) return true
      const haystack = `${row.code} ${row.subject} ${row.recipientLabel} ${row.projectName}`.toLowerCase()
      return tokens.every((token) => haystack.includes(token))
    })
  }, [letterRows, projectFilter, search, statusFilter])

  const handleDelete = async (row: LetterRow) => {
    if (!canDelete) return
    if (!window.confirm(copy.letters.messages.deleteConfirm)) return
    try {
      const response = await fetch(`/api/documents/letters/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload.message ?? copy.letters.messages.loadError)
      }
      setLetterRows((prev) => prev.filter((item) => item.id !== row.id))
      addToast(copy.letters.messages.deleteSuccess, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">{copy.letters.title}</h2>
            <p className="text-sm text-slate-600">{copy.letters.description}</p>
          </div>
          {canCreate ? (
            <Link
              href="/documents/letters/new"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5"
            >
              {copy.letters.create}
            </Link>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-500">
            {copy.letters.filters.searchLabel}
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder={copy.letters.filters.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.letters.filters.statusLabel}
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">{copy.letters.filters.allLabel}</option>
              <option value="DRAFT">{copy.status.document.DRAFT}</option>
              <option value="FINAL">{copy.status.document.FINAL}</option>
              <option value="ARCHIVED">{copy.status.document.ARCHIVED}</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">
            {copy.letters.filters.projectLabel}
            <select
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
            >
              <option value="ALL">{copy.letters.filters.allLabel}</option>
              {projects.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredRows.length ? (
          <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-100/70">
                <tr className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <th className="w-[16%] px-3 py-3 text-left">{copy.letters.table.code}</th>
                  <th className="px-3 py-3 text-left">{copy.letters.table.subject}</th>
                  <th className="w-[18%] px-3 py-3 text-left">{copy.letters.table.recipient}</th>
                  <th className="w-[14%] px-3 py-3 text-left">{copy.letters.table.project}</th>
                  <th className="w-[10%] px-3 py-3 text-left">{copy.letters.table.status}</th>
                  <th className="w-[12%] px-3 py-3 text-left">{copy.letters.table.updatedAt}</th>
                  <th className="w-[8%] px-3 py-3 text-left">{copy.letters.table.attachments}</th>
                  <th className="w-[10%] px-3 py-3 text-left">{copy.letters.table.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="transition hover:bg-slate-50">
                    <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-800">
                      {row.code}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-800">{row.subject}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{row.recipientLabel || '—'}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{row.projectName}</td>
                    <td className="px-3 py-3 text-xs font-semibold text-slate-700">
                      {copy.status.document[row.status] ?? row.status}
                    </td>
                    <td className="px-3 py-3 text-xs text-slate-600">{formatDate(row.updatedAt)}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{row.attachments}</td>
                    <td className="px-3 py-3 text-xs">
                      <div className="flex flex-wrap gap-2">
                        {canView || canUpdate ? (
                          <Link
                            href={`/documents/letters/${row.id}`}
                            className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-white"
                          >
                            {canUpdate ? copy.letters.actions.edit : copy.letters.actions.view}
                          </Link>
                        ) : null}
                        {canDelete ? (
                          <button
                            type="button"
                            className="rounded-full border border-rose-200 px-3 py-1 text-[11px] font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50"
                            onClick={() => handleDelete(row)}
                          >
                            {copy.letters.actions.delete}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">{copy.letters.table.empty}</p>
        )}
      </div>
    </div>
  )
}
