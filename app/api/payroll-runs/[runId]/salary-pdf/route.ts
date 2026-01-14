import { NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

import { prisma } from '@/lib/prisma'
import { canViewPayroll } from '@/lib/server/payrollRuns'
import { normalizeTeamKey, normalizeText } from '@/lib/members/utils'
import { renderSalaryReportHtml, type SalaryPage, type SalaryRow } from '@/lib/templates/salaryReport'

const EXECUTABLE_PATH =
  process.env.CHROMIUM_EXECUTABLE_PATH ??
  process.env.PUPPETEER_EXECUTABLE_PATH ??
  '/snap/bin/chromium'

const LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox']
const ROWS_PER_PAGE = 12
const DEFAULT_UNIT_NAME = '邦社库&丹达项目经理部'
const TEAM_FALLBACK_LABEL = '未分组 / Non assigné'
const TEAM_FALLBACK_KEY = 'unassigned'

type ExportPayload = {
  locale?: string
  unitName?: string
}

const toMonthStart = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1))

const addUtcDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const formatDate = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10).replace(/-/g, '/') : ''

const parseAmount = (value: unknown) => {
  if (value === null || value === undefined) return null
  const parsed = Number(String(value))
  return Number.isFinite(parsed) ? parsed : null
}

const chunkRows = <T,>(rows: T[], size: number) => {
  const result: T[][] = []
  for (let i = 0; i < rows.length; i += size) {
    result.push(rows.slice(i, i + size))
  }
  return result
}

