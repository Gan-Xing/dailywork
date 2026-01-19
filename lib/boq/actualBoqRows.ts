import type { BoqItemTone } from '@prisma/client'

import type { Locale } from '@/lib/i18n'

export type BoqCompletionRecord = {
  boqItemId: number
  bindingCount: number
  designQuantity: number | null
  completedQuantity: number | null
}

export type BoqActualRow = {
  index: number
  id: number
  code: string
  designation: string
  unit: string | null
  unitPrice: string | null
  quantity: number | string | null
  totalPrice: number | string | null
  totalPriceValue: number | null
  tone: BoqItemTone
  bindingCount: number
  designQuantity: number | null
  completedQuantity: number | null
  searchable: string
  subtotalCode: string | null
  majorCode: string | null
}

type BoqItemBase = {
  id: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: string | null
  quantity: string | null
  totalPrice: string | null
  tone: BoqItemTone
  sortOrder: number
}

type Totals = {
  totalPrice: number
  itemCount: number
}

const normalizeBoqCode = (value?: string | null) => (value ?? '').trim().toUpperCase()
const isVatCode = (code: string) => code === 'TVA'
const isTotalHtvaCode = (code: string) => code.startsWith('TOTAL HTVA')
const isTotalWithTaxCode = (code: string) => code.startsWith('TOTAL TTC')

const parseBoqNumber = (value?: string | number | null) => {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed || trimmed === '-') return null
  const normalized = trimmed.replace(/,/g, '')
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const extractSubtotalCode = (value: string) => {
  const normalized = normalizeBoqCode(value)
  if (/^\d{3}$/.test(normalized)) return normalized
  const match = normalized.match(/(\d{3})/)
  if (match?.[1]) return match[1]
  const totalMatch = normalized.match(/T(\d{1,2})/)
  if (totalMatch?.[1]) {
    const numeric = Number(totalMatch[1])
    if (Number.isFinite(numeric)) {
      return String(numeric * 100).padStart(3, '0')
    }
  }
  return null
}

const deriveMajorCode = (code: string | null) => {
  if (!code) return null
  const numeric = Number(code)
  if (!Number.isFinite(numeric)) return code
  const major = Math.floor(numeric / 100) * 100
  return String(major).padStart(3, '0')
}

const addTotals = (target: Totals, addition: Totals) => {
  target.totalPrice += addition.totalPrice
  target.itemCount += addition.itemCount
}

const addToMap = (map: Map<number, Totals>, key: number, addition: Totals) => {
  const existing = map.get(key) ?? { totalPrice: 0, itemCount: 0 }
  addTotals(existing, addition)
  map.set(key, existing)
}

const addToCodeMap = (map: Map<string, Totals>, key: string, addition: Totals) => {
  const existing = map.get(key) ?? { totalPrice: 0, itemCount: 0 }
  addTotals(existing, addition)
  map.set(key, existing)
}

export const sortBoqItemsByOrder = <T extends { sortOrder: number; id: number }>(items: T[]) =>
  [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)

