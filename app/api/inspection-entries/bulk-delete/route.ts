import { NextResponse } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import type { IntervalSide } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再批量删除报检' }, { status: 401 })
  }
  const [canBulkEdit, canDelete] = await Promise.all([
    hasPermission('inspection:bulk-edit'),
    hasPermission('inspection:create'),
  ])
  if (!canBulkEdit || !canDelete) {
    return NextResponse.json({ message: '缺少报检批量删除权限' }, { status: 403 })
  }

  let body: { ids?: unknown }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    : []
  if (!ids.length) {
    return NextResponse.json({ message: '请选择需要删除的报检明细' }, { status: 400 })
  }

  try {
    const seedEntries = await prisma.inspectionEntry.findMany({
      where: { id: { in: ids } },
      select: { roadId: true, phaseId: true, side: true, startPk: true, endPk: true, documentId: true },
    })
    if (!seedEntries.length) {
      return NextResponse.json({ message: '未找到需要删除的报检明细' }, { status: 404 })
    }
    const groupMap = new Map<
      string,
      { roadId: number; phaseId: number; side: IntervalSide; startPk: number; endPk: number; documentId: number | null }
    >()
    seedEntries.forEach((entry) => {
      const key = `${entry.roadId}:${entry.phaseId}:${entry.side}:${entry.startPk}:${entry.endPk}:${entry.documentId ?? 'null'}`
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          roadId: entry.roadId,
          phaseId: entry.phaseId,
          side: entry.side,
          startPk: entry.startPk,
          endPk: entry.endPk,
          documentId: entry.documentId ?? null,
        })
      }
    })
    const groupFilters = Array.from(groupMap.values()).map((entry) => ({
      roadId: entry.roadId,
      phaseId: entry.phaseId,
      side: entry.side,
      startPk: entry.startPk,
      endPk: entry.endPk,
      documentId: entry.documentId,
    }))
    const groupedEntries = await prisma.inspectionEntry.findMany({
      where: { OR: groupFilters },
      select: { id: true },
    })
    const expandedIds = groupedEntries.map((entry) => entry.id)
    if (!expandedIds.length) {
      return NextResponse.json({ message: '未找到需要删除的报检明细' }, { status: 404 })
    }
    const result = await prisma.inspectionEntry.deleteMany({ where: { id: { in: expandedIds } } })
    return NextResponse.json({ deleted: result.count })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