const buildTeamLabel = (teamZh: string, teamName: string, fallback: string) => {
  const zh = normalizeText(teamZh)
  const name = normalizeText(teamName)
  if (zh && name) {
    if (zh.toLowerCase() === name.toLowerCase()) return zh
    return `${zh} / ${name}`
  }
  return zh || name || fallback
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
      note: true,
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
  const unitName = normalizeText(payload.unitName) || normalizeText(run.note) || DEFAULT_UNIT_NAME
  const formatter = new Intl.NumberFormat(locale)
  const collator = new Intl.Collator(locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh'], {
    numeric: true,
    sensitivity: 'base',
  })

  const payouts = await prisma.userPayrollPayout.findMany({
    where: { runId: id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          expatProfile: {
            select: {
              contractNumber: true,
              team: true,
            },
          },
        },
      },
    },
  })

  if (payouts.length === 0) {
    return NextResponse.json({ message: '暂无可导出的工资记录' }, { status: 404 })
  }

  const teamKeys = new Set<string>()
  payouts.forEach((payout) => {
    const rawTeam = normalizeText(payout.team) || normalizeText(payout.user.expatProfile?.team)
    const key = normalizeTeamKey(rawTeam)
    if (key) teamKeys.add(key)
  })
  const teamSupervisors = teamKeys.size
    ? await prisma.teamSupervisor.findMany({
        where: { teamKey: { in: Array.from(teamKeys) } },
        select: { teamKey: true, teamZh: true },
      })
    : []
  const teamZhByKey = new Map<string, string>()
  teamSupervisors.forEach((item) => {
    const zh = normalizeText(item.teamZh)
    if (zh) teamZhByKey.set(item.teamKey, zh)
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

  const periodStart =
    run.sequence === 2
      ? runOne?.attendanceCutoffDate
        ? addUtcDays(runOne.attendanceCutoffDate, 1)
        : toMonthStart(run.year, run.month)
      : prevRunTwo?.attendanceCutoffDate
        ? addUtcDays(prevRunTwo.attendanceCutoffDate, 1)
        : toMonthStart(run.year, run.month)
  const periodEnd = run.attendanceCutoffDate

  const formatAmount = (value: unknown) => {
    const parsed = parseAmount(value)
    if (parsed === null) return ''
    return formatter.format(parsed)
  }

  const teamFallback = TEAM_FALLBACK_LABEL
  const teams = new Map<string, { label: string; zh: string; fr: string; items: typeof payouts }>()

  payouts.forEach((payout) => {
    const rawTeam = normalizeText(payout.team) || normalizeText(payout.user.expatProfile?.team)
    const teamKey = normalizeTeamKey(rawTeam)
    const teamZh = teamKey ? teamZhByKey.get(teamKey) ?? '' : ''
    const label = buildTeamLabel(teamZh, rawTeam, teamFallback)
    const groupKey = teamKey || TEAM_FALLBACK_KEY
    const entry = teams.get(groupKey)
    if (entry) {
      entry.items.push(payout)
    } else {
      teams.set(groupKey, { label, zh: teamZh, fr: rawTeam, items: [payout] })
    }
  })

  const pages: SalaryPage[] = []
  const sortedTeams = Array.from(teams.values()).sort((left, right) =>
    collator.compare(left.label, right.label),
  )

  sortedTeams.forEach(({ label, zh, fr, items }) => {
    const sortedItems = [...items].sort((left, right) => {
      const leftContract = normalizeText(left.user.expatProfile?.contractNumber)
      const rightContract = normalizeText(right.user.expatProfile?.contractNumber)
      const contractCompare = collator.compare(leftContract, rightContract)
      if (contractCompare !== 0) return contractCompare
      const leftName = normalizeText(left.user.name) || normalizeText(left.user.username)
      const rightName = normalizeText(right.user.name) || normalizeText(right.user.username)
      const nameCompare = collator.compare(leftName, rightName)
      if (nameCompare !== 0) return nameCompare
      return left.user.id - right.user.id
    })

    const totalAmountValue = sortedItems.reduce((sum, payout) => {
      const parsed = parseAmount(payout.amount)
      return parsed === null ? sum : sum + parsed
    }, 0)
    const totalAmount = formatter.format(totalAmountValue)
    const chunks = chunkRows(sortedItems, ROWS_PER_PAGE)

    chunks.forEach((chunk, chunkIndex) => {
      const rows: SalaryRow[] = chunk.map((payout, index) => {
        const contractNumber = normalizeText(payout.user.expatProfile?.contractNumber)
        return {
          index: chunkIndex * ROWS_PER_PAGE + index + 1,
          matricule: contractNumber || normalizeText(payout.user.username),
          name: normalizeText(payout.user.name) || normalizeText(payout.user.username),
          amount: formatAmount(payout.amount),
          advance: '',
          paid: formatAmount(payout.amount),
        }
      })

      const blanks = ROWS_PER_PAGE - rows.length
      for (let i = 0; i < blanks; i += 1) {
        rows.push({
          index: '',
          matricule: '',
          name: '',
          amount: '',
          advance: '',
          paid: '',
        })
      }

      pages.push({
        teamLabel: label,
        teamZh: zh,
        teamFr: fr || TEAM_FALLBACK_LABEL,
        unitName,
        periodStart: formatDate(periodStart),
        periodEnd: formatDate(periodEnd),
        rows,
        showTotal: chunkIndex === chunks.length - 1,
        totalAmount: chunkIndex === chunks.length - 1 ? totalAmount : '',
        totalAdvance: chunkIndex === chunks.length - 1 ? '-' : '',
        totalPaid: chunkIndex === chunks.length - 1 ? totalAmount : '',
        pageNumber: 0,
        pageCount: 0,
      })
    })
  })

  pages.forEach((page, index) => {
    page.pageNumber = index + 1
    page.pageCount = pages.length
  })

  const html = await renderSalaryReportHtml(pages)

  console.log(`[SalaryPDF] Start generating PDF for runId: ${id}, rows: ${payouts.length}`)

  try {
    console.log(`[SalaryPDF] Launching puppeteer with: ${EXECUTABLE_PATH}`)
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: EXECUTABLE_PATH,
      args: LAUNCH_ARGS,
    })
    const page = await browser.newPage()
    console.log('[SalaryPDF] Setting content...')
    await page.setContent(html, { waitUntil: 'load', timeout: 60000 })
    console.log('[SalaryPDF] Content set. Generating PDF...')
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    })
    await browser.close()

    console.log(`[SalaryPDF] PDF generated successfully. Size: ${pdfBuffer.byteLength} bytes`)

    const filename = `salary-payouts-${run.year}-${String(run.month).padStart(2, '0')}-run-${run.sequence}.pdf`
    const pdfArrayBuffer = pdfBuffer.buffer.slice(
      pdfBuffer.byteOffset,
      pdfBuffer.byteOffset + pdfBuffer.byteLength,
    ) as ArrayBuffer

    return new Response(pdfArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('[SalaryPDF] Generation failed:', error)
    const message =
      (error as Error).message ||
      '生成 PDF 失败：请先安装浏览器内核或设置 CHROMIUM_EXECUTABLE_PATH/PUPPETEER_EXECUTABLE_PATH。'
    return NextResponse.json({ message }, { status: 500 })
  }
}
