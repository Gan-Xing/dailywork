import type { Project, WeeklyDeliveryPlan, WeeklyDeliveryPlanItem, WeeklyDeliveryPlanProject } from '@prisma/client'
import { NextResponse } from 'next/server'

import { calculateWeekEndDate, parseDateInput } from '@/app/resources/weekly-plans/materialsConfig'
import { prisma } from '@/lib/prisma'
import { getSessionUser, hasPermission } from '@/lib/server/authSession'

export type PlanWithItems = WeeklyDeliveryPlan & {
  project: Pick<Project, 'id' | 'name'>
  projects: Array<WeeklyDeliveryPlanProject & { project: Pick<Project, 'id' | 'name'> }>
  items: WeeklyDeliveryPlanItem[]
  _count?: { items: number }
}

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

export async function GET(req: Request) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const projectIdStr = searchParams.get('projectId')
  const projectId = projectIdStr ? Number(projectIdStr) : null
  const where =
    projectId != null && Number.isFinite(projectId)
      ? {
          OR: [
            { projectId },
            { projects: { some: { projectId } } },
          ],
        }
      : {}

  try {
    const plans = await prisma.weeklyDeliveryPlan.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { month: 'desc' }, { session: 'desc' }],
      include: {
        project: { select: { id: true, name: true } },
        projects: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
        },
        _count: { select: { items: true } },
      },
    })
    return NextResponse.json({ plans })
  } catch (error) {
    console.error('[weekly-plans GET]', error)
    return NextResponse.json({ message: '查询失败' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 })
  }
  const session = await getSessionUser()
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 })

  try {
    const body = (await req.json()) as {
      projectId?: number
      projectIds?: number[]
      month: number
      session: number
      title?: string
      weekStartDate?: string
      approverName?: string
      editorName?: string
    }

    const normalizedProjectIds = normalizeProjectIds(body.projectIds)
    const primaryProjectId =
      normalizedProjectIds[0] ?? (Number.isInteger(body.projectId) && body.projectId! > 0 ? Number(body.projectId) : null)
    const projectIds = primaryProjectId
      ? Array.from(new Set([primaryProjectId, ...normalizedProjectIds]))
      : normalizedProjectIds

    const month = Number(body.month)
    const sess = Number(body.session)
    const parsedStartDate = parseDateInput(body.weekStartDate)
    const parsedEndDate = calculateWeekEndDate(parsedStartDate)

    if (!projectIds.length || !month || !sess || !parsedStartDate || !parsedEndDate) {
      return NextResponse.json(
        { message: '缺少必填字段：projectIds / month / session / weekStartDate' },
        { status: 400 },
      )
    }

    const title = body.title?.trim() || `M${month}S${sess}`

    const duplicatePlan = await prisma.weeklyDeliveryPlan.findFirst({
      where: {
        month,
        session: sess,
        OR: [
          { projectId: { in: projectIds } },
          { projects: { some: { projectId: { in: projectIds } } } },
        ],
      },
      select: { id: true },
    })
    if (duplicatePlan) {
      return NextResponse.json({ message: '所选项目中存在同一月份届次计划' }, { status: 409 })
    }

    const plan = await prisma.weeklyDeliveryPlan.create({
      data: {
        projectId: projectIds[0],
        month,
        session: sess,
        title,
        weekStartDate: parsedStartDate,
        weekEndDate: parsedEndDate,
        approverName: body.approverName ?? null,
        editorName: body.editorName ?? null,
        createdById: session.id,
        updatedById: session.id,
        projects: {
          create: projectIds.map((projectId, index) => ({
            projectId,
            sortOrder: index,
          })),
        },
      },
      include: {
        project: { select: { id: true, name: true } },
        projects: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: [{ sortOrder: 'asc' }, { projectId: 'asc' }],
        },
        _count: { select: { items: true } },
      },
    })
    return NextResponse.json({ plan }, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ message: '该项目下同一月份届次已存在' }, { status: 409 })
    }
    console.error('[weekly-plans POST]', error)
    return NextResponse.json({ message: '创建失败' }, { status: 500 })
  }
}
