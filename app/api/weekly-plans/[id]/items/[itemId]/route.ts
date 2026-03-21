import { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server';

import { getSessionUser, hasPermission } from '@/lib/server/authSession';
import { prisma } from '@/lib/prisma';
import {
  buildGoodsNameKey,
  buildMaterialModelKey,
  normalizeGoodsName,
  normalizeMaterialModel,
  normalizeWeeklyPlanItemStatus,
} from '@/app/resources/weekly-plans/materialsConfig'
import { syncWeeklyPlanLatestPrice } from '@/lib/server/weeklyPlanPricing'

// PUT /api/weekly-plans/[id]/items/[itemId]
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 });

  const { id, itemId } = await params;
  const planId = Number(id);
  const itemIdNum = Number(itemId);

  try {
    const body = (await req.json()) as {
      deliveryDate?: string | null;
      supplier?: string | null;
      goodsName?: string | null;
      model?: unknown;
      unit?: string | null;
      status?: string | null;
      plannedQty?: number | null;
      transporter?: string | null;
      headPlateNumber?: string | null;
      tailPlateNumber?: string | null;
      phone?: string | null;
      actualQty?: number | null;
      unitPrice?: number | null;
      note?: string | null;
      sortOrder?: number;
    };

    const existingItem = await prisma.weeklyDeliveryPlanItem.findUnique({
      where: { id: itemIdNum },
      select: {
        id: true,
        goodsName: true,
        model: true,
        unitPrice: true,
      },
    })

    if (!existingItem) {
      return NextResponse.json({ message: '计划明细不存在' }, { status: 404 })
    }

    const nextGoodsName =
      body.goodsName === undefined ? existingItem.goodsName : normalizeGoodsName(body.goodsName)
    const nextModel =
      body.model === undefined ? existingItem.model : normalizeMaterialModel(body.model)
    const nextUnitPrice = body.unitPrice === undefined ? existingItem.unitPrice : body.unitPrice

    const item = await prisma.$transaction(async (tx) => {
      const updatedItem = await tx.weeklyDeliveryPlanItem.update({
        where: { id: itemIdNum },
        data: {
          deliveryDate: body.deliveryDate,
          supplier: body.supplier,
          goodsName: nextGoodsName,
          goodsNameKey: buildGoodsNameKey(nextGoodsName),
          model: body.model !== undefined ? nextModel ?? Prisma.JsonNull : undefined,
          modelKey:
            body.model !== undefined || body.goodsName !== undefined
              ? buildMaterialModelKey(nextModel)
              : undefined,
          unit: body.unit,
          status: body.status === undefined ? undefined : normalizeWeeklyPlanItemStatus(body.status),
          plannedQty: body.plannedQty != null ? body.plannedQty : null,
          transporter: body.transporter,
          headPlateNumber: body.headPlateNumber,
          tailPlateNumber: body.tailPlateNumber,
          phone: body.phone,
          actualQty: body.actualQty != null ? body.actualQty : null,
          unitPrice: body.unitPrice != null ? body.unitPrice : null,
          note: body.note,
          ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
        },
      })

      await tx.weeklyDeliveryPlan.update({
        where: { id: planId },
        data: { updatedById: session.id },
      })

      await syncWeeklyPlanLatestPrice(tx, {
        goodsName: nextGoodsName,
        model: nextModel,
        unitPrice: nextUnitPrice,
        sourceItemId: updatedItem.id,
      })

      return updatedItem
    })
    return NextResponse.json({ item });
  } catch (error) {
    console.error('[weekly-plans/[id]/items/[itemId] PUT]', error);
    return NextResponse.json({ message: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/weekly-plans/[id]/items/[itemId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> },
) {
  if (!(await hasPermission('material:delete'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }

  const { itemId } = await params;
  const itemIdNum = Number(itemId);

  try {
    await prisma.weeklyDeliveryPlanItem.delete({ where: { id: itemIdNum } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[weekly-plans/[id]/items/[itemId] DELETE]', error);
    return NextResponse.json({ message: '删除失败' }, { status: 500 });
  }
}
