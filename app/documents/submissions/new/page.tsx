import { getSessionUser, hasPermission } from '@/lib/server/authSession'

import SubmissionEditor from './SubmissionEditor'

export default async function NewSubmissionPage() {
  const canManage = await hasPermission('submission:manage')
  const sessionUser = await getSessionUser()

  return <SubmissionEditor canManage={canManage} currentUser={sessionUser} />
}
