import { NextResponse, type NextRequest } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:manage'))) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的单位 ID' }, { status: 400 })
  }

  let payload: { name?: string; symbol?: string | null; sortOrder?: number; isActive?: boolean }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.name) {
    return NextResponse.json({ message: '缺少单位名称' }, { status: 400 })
  }

  try {
    const unit = await prisma.financeUnit.update({
      where: { id },
      data: {
        name: payload.name,
        symbol: payload.symbol ?? null,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
      },
    })
    return NextResponse.json({ unit })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:manage'))) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的单位 ID' }, { status: 400 })
  }

  try {
    const unit = await prisma.financeUnit.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ unit })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
