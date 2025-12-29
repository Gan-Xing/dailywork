import { useCallback, useMemo, useState, type ChangeEvent } from 'react'

import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type ContractChangeImportColumnKey =
  | 'name'
  | 'birthDate'
  | 'contractNumber'
  | 'contractType'
  | 'salaryCategory'
  | 'salaryAmount'
  | 'salaryUnit'
  | 'prime'
  | 'startDate'
  | 'endDate'
  | 'changeDate'
  | 'reason'
  | 'chineseSupervisor'
  | 'baseSalary'

type ContractChangeImportErrorCode =
  | 'missing_name'
  | 'missing_birth_date'
  | 'invalid_birth_date'
  | 'duplicate_identity'
  | 'member_not_found'
  | 'chinese_member'
  | 'missing_change_fields'
  | 'invalid_contract_type'
  | 'invalid_salary_unit'
  | 'invalid_base_salary_unit'
  | 'invalid_start_date'
  | 'invalid_end_date'
  | 'invalid_change_date'
  | 'invalid_chinese_supervisor'
  | 'duplicate_contract_number'
  | 'contract_number_exists'
  | 'import_failed'

type ContractChangeImportError = {
  row: number
  code: ContractChangeImportErrorCode
  value?: string
}

type UseContractChangeImportParams = {
  t: MemberCopy
  canUpdateMember: boolean
  loadData: () => Promise<void>
  setActionError: (value: string | null) => void
  setActionNotice: (value: string | null) => void
}

type ContractChangeImportItem = {
  row: number
  name: string
  birthDate: string
  contractNumber?: string
  contractType?: string
  salaryCategory?: string
  salaryAmount?: string
  salaryUnit?: string
  prime?: string
  startDate?: string
  endDate?: string
  changeDate?: string
  reason?: string
  chineseSupervisor?: string
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const normalizeDate = (input: unknown): string | null => {
  if (!input) return null
  let date: Date | undefined

  if (input instanceof Date) {
    date = input
  } else if (typeof input === 'number') {
    date = new Date(Math.round((input - 25569) * 86400 * 1000))
  } else if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return null
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed
    }
  }

  if (date && !Number.isNaN(date.getTime())) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  return null
}

const parseSalaryUnit = (value: string) => {
  const text = value.trim().toUpperCase()
  if (!text) return ''
  if (text === 'MONTH' || text === 'M' || text === 'MOIS' || text.includes('月')) return 'MONTH'
  if (text === 'HOUR' || text === 'H' || text === 'HEURE' || text.includes('时'))
    return 'HOUR'
  return ''
}

