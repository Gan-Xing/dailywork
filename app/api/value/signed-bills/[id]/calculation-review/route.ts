import { NextResponse } from 'next/server'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { getSignedCalculationReview, updateSignedCalculationNote } from '@/lib/server/signedBillCalculationStore'
import { SignedBillError, positiveBillInteger } from '@/lib/value/signedBills'

export const runtime = 'nodejs'
const failure = (error: unknown) => {
  if (error instanceof SignedBillError) return NextResponse.json({ message: error.message }, { status: error.status })
  console.error('[signed calculation review]', error)
  return NextResponse.json({ message: '无法读取或保存计算明细，请稍后重试' }, { status: 500 })
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasPermission('value:view')) return NextResponse.json({ message: '缺少产值查看权限' }, { status: 403 })
  try { return NextResponse.json(await getSignedCalculationReview(positiveBillInteger(Number((await params).id), '版本ID'))) } catch (error) { return failure(error) }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasPermission('value:update')) return NextResponse.json({ message: '缺少产值更新权限' }, { status: 403 })
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })
  let payload: unknown
  try { payload = await request.json() } catch { return NextResponse.json({ message: '请求体格式无效' }, { status: 400 }) }
  try { return NextResponse.json({ record: await updateSignedCalculationNote(positiveBillInteger(Number((await params).id), '版本ID'), payload, user.id) }) } catch (error) { return failure(error) }
}
