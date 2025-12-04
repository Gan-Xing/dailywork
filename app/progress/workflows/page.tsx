import { AccessDenied } from '@/components/AccessDenied'
import { WorkflowManager } from './WorkflowManager'
import { getProgressCopy } from '@/lib/i18n/progress'
import { getSessionUser } from '@/lib/server/authSession'
import { listWorkflowsWithDefaults } from '@/lib/server/workflowStore'

export const dynamic = 'force-dynamic'

export default async function WorkflowPage() {
  const sessionUser = getSessionUser()
  const canManage = sessionUser?.permissions.includes('road:manage') ?? false

  if (!canManage) {
    const t = getProgressCopy('zh')
    return <AccessDenied permissions={['road:manage']} hint={t.workflow.accessHint} />
  }

  const workflows = await listWorkflowsWithDefaults()

  return (
    <WorkflowManager initialWorkflows={workflows} />
  )
}
