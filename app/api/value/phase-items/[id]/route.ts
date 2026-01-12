import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { hasPermission } from '@/lib/server/authSession'

const respond = (message: string, status: number) =>
  NextResponse.json({ message }, { status })

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasPermission('value:view'))) {
    return respond('缺少产值查看权限', 403)
  }

  const { id } = await params
  const itemId = Number(id)
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return respond('分项名称无效', 400)
  }

  try {
    const item = await prisma.phaseItem.findUnique({
      where: { id: itemId },
      include: {
        phaseDefinition: { select: { id: true, name: true, measure: true } },
        formula: true,
        boqLinks: {
          where: {
            isActive: true,
            boqItem: {
              sheetType: 'CONTRACT',
              tone: 'ITEM',
              isActive: true,
            },
          },
          select: { boqItemId: true },
        },
      },
    })

    if (!item) {
      return respond('分项名称不存在', 404)
    }

    return NextResponse.json({
      item: {
        id: item.id,
        name: item.name,
        phaseDefinitionId: item.phaseDefinitionId,
        phaseDefinitionName: item.phaseDefinition.name,
        measure: item.measure,
        unitString: item.unitString ?? null,
        description: item.description ?? null,
      },
      formula: item.formula
        ? {
            expression: item.formula.expression,
            unitString: item.formula.unitString ?? null,
            inputSchema: item.formula.inputSchema ?? null,
          }
        : null,
      boqItemIds: item.boqLinks.map((link) => link.boqItemId),
    })
  } catch (error) {
    return respond((error as Error).message ?? '无法加载分项名称', 500)
  }
}
