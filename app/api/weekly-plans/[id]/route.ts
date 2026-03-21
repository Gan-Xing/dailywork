import { NextResponse } from 'next/server';

import { getSessionUser, hasPermission } from '@/lib/server/authSession';
import { prisma } from '@/lib/prisma';
import { calculateWeekEndDate, parseDateInput } from '@/app/resources/weekly-plans/materialsConfig';

// GET /api/weekly-plans/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }

  const { id } = await params;
  const planId = Number(id);

  try {
    const plan = await prisma.weeklyDeliveryPlan.findUnique({
      where: { id: planId },
      include: {
        project: { select: { id: true, name: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!plan) return NextResponse.json({ message: '计划不存在' }, { status: 404 });
    return NextResponse.json({ plan });
  } catch (error) {
    console.error('[weekly-plans/[id] GET]', error);
    return NextResponse.json({ message: '查询失败' }, { status: 500 });
  }
}

// PUT /api/weekly-plans/[id]
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 });

  const { id } = await params;
  const planId = Number(id);

  try {
    const body = (await req.json()) as {
      weekStartDate?: string | null;
      approverName?: string | null;
      editorName?: string | null;
    };

    const parsedStartDate =
      body.weekStartDate === undefined ? undefined : parseDateInput(body.weekStartDate);

    if (body.weekStartDate !== undefined && !parsedStartDate) {
      return NextResponse.json({ message: '开始日期格式不正确' }, { status: 400 });
    }

    const plan = await prisma.weeklyDeliveryPlan.update({
      where: { id: planId },
      data: {
        weekStartDate: parsedStartDate,
        weekEndDate:
          body.weekStartDate === undefined ? undefined : calculateWeekEndDate(parsedStartDate),
        approverName: body.approverName,
        editorName: body.editorName,
        updatedById: session.id,
      },
    });
    return NextResponse.json({ plan });
  } catch (error) {
    console.error('[weekly-plans/[id] PUT]', error);
    return NextResponse.json({ message: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/weekly-plans/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:delete'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }

  const { id } = await params;
  const planId = Number(id);

  try {
    await prisma.weeklyDeliveryPlan.delete({ where: { id: planId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[weekly-plans/[id] DELETE]', error);
    return NextResponse.json({ message: '删除失败' }, { status: 500 });
  }
}
