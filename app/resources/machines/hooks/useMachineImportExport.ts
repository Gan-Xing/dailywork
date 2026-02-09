import { useCallback, useMemo, useState } from 'react'

import type { ResourcesCopy } from '@/lib/i18n/resources'
import {
  MACHINE_REQUIRED_IMPORT_HEADERS,
  MACHINE_TEMPLATE_HEADERS,
  type MachineColumnKey,
  machineColumnOrder,
} from '@/lib/resources/machines/constants'
import type { MachineAsset, MachineImportRow } from '@/types/machines'

type ImportHeaderKey =
  | 'assetCategoryName'
  | 'assetNumber'
  | 'manufacturer'
  | 'assetName'
  | 'assetStatusName'
  | 'specModel'
  | 'registrationDate'
  | 'originalValue'
  | 'usedMonths'
  | 'currentValue'
  | 'depreciatedMonths'
  | 'remainingMonths'
  | 'usageStatus'
  | 'alias'
  | 'plateNumber'
  | 'photoLinks'

type ImportError = {
  row: number
  code: 'missing_asset_number'
}

const normalizeText = (value: unknown) => String(value ?? '').trim()

const formatDateInput = (iso: string) => (iso.includes('T') ? iso.split('T')[0] ?? iso : iso)

const formatNumberCell = (value: number | null) => {
  if (value === null || value === undefined) return ''
  if (!Number.isFinite(value)) return ''
  return String(value)
}

