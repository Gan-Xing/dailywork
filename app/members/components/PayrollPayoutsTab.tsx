'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { MultiSelectFilter, type MultiSelectOption } from '@/components/MultiSelectFilter'
import { ActionButton } from '@/components/members/MemberButtons'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'
import { normalizeText } from '@/lib/members/utils'
import type { Member } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type SupervisorOption = { value: string; label: string }

type PayrollSortField =
  | 'supervisor'
  | 'team'
  | 'name'
  | 'contractNumber'
  | 'contractType'
  | 'run1'
  | 'run2'
  | 'total'

type PayrollRun = {
  id: number
  year: number
  month: number
  sequence: number
  payoutDate: string
  attendanceCutoffDate: string
  note?: string | null
  createdAt: string
  updatedAt: string
}

type PayrollPayout = {
  id: number
  runId: number
  userId: number
  team: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  payoutDate: string
  amount: string
  currency: string
  note: string | null
  createdAt: string
  updatedAt: string
}

type PayrollPayoutsTabProps = {
  t: MemberCopy
  locale: Locale
  members: Member[]
  membersLoading: boolean
  membersError: string | null
  teamOptions: string[]
  chineseSupervisorOptions: SupervisorOption[]
  canViewPayroll: boolean
  canManagePayroll: boolean
}

const formatDateInput = (value?: string | null) => (value ? value.slice(0, 10) : '')

const toMonthValue = (date: Date) => date.toISOString().slice(0, 7)

const parseDateValue = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

const isAfterCutoff = (terminationDate: Date | null, cutoffDate: Date | null) => {
  if (!terminationDate) return true
  if (!cutoffDate) return true
  return terminationDate.getTime() > cutoffDate.getTime()
}

