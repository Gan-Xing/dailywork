import { NextResponse } from 'next/server'

import type { DailyReport } from '@/lib/reportState'
import { prepareReportForDate, saveReportForDate } from '@/lib/server/reportStore'
import { DATE_KEY_REGEX } from '@/lib/reportUtils'

interface RouteParams {
  params: {
    date: string
  }
}

const invalidDateResponse = NextResponse.json({ message: 'Invalid date' }, { status: 400 })

export async function GET(_request: Request, { params }: RouteParams) {
  const dateKey = params.date
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return invalidDateResponse
  }
  try {
    const result = await prepareReportForDate(dateKey)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const dateKey = params.date
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return invalidDateResponse
  }
  let payload: { report?: DailyReport }
  try {
    payload = (await request.json()) as { report?: DailyReport }
  } catch (error) {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  if (!payload.report) {
    return NextResponse.json({ message: 'Missing report payload' }, { status: 400 })
  }

  try {
    const { report, summary } = await saveReportForDate(dateKey, payload.report)
    return NextResponse.json({ report, summary })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
