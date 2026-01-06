import { notFound } from 'next/navigation'

import { AccessDenied } from '@/components/AccessDenied'
import { getSessionUser } from '@/lib/server/authSession'
import { getUserById } from '@/lib/server/authStore'

import { MemberEditClient } from './MemberEditClient'

export default async function MemberEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const memberId = Number(id)
  if (!memberId) return notFound()

  const sessionUser = await getSessionUser()
  const permissions = sessionUser?.permissions ?? []
  const canUpdate =
    permissions.includes('member:update') ||
    permissions.includes('member:edit') ||
    permissions.includes('member:manage')
  if (!sessionUser || !canUpdate) {
    return <AccessDenied permissions={['member:update']} />
  }

  const member = await getUserById(memberId)
  if (!member) return notFound()

  const canAssignRole = permissions.includes('role:update') || permissions.includes('role:manage')
  const canDeleteMember = permissions.includes('member:delete')
  const isViewerChinese = sessionUser?.nationality === 'china'
  const canViewSignature = permissions.includes('signature:view')
  const canUploadSignature = permissions.includes('signature:upload')
  const canDeleteSignature = permissions.includes('signature:delete')

  return (
    <MemberEditClient
      member={member}
      canAssignRole={canAssignRole}
      canDeleteMember={canDeleteMember}
      isViewerChinese={isViewerChinese}
      canViewSignature={canViewSignature}
      canUploadSignature={canUploadSignature}
      canDeleteSignature={canDeleteSignature}
    />
  )
}