export const buildActualBoqRows = ({
  items,
  completion,
  locale,
}: {
  items: BoqItemBase[]
  completion: Map<number, BoqCompletionRecord> | BoqCompletionRecord[]
  locale: Locale
}): BoqActualRow[] => {
  if (!items.length) return []
  const completionMap =
    completion instanceof Map
      ? completion
      : new Map(completion.map((entry) => [entry.boqItemId, entry]))

  const baseRows = sortBoqItemsByOrder(items).map((item, index) => {
    const designation = locale === 'fr' ? item.designationFr : item.designationZh
    const searchable = `${item.code} ${designation}`.toLowerCase()
    const completionRecord = completionMap.get(item.id)
    const rawDesignQuantity = completionRecord?.designQuantity ?? null
    const designQuantity =
      rawDesignQuantity !== null && Number.isFinite(rawDesignQuantity) ? rawDesignQuantity : 0
    const rawCompletedQuantity = completionRecord?.completedQuantity ?? null
    const completedQuantity =
      rawCompletedQuantity !== null && Number.isFinite(rawCompletedQuantity) ? rawCompletedQuantity : 0
    const unitPriceValue = parseBoqNumber(item.unitPrice)
    const quantityValue = item.tone === 'ITEM' ? designQuantity : parseBoqNumber(item.quantity)
    const totalPriceValue =
      item.tone === 'ITEM'
        ? quantityValue !== null && unitPriceValue !== null
          ? quantityValue * unitPriceValue
          : null
        : parseBoqNumber(item.totalPrice) ??
          (quantityValue !== null && unitPriceValue !== null ? quantityValue * unitPriceValue : null)
    const subtotalCode = extractSubtotalCode(item.code) ?? extractSubtotalCode(designation)
    const majorCode = deriveMajorCode(subtotalCode)

    return {
      index,
      id: item.id,
      code: item.code,
      designation,
      unit: item.unit,
      unitPrice: item.unitPrice,
      quantity: item.tone === 'ITEM' ? designQuantity : item.quantity,
      totalPrice: item.tone === 'ITEM' ? totalPriceValue : item.totalPrice,
      totalPriceValue,
      tone: item.tone,
      bindingCount: completionRecord?.bindingCount ?? 0,
      designQuantity: item.tone === 'ITEM' ? designQuantity : null,
      completedQuantity: item.tone === 'ITEM' ? completedQuantity : null,
      searchable,
      subtotalCode,
      majorCode,
    }
  })

  const totalsBySection = new Map<number, Totals>()
  const totalsBySubsection = new Map<number, Totals>()
  const totalsBySubsectionCode = new Map<string, Totals>()
  const totalsByMajorCode = new Map<string, Totals>()
  const subsectionIndexBySectionAndCode = new Map<number, Map<string, number>>()
  const overallTotals: Totals = { totalPrice: 0, itemCount: 0 }
  const sectionIndexByRow: Array<number | null> = []
  let currentSectionIndex: number | null = null
  let currentSubsectionIndex: number | null = null
  let currentSubsectionCode: string | null = null

  baseRows.forEach((row, index) => {
    if (row.tone === 'SECTION') {
      currentSectionIndex = index
      currentSubsectionIndex = null
      currentSubsectionCode = null
    } else if (row.tone === 'SUBSECTION') {
      const code = row.subtotalCode
      const isMajor = code !== null && Number.isFinite(Number(code)) && Number(code) % 100 === 0
      if (isMajor) {
        if (currentSectionIndex !== null) {
          const map = subsectionIndexBySectionAndCode.get(currentSectionIndex) ?? new Map()
          map.set(code, index)
          subsectionIndexBySectionAndCode.set(currentSectionIndex, map)
        }
        currentSubsectionIndex = index
      }
    }
    if (row.tone !== 'ITEM') {
      if (row.subtotalCode && /^\d{3}$/.test(row.subtotalCode)) {
        currentSubsectionCode = row.subtotalCode
      }
    }
    sectionIndexByRow[index] = currentSectionIndex
    if (row.tone !== 'ITEM') return
    const addition: Totals = {
      totalPrice: row.totalPriceValue ?? 0,
      itemCount: 1,
    }
    addTotals(overallTotals, addition)
    if (currentSectionIndex !== null) {
      addToMap(totalsBySection, currentSectionIndex, addition)
    }
    if (currentSubsectionIndex !== null) {
      addToMap(totalsBySubsection, currentSubsectionIndex, addition)
    }
    if (currentSubsectionCode) {
      addToCodeMap(totalsBySubsectionCode, currentSubsectionCode, addition)
    }
    if (row.majorCode) {
      addToCodeMap(totalsByMajorCode, row.majorCode, addition)
    }
  })

  const applyTotals = (row: BoqActualRow, totals: Totals | undefined) => {
    if (!totals || totals.itemCount === 0) {
      const fallbackTotalPrice = row.totalPriceValue ?? row.totalPrice
      return { ...row, totalPrice: fallbackTotalPrice ?? null }
    }
    return { ...row, totalPrice: totals.totalPrice }
  }

  const scaleTotals = (totals: Totals, factor: number): Totals => ({
    totalPrice: totals.totalPrice * factor,
    itemCount: totals.itemCount,
  })

  const resolveTotalsForTotalRow = (row: BoqActualRow, index: number) => {
    const normalizedCode = normalizeBoqCode(row.code)
    const useOverall =
      isVatCode(normalizedCode) || isTotalHtvaCode(normalizedCode) || isTotalWithTaxCode(normalizedCode)
    if (useOverall) {
      const factor = isVatCode(normalizedCode) ? 0.18 : isTotalWithTaxCode(normalizedCode) ? 1.18 : 1
      return scaleTotals(overallTotals, factor)
    }

    if (row.majorCode && totalsByMajorCode.has(row.majorCode)) {
      return totalsByMajorCode.get(row.majorCode)
    }
    if (row.subtotalCode && totalsBySubsectionCode.has(row.subtotalCode)) {
      return totalsBySubsectionCode.get(row.subtotalCode)
    }

    const sectionIndex = sectionIndexByRow[index]
    if (sectionIndex !== null) {
      const subtotalCode = row.subtotalCode
      const matchingSubsectionIndex = subtotalCode
        ? subsectionIndexBySectionAndCode.get(sectionIndex)?.get(subtotalCode) ?? null
        : null
      return matchingSubsectionIndex !== null
        ? totalsBySubsection.get(matchingSubsectionIndex)
        : totalsBySection.get(sectionIndex)
    }

    return overallTotals
  }

  const totalRowTotalsByKey = new Map<string, Totals>()
  const totalRowTotalsByCode = new Map<string, Totals>()
  baseRows.forEach((row, index) => {
    if (row.tone !== 'TOTAL') return
    const sectionIndex = sectionIndexByRow[index]
    if (sectionIndex === null) return
    const subtotalCode = row.subtotalCode
    if (!subtotalCode) return
    const totals = resolveTotalsForTotalRow(row, index)
    if (!totals) return
    totalRowTotalsByKey.set(`${sectionIndex}:${subtotalCode}`, totals)
    if (row.majorCode && !totalRowTotalsByCode.has(row.majorCode)) {
      totalRowTotalsByCode.set(row.majorCode, totals)
    }
    if (!totalRowTotalsByCode.has(subtotalCode)) {
      totalRowTotalsByCode.set(subtotalCode, totals)
    }
  })

  return baseRows.map((row, index) => {
    if (row.tone === 'SUBSECTION') {
      const normalizedCode = normalizeBoqCode(row.code)
      if (isVatCode(normalizedCode)) {
        return applyTotals(row, scaleTotals(overallTotals, 0.18))
      }
      const subsectionTotals = totalsBySubsection.get(index)
      const sectionIndex = sectionIndexByRow[index]
      const subtotalCode = row.subtotalCode
      const fallbackTotals =
        sectionIndex !== null && subtotalCode
          ? totalRowTotalsByKey.get(`${sectionIndex}:${subtotalCode}`)
          : undefined
      const codeTotals = row.majorCode
        ? totalRowTotalsByCode.get(row.majorCode) ?? totalsByMajorCode.get(row.majorCode)
        : subtotalCode
          ? totalRowTotalsByCode.get(subtotalCode) ?? totalsBySubsectionCode.get(subtotalCode)
          : undefined
      const resolvedTotals =
        subsectionTotals && subsectionTotals.itemCount > 0 ? subsectionTotals : fallbackTotals ?? codeTotals
      return applyTotals(row, resolvedTotals)
    }
    if (row.tone === 'TOTAL') {
      return applyTotals(row, resolveTotalsForTotalRow(row, index))
    }
    return row
  })
}
