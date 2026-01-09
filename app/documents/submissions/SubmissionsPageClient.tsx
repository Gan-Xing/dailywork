'use client'

import Link from 'next/link'

import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import SubmissionsFilters from './SubmissionsFilters'
import SubmissionsTable, { type SubmissionRow } from './SubmissionsTable'

type Props = {
  query: Record<string, unknown>
  templates: { id: string; name: string }[]
  creators: { id: number; username: string; name: string | null }[]
  statusList: string[]
  submissionNumbers: number[]
  rows: SubmissionRow[]
  canViewTemplates: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
  canView: boolean
}

export function SubmissionsPageClient({
  query,
  templates,
  creators,
  statusList,
  submissionNumbers,
  rows,
  canViewTemplates,
  canCreate,
  canUpdate,
  canDelete,
  canView,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          {copy.submissions.badge.title}
          <span className="h-[1px] w-10 bg-emerald-200" />
          {copy.submissions.badge.suffix}
        </div>
        <div className="flex items-center gap-2">
          {canViewTemplates ? (
            <Link
              href="/documents/templates"
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-100"
            >
              {copy.submissions.manageTemplates}
            </Link>
          ) : (
            <span className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400">
              {copy.submissions.manageTemplates}
            </span>
          )}
          {canCreate ? (
            <Link
              href="/documents/submissions/new"
              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40"
            >
              {copy.submissions.createSubmission}
            </Link>
          ) : (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
              {copy.submissions.createSubmission}
            </span>
          )}
        </div>
      </div>

      <SubmissionsFilters
        query={query}
        templates={templates}
        creators={creators}
        statusList={statusList}
        submissionNumbers={submissionNumbers}
      />

      <SubmissionsTable rows={rows} canUpdate={canUpdate} canDelete={canDelete} canView={canView} />
    </div>
  )
}
