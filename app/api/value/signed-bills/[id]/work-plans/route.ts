import { NextResponse } from 'next/server'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { listBoqWorkPlans, saveBoqWorkPlan } from '@/lib/server/boqWorkPlanStore'
import { BoqWorkPlanError } from '@/lib/value/boqWorkPlans'
import { workId } from '@/lib/value/boqWorkPlanRules'

export const runtime = 'nodejs'
const failure = (error: unknown) => {
  if (error instanceof BoqWorkPlanError) return NextResponse.json({ message: error.message }, { status: error.status })
  if (error && typeof error === 'object' && 'code' in error && ['P2002', 'P2034'].includes(String(error.code))) return NextResponse.json({ message: '计划版本冲突，请刷新核对' }, { status: 409 })
  console.error('[boq-work-plans]', error)
  return NextResponse.json({ message: '无法读取或保存待计量计划' }, { status: 500 })
}
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasPermission('value:view')) return NextResponse.json({ message: '缺少产值查看权限' }, { status: 403 })
  try {
    const result = await listBoqWorkPlans(workId(Number((await params).id), '账单版本'))
    if (!await hasPermission('value:update')) { result.editAllowed = false; result.readOnlyReason = '当前账号只可查看待计量计划。' }
    return NextResponse.json(result)
  } catch (error) { return failure(error) }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasPermission('value:update')) return NextResponse.json({ message: '缺少产值更新权限' }, { status: 403 })
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ message: '请先登录' }, { status: 401 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ message: '请求体格式无效' }, { status: 400 }) }
  try { return NextResponse.json(await saveBoqWorkPlan(workId(Number((await params).id), '账单版本'), body, user.id)) } catch (error) { return failure(error) }
}
