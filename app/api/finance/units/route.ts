import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { ensureFinanceDefaults } from '@/lib/server/financeStore'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!hasPermission('finance:view')) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }
  await ensureFinanceDefaults()
  const units = await prisma.financeUnit.findMany({ orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })
  return NextResponse.json({ units })
}

export async function POST(request: Request) {
  if (!hasPermission('finance:manage')) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
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
    const unit = await prisma.financeUnit.create({
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
