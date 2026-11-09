import { NextResponse } from 'next/server'
import { hasPermission } from '@/lib/server/authSession'
import { previewBoqWorkMatch } from '@/lib/server/boqWorkPlanStore'
import { BoqWorkPlanError } from '@/lib/value/boqWorkPlans'
import { workId } from '@/lib/value/boqWorkPlanRules'

export const runtime = 'nodejs'
/** Deliberately a read-only preview: no allocations or confirmations are inserted. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!await hasPermission('value:update')) return NextResponse.json({ message: '缺少产值更新权限' }, { status: 403 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ message: '请求体格式无效' }, { status: 400 }) }
  try { return NextResponse.json(await previewBoqWorkMatch(workId(Number((await params).id), '账单版本'), body)) } catch (error) {
    if (error instanceof BoqWorkPlanError) return NextResponse.json({ message: error.message }, { status: error.status })
    console.error('[boq-work-match-preview]', error)
    return NextResponse.json({ message: '无法预览匹配；未写入核销数据' }, { status: 500 })
  }
}
