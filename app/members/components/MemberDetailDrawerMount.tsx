import { MemberDetailDrawer } from '@/components/members/MemberDetailDrawer'
import type { Member } from '@/types/members'

type MemberDetailDrawerMountProps = {
  selectedMember: Member | null
  onClose: () => void
  onEdit: (member: Member) => void
  teamSupervisorMap: Map<string, { teamZh?: string | null }>
  canViewCompensation: boolean
}

export function MemberDetailDrawerMount({
  selectedMember,
  onClose,
  onEdit,
  teamSupervisorMap,
  canViewCompensation,
}: MemberDetailDrawerMountProps) {
  return (
    <MemberDetailDrawer
      key={selectedMember?.id ?? 'member-detail-drawer'}
      member={selectedMember}
      open={!!selectedMember}
      onClose={onClose}
      onEdit={(member) => onEdit(member)}
      teamSupervisorMap={teamSupervisorMap}
      canViewCompensation={canViewCompensation}
    />
  )
}
