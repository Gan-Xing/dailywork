import { NextResponse } from 'next/server'

import { DATE_KEY_REGEX } from '@/lib/reportUtils'
import { hasPermission } from '@/lib/server/authSession'
import { prepareReportForDate, saveReportForDate } from '@/lib/server/reportStore'
import { mergeReportWithExtractionOutput, normalizeLogExtractionOutput } from '@/lib/logExtraction'

export async function POST(request: Request) {
  if (!(await hasPermission('report:edit'))) {
    return NextResponse.json({ message: '缺少日报编辑权限' }, { status: 403 })
  }

  let payload: { date?: unknown; output?: unknown; dryRun?: unknown }
  try {
    payload = (await request.json()) as { date?: unknown; output?: unknown; dryRun?: unknown }
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const dateKey = typeof payload.date === 'string' ? payload.date.trim() : ''
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return NextResponse.json({ message: 'Invalid date' }, { status: 400 })
  }

  const output = normalizeLogExtractionOutput(payload.output)
  const dryRun = Boolean(payload.dryRun)

  try {
    const prepared = await prepareReportForDate(dateKey)
    const { report, mergedOutput } = mergeReportWithExtractionOutput(prepared.report, output)

    if (dryRun) {
      return NextResponse.json({
        mergedOutput,
        exists: prepared.exists,
        preview: true,
      })
    }

    const saved = await saveReportForDate(dateKey, report)

    return NextResponse.json({
      mergedOutput,
      summary: saved.summary,
      exists: prepared.exists,
      preview: false,
    })
  } catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 500 })
  }
}
