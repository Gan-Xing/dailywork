import { NextResponse } from 'next/server';

import { hasPermission } from '@/lib/server/authSession';
import { prisma } from '@/lib/prisma';
import {
  buildGoodsNameKey,
  buildMaterialModelKey,
  normalizeMaterialModel,
} from '@/app/resources/weekly-plans/materialsConfig'

// GET /api/weekly-plans/recent-price?goodsName=xxx&model=yyy
export async function GET(req: Request) {
  if (!(await hasPermission('material:view'))) {
    return NextResponse.json({ message: '无权限' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const goodsName = searchParams.get('goodsName');
  const modelStr = searchParams.get('model');

  if (!goodsName) {
    return NextResponse.json({ price: null });
  }

  try {
    let modelObj = null;
    if (modelStr) {
      try {
        modelObj = normalizeMaterialModel(JSON.parse(modelStr));
      } catch {
        // invalid json
      }
    }

    const goodsNameKey = buildGoodsNameKey(goodsName);
    if (!goodsNameKey) {
      return NextResponse.json({ price: null });
    }

    const latestPrice = await prisma.weeklyMaterialLatestPrice.findUnique({
      where: {
        goodsNameKey_modelKey: {
          goodsNameKey,
          modelKey: buildMaterialModelKey(modelObj),
        },
      },
      select: {
        unitPrice: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      price: latestPrice?.unitPrice ? Number(latestPrice.unitPrice) : null,
      updatedAt: latestPrice?.updatedAt ?? null,
    });
  } catch (error) {
    console.error('[recent-price GET]', error);
    return NextResponse.json({ message: '查询失败' }, { status: 500 });
  }
}
