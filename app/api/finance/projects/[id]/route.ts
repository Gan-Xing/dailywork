import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: { id: string }
}

export async function PUT(request: Request, { params }: RouteParams) {
  if (!hasPermission('finance:manage')) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
  }
  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的项目 ID' }, { status: 400 })
  }

  let payload: { name?: string; code?: string | null; isActive?: boolean }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.name) {
    return NextResponse.json({ message: '缺少项目名称' }, { status: 400 })
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: {
        name: payload.name,
        code: payload.code ?? null,
        isActive: payload.isActive ?? true,
      },
    })
    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  if (!hasPermission('finance:manage')) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
  }
  const id = Number(params.id)
  if (!Number.isFinite(id)) {
    return NextResponse.json({ message: '无效的项目 ID' }, { status: 400 })
  }

  try {
    const project = await prisma.project.update({
      where: { id },
      data: { isActive: false },
    })
    return NextResponse.json({ project })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
