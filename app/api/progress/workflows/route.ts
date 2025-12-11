import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  listWorkflowsWithDefaults,
  updateWorkflowTemplate,
} from '@/lib/server/workflowStore'

export async function GET() {
  if (!hasPermission('road:manage')) {
    return NextResponse.json({ message: '缺少道路管理权限' }, { status: 403 })
  }
  const workflows = await listWorkflowsWithDefaults()
  return NextResponse.json({ workflows })
}

export async function POST(request: Request) {
  if (!hasPermission('road:manage')) {
    return NextResponse.json({ message: '缺少道路管理权限' }, { status: 403 })
  }

  let payload: Record<string, unknown>
  try {
    payload = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const action = (payload.action as string) ?? 'save'

  try {
    if (action === 'create') {
      const workflow = await createWorkflowTemplate({
        name: String(payload.name || ''),
        measure: (payload.measure as any) ?? 'LINEAR',
        pointHasSides: Boolean(payload.pointHasSides),
        workflow: payload.workflow as any,
      })
      return NextResponse.json({ workflow }, { status: 201 })
    }

    if (!payload.phaseDefinitionId || !payload.workflow) {
      return NextResponse.json({ message: '缺少必填字段：phaseDefinitionId 或 workflow' }, { status: 400 })
    }

    const layers = Array.isArray((payload.workflow as any)?.layers) ? (payload.workflow as any).layers : []
    const checks =
      layers.flatMap((layer: any) => (Array.isArray(layer.checks) ? layer.checks : [])).filter((c: any) => c && c.name)
    if (!layers.length) {
      return NextResponse.json({ message: '模板至少需要 1 个层次，请先添加层次后再保存' }, { status: 400 })
    }
    if (!checks.length) {
      return NextResponse.json({ message: '模板至少需要 1 个验收内容，请先添加验收内容后再保存' }, { status: 400 })
    }

    const workflow = await updateWorkflowTemplate({
      phaseDefinitionId: Number(payload.phaseDefinitionId),
      workflow: payload.workflow as any,
      name: (payload.name as string | undefined) ?? (payload.workflow as any)?.phaseName,
      measure: (payload.measure as any) ?? (payload.workflow as any)?.measure,
      pointHasSides: payload.pointHasSides as boolean | undefined,
    })
    return NextResponse.json({ workflow })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  if (!hasPermission('road:manage')) {
    return NextResponse.json({ message: '缺少道路管理权限' }, { status: 403 })
  }

  let payload: { phaseDefinitionId?: number }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.phaseDefinitionId) {
    return NextResponse.json({ message: '缺少必填字段：phaseDefinitionId' }, { status: 400 })
  }

  try {
    await deleteWorkflowTemplate(Number(payload.phaseDefinitionId))
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
