import { PaymentStatus } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateFinanceEntry } from '@/lib/server/financeStore'
import { prisma } from '@/lib/prisma'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPaymentStatus = (value: unknown): value is PaymentStatus =>
  value === 'PENDING' || value === 'PAID'

const allowedPatchFields = new Set([
  'projectId',
  'reason',
  'categoryKey',
  'amount',
  'unitId',
  'paymentTypeId',
  'handlerId',
  'paymentDate',
  'paymentStatus',
  'tva',
  'remark',
])

type FinanceEntryPatch = Partial<{
  projectId: number
  reason: string
  categoryKey: string
  amount: number
  unitId: number
  paymentTypeId: number
  handlerId: number | null
  paymentDate: string
  paymentStatus: PaymentStatus
  tva: number | null
  remark: string | null
}>

const buildPatchPayload = (patch: Record<string, unknown>): FinanceEntryPatch => {
  const payload: FinanceEntryPatch = {}
  Object.keys(patch).forEach((key) => {
    if (!allowedPatchFields.has(key)) {
      throw new Error(`包含不允许的字段: ${key}`)
    }
  })

  if (Object.prototype.hasOwnProperty.call(patch, 'projectId')) {
    const value = Number(patch.projectId)
    if (!Number.isFinite(value)) throw new Error('项目无效')
    payload.projectId = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'reason')) {
    const value = typeof patch.reason === 'string' ? patch.reason.trim() : ''
    if (!value) throw new Error('事由不能为空')
    payload.reason = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'categoryKey')) {
    const value = typeof patch.categoryKey === 'string' ? patch.categoryKey.trim() : ''
    if (!value) throw new Error('分类不能为空')
    payload.categoryKey = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'amount')) {
    const value = Number(patch.amount)
    if (!Number.isFinite(value)) throw new Error('金额无效')
    payload.amount = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'unitId')) {
    const value = Number(patch.unitId)
    if (!Number.isFinite(value)) throw new Error('单位无效')
    payload.unitId = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'paymentTypeId')) {
    const value = Number(patch.paymentTypeId)
    if (!Number.isFinite(value)) throw new Error('支付方式无效')
    payload.paymentTypeId = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'handlerId')) {
    if (patch.handlerId === null) {
      payload.handlerId = null
    } else {
      const value = Number(patch.handlerId)
      if (!Number.isFinite(value)) throw new Error('经办人无效')
      payload.handlerId = value
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'paymentDate')) {
    const value = typeof patch.paymentDate === 'string' ? patch.paymentDate.trim() : ''
    if (!value) throw new Error('支付日期不能为空')
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) throw new Error('支付日期无效')
    payload.paymentDate = value
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'paymentStatus')) {
    if (!isPaymentStatus(patch.paymentStatus)) throw new Error('支付状态无效')
    payload.paymentStatus = patch.paymentStatus
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'tva')) {
    if (patch.tva === null || patch.tva === '') {
      payload.tva = null
    } else {
      const value = Number(patch.tva)
      if (!Number.isFinite(value)) throw new Error('税费无效')
      payload.tva = value
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'remark')) {
    if (patch.remark === null) {
      payload.remark = null
    } else if (typeof patch.remark === 'string') {
      payload.remark = patch.remark.trim()
    } else {
      payload.remark = null
    }
  }

  if (Object.keys(payload).length === 0) {
    throw new Error('缺少可更新字段')
  }
  return payload
}

export async function POST(request: NextRequest) {
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const items = Array.isArray(body?.items) ? body.items : []
  if (items.length === 0) {
    return NextResponse.json({ message: '缺少批量更新内容' }, { status: 400 })
  }

  const session = await getSessionUser()
  const results: Array<{ id: number; ok: boolean; error?: string }> = []

  for (const item of items) {
    const id = Number(item?.id)
    if (!Number.isFinite(id)) {
      results.push({ id: id || 0, ok: false, error: '无效的 ID' })
      continue
    }
    const patch = isRecord(item?.patch) ? item.patch : null
    if (!patch) {
      results.push({ id, ok: false, error: '缺少更新内容' })
      continue
    }

    try {
      const payload = buildPatchPayload(patch)
      const existing = await prisma.financeEntry.findUnique({
        where: { id },
        select: { isDeleted: true },
      })
      if (!existing) {
        results.push({ id, ok: false, error: '记录不存在' })
        continue
      }
      if (existing.isDeleted) {
        results.push({ id, ok: false, error: '记录已删除' })
        continue
      }
      await updateFinanceEntry(id, payload, session?.id)
      results.push({ id, ok: true })
    } catch (error) {
      results.push({ id, ok: false, error: (error as Error).message })
    }
  }

  return NextResponse.json({ results })
}
