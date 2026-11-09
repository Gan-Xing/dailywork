import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createSignedBillRevision, listSignedBillRevisions } from '@/lib/server/signedBillStore'
import { SignedBillError, billPeriodIndex, positiveBillInteger } from '@/lib/value/signedBills'

export const runtime = 'nodejs'

const failure = (error: unknown) => {
  if (error instanceof SignedBillError) return NextResponse.json({ message: error.message }, { status: error.status })
  console.error('[signed-bills]', error)
  return NextResponse.json({ message: '无法处理签字账单，请稍后重试' }, { status: 500 })
}

export async function GET(request: Request) {
  if (!await hasPermission('value:view')) return NextResponse.json({ message: '缺少产值查看权限' }, { status: 403 })
  try {
    const search = new URL(request.url).searchParams
    const projectId = positiveBillInteger(Number(search.get('projectId')), '项目ID')
    const periodIndex = search.has('periodIndex') ? billPeriodIndex(Number(search.get('periodIndex'))) : undefined
    const revisions = await listSignedBillRevisions({ projectId, periodIndex })
    return NextResponse.json({ revisions })
  } catch (error) {
    return failure(error)
  }
}

export async function POST(request: Request) {
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
    const result = await createSignedBillRevision(payload, user.id)
    return NextResponse.json(result, { status: result.reused ? 200 : 201 })
  } catch (error) {
    return failure(error)
  }
}
