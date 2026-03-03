import { FinanceLedgerStage } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import { createFinanceLedgerEvent } from '@/lib/server/financeLedgerStore'

const isLedgerStage = (value: unknown): value is FinanceLedgerStage =>
  value === 'SITE_SIGNED' ||
  value === 'HQ_BILL_RECEIVED' ||
  value === 'BE_CONFIRMED' ||
  value === 'BE_DELIVERED' ||
  value === 'HQ_INVOICE_RECEIVED' ||
  value === 'CHEQUE_ISSUED' ||
  value === 'CHEQUE_RECEIVED'

const parseOptionalAmount = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error('金额字段无效')
  }
  return parsed
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const caseId = Number(idParam)
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return NextResponse.json({ message: '无效的 case ID' }, { status: 400 })
  }

  let payload: {
    stage?: unknown
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

  if (!isLedgerStage(payload.stage)) {
    return NextResponse.json({ message: 'stage 无效' }, { status: 400 })
  }
  if (!payload.occurredAt || typeof payload.occurredAt !== 'string') {
    return NextResponse.json({ message: 'occurredAt 必填' }, { status: 400 })
  }

  try {
    const session = await getSessionUser()
    const ledgerCase = await createFinanceLedgerEvent(
      caseId,
      {
        stage: payload.stage,
        occurredAt: payload.occurredAt,
        note: payload.note == null ? null : String(payload.note),
        accountAmount: parseOptionalAmount(payload.accountAmount),
        invoiceAmount: parseOptionalAmount(payload.invoiceAmount),
        advanceAmount: parseOptionalAmount(payload.advanceAmount),
        chequeAmount: parseOptionalAmount(payload.chequeAmount),
        invoiceNumber: payload.invoiceNumber == null ? null : String(payload.invoiceNumber),
        receiptChequeNumber: payload.receiptChequeNumber == null ? null : String(payload.receiptChequeNumber),
        remark: payload.remark == null ? null : String(payload.remark),
      },
      session?.id,
    )
    return NextResponse.json({ case: ledgerCase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

