import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { ensureFinanceDefaults } from '@/lib/server/financeStore'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!hasPermission('finance:view')) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }
  await ensureFinanceDefaults()
  const projects = await prisma.project.findMany({ orderBy: [{ name: 'asc' }, { id: 'asc' }] })
  return NextResponse.json({ projects })
}

export async function POST(request: Request) {
  if (!hasPermission('finance:manage')) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
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
    const project = await prisma.project.create({
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
