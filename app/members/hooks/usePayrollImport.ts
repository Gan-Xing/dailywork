import { useCallback } from 'react'
import { memberCopy } from '@/lib/i18n/members'
import type { Member } from '@/types/members'
import { normalizeText } from '@/lib/members/utils'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UsePayrollImportParams = {
  t: MemberCopy
  members: Member[]
  contractNumbersByMemberId?: Record<number, string[]>
}

export type ImportTarget = {
  runId: number
  date: string
}

export type PayrollImportErrorItem = {
  row?: number
  contractNumber?: string
  name?: string
  message: string
}

// Helper to convert various date inputs to YYYY-MM-DD string
function normalizeDate(input: unknown): string | null {
  if (!input) return null
  
  let date: Date | undefined

  if (input instanceof Date) {
    date = input
  } else if (typeof input === 'number') {
    // Excel serial date (approximate)
    // 25569 is offset for 1970-01-01
    // Excel dates are usually local time 00:00:00
    date = new Date(Math.round((input - 25569) * 86400 * 1000))
  } else if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    // If it looks like YYYY-MM-DD, just return it directly to avoid parsing issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    const d = new Date(trimmed)
    if (!Number.isNaN(d.getTime())) {
      date = d
    }
  }

  if (date && !Number.isNaN(date.getTime())) {
    // We want the "Calendar Date", ignoring timezones.
    // If date is "Wed Dec 15 2025 00:00:00 GMT+0800", we want "2025-12-15".
    // getFullYear/Month/Date uses local time of the browser/server environment.
    // If the browser is in GMT+8, this works.
    
    // Note: If the input string was "2025-12-15", new Date() often assumes UTC.
    // "2025-12-15T00:00:00.000Z".
    // Then getFullYear (local) might be 2025-12-15 (if local is +8) or 2025-12-14 (if local is -5).
    
    // To be safe, we should probably output UTC date if it seems to be midnight UTC, 
    // OR just use the string components if possible.
    
    // BUT, Excel dates (cellDates: true) are usually adjusted to local timezone by the xlsx library?
    // Actually, xlsx usually parses as UTC+offset.
    
    // Let's try to get YYYY-MM-DD by correcting for timezone offset to ensure we get the intended day.
    // A common trick is to add 12 hours to be safe from midnight shifts?
    // No, that's risky.
    
    // Let's rely on local time components.
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return null
}

export function usePayrollImport({ t, members, contractNumbersByMemberId }: UsePayrollImportParams) {
  const parseFile = useCallback(
    async (
      file: File,
      targets: ImportTarget[],
    ): Promise<{ data: Map<number, Map<number, string>>; errors: PayrollImportErrorItem[] }> => {
      const errors: PayrollImportErrorItem[] = []
      if (targets.length === 0) {
        return {
          data: new Map(),
          errors: [{ message: t.payroll.errors.importInvalidTargets }],
        }
      }

      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
      const sheetName = workbook.SheetNames[0]
      if (!sheetName) {
        return { data: new Map(), errors: [{ message: t.errors.importInvalidFile }] }
      }
      const worksheet = workbook.Sheets[sheetName]
      
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, {
        header: 1,
        defval: '',
      })

      if (jsonData.length < 2) {
        return { data: new Map(), errors: [{ message: t.errors.importNoData }] }
      }

      const headers = jsonData[0]
      const normalizeHeader = (value: unknown) => String(value ?? '').trim().toLowerCase()
      const nameHeaderTokens = new Set(
        [
          t.form.name,
          memberCopy.zh.form.name,
          memberCopy.fr.form.name,
          'name',
          'nom',
          '姓名',
          '名字',
        ]
          .map((value) => normalizeHeader(value))
          .filter(Boolean),
      )
      const nameIdx = headers.findIndex((header) =>
        nameHeaderTokens.has(normalizeHeader(header)),
      )

      // 1. Contract Number (Required)
      let contractIdx = headers.findIndex((h) => {
        const str = String(h).toLowerCase()
        return (
          str.includes('contract') ||
          str.includes('contrat') ||
          str.includes('bh') ||
          str.includes('编号')
        )
      })
      if (contractIdx === -1) contractIdx = 0

      // 2. Map Run IDs to Column Indices
      const runColumnMap = new Map<number, number>()
      
      const normalizedTargets = targets
        .map(t => ({ runId: t.runId, date: normalizeDate(t.date) }))
        .filter(t => t.date !== null) as { runId: number, date: string }[]

      if (normalizedTargets.length === 0) {
         return {
           data: new Map(),
           errors: [{ message: t.payroll.errors.importInvalidTargets }],
         }
      }

      for (let i = 0; i < headers.length; i++) {
        if (i === contractIdx) continue
        const headerVal = headers[i]
        const normalizedHeader = normalizeDate(headerVal)
        
        if (!normalizedHeader) continue

        // Check match
        const match = normalizedTargets.find(t => t.date === normalizedHeader)
        if (match) {
          runColumnMap.set(match.runId, i)
        }
      }

      if (runColumnMap.size === 0) {
         const searchedDates = normalizedTargets.map(t => t.date).join(', ')
         return {
           data: new Map(),
           errors: [
             {
               message: `${t.payroll.errors.importMissingHeaders} (Searched for dates: ${searchedDates})`,
             },
           ],
         }
      }

      const rows = jsonData.slice(1)
      const result = new Map<number, Map<number, string>>()
      
      runColumnMap.forEach((_, runId) => {
        result.set(runId, new Map())
      })

      const contractMap = new Map<string, Member>()
      members.forEach((m) => {
        const contractNumbers = contractNumbersByMemberId?.[m.id] ?? []
        const fallbackContract = normalizeText(m.expatProfile?.contractNumber)
        const candidates = new Set<string>()
        contractNumbers.forEach((value) => {
          const normalized = normalizeText(value)
          if (normalized) candidates.add(normalized)
        })
        if (fallbackContract) candidates.add(fallbackContract)
        candidates.forEach((value) => {
          const key = value.toUpperCase()
          if (!contractMap.has(key)) {
            contractMap.set(key, m)
          }
        })
      })

      rows.forEach((row: any, index: number) => {
        if (!row) return
        
        const rawContract = String(row[contractIdx] || '').trim()
        if (!rawContract) return

        // Match case-insensitively
        const normalizedContract = normalizeText(rawContract).toUpperCase()
        const member = contractMap.get(normalizedContract)

        if (!member) {
           let hasData = false
           runColumnMap.forEach((colIdx) => {
             if (row[colIdx]) hasData = true
           })
           
           if (hasData) {
             const nameValue = nameIdx >= 0 ? normalizeText(row[nameIdx]) : ''
             errors.push({
               row: index + 2,
               contractNumber: rawContract,
               name: nameValue || undefined,
               message: t.payroll.errors.importContractNotFound(rawContract),
             })
           }
           return
        }

        runColumnMap.forEach((colIdx, runId) => {
          const rawAmount = row[colIdx]
          let amountStr = String(rawAmount || '').trim()
          amountStr = amountStr.replace(/\s/g, '')
          
          if (amountStr) {
            result.get(runId)?.set(member.id, amountStr)
          }
        })
      })

      return { data: result, errors }
    },
    [t, members, contractNumbersByMemberId],
  )

  return { parseFile }
}
