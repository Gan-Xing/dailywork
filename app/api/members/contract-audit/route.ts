import { NextResponse } from 'next/server'

import { hasPermission } from '@/lib/server/authSession'
import { prisma } from '@/lib/prisma'
import {
  auditContractRows,
  buildContractAuditReport,
  type ContractAuditRow,
} from '@/lib/server/contractAudit'

const normalizeText = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim()
}

const parseBirthDate = (value: unknown, XLSX: typeof import('xlsx')) => {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    }
  }
  const text = String(value).trim()
  if (!text) return null
  const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
  if (!match) return null
  const [, year, month, day] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

export async function POST(request: Request) {
  const allowed = await hasPermission('member:view')
  if (!allowed) {
    return NextResponse.json({ error: '权限不足' }, { status: 403 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '未找到上传文件' }, { status: 400 })
  }

  const XLSX = await import('xlsx')
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const worksheet = sheetName ? workbook.Sheets[sheetName] : null
  if (!worksheet) {
    return NextResponse.json({ error: '无法读取表格' }, { status: 400 })
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: '',
  }) as unknown[][]
  if (!rows.length) {
    return NextResponse.json({ error: '表格没有数据' }, { status: 400 })
  }

  const headerRow = rows[0]?.map((cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim()) ?? []
  const headerMap = new Map<string, keyof ContractAuditRow>([
    ['班组', 'team'],
    ['合同编号', 'contractNumber'],
    ['姓名', 'name'],
    ['出生日期', 'birthDate'],
    ['生日', 'birthDate'],
  ])
  const columnIndex = new Map<keyof ContractAuditRow, number>()
  headerRow.forEach((label, index) => {
    const key = headerMap.get(label)
    if (key) columnIndex.set(key, index)
  })

  const requiredKeys: Array<keyof ContractAuditRow> = [
    'team',
    'contractNumber',
    'name',
    'birthDate',
  ]
  const missing = requiredKeys.filter((key) => !columnIndex.has(key))
  if (missing.length > 0) {
    return NextResponse.json({ error: '缺少表头：班组/合同编号/姓名/出生日期' }, { status: 400 })
  }

  const parsedRows: ContractAuditRow[] = []
  rows.slice(1).forEach((row, index) => {
    const isEmpty = row.every((cell) => !String(cell ?? '').trim())
    if (isEmpty) return
    const rowNumber = index + 2
    const team = normalizeText(row[columnIndex.get('team') as number]) || null
    const contractNumber =
      normalizeText(row[columnIndex.get('contractNumber') as number]) || null
    const name = normalizeText(row[columnIndex.get('name') as number]) || null
    const birthDate = parseBirthDate(
      row[columnIndex.get('birthDate') as number],
      XLSX,
    )
    parsedRows.push({
      row: rowNumber,
      team,
      contractNumber,
      name,
      birthDate,
    })
  })

  if (parsedRows.length === 0) {
    return NextResponse.json({ error: '表格没有有效数据' }, { status: 400 })
  }

  const { results, summary, latestTeamCounts, inputTeamCounts } = await auditContractRows(
    prisma,
    parsedRows,
  )
  const report = buildContractAuditReport(
    results,
    summary,
    latestTeamCounts,
    inputTeamCounts,
  )

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `contract-audit-${timestamp}.txt`
  const outputPath = `reports/${filename}`
  const fs = await import('node:fs')
  const path = await import('node:path')
  const fullPath = path.join(process.cwd(), outputPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, report, 'utf8')

  return NextResponse.json({
    path: outputPath,
    summary,
    total: results.length,
  })
}
