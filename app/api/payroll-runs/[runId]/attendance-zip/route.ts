import { NextResponse } from 'next/server'
import archiver from 'archiver'
import { PDFDocument } from 'pdf-lib'
import puppeteer from 'puppeteer'
import { PassThrough, Readable } from 'stream'

import { prisma } from '@/lib/prisma'
import { normalizeTeamKey, normalizeText } from '@/lib/members/utils'
import { canViewPayroll } from '@/lib/server/payrollRuns'
import {
  PRESENCE_ROWS_PER_PAGE,
  renderPresenceReportHtml,
  type PresencePage,
  type PresenceRow,
} from '@/lib/templates/presenceReport'

export const maxDuration = 300

const EXECUTABLE_PATH =
  process.env.CHROMIUM_EXECUTABLE_PATH ??
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/snap/bin/chromium'

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']
const TEAM_FALLBACK_KEY = 'unassigned'
const TEAM_FALLBACK_ZH = '未分组'
const TEAM_FALLBACK_FR = 'Non assigné'

type ExportPayload = {
  locale?: string
}

type ExportMember = {
  id: number
  name: string
  role: string
  team: string
  contractType: 'CTJ' | 'CDD' | null
  contractStartDate: Date | null
  contractEndDate: Date | null
}

type ContractChange = {
  userId: number
  contractType: 'CTJ' | 'CDD' | null
  startDate: Date | null
  endDate: Date | null
  changeDate: Date
}

const toUtcDate = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day))

const toUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const toMonthStart = (year: number, month: number) => new Date(Date.UTC(year, month - 1, 1))

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const formatHeaderDate = (value: Date) => {
  const day = String(value.getUTCDate()).padStart(2, '0')
  const month = String(value.getUTCMonth() + 1).padStart(2, '0')
  const year = value.getUTCFullYear()
  return `${day}/${month}/${year}`
}

const formatRowDate = (value: Date) => {
  const day = String(value.getUTCDate())
  const month = String(value.getUTCMonth() + 1)
  const year = value.getUTCFullYear()
  return `${year}/${month}/${day}`
}

const isWeekend = (value: Date) => {
  const day = value.getUTCDay()
  return day === 0 || day === 6
}

