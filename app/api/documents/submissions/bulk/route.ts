import { NextRequest, NextResponse } from 'next/server'

import { DocumentStatus } from '@prisma/client'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

type Payload =
  | { action: 'archive'; ids: number[] }
  | { action: 'delete'; ids: number[] }
  | { action: 'status'; ids: number[]; status: DocumentStatus }

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ message: '请先登录后再操作' }, { status: 401 })
  }
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少编辑权限' }, { status: 403 })
  }

  let payload: Payload
  try {
    payload = (await request.json()) as Payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!Array.isArray(payload.ids) || payload.ids.length === 0) {
    return NextResponse.json({ message: 'ids 不能为空' }, { status: 400 })
  }

  try {
    if (payload.action === 'archive') {
      const result = await prisma.document.updateMany({
        where: { id: { in: payload.ids } },
        data: { status: DocumentStatus.ARCHIVED, updatedById: sessionUser.id },
      })
      return NextResponse.json({ count: result.count })
    }

    if (payload.action === 'status') {
      if (!payload.status) return NextResponse.json({ message: 'status 必填' }, { status: 400 })
      const result = await prisma.document.updateMany({
        where: { id: { in: payload.ids } },
        data: { status: payload.status, updatedById: sessionUser.id },
      })
      return NextResponse.json({ count: result.count })
    }

    if (payload.action === 'delete') {
      const result = await prisma.document.deleteMany({ where: { id: { in: payload.ids } } })
      return NextResponse.json({ count: result.count })
    }

    return NextResponse.json({ message: '不支持的 action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
