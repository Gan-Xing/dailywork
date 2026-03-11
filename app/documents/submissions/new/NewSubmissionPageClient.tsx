'use client'

import { useMemo } from 'react'

import { buildDefaultSubmissionDraft } from '@/lib/documents/submissionDefaults'

import SubmissionEditor from './SubmissionEditor'

type Props = {
  canManage: boolean
  canEdit: boolean
  currentUser?: { id: number; username: string } | null
  suggestedSubmissionNumber: number
}

export function NewSubmissionPageClient({ canManage, canEdit, currentUser, suggestedSubmissionNumber }: Props) {
  const defaultDraft = useMemo(
    () => buildDefaultSubmissionDraft({ suggestedSubmissionNumber }),
    [suggestedSubmissionNumber],
  )

  return (
    <div className="space-y-6">
      <SubmissionEditor
        canManage={canManage}
        canEdit={canEdit}
        currentUser={currentUser}
        defaultDraft={defaultDraft}
      />
    </div>
  )
}
