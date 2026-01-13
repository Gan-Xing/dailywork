'use client'

import Link from 'next/link'

import { locales } from '@/lib/i18n'
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
      <SubmissionsFilters
        query={query}
        templates={templates}
        creators={creators}
        statusList={statusList}
        submissionNumbers={submissionNumbers}
      />

      <SubmissionsTable rows={rows} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} canView={canView} />
    </div>
  )
}
