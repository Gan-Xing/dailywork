import { notFound } from 'next/navigation'

import { getSessionUser } from '@/lib/server/authSession'
import { findSubmissionDocByIdentifier } from '@/lib/server/submissionDocStore'
import type { SubmissionData } from '@/types/documents'

import { DocumentsAccessDenied } from '../../DocumentsAccessDenied'
import { SubmissionDetailClient } from './SubmissionDetailClient'

export default async function SubmissionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params

  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canView = permissions.includes('submission:view') || permissions.includes('submission:update')
  const canEdit = permissions.includes('submission:update')
  const canManage = permissions.includes('submission:manage')

  if (!sessionUser || !canView) {
    return <DocumentsAccessDenied permissions={['submission:view']} variant="submissionDetail" />
  }

  const submission = await findSubmissionDocByIdentifier(idParam)
  if (!submission) return notFound()

  const submissionNumber = submission.submission?.submissionNumber ?? null

  const data: SubmissionData = {
    documentMeta: {
      projectName: submission.submission?.projectName ?? (submission.data as any)?.documentMeta?.projectName ?? '',
      projectCode: submission.submission?.projectCode ?? (submission.data as any)?.documentMeta?.projectCode ?? '',
      contractNumbers:
        submission.submission?.contractNumbers && Array.isArray(submission.submission.contractNumbers)
          ? (submission.submission.contractNumbers as string[])
          : (submission.data as any)?.documentMeta?.contractNumbers ?? [],
      bordereauNumber: submission.submission?.bordereauNumber ?? (submission.data as any)?.documentMeta?.bordereauNumber ?? 0,
      subject: submission.submission?.subject ?? (submission.data as any)?.documentMeta?.subject ?? '',
    },
    parties: {
      sender: {
        organization: submission.submission?.senderOrg ?? (submission.data as any)?.parties?.sender?.organization ?? '',
        date: submission.submission?.senderDate ?? (submission.data as any)?.parties?.sender?.date ?? '',
        lastName: submission.submission?.senderLastName ?? (submission.data as any)?.parties?.sender?.lastName ?? '',
        firstName: submission.submission?.senderFirstName ?? (submission.data as any)?.parties?.sender?.firstName ?? '',
        signature: submission.submission?.senderSignature ?? (submission.data as any)?.parties?.sender?.signature ?? '',
        time: submission.submission?.senderTime ?? (submission.data as any)?.parties?.sender?.time ?? '',
      },
      recipient: {
        organization: submission.submission?.recipientOrg ?? (submission.data as any)?.parties?.recipient?.organization ?? '',
        date: submission.submission?.recipientDate ?? (submission.data as any)?.parties?.recipient?.date ?? '',
        lastName: submission.submission?.recipientLastName ?? (submission.data as any)?.parties?.recipient?.lastName ?? '',
        firstName: submission.submission?.recipientFirstName ?? (submission.data as any)?.parties?.recipient?.firstName ?? '',
        signature: submission.submission?.recipientSignature ?? (submission.data as any)?.parties?.recipient?.signature ?? '',
        time: submission.submission?.recipientTime ?? (submission.data as any)?.parties?.recipient?.time ?? '',
      },
    },
    items:
      submission.items?.length && submission.items.length > 0
        ? submission.items.map((it) => ({
            designation: it.designation,
            quantity: it.quantity ?? undefined,
            observation: it.observation ?? undefined,
          }))
        : (submission.data as any)?.items ?? [],
    comments: submission.submission?.comments ?? (submission.data as any)?.comments ?? '',
  }

  return (
    <SubmissionDetailClient
      initialSubmission={{
        id: submission.id,
        title: submission.title,
        data,
        status: submission.status,
        templateId: submission.templateId,
        templateVersion: submission.templateVersion,
      }}
      submissionNumber={submissionNumber}
      canManage={canManage}
      canEdit={canEdit}
      currentUser={sessionUser}
    />
  )
}
