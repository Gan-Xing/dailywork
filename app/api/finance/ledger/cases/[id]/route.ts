import { FinanceLedgerCaseStatus, FinanceLedgerStage } from '@prisma/client'
import { NextResponse, type NextRequest } from 'next/server'

import { getSessionUser, hasPermission } from '@/lib/server/authSession'
import {
  getFinanceLedgerCase,
  softDeleteFinanceLedgerCase,
  updateFinanceLedgerCase,
} from '@/lib/server/financeLedgerStore'

const isLedgerStatus = (value: unknown): value is FinanceLedgerCaseStatus =>
  value === 'IN_PROGRESS' || value === 'DONE' || value === 'BLOCKED'

const isLedgerStage = (value: string): value is FinanceLedgerStage =>
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

const parseOptionalDate = (value: unknown) => {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') {
    throw new Error('日期字段无效')
  }
  return value
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:view'))) {
    return NextResponse.json({ message: '缺少财务查看权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: '无效的 ID' }, { status: 400 })
  }

  try {
    const ledgerCase = await getFinanceLedgerCase(id)
    return NextResponse.json({ case: ledgerCase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 404 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: '无效的 ID' }, { status: 400 })
  }

  let payload: {
    status?: unknown
    accountAmount?: unknown
    invoiceAmount?: unknown
    advanceAmount?: unknown
    chequeAmount?: unknown
    invoiceNumber?: unknown
    receiptChequeNumber?: unknown
    remark?: unknown
    constructionStartedAt?: unknown
    constructionFinishedAt?: unknown
    stageDates?: unknown
  }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const parsedPayload: Parameters<typeof updateFinanceLedgerCase>[1] = {}
  if (payload.status !== undefined) {
    if (!isLedgerStatus(payload.status)) {
      return NextResponse.json({ message: 'status 无效' }, { status: 400 })
    }
    parsedPayload.status = payload.status
  }

  try {
    parsedPayload.accountAmount = parseOptionalAmount(payload.accountAmount)
    parsedPayload.invoiceAmount = parseOptionalAmount(payload.invoiceAmount)
    parsedPayload.advanceAmount = parseOptionalAmount(payload.advanceAmount)
    parsedPayload.chequeAmount = parseOptionalAmount(payload.chequeAmount)
    parsedPayload.constructionStartedAt = parseOptionalDate(payload.constructionStartedAt)
    parsedPayload.constructionFinishedAt = parseOptionalDate(payload.constructionFinishedAt)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
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
  if (payload.stageDates !== undefined) {
    if (
      payload.stageDates == null ||
      typeof payload.stageDates !== 'object' ||
      Array.isArray(payload.stageDates)
    ) {
      return NextResponse.json({ message: 'stageDates 无效' }, { status: 400 })
    }
    const stageDates = payload.stageDates as Record<string, unknown>
    const parsedStageDates: Partial<Record<FinanceLedgerStage, string | null>> = {}
    for (const [key, rawValue] of Object.entries(stageDates)) {
      if (!isLedgerStage(key)) continue
      try {
        parsedStageDates[key] = parseOptionalDate(rawValue) ?? null
      } catch (error) {
        return NextResponse.json({ message: (error as Error).message }, { status: 400 })
      }
    }
    parsedPayload.stageDates = parsedStageDates
  }

  try {
    const session = await getSessionUser()
    const ledgerCase = await updateFinanceLedgerCase(id, parsedPayload, session?.id)
    return NextResponse.json({ case: ledgerCase })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params
  if (!(await hasPermission('finance:edit'))) {
    return NextResponse.json({ message: '缺少财务编辑权限' }, { status: 403 })
  }
  const id = Number(idParam)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: '无效的 ID' }, { status: 400 })
  }

  try {
    const session = await getSessionUser()
    await softDeleteFinanceLedgerCase(id, session?.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 })
  }
}
