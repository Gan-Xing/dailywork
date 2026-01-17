import { NextResponse } from 'next/server'

import { DocumentType, TemplateStatus } from '@prisma/client'

import { renderDailyReportTemplate } from '@/lib/documents/reportTemplate'
import type { Locale } from '@/lib/i18n'
import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'
import type { DailyReport } from '@/lib/reportState'
import { DATE_KEY_REGEX, normalizeReportForDate, recalcReportMaterials } from '@/lib/reportUtils'
import { prepareReportForDate } from '@/lib/server/reportStore'

const invalidDateResponse = NextResponse.json({ message: 'Invalid date' }, { status: 400 })

const resolveLocale = (value?: string | null): Locale => (value === 'fr' ? 'fr' : 'zh')
const resolveBaseUrl = (request: Request) => {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
  const host = forwardedHost ?? request.headers.get('host')
  if (!host) return undefined
  const proto = forwardedProto ?? 'http'
  return `${proto}://${host}`
}

const getTemplate = async (locale: Locale) => {
  const published = await prisma.documentTemplate.findFirst({
    where: {
      type: DocumentType.DAILY_REPORT,
      language: locale,
      status: TemplateStatus.PUBLISHED,
    },
    orderBy: { updatedAt: 'desc' },
  })
  if (published) return published

  return prisma.documentTemplate.findFirst({
    where: {
      type: DocumentType.DAILY_REPORT,
      language: locale,
      status: TemplateStatus.DRAFT,
    },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function POST(request: Request) {
  const [canView, canEdit] = await Promise.all([
    hasPermission('report:view'),
    hasPermission('report:edit'),
  ])
  if (!canView && !canEdit) {
    return NextResponse.json({ message: '缺少日报查看权限' }, { status: 403 })
  }

  let payload: { date?: string; locale?: string; report?: DailyReport }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const dateKey = payload.date ?? ''
  if (!DATE_KEY_REGEX.test(dateKey)) {
    return invalidDateResponse
  }

  const locale = resolveLocale(payload.locale)

  const template = await getTemplate(locale)
  if (!template) {
    return NextResponse.json({ message: '未找到日报模板' }, { status: 404 })
  }

  let report: DailyReport
  if (payload.report) {
    report = normalizeReportForDate(payload.report, dateKey)
    report = recalcReportMaterials(report)
  } else {
    const prepared = await prepareReportForDate(dateKey)
    report = recalcReportMaterials(prepared.report)
  }

  const html = renderDailyReportTemplate(template.html, report, locale, {
    baseUrl: resolveBaseUrl(request),
  })
  return NextResponse.json({ html, templateId: template.id })
}