const enumerateDates = (start: Date, end: Date) => {
  const result: Date[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    result.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return result
}

const buildRows = (dates: Date[]) =>
  dates.map<PresenceRow>((date) => ({
    date: formatRowDate(date),
    isWeekend: isWeekend(date),
  }))

const chunkRows = (rows: PresenceRow[], size: number) => {
  const chunks: PresenceRow[][] = []
  for (let i = 0; i < rows.length; i += size) {
    const chunk = rows.slice(i, i + size)
    while (chunk.length < size) {
      chunk.push({ date: '', isWeekend: false })
    }
    chunks.push(chunk)
  }
  return chunks
}

const buildPages = (
  rows: PresenceRow[],
  rowsPerPage: number,
  pageBase: Omit<PresencePage, 'rows'>,
) => {
  if (rows.length === 0) return []
  return chunkRows(rows, rowsPerPage).map((chunk) => ({
    ...pageBase,
    rows: chunk,
  }))
}

const hasContractTypeOverlap = (
  changes: ContractChange[],
  profile: ExportMember,
  type: 'CTJ' | 'CDD',
  periodStart: Date,
  periodEnd: Date,
) => {
  const startTime = periodStart.getTime()
  const endTime = periodEnd.getTime()

  const overlaps = (start: Date | null, end: Date | null) => {
    if (!start) return false
    const intervalStart = start.getTime()
    const intervalEnd = end ? end.getTime() : Number.POSITIVE_INFINITY
    return intervalStart <= endTime && intervalEnd >= startTime
  }

  const matched = changes.filter((change) => change.contractType === type)
  if (matched.some((change) => overlaps(change.startDate ?? change.changeDate, change.endDate ?? null))) {
    return true
  }

  if (profile.contractType !== type) return false
  if (!profile.contractStartDate) return true
  return overlaps(profile.contractStartDate, profile.contractEndDate ?? null)
}

const buildTeamLabel = (
  locale: 'zh' | 'fr',
  teamKey: string,
  teamName: string,
  teamZhByKey: Map<string, string>,
) => {
  if (locale === 'zh') {
    return teamZhByKey.get(teamKey) || teamName || TEAM_FALLBACK_ZH
  }
  return teamName || TEAM_FALLBACK_FR
}

const sanitizeFilename = (value: string, fallback: string) => {
  const normalized = normalizeText(value)
  if (!normalized) return fallback
  return (
    normalized
      .replace(/[\\/:*?\"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || fallback
  )
}

const buildContentDisposition = (filename: string) => {
  const fallback = filename.replace(/[^\x20-\x7E]+/g, '_')
  const encoded = encodeURIComponent(filename)
  return `attachment; filename=\"${fallback}\"; filename*=UTF-8''${encoded}`
}

const generatePdfBuffer = async (
  browser: puppeteer.Browser,
  html: string,
  landscape: boolean,
) => {
  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'load', timeout: 120_000 })
  await page.emulateMediaType('screen')
  await page.addStyleTag({
    content:
      'html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }',
  })
  const pdfBuffer = await page.pdf({
    format: 'A4',
    landscape,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
  })
  await page.close()
  return pdfBuffer
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  if (!(await canViewPayroll())) {
    return NextResponse.json({ message: '缺少工资发放查看权限' }, { status: 403 })
  }

  const { runId } = await params
  const id = Number(runId)
  if (!id) {
    return NextResponse.json({ message: '缺少发放批次 ID' }, { status: 400 })
  }

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    select: {
      id: true,
      year: true,
      month: true,
      sequence: true,
      attendanceCutoffDate: true,
    },
  })
  if (!run) {
    return NextResponse.json({ message: '发放批次不存在' }, { status: 404 })
  }

  let payload: ExportPayload = {}
  try {
    payload = (await request.json()) as ExportPayload
  } catch {
    payload = {}
  }
  const locale = payload.locale === 'fr' ? 'fr' : 'zh'
  const collator = new Intl.Collator(locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh'], {
    numeric: true,
    sensitivity: 'base',
  })

  const prevYear = run.month === 1 ? run.year - 1 : run.year
  const prevMonth = run.month === 1 ? 12 : run.month - 1
  const [prevRunTwo, runOne] = await Promise.all([
    run.sequence === 1
      ? prisma.payrollRun.findFirst({
          where: { year: prevYear, month: prevMonth, sequence: 2 },
          select: { attendanceCutoffDate: true },
        })
      : null,
    run.sequence === 2
      ? prisma.payrollRun.findFirst({
          where: { year: run.year, month: run.month, sequence: 1 },
          select: { attendanceCutoffDate: true },
        })
      : null,
  ])

  const ctjStart =
    run.sequence === 2
      ? runOne?.attendanceCutoffDate
        ? addUtcDays(toUtcDay(runOne.attendanceCutoffDate), 1)
        : toMonthStart(run.year, run.month)
      : prevRunTwo?.attendanceCutoffDate
        ? addUtcDays(toUtcDay(prevRunTwo.attendanceCutoffDate), 1)
        : toMonthStart(run.year, run.month)
  const ctjEnd = toUtcDay(run.attendanceCutoffDate)

  const cddPeriod =
    run.sequence === 1
      ? {
          start: toUtcDate(prevYear, prevMonth, 21),
          end: toUtcDate(run.year, run.month, 20),
        }
      : null

  const users = await prisma.user.findMany({
    where: { expatProfile: { isNot: null } },
    select: {
      id: true,
      name: true,
      username: true,
      position: true,
      nationality: true,
      expatProfile: {
        select: {
          team: true,
          contractType: true,
          contractStartDate: true,
          contractEndDate: true,
        },
      },
    },
  })

  const members: ExportMember[] = users
    .filter((member) => member.nationality !== 'china' && member.expatProfile)
    .map((member) => ({
      id: member.id,
      name: normalizeText(member.name) || normalizeText(member.username),
      role: normalizeText(member.position),
      team: normalizeText(member.expatProfile?.team ?? null),
      contractType: member.expatProfile?.contractType ?? null,
      contractStartDate: member.expatProfile?.contractStartDate ?? null,
      contractEndDate: member.expatProfile?.contractEndDate ?? null,
    }))

  if (members.length === 0) {
    return NextResponse.json({ message: '暂无可导出的考勤记录' }, { status: 404 })
  }

  const memberIds = members.map((member) => member.id)
  const contractChanges = memberIds.length
    ? await prisma.userContractChange.findMany({
        where: { userId: { in: memberIds } },
        select: {
          userId: true,
          contractType: true,
          startDate: true,
          endDate: true,
          changeDate: true,
        },
      })
    : []

  const changesByUser = new Map<number, ContractChange[]>()
  contractChanges.forEach((change) => {
    const list = changesByUser.get(change.userId) ?? []
    list.push(change)
    changesByUser.set(change.userId, list)
  })

  const ctjRows = buildRows(enumerateDates(ctjStart, ctjEnd))
  const cddRows = cddPeriod ? buildRows(enumerateDates(cddPeriod.start, cddPeriod.end)) : []

  const teams = new Map<
    string,
    { teamKey: string; teamName: string; ctj: ExportMember[]; cdd: ExportMember[] }
  >()

  members.forEach((member) => {
    const changes = changesByUser.get(member.id) ?? []
    const hasCtj = hasContractTypeOverlap(changes, member, 'CTJ', ctjStart, ctjEnd)
    const hasCdd =
      cddPeriod && hasContractTypeOverlap(changes, member, 'CDD', cddPeriod.start, cddPeriod.end)
    if (!hasCtj && !hasCdd) return

    const teamKey = normalizeTeamKey(member.team) || TEAM_FALLBACK_KEY
    const existing = teams.get(teamKey) ?? {
      teamKey,
      teamName: member.team,
      ctj: [],
      cdd: [],
    }
    if (!existing.teamName && member.team) {
      existing.teamName = member.team
    }
    if (hasCtj) existing.ctj.push(member)
    if (hasCdd) existing.cdd.push(member)
    teams.set(teamKey, existing)
  })

  if (teams.size === 0) {
    return NextResponse.json({ message: '暂无可导出的考勤记录' }, { status: 404 })
  }

  const teamKeys = Array.from(teams.keys()).filter((key) => key !== TEAM_FALLBACK_KEY)
  const teamSupervisors = teamKeys.length
    ? await prisma.teamSupervisor.findMany({
        where: { teamKey: { in: teamKeys } },
        select: { teamKey: true, teamZh: true },
      })
    : []
  const teamZhByKey = new Map<string, string>()
  teamSupervisors.forEach((item) => {
    const zh = normalizeText(item.teamZh)
    if (zh) teamZhByKey.set(item.teamKey, zh)
  })

  const sortedTeams = Array.from(teams.values())
    .map((team) => {
      const label = buildTeamLabel(locale, team.teamKey, team.teamName, teamZhByKey)
      return { ...team, label }
    })
    .sort((left, right) => collator.compare(left.label, right.label))

  const zipFilename = sanitizeFilename(
    `attendance-${run.year}-${String(run.month).padStart(2, '0')}-run-${run.sequence}.zip`,
    'attendance.zip',
  )

  const archive = archiver('zip', { zlib: { level: 9 } })
  const stream = new PassThrough()
  let aborted = false
  let browser: puppeteer.Browser | null = null
  const shouldAbort = () => aborted || stream.destroyed
  const abortExport = (error?: Error) => {
    if (aborted) return
    aborted = true
    try {
      archive.abort()
    } catch {
      // Ignore abort failures.
    }
    if (error) {
      console.error('[AttendanceZip] Aborted:', error)
    }
    if (!stream.destroyed) {
      stream.destroy(error)
    }
  }

  archive.pipe(stream)
  archive.on('error', (error) => abortExport(error))
  stream.on('error', (error) => abortExport(error))
  stream.on('close', () => {
    if (!aborted) {
      aborted = true
    }
  })
  if (request.signal) {
    if (request.signal.aborted) {
      abortExport(new Error('Request aborted'))
    } else {
      request.signal.addEventListener('abort', () => abortExport(new Error('Request aborted')))
    }
  }

  const response = new Response(Readable.toWeb(stream), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': buildContentDisposition(zipFilename),
    },
  })

  void (async () => {
    try {
      browser = await puppeteer.launch({
        headless: true,
        executablePath: EXECUTABLE_PATH,
        args: LAUNCH_ARGS,
      })

      const ctjPeriodStart = formatHeaderDate(ctjStart)
      const ctjPeriodEnd = formatHeaderDate(ctjEnd)
      const cddPeriodStart = cddPeriod ? formatHeaderDate(cddPeriod.start) : ''
      const cddPeriodEnd = cddPeriod ? formatHeaderDate(cddPeriod.end) : ''

      for (const team of sortedTeams) {
        if (shouldAbort()) break
        const ctjMembers = [...team.ctj].sort((left, right) =>
          collator.compare(left.name, right.name),
        )
        const cddMembers = [...team.cdd].sort((left, right) =>
          collator.compare(left.name, right.name),
        )

        const ctjPages = ctjMembers.flatMap((member) =>
          buildPages(ctjRows, PRESENCE_ROWS_PER_PAGE.ctj, {
            employeeName: member.name,
            employeeRole: member.role,
            periodStart: ctjPeriodStart,
            periodEnd: ctjPeriodEnd,
          }),
        )
        const cddPages =
          run.sequence === 1
            ? cddMembers.flatMap((member) =>
                buildPages(cddRows, PRESENCE_ROWS_PER_PAGE.cdd, {
                  employeeName: member.name,
                  employeeRole: member.role,
                  periodStart: cddPeriodStart,
                  periodEnd: cddPeriodEnd,
                }),
              )
            : []

        if (ctjPages.length === 0 && cddPages.length === 0) continue

        let ctjBuffer: Uint8Array | null = null
        let cddBuffer: Uint8Array | null = null

        if (ctjPages.length > 0) {
          if (shouldAbort()) break
          const ctjHtml = await renderPresenceReportHtml(ctjPages, 'ctj')
          ctjBuffer = await generatePdfBuffer(browser, ctjHtml, true)
        }

        if (cddPages.length > 0) {
          if (shouldAbort()) break
          const cddHtml = await renderPresenceReportHtml(cddPages, 'cdd')
          cddBuffer = await generatePdfBuffer(browser, cddHtml, false)
        }

        let mergedBuffer: Uint8Array
        if (ctjBuffer && cddBuffer) {
          if (shouldAbort()) break
          const merged = await PDFDocument.create()
          const ctjDoc = await PDFDocument.load(ctjBuffer)
          const ctjPagesCopied = await merged.copyPages(ctjDoc, ctjDoc.getPageIndices())
          ctjPagesCopied.forEach((page) => merged.addPage(page))
          const cddDoc = await PDFDocument.load(cddBuffer)
          const cddPagesCopied = await merged.copyPages(cddDoc, cddDoc.getPageIndices())
          cddPagesCopied.forEach((page) => merged.addPage(page))
          mergedBuffer = await merged.save()
        } else {
          mergedBuffer = (ctjBuffer ?? cddBuffer) as Uint8Array
        }

        const teamLabel = buildTeamLabel(locale, team.teamKey, team.teamName, teamZhByKey)
        const filename = sanitizeFilename(
          `attendance-${run.year}-${String(run.month).padStart(2, '0')}-run-${run.sequence}-${teamLabel}.pdf`,
          `attendance-${team.teamKey || TEAM_FALLBACK_KEY}.pdf`,
        )
        if (shouldAbort()) break
        try {
          archive.append(Buffer.from(mergedBuffer), { name: filename })
        } catch (error) {
          abortExport(error as Error)
          break
        }
      }
    } catch (error) {
      abortExport(error as Error)
    } finally {
      if (browser) {
        await browser.close().catch(() => undefined)
      }
      try {
        if (!shouldAbort()) {
          archive.finalize()
        }
      } catch {
        // Ignore finalize errors after stream teardown.
      }
    }
  })().catch((error) => abortExport(error as Error))

  return response
}
