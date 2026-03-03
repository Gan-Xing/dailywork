import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { updateFinanceLedgerEvent } from '@/lib/server/financeLedgerStore'

const parseOptionalAmount = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('金额字段无效')
  }
  return parsed
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eventIdParam } = await params
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const eventId = Number(eventIdParam)
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ message: '无效的 event ID' }, { status: 400 })
  }

  let payload: {
    occurredAt?: unknown
    note?: unknown
    accountAmount?: unknown
    invoiceAmount?: unknown
    advanceAmount?: unknown
    chequeAmount?: unknown
    invoiceNumber?: unknown
    receiptChequeNumber?: unknown
    remark?: unknown
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (payload.occurredAt !== undefined && typeof payload.occurredAt !== 'string') {
    return NextResponse.json({ message: 'occurredAt 无效' }, { status: 400 })
  }

  try {
    const parsedPayload: Parameters<typeof updateFinanceLedgerEvent>[1] = {
      occurredAt: payload.occurredAt as string | undefined,
      accountAmount: parseOptionalAmount(payload.accountAmount),
      invoiceAmount: parseOptionalAmount(payload.invoiceAmount),
      advanceAmount: parseOptionalAmount(payload.advanceAmount),
      chequeAmount: parseOptionalAmount(payload.chequeAmount),
    }
    if (payload.note !== undefined) {
      parsedPayload.note = payload.note == null ? null : String(payload.note)
    }
    if (payload.invoiceNumber !== undefined) {
      parsedPayload.invoiceNumber = payload.invoiceNumber == null ? null : String(payload.invoiceNumber)
    }
    if (payload.receiptChequeNumber !== undefined) {
      parsedPayload.receiptChequeNumber =
        payload.receiptChequeNumber == null ? null : String(payload.receiptChequeNumber)
    }
    if (payload.remark !== undefined) {
      parsedPayload.remark = payload.remark == null ? null : String(payload.remark)
    }

    const session = await getSessionUser()
    const ledgerCase = await updateFinanceLedgerEvent(eventId, parsedPayload, session?.id)
    return NextResponse.json({ case: ledgerCase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
