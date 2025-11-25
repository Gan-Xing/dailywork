import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { deactivateFinanceCategory, ensureFinanceCategories, upsertFinanceCategory } from '@/lib/server/financeStore'
import { prisma } from '@/lib/prisma'

export async function GET() {
  if (!hasPermission('finance:view')) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }
  await ensureFinanceCategories()
  const categories = await prisma.financeCategory.findMany({
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  })
  return NextResponse.json({ categories })
}

export async function POST(request: Request) {
  if (!hasPermission('finance:manage')) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
  }

  let payload: {
    key?: string
    parentKey?: string | null
    labelZh?: string
    labelEn?: string | null
    labelFr?: string | null
    code?: string | null
    sortOrder?: number
    isActive?: boolean
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.key || !payload.labelZh) {
    return NextResponse.json({ message: '缺少必填字段 key/labelZh' }, { status: 400 })
  }

  try {
    const category = await upsertFinanceCategory({
      key: payload.key,
      parentKey: payload.parentKey ?? null,
      labelZh: payload.labelZh,
      labelEn: payload.labelEn ?? null,
      labelFr: payload.labelFr ?? null,
      code: payload.code ?? null,
      sortOrder: payload.sortOrder ?? 0,
      isActive: payload.isActive ?? true,
    })
    return NextResponse.json({ category })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  if (!hasPermission('finance:manage')) {
    return NextResponse.json({ message: '缺少财务管理权限' }, { status: 403 })
  }
  let payload: { key?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }
  if (!payload.key) {
    return NextResponse.json({ message: '缺少 key' }, { status: 400 })
  }
  try {
    const category = await deactivateFinanceCategory(payload.key)
    return NextResponse.json({ category })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
