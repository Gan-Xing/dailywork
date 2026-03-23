import { NextResponse } from 'next/server'

import { calculateWeekEndDate, parseDateInput } from '@/app/resources/weekly-plans/materialsConfig'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { resolveWeeklyPlanSignerInput } from '@/lib/server/weeklyPlanSigners'

const normalizeProjectIds = (value: unknown): number[] =>
  Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .map((item) => Number(item))
            .filter((item) => Number.isInteger(item) && item > 0),
        ),
      )
    : []

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const { id } = await params
  const planId = Number(id)

  try {
    const plan = await prisma.weeklyDeliveryPlan.findUnique({
      where: { id: planId },
      include: {
        project: { select: { id: true, name: true } },
        projects: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
        },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!plan) return NextResponse.json({ message: '计划不存在' }, { status: 404 })
    return NextResponse.json({ plan })
  } catch (error) {
    console.error('[weekly-plans/[id] GET]', error)
    return NextResponse.json({ message: '查询失败' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 })

  const { id } = await params
  const planId = Number(id)

  try {
    const body = (await req.json()) as {
      projectIds?: number[]
      month?: number
      session?: number
      title?: string | null
      weekStartDate?: string | null
      approverUserId?: number | null
      editorUserId?: number | null
      approverName?: string | null
      editorName?: string | null
    }

    const existingPlan = await prisma.weeklyDeliveryPlan.findUnique({
      where: { id: planId },
      include: {
        projects: {
          orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
        },
      },
    })
    if (!existingPlan) {
      return NextResponse.json({ message: '计划不存在' }, { status: 404 })
    }

    const parsedStartDate =
      body.weekStartDate === undefined ? undefined : parseDateInput(body.weekStartDate)
    if (body.weekStartDate !== undefined && !parsedStartDate) {
      return NextResponse.json({ message: '开始日期格式不正确' }, { status: 400 })
    }

    const normalizedProjectIds = normalizeProjectIds(body.projectIds)
    const nextProjectIds = normalizedProjectIds.length
      ? normalizedProjectIds
      : existingPlan.projects.length
        ? existingPlan.projects.map((entry) => entry.projectId)
        : [existingPlan.projectId]

    const nextMonth = body.month != null ? Number(body.month) : existingPlan.month
    const nextSession = body.session != null ? Number(body.session) : existingPlan.session
    const nextTitle = body.title?.trim() || `M${nextMonth}S${nextSession}`
    const nextPrimaryProjectId = nextProjectIds[0]
    const shouldResolveSigners =
      Object.prototype.hasOwnProperty.call(body, 'approverUserId') ||
      Object.prototype.hasOwnProperty.call(body, 'editorUserId') ||
      Object.prototype.hasOwnProperty.call(body, 'approverName') ||
      Object.prototype.hasOwnProperty.call(body, 'editorName')
    const signerInput = shouldResolveSigners
      ? await resolveWeeklyPlanSignerInput({
          approverUserId: body.approverUserId,
          editorUserId: body.editorUserId,
          approverName: body.approverName,
          editorName: body.editorName,
        })
      : null

    const conflictingPlan = await prisma.weeklyDeliveryPlan.findFirst({
      where: {
        id: { not: planId },
        month: nextMonth,
        session: nextSession,
        OR: [
          { projectId: { in: nextProjectIds } },
          { projects: { some: { projectId: { in: nextProjectIds } } } },
        ],
      },
      select: { id: true },
    })
    if (conflictingPlan) {
      return NextResponse.json({ message: '所选项目中存在同一月份届次计划' }, { status: 409 })
    }

    const plan = await prisma.$transaction(async (tx) => {
      const updatedPlan = await tx.weeklyDeliveryPlan.update({
        where: { id: planId },
        data: {
          project: { connect: { id: nextPrimaryProjectId } },
          month: nextMonth,
          session: nextSession,
          title: nextTitle,
          weekStartDate: parsedStartDate === undefined ? undefined : parsedStartDate,
          weekEndDate:
            body.weekStartDate === undefined ? undefined : calculateWeekEndDate(parsedStartDate),
          approverUser: signerInput
            ? signerInput.approverUserId
              ? { connect: { id: signerInput.approverUserId } }
              : { disconnect: true }
            : undefined,
          editorUser: signerInput
            ? signerInput.editorUserId
              ? { connect: { id: signerInput.editorUserId } }
              : { disconnect: true }
            : undefined,
          approverName: signerInput ? signerInput.approverName : undefined,
          editorName: signerInput ? signerInput.editorName : undefined,
          updatedBy: { connect: { id: session.id } },
        },
      })

      if (body.projectIds !== undefined) {
        await tx.weeklyDeliveryPlanProject.deleteMany({ where: { planId } })
        await tx.weeklyDeliveryPlanProject.createMany({
          data: nextProjectIds.map((projectId, index) => ({
            planId,
            projectId,
            sortOrder: index,
          })),
        })
      }

      return updatedPlan
    })

    return NextResponse.json({ plan })
  } catch (error) {
    if ((error as Error).message === 'INVALID_WEEKLY_PLAN_SIGNER') {
      return NextResponse.json(
        { code: 'INVALID_WEEKLY_PLAN_SIGNER', message: '审批人或编制人必须从中方人员名单中选择。' },
        { status: 400 },
      )
    }
    console.error('[weekly-plans/[id] PUT]', error)
    return NextResponse.json({ message: '更新失败' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:delete'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const { id } = await params
  const planId = Number(id)

  try {
    await prisma.weeklyDeliveryPlan.delete({ where: { id: planId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[weekly-plans/[id] DELETE]', error)
    return NextResponse.json({ message: '删除失败' }, { status: 500 })
  }
}
