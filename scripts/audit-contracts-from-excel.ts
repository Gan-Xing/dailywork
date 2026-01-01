/**
 * Audit contract numbers from an Excel file (columns: 班组, 合同编号, 姓名, 出生日期).
 *
 * Usage:
 *   npx tsx scripts/audit-contracts-from-excel.ts /path/to/file.xlsx
 *   npx tsx scripts/audit-contracts-from-excel.ts /path/to/file.xlsx --output reports/contract-audit.txt
 */
/* eslint-disable no-console */
import 'dotenv/config'

import fs from 'node:fs'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import {
  auditContractRows,
  buildContractAuditReport,
  type ContractAuditRow,
} from '@/lib/server/contractAudit'

const prisma = new PrismaClient()

const parseOutputPath = () => {
  const args = process.argv
  const index = args.indexOf('--output')
  if (index === -1) return null
  const raw = args[index + 1]
  if (!raw) return null
  return raw
}

const parseFilePath = () => {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
  return args[0] ?? null
}

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

const main = async () => {
  const filePath = parseFilePath()
  if (!filePath) {
    console.log('Usage: npx tsx scripts/audit-contracts-from-excel.ts <file.xlsx>')
    process.exitCode = 1
    return
  }

  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`)
    process.exitCode = 1
    return
  }

  const XLSX = await import('xlsx')
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  const worksheet = sheetName ? workbook.Sheets[sheetName] : null
  if (!worksheet) {
    console.log('Unable to read worksheet.')
    process.exitCode = 1
    return
  }

  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    blankrows: false,
    defval: '',
  }) as unknown[][]
  if (!rows.length) {
    console.log('Worksheet is empty.')
    process.exitCode = 1
    return
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
    console.log('Missing headers: 班组/合同编号/姓名/出生日期')
    process.exitCode = 1
    return
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
    console.log('No valid rows found.')
    process.exitCode = 1
    return
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

  const outputPath =
    parseOutputPath() ||
    `reports/contract-audit-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
  const fullPath = path.isAbsolute(outputPath)
    ? outputPath
    : path.join(process.cwd(), outputPath)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, report, 'utf8')
  console.log(`Wrote report to ${outputPath}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
