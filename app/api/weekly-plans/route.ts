import type { Project, WeeklyDeliveryPlan, WeeklyDeliveryPlanItem } from '@prisma/client';
import { NextResponse } from 'next/server';

import { getSessionUser, hasPermission } from '@/lib/server/authSession';
import { prisma } from '@/lib/prisma';
import { calculateWeekEndDate, parseDateInput } from '@/app/resources/weekly-plans/materialsConfig';

export type PlanWithItems = WeeklyDeliveryPlan & {
  project: Pick<Project, 'id' | 'name'>;
  items: WeeklyDeliveryPlanItem[];
  _count?: { items: number };
};

// GET /api/weekly-plans?projectId=1
export async function GET(req: Request) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const projectIdStr = searchParams.get('projectId');
  const where = projectIdStr ? { projectId: Number(projectIdStr) } : {};

  try {
    const plans = await prisma.weeklyDeliveryPlan.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { month: 'desc' }, { session: 'desc' }],
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
    return NextResponse.json({ plans });
  } catch (error) {
    console.error('[weekly-plans GET]', error);
    return NextResponse.json({ message: '查询失败' }, { status: 500 });
  }
}

// POST /api/weekly-plans
export async function POST(req: Request) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 });

  try {
    const body = (await req.json()) as {
      projectId: number;
      month: number;
      session: number;
      weekStartDate?: string;
      approverName?: string;
      editorName?: string;
    };

    const { projectId, month, session: sess, weekStartDate, approverName, editorName } = body;
    const parsedStartDate = parseDateInput(weekStartDate);
    const parsedEndDate = calculateWeekEndDate(parsedStartDate);

    if (!projectId || !month || !sess || !parsedStartDate || !parsedEndDate) {
      return NextResponse.json(
        { message: '缺少必填字段：projectId / month / session / weekStartDate' },
        { status: 400 },
      );
    }

    const title = `M${month}S${sess}`;

    const plan = await prisma.weeklyDeliveryPlan.create({
      data: {
        projectId,
        month,
        session: sess,
        title,
        weekStartDate: parsedStartDate,
        weekEndDate: parsedEndDate,
        approverName: approverName ?? null,
        editorName: editorName ?? null,
        createdById: session.id,
        updatedById: session.id,
      },
      include: {
        project: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ message: '该项目下同一月份届次已存在' }, { status: 409 });
    }
    console.error('[weekly-plans POST]', error);
    return NextResponse.json({ message: '创建失败' }, { status: 500 });
  }
}
