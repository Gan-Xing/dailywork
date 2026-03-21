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

// POST /api/weekly-plans/[id]/items
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('material:create'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ message: '未登录' }, { status: 401 });

  const { id } = await params;
  const planId = Number(id);

  try {
    const body = (await req.json()) as {
      deliveryDate?: string;
      supplier?: string;
      goodsName?: string;
      model?: unknown;
      unit?: string;
      status?: string | null;
      plannedQty?: number | null;
      transporter?: string;
      headPlateNumber?: string;
      tailPlateNumber?: string;
      phone?: string;
      actualQty?: number | null;
      unitPrice?: number | null;
      note?: string;
    };

    const goodsName = normalizeGoodsName(body.goodsName);
    const model = normalizeMaterialModel(body.model);
    const status = normalizeWeeklyPlanItemStatus(body.status);
    const goodsNameKey = buildGoodsNameKey(goodsName);
    const modelKey = buildMaterialModelKey(model);

    // Determine next sortOrder
    const last = await prisma.weeklyDeliveryPlanItem.findFirst({
      where: { planId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const item = await prisma.$transaction(async (tx) => {
      const createdItem = await tx.weeklyDeliveryPlanItem.create({
        data: {
          planId,
          sortOrder,
          deliveryDate: body.deliveryDate ?? null,
          supplier: body.supplier ?? null,
          goodsName,
          goodsNameKey,
          model: model ?? Prisma.JsonNull,
          modelKey,
          unit: body.unit ?? null,
          status,
          plannedQty: body.plannedQty != null ? body.plannedQty : null,
          transporter: body.transporter ?? null,
          headPlateNumber: body.headPlateNumber ?? null,
          tailPlateNumber: body.tailPlateNumber ?? null,
          phone: body.phone ?? null,
          actualQty: body.actualQty != null ? body.actualQty : null,
          unitPrice: body.unitPrice != null ? body.unitPrice : null,
          note: body.note ?? null,
        },
      })

      await tx.weeklyDeliveryPlan.update({
        where: { id: planId },
        data: { updatedById: session.id },
      })

      await syncWeeklyPlanLatestPrice(tx, {
        goodsName,
        model,
        unitPrice: createdItem.unitPrice,
        sourceItemId: createdItem.id,
      })

      return createdItem
    })

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('[weekly-plans/[id]/items POST]', error);
    return NextResponse.json({ message: '添加行失败' }, { status: 500 });
  }
}
