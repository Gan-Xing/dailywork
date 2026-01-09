'use client'

import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import SubmissionEditor from './SubmissionEditor'

type Props = {
  canManage: boolean
  canEdit: boolean
  currentUser?: { id: number; username: string } | null
}

export function NewSubmissionPageClient({ canManage, canEdit, currentUser }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  return (
    <div className="space-y-6">
      <SubmissionEditor canManage={canManage} canEdit={canEdit} currentUser={currentUser} />
    </div>
  )
}