const toAmountNumber = (value?: string | null) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function PayrollPayoutsTab({
  t,
  locale,
  members,
  membersLoading,
  membersError,
  teamOptions,
  chineseSupervisorOptions,
  canViewPayroll,
  canManagePayroll,
}: PayrollPayoutsTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthValue(new Date()))
  const [viewMode, setViewMode] = useState<'entry' | 'report'>('entry')
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [payouts, setPayouts] = useState<PayrollPayout[]>([])
  const [prevCutoffDate, setPrevCutoffDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<number, Record<number, string>>>({})
  const [runDateDrafts, setRunDateDrafts] = useState<Record<number, string>>({})
  const [runCutoffDrafts, setRunCutoffDrafts] = useState<Record<number, string>>({})
  const [savingRuns, setSavingRuns] = useState<Record<number, boolean>>({})
  const [savingDates, setSavingDates] = useState<Record<number, boolean>>({})
  const [bulkOpen, setBulkOpen] = useState<Record<number, boolean>>({})
  const [bulkInputs, setBulkInputs] = useState<Record<number, string>>({})
  const [nameFilters, setNameFilters] = useState<string[]>([])
  const [teamFilters, setTeamFilters] = useState<string[]>([])
  const [supervisorFilters, setSupervisorFilters] = useState<string[]>([])
  const [contractTypeFilters, setContractTypeFilters] = useState<string[]>([])
  const [contractNumberFilters, setContractNumberFilters] = useState<string[]>([])
  const [sortField, setSortField] = useState<PayrollSortField | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const collator = useMemo(() => {
    const localeId = locale === 'fr' ? 'fr' : ['zh-Hans-u-co-pinyin', 'zh-Hans', 'zh']
    return new Intl.Collator(localeId, { numeric: true, sensitivity: 'base' })
  }, [locale])

  const baseMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          member.nationality !== 'china' &&
          member.expatProfile &&
          normalizeText(member.expatProfile.team),
      ),
    [members],
  )

  const filterControlProps = useMemo(
    () => ({
      allLabel: t.filters.all,
      selectedLabel: t.filters.selected,
      selectAllLabel: t.filters.selectAll,
      clearLabel: t.filters.clear,
      noOptionsLabel: t.filters.noOptions,
      searchPlaceholder: t.filters.searchPlaceholder,
      className: 'w-full',
    }),
    [t],
  )

  const nameFilterOptions = useMemo(() => {
    const map = new Map<string, string>()
    baseMembers.forEach((member) => {
      const name = normalizeText(member.name)
      if (!name || map.has(name)) return
      map.set(name, name)
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => collator.compare(left.label, right.label))
  }, [baseMembers, collator])

  const teamFilterOptions = useMemo(() => {
    const map = new Map<string, string>()
    teamOptions.forEach((team) => {
      const value = normalizeText(team)
      if (!value || map.has(value)) return
      map.set(value, team)
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => collator.compare(left.label, right.label))
  }, [teamOptions, collator])

  const supervisorFilterOptions = useMemo(() => {
    const list = chineseSupervisorOptions
      .map((option) => ({ value: option.value, label: option.label }))
      .filter((option) => normalizeText(option.value))
    list.sort((left, right) => collator.compare(left.label, right.label))
    return list
  }, [chineseSupervisorOptions, collator])

  const contractTypeFilterOptions = useMemo<MultiSelectOption[]>(
    () => [
      { value: 'CTJ', label: 'CTJ' },
      { value: 'CDD', label: 'CDD' },
    ],
    [],
  )

  const contractNumberFilterOptions = useMemo(() => {
    const map = new Map<string, string>()
    baseMembers.forEach((member) => {
      const contractNumber = normalizeText(member.expatProfile?.contractNumber)
      if (!contractNumber || map.has(contractNumber)) return
      map.set(contractNumber, contractNumber)
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((left, right) => collator.compare(left.label, right.label))
  }, [baseMembers, collator])

  const filteredMembers = useMemo(() => {
    return baseMembers.filter((member) => {
      if (nameFilters.length > 0) {
        const name = normalizeText(member.name)
        if (!name || !nameFilters.includes(name)) return false
      }
      if (teamFilters.length > 0) {
        const team = normalizeText(member.expatProfile?.team)
        if (!teamFilters.includes(team)) return false
      }
      if (supervisorFilters.length > 0) {
        const supervisorId = member.expatProfile?.chineseSupervisorId
        if (!supervisorFilters.includes(String(supervisorId ?? ''))) return false
      }
      if (contractTypeFilters.length > 0) {
        if (!member.expatProfile?.contractType) return false
        if (!contractTypeFilters.includes(member.expatProfile.contractType)) return false
      }
      if (contractNumberFilters.length > 0) {
        const contractNumber = normalizeText(member.expatProfile?.contractNumber)
        if (!contractNumber || !contractNumberFilters.includes(contractNumber)) return false
      }
      return true
    })
  }, [
    baseMembers,
    nameFilters,
    teamFilters,
    supervisorFilters,
    contractTypeFilters,
    contractNumberFilters,
  ])

  const runOneCutoffDate = useMemo(() => {
    const runOne = runs.find((run) => run.sequence === 1)
    if (!runOne) return null
    const draft = normalizeText(runCutoffDrafts[runOne.id])
    return draft || formatDateInput(runOne.attendanceCutoffDate)
  }, [runs, runCutoffDrafts])

  const { visibleMembers, eligibilityById } = useMemo(() => {
    const prevCutoff = parseDateValue(prevCutoffDate)
    const runOneCutoff = parseDateValue(runOneCutoffDate)
    const nextMembers: Member[] = []
    const nextEligibility = new Map<number, { run1Editable: boolean; run2Editable: boolean }>()

    filteredMembers.forEach((member) => {
      const terminationDate = parseDateValue(member.terminationDate)
      const isVisible = isAfterCutoff(terminationDate, prevCutoff)
      if (!isVisible) return

      const isCdd = member.expatProfile?.contractType === 'CDD'
      if (isCdd) {
        nextEligibility.set(member.id, { run1Editable: false, run2Editable: true })
        nextMembers.push(member)
        return
      }

      const run2Editable = isAfterCutoff(terminationDate, runOneCutoff)
      nextEligibility.set(member.id, { run1Editable: true, run2Editable })
      nextMembers.push(member)
    })

    return { visibleMembers: nextMembers, eligibilityById: nextEligibility }
  }, [filteredMembers, prevCutoffDate, runOneCutoffDate])

  const runMap = useMemo(() => {
    const map = new Map<number, PayrollRun>()
    runs.forEach((run) => {
      map.set(run.sequence, run)
    })
    return map
  }, [runs])

  const payoutMap = useMemo(() => {
    const map = new Map<number, Map<number, PayrollPayout>>()
    payouts.forEach((payout) => {
      if (!map.has(payout.runId)) {
        map.set(payout.runId, new Map())
      }
      map.get(payout.runId)?.set(payout.userId, payout)
    })
    return map
  }, [payouts])

  const sortedMembers = useMemo(() => {
    const list = [...visibleMembers]
    const direction = sortDir === 'asc' ? 1 : -1
    const runOne = runMap.get(1)
    const runTwo = runMap.get(2)

    const compareText = (leftValue: string, rightValue: string) => {
      if (!leftValue && !rightValue) return 0
      if (!leftValue) return 1
      if (!rightValue) return -1
      return collator.compare(leftValue, rightValue) * direction
    }

    const compareNumber = (leftValue: number | null, rightValue: number | null) => {
      if (leftValue === null && rightValue === null) return 0
      if (leftValue === null) return 1
      if (rightValue === null) return -1
      return (leftValue - rightValue) * direction
    }

    const getRunAmount = (member: Member, run: PayrollRun | undefined, eligible: boolean) => {
      if (!run || !eligible) return null
      const value =
        viewMode === 'report'
          ? payoutMap.get(run.id)?.get(member.id)?.amount
          : drafts[run.id]?.[member.id]
      return toAmountNumber(value)
    }

    const getTotalAmount = (member: Member) => {
      const eligibility = eligibilityById.get(member.id)
      const runOneAmount = getRunAmount(member, runOne, Boolean(eligibility?.run1Editable))
      const runTwoAmount = getRunAmount(member, runTwo, Boolean(eligibility?.run2Editable))
      if (runOneAmount === null && runTwoAmount === null) return null
      return (runOneAmount ?? 0) + (runTwoAmount ?? 0)
    }

    const defaultCompare = (left: Member, right: Member) => {
      const leftSupervisor =
        normalizeText(left.expatProfile?.chineseSupervisor?.chineseProfile?.frenchName) ||
        normalizeText(left.expatProfile?.chineseSupervisor?.username)
      const rightSupervisor =
        normalizeText(right.expatProfile?.chineseSupervisor?.chineseProfile?.frenchName) ||
        normalizeText(right.expatProfile?.chineseSupervisor?.username)
      const supervisorCompare = collator.compare(leftSupervisor, rightSupervisor)
      if (supervisorCompare !== 0) return supervisorCompare
      const teamCompare = collator.compare(
        normalizeText(left.expatProfile?.team),
        normalizeText(right.expatProfile?.team),
      )
      if (teamCompare !== 0) return teamCompare
      const nameCompare = collator.compare(
        normalizeText(left.name) || normalizeText(left.username),
        normalizeText(right.name) || normalizeText(right.username),
      )
      if (nameCompare !== 0) return nameCompare
      return left.id - right.id
    }

    const compareByField = (left: Member, right: Member) => {
      switch (sortField) {
        case 'supervisor':
          return compareText(
            normalizeText(left.expatProfile?.chineseSupervisor?.chineseProfile?.frenchName) ||
              normalizeText(left.expatProfile?.chineseSupervisor?.username),
            normalizeText(right.expatProfile?.chineseSupervisor?.chineseProfile?.frenchName) ||
              normalizeText(right.expatProfile?.chineseSupervisor?.username),
          )
        case 'team':
          return compareText(
            normalizeText(left.expatProfile?.team),
            normalizeText(right.expatProfile?.team),
          )
        case 'name':
          return compareText(
            normalizeText(left.name) || normalizeText(left.username),
            normalizeText(right.name) || normalizeText(right.username),
          )
        case 'contractNumber':
          return compareText(
            normalizeText(left.expatProfile?.contractNumber),
            normalizeText(right.expatProfile?.contractNumber),
          )
        case 'contractType':
          return compareText(
            left.expatProfile?.contractType ?? '',
            right.expatProfile?.contractType ?? '',
          )
        case 'run1': {
          const leftAmount = getRunAmount(
            left,
            runOne,
            Boolean(eligibilityById.get(left.id)?.run1Editable),
          )
          const rightAmount = getRunAmount(
            right,
            runOne,
            Boolean(eligibilityById.get(right.id)?.run1Editable),
          )
          return compareNumber(leftAmount, rightAmount)
        }
        case 'run2': {
          const leftAmount = getRunAmount(
            left,
            runTwo,
            Boolean(eligibilityById.get(left.id)?.run2Editable),
          )
          const rightAmount = getRunAmount(
            right,
            runTwo,
            Boolean(eligibilityById.get(right.id)?.run2Editable),
          )
          return compareNumber(leftAmount, rightAmount)
        }
        case 'total':
          return compareNumber(getTotalAmount(left), getTotalAmount(right))
        default:
          return 0
      }
    }

    list.sort((left, right) => {
      if (!sortField) return defaultCompare(left, right)
      const result = compareByField(left, right)
      if (result !== 0) return result
      return defaultCompare(left, right)
    })
    return list
  }, [
    visibleMembers,
    sortDir,
    sortField,
    runMap,
    viewMode,
    payoutMap,
    drafts,
    eligibilityById,
    collator,
  ])

  const selectedStats = useMemo(() => {
    const ctjCount = sortedMembers.filter((member) => member.expatProfile?.contractType === 'CTJ')
      .length
    const cddCount = sortedMembers.filter((member) => member.expatProfile?.contractType === 'CDD')
      .length
    return { total: sortedMembers.length, ctj: ctjCount, cdd: cddCount }
  }, [sortedMembers])

  const activeFilterCount =
    nameFilters.length +
    teamFilters.length +
    supervisorFilters.length +
    contractTypeFilters.length +
    contractNumberFilters.length
  const hasActiveFilters = activeFilterCount > 0

  const clearFilters = () => {
    setNameFilters([])
    setTeamFilters([])
    setSupervisorFilters([])
    setContractTypeFilters([])
    setContractNumberFilters([])
  }

  const loadPayroll = useCallback(async () => {
    if (!canViewPayroll) return
    const [yearValue, monthValue] = selectedMonth.split('-').map((part) => Number(part))
    if (!yearValue || !monthValue) return
    setLoading(true)
    setError(null)
    try {
      const prevMonthValue = monthValue === 1 ? 12 : monthValue - 1
      const prevYearValue = monthValue === 1 ? yearValue - 1 : yearValue
      const [res, prevRes] = await Promise.all([
        fetch(`/api/payroll-runs?year=${yearValue}&month=${monthValue}`),
        fetch(`/api/payroll-runs?year=${prevYearValue}&month=${prevMonthValue}`),
      ])
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.payroll.errors.loadFailed)
      }
      const data = (await res.json()) as { runs?: PayrollRun[]; payouts?: PayrollPayout[] }
      const nextRuns = Array.isArray(data.runs) ? data.runs : []
      const nextPayouts = Array.isArray(data.payouts) ? data.payouts : []
      let nextPrevCutoff: string | null = null
      if (prevRes.ok) {
        const prevData = (await prevRes.json().catch(() => ({}))) as { runs?: PayrollRun[] }
        const prevRuns = Array.isArray(prevData.runs) ? prevData.runs : []
        nextPrevCutoff =
          prevRuns.find((run) => run.sequence === 2)?.attendanceCutoffDate ?? null
      }
      setRuns(nextRuns)
      setPayouts(nextPayouts)
      setPrevCutoffDate(nextPrevCutoff)
      const nextDrafts: Record<number, Record<number, string>> = {}
      nextPayouts.forEach((payout) => {
        if (!nextDrafts[payout.runId]) nextDrafts[payout.runId] = {}
        nextDrafts[payout.runId][payout.userId] = payout.amount
      })
      setDrafts(nextDrafts)
      const nextRunDrafts: Record<number, string> = {}
      const nextRunCutoffDrafts: Record<number, string> = {}
      nextRuns.forEach((run) => {
        nextRunDrafts[run.id] = formatDateInput(run.payoutDate)
        nextRunCutoffDrafts[run.id] = formatDateInput(run.attendanceCutoffDate)
      })
      setRunDateDrafts(nextRunDrafts)
      setRunCutoffDrafts(nextRunCutoffDrafts)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payroll.errors.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [canViewPayroll, selectedMonth, t.payroll.errors.loadFailed])

  useEffect(() => {
    void loadPayroll()
  }, [loadPayroll])

  const updateDraft = (runId: number, userId: number, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [runId]: {
        ...prev[runId],
        [userId]: value,
      },
    }))
  }

  const getDraftAmount = (runId: number, userId: number) =>
    drafts[runId]?.[userId] ?? ''

  const getSupervisorLabel = (member: Member, runId?: number) => {
    if (runId) {
      const payout = payoutMap.get(runId)?.get(member.id)
      if (payout?.chineseSupervisorName) return payout.chineseSupervisorName
    }
    const supervisor = member.expatProfile?.chineseSupervisor
    return (
      normalizeText(supervisor?.chineseProfile?.frenchName) ||
      normalizeText(supervisor?.username) ||
      t.labels.empty
    )
  }

  const getTeamLabel = (member: Member, runId?: number) => {
    if (runId) {
      const payout = payoutMap.get(runId)?.get(member.id)
      if (payout?.team) return payout.team
    }
    return normalizeText(member.expatProfile?.team) || t.labels.empty
  }

  const runOneEligibleMembers = useMemo(
    () =>
      sortedMembers.filter((member) => eligibilityById.get(member.id)?.run1Editable),
    [sortedMembers, eligibilityById],
  )

  const runTwoEligibleMembers = useMemo(
    () =>
      sortedMembers.filter((member) => eligibilityById.get(member.id)?.run2Editable),
    [sortedMembers, eligibilityById],
  )

  const getEligibleMembers = (sequence: number) => {
    return sequence === 1 ? runOneEligibleMembers : runTwoEligibleMembers
  }

  const saveRun = async (run: PayrollRun) => {
    if (!canManagePayroll) return
    setError(null)
    const eligibleMembers = getEligibleMembers(run.sequence)
    if (eligibleMembers.length === 0) return

    const missing = eligibleMembers.filter((member) => {
      const value = getDraftAmount(run.id, member.id)
      return !normalizeText(value)
    })
    if (missing.length > 0) {
      setError(t.payroll.errors.missingAmount(missing.length))
      return
    }

    setSavingRuns((prev) => ({ ...prev, [run.id]: true }))
    try {
      const items = eligibleMembers.map((member) => ({
        userId: member.id,
        amount: getDraftAmount(run.id, member.id),
        team: member.expatProfile?.team ?? null,
        chineseSupervisorId: member.expatProfile?.chineseSupervisorId ?? null,
      }))
      const res = await fetch(`/api/payroll-runs/${run.id}/payouts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.payroll.errors.saveFailed)
      }
      await loadPayroll()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payroll.errors.saveFailed)
    } finally {
      setSavingRuns((prev) => ({ ...prev, [run.id]: false }))
    }
  }

  const saveRunDate = async (run: PayrollRun) => {
    if (!canManagePayroll) return
    const payoutDraft = normalizeText(runDateDrafts[run.id])
    const cutoffDraft = normalizeText(runCutoffDrafts[run.id])
    if (!payoutDraft && !cutoffDraft) return
    setSavingDates((prev) => ({ ...prev, [run.id]: true }))
    setError(null)
    try {
      const res = await fetch(`/api/payroll-runs/${run.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(payoutDraft ? { payoutDate: payoutDraft } : {}),
          ...(cutoffDraft ? { attendanceCutoffDate: cutoffDraft } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.payroll.errors.saveFailed)
      }
      await loadPayroll()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payroll.errors.saveFailed)
    } finally {
      setSavingDates((prev) => ({ ...prev, [run.id]: false }))
    }
  }

  const applyBulk = (run: PayrollRun) => {
    const lines = (bulkInputs[run.id] ?? '').split(/\r?\n/).map((line) => line.trim())
    if (lines.length === 0) return
    const eligibleMembers = getEligibleMembers(run.sequence)
    if (eligibleMembers.length === 0) return

    setDrafts((prev) => {
      const runDrafts = { ...(prev[run.id] ?? {}) }
      eligibleMembers.forEach((member, index) => {
        if (index >= lines.length) return
        runDrafts[member.id] = lines[index]
      })
      return { ...prev, [run.id]: runDrafts }
    })
  }

  const exportReport = async () => {
    if (sortedMembers.length === 0) return
    const runOne = runMap.get(1)
    const runTwo = runMap.get(2)
    const header = [
      t.table.chineseSupervisor,
      t.table.team,
      t.table.name,
      t.table.contractNumber,
      t.table.contractType,
      runOne ? formatDateInput(runOne.payoutDate) : t.payroll.runLabels.first,
      runTwo ? formatDateInput(runTwo.payoutDate) : t.payroll.runLabels.second,
      t.payroll.table.total,
    ]

    const rows = sortedMembers.map((member) => {
      const eligibility = eligibilityById.get(member.id)
      const runOneEligible = Boolean(eligibility?.run1Editable)
      const runTwoEligible = Boolean(eligibility?.run2Editable)
      const runOneAmount =
        runOne && runOneEligible
          ? payoutMap.get(runOne.id)?.get(member.id)?.amount ?? ''
          : ''
      const runTwoAmount =
        runTwo && runTwoEligible
          ? payoutMap.get(runTwo.id)?.get(member.id)?.amount ?? ''
          : ''
      const runOneNumber = toAmountNumber(runOneAmount)
      const runTwoNumber = toAmountNumber(runTwoAmount)
      const hasTotal = runOneNumber !== null || runTwoNumber !== null
      const rowTotal = (runOneNumber ?? 0) + (runTwoNumber ?? 0)
      return [
        getSupervisorLabel(member, runTwo?.id ?? runOne?.id),
        getTeamLabel(member, runTwo?.id ?? runOne?.id),
        normalizeText(member.name) || normalizeText(member.username),
        normalizeText(member.expatProfile?.contractNumber),
        member.expatProfile?.contractType ?? t.labels.empty,
        runOneAmount,
        runTwoAmount,
        hasTotal ? rowTotal : '',
      ]
    })

    const XLSX = await import('xlsx')
    const totalRow = [
      t.payroll.table.total,
      '',
      '',
      '',
      '',
      runOne ? runOneTotal : '',
      runTwo ? runTwoTotal : '',
      runOne || runTwo ? runOneTotal + runTwoTotal : '',
    ]
    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows, totalRow])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, t.payroll.title)
    const filename = `payroll-payouts-${selectedMonth}.xlsx`
    XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
  }

  const sumRun = (runId: number | undefined, eligibleMembers: Member[]) => {
    if (!runId) return 0
    return eligibleMembers.reduce((total, member) => {
      const value = payoutMap.get(runId)?.get(member.id)?.amount
      const parsed = Number(value)
      return Number.isFinite(parsed) ? total + parsed : total
    }, 0)
  }

  const handleSort = (field: PayrollSortField) => {
    setSortField((prev) => {
      if (prev === field) {
        setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return field
    })
  }

  const sortIndicator = (field: PayrollSortField) => {
    if (sortField !== field) return ''
    return sortDir === 'asc' ? '↑' : '↓'
  }

  const clearRun = async (run: PayrollRun) => {
    if (!canManagePayroll) return
    const label =
      formatDateInput(run.payoutDate) ||
      (run.sequence === 1 ? t.payroll.runLabels.first : t.payroll.runLabels.second)
    if (!window.confirm(t.payroll.confirm.clearRun(label))) return
    setSavingRuns((prev) => ({ ...prev, [run.id]: true }))
    setError(null)
    try {
      const res = await fetch(`/api/payroll-runs/${run.id}/payouts`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.payroll.errors.saveFailed)
      }
      await loadPayroll()
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payroll.errors.saveFailed)
    } finally {
      setSavingRuns((prev) => ({ ...prev, [run.id]: false }))
    }
  }

  if (!canViewPayroll) {
    return (
      <div className="p-6 text-sm text-rose-600">{t.access.needPayrollView}</div>
    )
  }

  const runOne = runMap.get(1)
  const runTwo = runMap.get(2)
  const runOneTotal = sumRun(runOne?.id, runOneEligibleMembers)
  const runTwoTotal = sumRun(runTwo?.id, runTwoEligibleMembers)
  const grandTotal = runOneTotal + runTwoTotal
  const columnCount = viewMode === 'report' ? 8 : 7

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t.payroll.title}
          </p>
          <p className="text-xs text-slate-500">{t.payroll.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadPayroll()}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            {t.compensation.actions.refresh}
          </button>
          <button
            type="button"
            onClick={exportReport}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
          >
            {t.actions.export}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-semibold">{t.payroll.monthLabel}</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
        </label>
        <div className="flex items-center rounded-full bg-slate-100 p-1">
          {(['entry', 'report'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                viewMode === mode
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.payroll.viewModes[mode]}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500">
          {t.payroll.stats.total}：{selectedStats.total} · {t.payroll.stats.ctj}：{selectedStats.ctj} · {t.payroll.stats.cdd}：{selectedStats.cdd}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[runOne, runTwo].map((run, index) => {
          if (!run) {
            return (
              <div
                key={`run-${index}`}
                className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-400"
              >
                {t.payroll.errors.loadFailed}
              </div>
            )
          }
          const draftDate = runDateDrafts[run.id] ?? formatDateInput(run.payoutDate)
          const draftCutoff =
            runCutoffDrafts[run.id] ?? formatDateInput(run.attendanceCutoffDate)
          const isSavingDate = savingDates[run.id]
          const isSavingRun = savingRuns[run.id]
          const isBulkOpen = bulkOpen[run.id]
          return (
            <div key={run.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {run.sequence === 1 ? t.payroll.runLabels.first : t.payroll.runLabels.second}
                  </p>
                  <p className="text-xs text-slate-500">{t.compensation.fields.payoutDate}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canManagePayroll || isSavingDate}
                    onClick={() => {
                      setRunDateDrafts((prev) => ({
                        ...prev,
                        [run.id]: formatDateInput(new Date().toISOString()),
                      }))
                    }}
                    className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-60"
                  >
                    {t.payroll.actions.useToday}
                  </button>
                  <button
                    type="button"
                    disabled={!canManagePayroll || isSavingDate}
                    onClick={() => saveRunDate(run)}
                    className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                  >
                    {t.payroll.actions.saveDate}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="text-sm text-slate-600">
                  <span className="block text-xs font-semibold text-slate-500">
                    {t.compensation.fields.payoutDate}
                  </span>
                  <input
                    type="date"
                    value={draftDate}
                    onChange={(event) =>
                      setRunDateDrafts((prev) => ({ ...prev, [run.id]: event.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
                <label className="text-sm text-slate-600">
                  <span className="block text-xs font-semibold text-slate-500">
                    {t.payroll.fields.attendanceCutoffDate}
                  </span>
                  <input
                    type="date"
                    value={draftCutoff}
                    onChange={(event) =>
                      setRunCutoffDrafts((prev) => ({
                        ...prev,
                        [run.id]: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                </label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!canManagePayroll || isSavingRun}
                  onClick={() => saveRun(run)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {t.payroll.actions.saveRun}
                </button>
                <button
                  type="button"
                  disabled={!canManagePayroll || isSavingRun}
                  onClick={() => clearRun(run)}
                  className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-600 disabled:opacity-60"
                >
                  {t.payroll.actions.clearRun}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBulkOpen((prev) => ({ ...prev, [run.id]: !isBulkOpen }))
                  }
                  className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
                >
                  {t.payroll.actions.bulkPaste}
                </button>
              </div>
              {isBulkOpen ? (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={3}
                    value={bulkInputs[run.id] ?? ''}
                    onChange={(event) =>
                      setBulkInputs((prev) => ({ ...prev, [run.id]: event.target.value }))
                    }
                    placeholder={t.payroll.bulkHint}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyBulk(run)}
                      className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      {t.payroll.actions.applyPaste}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setBulkInputs((prev) => ({ ...prev, [run.id]: '' }))
                      }
                      className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600"
                    >
                      {t.payroll.actions.clearPaste}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {t.filters.selected(hasActiveFilters ? activeFilterCount : 0)}
          </div>
          <ActionButton onClick={clearFilters} disabled={!hasActiveFilters}>
            {t.filters.reset}
          </ActionButton>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <MultiSelectFilter
            label={t.table.name}
            options={nameFilterOptions}
            selected={nameFilters}
            onChange={setNameFilters}
            {...filterControlProps}
          />
          <MultiSelectFilter
            label={t.table.team}
            options={teamFilterOptions}
            selected={teamFilters}
            onChange={setTeamFilters}
            {...filterControlProps}
          />
          <MultiSelectFilter
            label={t.table.chineseSupervisor}
            options={supervisorFilterOptions}
            selected={supervisorFilters}
            onChange={setSupervisorFilters}
            {...filterControlProps}
          />
          <MultiSelectFilter
            label={t.table.contractNumber}
            options={contractNumberFilterOptions}
            selected={contractNumberFilters}
            onChange={setContractNumberFilters}
            {...filterControlProps}
          />
          <MultiSelectFilter
            label={t.table.contractType}
            options={contractTypeFilterOptions}
            selected={contractTypeFilters}
            onChange={setContractTypeFilters}
            {...filterControlProps}
          />
        </div>
      </div>

      {membersError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          {membersError}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('supervisor')}
                  className="flex items-center gap-1 text-left"
                >
                  <span>{t.table.chineseSupervisor}</span>
                  <span className="text-slate-400">{sortIndicator('supervisor')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('team')}
                  className="flex items-center gap-1 text-left"
                >
                  <span>{t.table.team}</span>
                  <span className="text-slate-400">{sortIndicator('team')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 text-left"
                >
                  <span>{t.table.name}</span>
                  <span className="text-slate-400">{sortIndicator('name')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('contractNumber')}
                  className="flex items-center gap-1 text-left"
                >
                  <span>{t.table.contractNumber}</span>
                  <span className="text-slate-400">{sortIndicator('contractNumber')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleSort('contractType')}
                  className="flex items-center gap-1 text-left"
                >
                  <span>{t.table.contractType}</span>
                  <span className="text-slate-400">{sortIndicator('contractType')}</span>
                </button>
              </th>
              <th className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleSort('run1')}
                    className="flex items-center gap-1 text-left"
                  >
                    <span>{runOne ? formatDateInput(runOne.payoutDate) : t.payroll.runLabels.first}</span>
                    <span className="text-slate-400">{sortIndicator('run1')}</span>
                  </button>
                  {viewMode === 'report' && runOne ? (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {numberFormatter.format(runOneTotal)}
                    </span>
                  ) : null}
                </div>
              </th>
              <th className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => handleSort('run2')}
                    className="flex items-center gap-1 text-left"
                  >
                    <span>{runTwo ? formatDateInput(runTwo.payoutDate) : t.payroll.runLabels.second}</span>
                    <span className="text-slate-400">{sortIndicator('run2')}</span>
                  </button>
                  {viewMode === 'report' && runTwo ? (
                    <span className="text-[11px] font-semibold text-slate-400">
                      {numberFormatter.format(runTwoTotal)}
                    </span>
                  ) : null}
                </div>
              </th>
              {viewMode === 'report' ? (
                <th className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => handleSort('total')}
                      className="flex items-center gap-1 text-left"
                    >
                      <span>{t.payroll.table.total}</span>
                      <span className="text-slate-400">{sortIndicator('total')}</span>
                    </button>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {numberFormatter.format(grandTotal)}
                    </span>
                  </div>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {membersLoading || loading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-400">
                  {t.feedback.loading}
                </td>
              </tr>
            ) : null}
            {!membersLoading && !loading && sortedMembers.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-6 text-center text-sm text-slate-400">
                  {t.payroll.empty}
                </td>
              </tr>
            ) : null}
            {!membersLoading && !loading
              ? sortedMembers.map((member) => {
                  const eligibility = eligibilityById.get(member.id)
                  const runOneEligible = Boolean(runOne && eligibility?.run1Editable)
                  const runTwoEligible = Boolean(runTwo && eligibility?.run2Editable)
                  const runOneValue =
                    runOne && runOneEligible ? getDraftAmount(runOne.id, member.id) : ''
                  const runTwoValue = runTwo ? getDraftAmount(runTwo.id, member.id) : ''
                  const runOneReportValue =
                    runOne && runOneEligible
                      ? payoutMap.get(runOne.id)?.get(member.id)?.amount ?? ''
                      : ''
                  const runTwoReportValue =
                    runTwo && runTwoEligible
                      ? payoutMap.get(runTwo.id)?.get(member.id)?.amount ?? ''
                      : ''
                  const runOneNumber = toAmountNumber(runOneReportValue)
                  const runTwoNumber = toAmountNumber(runTwoReportValue)
                  const hasRowTotal = runOneNumber !== null || runTwoNumber !== null
                  const rowTotal = (runOneNumber ?? 0) + (runTwoNumber ?? 0)
                  return (
                    <tr key={member.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">{getSupervisorLabel(member, runTwo?.id ?? runOne?.id)}</td>
                      <td className="px-4 py-3">{getTeamLabel(member, runTwo?.id ?? runOne?.id)}</td>
                      <td className="px-4 py-3">
                        {normalizeText(member.name) || normalizeText(member.username) || t.labels.empty}
                      </td>
                      <td className="px-4 py-3">
                        {normalizeText(member.expatProfile?.contractNumber) || t.labels.empty}
                      </td>
                      <td className="px-4 py-3">{member.expatProfile?.contractType ?? t.labels.empty}</td>
                      <td className="px-4 py-3">
                        {viewMode === 'entry' ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            value={runOneValue}
                            disabled={!runOne || !canManagePayroll || !runOneEligible}
                            onChange={(event) =>
                              runOne && updateDraft(runOne.id, member.id, event.target.value)
                            }
                            placeholder={
                              runOneEligible ? t.compensation.fields.amount : t.payroll.table.runEmpty
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        ) : (
                          <span className="text-sm">
                            {runOneEligible
                              ? runOneReportValue || t.labels.empty
                              : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {viewMode === 'entry' ? (
                          <input
                            type="number"
                            inputMode="decimal"
                            value={runTwoValue}
                            disabled={!runTwo || !canManagePayroll || !runTwoEligible}
                            onChange={(event) =>
                              runTwo && updateDraft(runTwo.id, member.id, event.target.value)
                            }
                            placeholder={
                              runTwoEligible ? t.compensation.fields.amount : t.payroll.table.runEmpty
                            }
                            className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        ) : (
                          <span className="text-sm">
                            {runTwoEligible
                              ? runTwoReportValue || t.labels.empty
                              : ''}
                          </span>
                        )}
                      </td>
                      {viewMode === 'report' ? (
                        <td className="px-4 py-3">
                          {hasRowTotal ? numberFormatter.format(rowTotal) : t.labels.empty}
                        </td>
                      ) : null}
                    </tr>
                  )
                })
              : null}
          </tbody>
          {viewMode === 'report' && sortedMembers.length > 0 ? (
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm text-slate-600">
              <tr>
                <td className="px-4 py-3 font-semibold">{t.payroll.table.total}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 font-semibold">
                  {numberFormatter.format(runOneTotal)}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {numberFormatter.format(runTwoTotal)}
                </td>
                <td className="px-4 py-3 font-semibold">
                  {numberFormatter.format(grandTotal)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
