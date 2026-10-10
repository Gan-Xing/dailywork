import { AccessDenied } from '@/components/AccessDenied'
import { getSessionUser } from '@/lib/server/authSession'
import { getValueBillReview } from '@/lib/server/valueBillReviewStore'

import BillReviewClient from './BillReviewClient'

export const dynamic = 'force-dynamic'

const REVIEW_KEY = 'tanda-attachment-6'

export default async function TandaAttachment6BillReviewPage() {
  const sessionUser = await getSessionUser()
  const isAdmin = sessionUser?.roles.some((role) => role.name === 'Admin') ?? false

  if (!sessionUser || !isAdmin) {
    return <AccessDenied locale="zh" permissions={['Admin']} hint="第六期最终计量审核页仅 Admin 可查看" />
  }

  const review = await getValueBillReview(REVIEW_KEY)

  return <BillReviewClient review={review} />
}
