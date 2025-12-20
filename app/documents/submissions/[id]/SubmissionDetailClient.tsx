'use client'

import type { DocumentStatus } from '@prisma/client'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { formatCopy, locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { SubmissionData } from '@/types/documents'

import SubmissionEditor from '../new/SubmissionEditor'

type Props = {
  initialSubmission: {
    id: number
    title: string | null
    templateId: string | null
    templateVersion?: number | null
    data: SubmissionData
    status: DocumentStatus
  }
  submissionNumber?: number | null
  canManage: boolean
  canEdit: boolean
  currentUser?: { id: number; username: string } | null
}

export function SubmissionDetailClient({
  initialSubmission,
  submissionNumber,
  canManage,
  canEdit,
  currentUser,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const detailLabel = submissionNumber
    ? formatCopy(copy.breadcrumbs.submissionDetailWithNumber, { number: submissionNumber })
    : copy.breadcrumbs.submissionDetailFallback

  return (
    <div className="space-y-6">
      <Breadcrumbs
        variant="light"
        items={[
          { label: copy.breadcrumbs.home, href: '/' },
          { label: copy.breadcrumbs.documents, href: '/documents' },
          { label: copy.breadcrumbs.submissions, href: '/documents/submissions' },
          { label: detailLabel },
        ]}
      />
      <SubmissionEditor
        initialSubmission={initialSubmission}
        canManage={canManage}
        canEdit={canEdit}
        currentUser={currentUser}
      />
    </div>
  )
}