export function useContractChangeImport({
  t,
  canUpdateMember,
  loadData,
  setActionError,
  setActionNotice,
}: UseContractChangeImportParams) {
  const [importing, setImporting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)

  const importHeaderMap = useMemo(() => {
    const map = new Map<string, ContractChangeImportColumnKey>()
    const normalize = (value: string) => value.trim().toLowerCase()
    const add = (label: string, key: ContractChangeImportColumnKey) => {
      if (label) map.set(normalize(label), key)
    }
    const register = (copy: (typeof memberCopy)[keyof typeof memberCopy]) => {
      add(copy.form.name, 'name')
      add(copy.form.birthDate, 'birthDate')
      add(copy.form.contractNumber, 'contractNumber')
      add(copy.form.contractType, 'contractType')
      add(copy.form.salaryCategory, 'salaryCategory')
      add(copy.form.baseSalaryAmount, 'salaryAmount')
      add(copy.form.baseSalaryUnit, 'salaryUnit')
      add(copy.form.prime, 'prime')
      add(copy.form.baseSalary, 'baseSalary')
      add(copy.compensation.fields.startDate, 'startDate')
      add(copy.compensation.fields.endDate, 'endDate')
      add(copy.compensation.fields.changeDate, 'changeDate')
      add(copy.compensation.fields.reason, 'reason')
      add(copy.compensation.fields.chineseSupervisor, 'chineseSupervisor')
      add(copy.form.chineseSupervisor, 'chineseSupervisor')
    }
    register(memberCopy.zh)
    register(memberCopy.fr)
    return map
  }, [])

  const templateColumns = useMemo<ContractChangeImportColumnKey[]>(
    () => [
      'name',
      'birthDate',
      'contractNumber',
      'contractType',
      'salaryCategory',
      'salaryAmount',
      'salaryUnit',
      'baseSalary',
      'prime',
      'startDate',
      'endDate',
      'changeDate',
      'reason',
      'chineseSupervisor',
    ],
    [],
  )

  const templateColumnLabels = useMemo<Record<ContractChangeImportColumnKey, string>>(
    () => ({
      name: t.form.name,
      birthDate: t.form.birthDate,
      contractNumber: t.form.contractNumber,
      contractType: t.form.contractType,
      salaryCategory: t.form.salaryCategory,
      salaryAmount: t.form.baseSalaryAmount,
      salaryUnit: t.form.baseSalaryUnit,
      baseSalary: t.form.baseSalary,
      prime: t.form.prime,
      startDate: t.compensation.fields.startDate,
      endDate: t.compensation.fields.endDate,
      changeDate: t.compensation.fields.changeDate,
      reason: t.compensation.fields.reason,
      chineseSupervisor: t.compensation.fields.chineseSupervisor,
    }),
    [t],
  )

  const formatImportError = useCallback(
    (error: ContractChangeImportError) => {
      let message = t.errors.importFailed
      switch (error.code) {
        case 'missing_name':
          message = t.errors.nameRequired
          break
        case 'missing_birth_date':
          message = t.errors.importMissingBirthDate
          break
        case 'invalid_birth_date':
          message = t.errors.importInvalidBirthDate
          break
        case 'duplicate_identity':
          message = t.errors.importDuplicateIdentity
          break
        case 'member_not_found':
          message = t.errors.importMemberNotFound
          break
        case 'chinese_member':
          message = t.errors.importChineseMember
          break
        case 'missing_change_fields':
          message = t.errors.importContractChangeMissingFields
          break
        case 'invalid_contract_type':
          message = t.errors.importInvalidContractType
          break
        case 'invalid_salary_unit':
          message = t.errors.importInvalidSalaryUnit
          break
        case 'invalid_base_salary_unit':
          message = t.errors.importInvalidBaseSalaryUnit
          break
        case 'invalid_start_date':
          message = t.errors.importInvalidStartDate
          break
        case 'invalid_end_date':
          message = t.errors.importInvalidEndDate
          break
        case 'invalid_change_date':
          message = t.errors.importInvalidChangeDate
          break
        case 'invalid_chinese_supervisor':
          message = t.errors.importInvalidChineseSupervisor
          break
        case 'duplicate_contract_number':
          message = t.errors.importDuplicateContractNumber
          break
        case 'contract_number_exists':
          message = t.errors.importContractNumberExists
          break
        case 'import_failed':
          message = t.errors.importFailed
          break
        default:
          message = t.errors.importFailed
      }
      return t.feedback.importRowError(error.row, message)
    },
    [t],
  )

  const handleImportFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      if (!canUpdateMember) {
        setActionError(t.errors.needMemberUpdate)
        return
      }
      const file = event.target.files?.[0]
      if (!file) return
      setImporting(true)
      setActionError(null)
      setActionNotice(null)
      try {
        const XLSX = await import('xlsx')
        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) throw new Error(t.errors.importInvalidFile)
        const worksheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, {
          header: 1,
          defval: '',
        })
        if (rows.length < 2) throw new Error(t.errors.importNoData)
        const headers = rows[0] as Array<unknown>
        const headerIndex = new Map<ContractChangeImportColumnKey, number>()
        headers.forEach((header, index) => {
          const key = importHeaderMap.get(normalizeText(header).toLowerCase())
          if (!key || headerIndex.has(key)) return
          headerIndex.set(key, index)
        })

        if (!headerIndex.has('name') || !headerIndex.has('birthDate')) {
          throw new Error(t.errors.importMissingHeaders)
        }

        const errors: ContractChangeImportError[] = []
        const prepared: ContractChangeImportItem[] = []

        rows.slice(1).forEach((row, index) => {
          if (!Array.isArray(row)) return
          const rowNumber = index + 2
          const nameValue = normalizeText(row[headerIndex.get('name')!])
          const birthValue = row[headerIndex.get('birthDate')!]
          const birthDate = normalizeDate(birthValue)
          const hasBirthValue = normalizeText(birthValue).length > 0 || birthValue instanceof Date

          let hasRowError = false
          if (!nameValue) {
            errors.push({ row: rowNumber, code: 'missing_name' })
            hasRowError = true
          }
          if (!hasBirthValue) {
            errors.push({ row: rowNumber, code: 'missing_birth_date' })
            hasRowError = true
          } else if (!birthDate) {
            errors.push({ row: rowNumber, code: 'invalid_birth_date' })
            hasRowError = true
          }

          const getCell = (key: ContractChangeImportColumnKey) => {
            const idx = headerIndex.get(key)
            return idx !== undefined ? row[idx] : undefined
          }
          const contractNumber = normalizeText(getCell('contractNumber'))
          const contractType = normalizeText(getCell('contractType'))
          const salaryCategory = normalizeText(getCell('salaryCategory'))
          const prime = normalizeText(getCell('prime'))
          const startDateValue = getCell('startDate')
          const endDateValue = getCell('endDate')
          const changeDateValue = getCell('changeDate')
          const reason = normalizeText(getCell('reason'))
          const chineseSupervisor = normalizeText(getCell('chineseSupervisor'))

          let salaryAmount = normalizeText(getCell('salaryAmount'))
          let salaryUnit = normalizeText(getCell('salaryUnit'))

          const baseSalaryValue = normalizeText(getCell('baseSalary'))
          if (!salaryAmount && baseSalaryValue) {
            const [amount, unit] = baseSalaryValue.split('/')
            salaryAmount = normalizeText(amount)
            if (!salaryUnit && unit) {
              salaryUnit = unit
            }
          }

          const hasChangeField =
            contractNumber ||
            contractType ||
            salaryCategory ||
            salaryAmount ||
            salaryUnit ||
            prime ||
            normalizeText(startDateValue) ||
            normalizeText(endDateValue)

          if (!hasRowError && !hasChangeField) {
            errors.push({ row: rowNumber, code: 'missing_change_fields' })
            hasRowError = true
          }

          if (hasRowError || !birthDate) return

          const item: ContractChangeImportItem = {
            row: rowNumber,
            name: nameValue,
            birthDate,
          }
          if (contractNumber) item.contractNumber = contractNumber
          if (contractType) item.contractType = contractType
          if (salaryCategory) item.salaryCategory = salaryCategory
          if (salaryAmount) item.salaryAmount = salaryAmount
          if (salaryUnit) item.salaryUnit = parseSalaryUnit(salaryUnit) || salaryUnit
          if (prime) item.prime = prime
          const startDate = normalizeDate(startDateValue)
          if (startDateValue && normalizeText(startDateValue) && !startDate) {
            errors.push({ row: rowNumber, code: 'invalid_start_date' })
            return
          }
          if (startDate) item.startDate = startDate
          const endDate = normalizeDate(endDateValue)
          if (endDateValue && normalizeText(endDateValue) && !endDate) {
            errors.push({ row: rowNumber, code: 'invalid_end_date' })
            return
          }
          if (endDate) item.endDate = endDate
          const changeDate = normalizeDate(changeDateValue)
          if (changeDateValue && normalizeText(changeDateValue) && !changeDate) {
            errors.push({ row: rowNumber, code: 'invalid_change_date' })
            return
          }
          if (changeDate) item.changeDate = changeDate
          if (reason) item.reason = reason
          if (chineseSupervisor) item.chineseSupervisor = chineseSupervisor
          prepared.push(item)
        })

        if (errors.length > 0) {
          setActionError(errors.map(formatImportError).join('\n'))
          if (prepared.length === 0) {
            return
          }
          const errorRowsCount = new Set(errors.map((item) => item.row)).size
          const shouldContinue = window.confirm(
            t.feedback.importSkipConfirm(prepared.length, errorRowsCount),
          )
          if (!shouldContinue) {
            return
          }
        }
        if (prepared.length === 0) {
          throw new Error(t.errors.importNoData)
        }

        const res = await fetch('/api/members/contract-changes/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: prepared, ignoreErrors: errors.length > 0 }),
        })
        const payload = (await res.json().catch(() => ({}))) as {
          imported?: number
          error?: string
          errors?: ContractChangeImportError[]
        }
        if (!res.ok) {
          if (payload.errors?.length) {
            setActionError(payload.errors.map(formatImportError).join('\n'))
            return
          }
          throw new Error(payload.error ?? t.errors.importFailed)
        }
        const combinedErrors = [...errors, ...(payload.errors ?? [])]
        if (combinedErrors.length > 0) {
          setActionError(combinedErrors.map(formatImportError).join('\n'))
          setActionNotice(
            t.feedback.importPartialSuccess(
              payload.imported ?? prepared.length,
              new Set(combinedErrors.map((item) => item.row)).size,
            ),
          )
        } else {
          setActionNotice(
            t.feedback.importContractChangesSuccess(payload.imported ?? prepared.length),
          )
        }
        await loadData()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : t.errors.importFailed)
      } finally {
        setImporting(false)
        if (event.target) event.target.value = ''
      }
    },
    [
      canUpdateMember,
      formatImportError,
      importHeaderMap,
      loadData,
      setActionError,
      setActionNotice,
      t,
    ],
  )

  const handleDownloadTemplate = useCallback(async () => {
    if (templateDownloading) return
    setTemplateDownloading(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const headerRow = templateColumns.map((key) => templateColumnLabels[key])
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow])
      const instructionsRows = [
        [t.contractChangeTemplate.columnsHeader, t.contractChangeTemplate.notesHeader],
        ...templateColumns.map((key) => [
          templateColumnLabels[key],
          t.contractChangeTemplate.notes[key],
        ]),
      ]
      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, t.compensation.contractChanges)
      XLSX.utils.book_append_sheet(
        workbook,
        instructionsSheet,
        t.contractChangeTemplate.instructionsSheet,
      )
      const filename = `contract-change-import-template-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.errors.templateDownloadFailed)
    } finally {
      setTemplateDownloading(false)
    }
  }, [
    templateDownloading,
    templateColumns,
    templateColumnLabels,
    t,
    setActionError,
    setActionNotice,
  ])

  return { importing, templateDownloading, handleImportFileChange, handleDownloadTemplate }
}
