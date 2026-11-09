import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { activateSignedBillRevision } from '@/lib/server/signedBillStore'
import { SignedBillError, positiveBillInteger } from '@/lib/value/signedBills'

export const runtime = 'nodejs'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasPermission('value:update')) return NextResponse.json({ message: '缺少产值更新权限' }, { status: 403 })
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ message: '请求体格式无效' }, { status: 400 })
  }
  try {
    const id = positiveBillInteger(Number((await params).id), '版本ID')
    const revision = await activateSignedBillRevision(id, payload, user.id)
    return NextResponse.json({ revision })
  } catch (error) {
    if (error instanceof SignedBillError) return NextResponse.json({ message: error.message }, { status: error.status })
    console.error('[signed-bills activate]', error)
    return NextResponse.json({ message: '无法切换签字版本，请稍后重试' }, { status: 500 })
  }
}