export function useMachineImportExport({
  t,
  canCreateMachines,
  canUpdateMachines,
  machines,
  visibleColumns,
  loadData,
  setActionError,
  setActionNotice,
}: {
  t: ResourcesCopy
  canCreateMachines: boolean
  canUpdateMachines: boolean
  machines: MachineAsset[]
  visibleColumns: MachineColumnKey[]
  loadData: () => Promise<void>
  setActionError: (value: string | null) => void
  setActionNotice: (value: string | null) => void
}) {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)

  const importHeaderMap = useMemo(() => {
    const map = new Map<string, ImportHeaderKey>()
    const normalize = (label: string) => label.trim().toLowerCase()
    const add = (label: string, key: ImportHeaderKey) => {
      if (!label) return
      map.set(normalize(label), key)
    }
    add('资产类别名称', 'assetCategoryName')
    add('资产编号', 'assetNumber')
    add('生产厂家', 'manufacturer')
    add('资产名称', 'assetName')
    add('资产状态名称', 'assetStatusName')
    add('规格型号', 'specModel')
    add('登记日期', 'registrationDate')
    add('资产原值', 'originalValue')
    add('使用月份', 'usedMonths')
    add('资产现值', 'currentValue')
    add('已提月份', 'depreciatedMonths')
    add('剩余月份', 'remainingMonths')
    add('使用状态', 'usageStatus')
    add('使用情况', 'usageStatus')
    add('别名', 'alias')
    add('别称', 'alias')
    add('车牌', 'plateNumber')
    add('车牌号', 'plateNumber')
    add('车牌号码', 'plateNumber')
    add('照片链接', 'photoLinks')
    add('照片链接数组', 'photoLinks')
    add('照片链接列表', 'photoLinks')
    return map
  }, [])

  const formatImportError = useCallback(
    (error: ImportError) => {
      const message = error.code === 'missing_asset_number' ? '缺少资产编号' : t.machines.errors.importFailed
      return `Row ${error.row}: ${message}`
    },
    [t],
  )

  const handleImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>, ignoreBlanks: boolean) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (!canCreateMachines && !canUpdateMachines) {
        setActionError(t.machines.errors.needMachineCreateOrUpdate)
        setActionNotice(null)
        return
      }
      setImporting(true)
      setActionError(null)
      setActionNotice(null)
      try {
        const XLSX = await import('xlsx')
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const worksheet = sheetName ? workbook.Sheets[sheetName] : null
        if (!worksheet) throw new Error(t.machines.errors.importInvalidFile)

        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
          defval: '',
        }) as unknown[][]
        if (!rows.length) throw new Error(t.machines.errors.importNoData)

        const headerRow = rows[0]?.map((cell) => normalizeText(cell).replace(/^\uFEFF/, '')) ?? []
        const headerKeys = headerRow.map((label) => {
          if (!label) return null
          return importHeaderMap.get(label.toLowerCase()) ?? null
        })

        const usedKeys = headerKeys.filter(Boolean) as ImportHeaderKey[]
        const missing = MACHINE_REQUIRED_IMPORT_HEADERS.filter((label) => {
          const key = importHeaderMap.get(label.toLowerCase())
          return key ? !usedKeys.includes(key) : true
        })
        if (missing.length > 0) throw new Error(t.machines.errors.importMissingHeaders)

        const normalizeDate = (value: unknown) => {
          if (!value) return null
          if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10)
          }
          if (typeof value === 'number') {
            const parsed = XLSX.SSF.parse_date_code(value)
            if (parsed) {
              const month = String(parsed.m).padStart(2, '0')
              const day = String(parsed.d).padStart(2, '0')
              return `${parsed.y}-${month}-${day}`
            }
          }
          const text = normalizeText(value)
          if (!text) return null
          const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
          if (match) {
            const [, year, month, day] = match
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          }
          return null
        }

        const normalizeNumber = (value: unknown) => {
          if (value == null) return null
          if (typeof value === 'number' && Number.isFinite(value)) return value
          const text = normalizeText(value).replace(/,/g, '')
          if (!text) return null
          const parsed = Number(text)
          return Number.isFinite(parsed) ? parsed : null
        }

        const normalizeInteger = (value: unknown) => {
          const number = normalizeNumber(value)
          if (number === null) return null
          return Number.isFinite(number) ? Math.round(number) : null
        }

        const normalizeList = (value: unknown) => {
          if (value == null) return null
          const text = normalizeText(value)
          if (!text) return null
          const items = text
            .split(/[\/,，;\n]+/)
            .map((item) => item.trim())
            .filter(Boolean)
          return items.length ? items : null
        }

        const errors: ImportError[] = []
        const prepared: MachineImportRow[] = []

        rows.slice(1).forEach((rowValues, index) => {
          const isEmpty = rowValues.every((cell) => !normalizeText(cell))
          if (isEmpty) return
          const rowNumber = index + 2
          const record: MachineImportRow = { row: rowNumber }

          headerKeys.forEach((key, colIndex) => {
            if (!key) return
            const raw = rowValues[colIndex]
            const text = normalizeText(raw)
            switch (key) {
              case 'registrationDate':
                record.registrationDate = normalizeDate(raw)
                break
              case 'originalValue':
                record.originalValue = normalizeNumber(raw)
                break
              case 'currentValue':
                record.currentValue = normalizeNumber(raw)
                break
              case 'usedMonths':
                record.usedMonths = normalizeInteger(raw)
                break
              case 'depreciatedMonths':
                record.depreciatedMonths = normalizeInteger(raw)
                break
              case 'remainingMonths':
                record.remainingMonths = normalizeInteger(raw)
                break
              case 'photoLinks':
                record.photoLinks = normalizeList(raw)
                break
              default:
                ;(record as Record<string, unknown>)[key] = text ? text : null
            }
          })

          const assetNumber = normalizeText(record.assetNumber)
          if (!assetNumber) {
            errors.push({ row: rowNumber, code: 'missing_asset_number' })
            return
          }
          record.assetNumber = assetNumber
          prepared.push(record)
        })

        if (errors.length > 0) {
          setActionError(errors.slice(0, 20).map(formatImportError).join('\n'))
          setActionNotice(null)
          return
        }

        if (prepared.length === 0) throw new Error(t.machines.errors.importNoData)

        const res = await fetch('/api/resources/machines/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ machines: prepared, ignoreBlanks }),
        })
        const json = (await res.json().catch(() => null)) as
          | { created: number; updated: number; error?: string }
          | null
        if (!res.ok) {
          throw new Error(json?.error || t.machines.errors.importFailed)
        }

        setActionNotice(t.machines.notices.importSuccess(json?.created ?? 0, json?.updated ?? 0))
        setActionError(null)
        await loadData()
      } catch (error) {
        setActionError(error instanceof Error ? error.message : t.machines.errors.importFailed)
        setActionNotice(null)
      } finally {
        setImporting(false)
      }
    },
    [
      canCreateMachines,
      canUpdateMachines,
      formatImportError,
      importHeaderMap,
      loadData,
      setActionError,
      setActionNotice,
      t,
    ],
  )

  const handleExport = useCallback(async () => {
    setExporting(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const columns = machineColumnOrder.filter((key) => key !== 'actions' && visibleColumns.includes(key))
      const header = columns.map((key) => t.machines.columns[key])
      const rows = machines.map((machine) =>
        columns.map((key) => {
          switch (key) {
            case 'registrationDate':
              return machine.registrationDate ? formatDateInput(machine.registrationDate) : ''
            case 'originalValue':
              return formatNumberCell(machine.originalValue)
            case 'currentValue':
              return formatNumberCell(machine.currentValue)
            case 'usedMonths':
              return machine.usedMonths ?? ''
            case 'depreciatedMonths':
              return machine.depreciatedMonths ?? ''
            case 'remainingMonths':
              return machine.remainingMonths ?? ''
            case 'createdAt':
              return machine.createdAt ? formatDateInput(machine.createdAt) : ''
            case 'updatedAt':
              return machine.updatedAt ? formatDateInput(machine.updatedAt) : ''
            case 'photoLinks':
              return machine.photoLinks?.join(',') ?? ''
            default:
              return (machine as Record<string, unknown>)[key] ?? ''
          }
        }),
      )

      const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'machines')
      const filename = `machines-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.common.loadFailed)
    } finally {
      setExporting(false)
    }
  }, [machines, setActionError, setActionNotice, t, visibleColumns])

  const handleDownloadTemplate = useCallback(async () => {
    setTemplateDownloading(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const worksheet = XLSX.utils.aoa_to_sheet([Array.from(MACHINE_TEMPLATE_HEADERS)])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'template')
      const filename = `machines-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (error) {
      setActionError(error instanceof Error ? error.message : t.common.loadFailed)
    } finally {
      setTemplateDownloading(false)
    }
  }, [setActionError, setActionNotice, t])

  return {
    importing,
    exporting,
    templateDownloading,
    handleImportFileChange,
    handleExport,
    handleDownloadTemplate,
  }
}
