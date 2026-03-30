'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { getResourcesCopy } from '@/lib/i18n/resources'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import { ResourcesHeader } from '../../ResourcesHeader'
import { useResourcesSession } from '../../hooks/useResourcesSession'
import {
  calculateWeekEndDate,
  createEmptyMaterialModel,
  formatDateInput,
  formatMaterialModel,
  formatPlanDateRange,
  normalizeMaterialModel,
  normalizeWeeklyPlanItemStatus,
  type MaterialModel,
  type WeeklyPlanItemStatus,
} from '../materialsConfig'
import { WeeklyPlanSignerSelect } from '../WeeklyPlanSignerSelect'
import { matchWeeklyPlanSignerId, type WeeklyPlanSignerOption } from '../signerOptions'

type Project = { id: number; name: string }

type PlanProjectLink = {
  projectId: number
  sortOrder: number
  project: Project
}

type PlanItem = {
  id: number
  planId: number
  sortOrder: number
  deliveryDate: string | null
  supplier: string | null
  goodsName: string | null
  model: unknown
  unit: string | null
  status: WeeklyPlanItemStatus | null
  plannedQty: string | null
  transporter: string | null
  headPlateNumber: string | null
  tailPlateNumber: string | null
  phone: string | null
  actualQty: string | null
  unitPrice: string | null
  note: string | null
}

type Plan = {
  id: number
  projectId: number
  project: Project
  projects: PlanProjectLink[]
  month: number
  session: number
  title: string
  weekStartDate: string | null
  weekEndDate: string | null
  approverUserId: number | null
  editorUserId: number | null
  approverName: string | null
  editorName: string | null
  items: PlanItem[]
}

type TableField = {
  key:
    | 'deliveryDate'
    | 'supplier'
    | 'unit'
    | 'plannedQty'
    | 'transporter'
    | 'headPlateNumber'
    | 'tailPlateNumber'
    | 'phone'
    | 'actualQty'
    | 'unitPrice'
    | 'proxyCost'
  label: string
  width: string
}

type ColumnKey =
  | 'deliveryDate'
  | 'supplier'
  | 'unit'
  | 'plannedQty'
  | 'transporter'
  | 'headPlateNumber'
  | 'tailPlateNumber'
  | 'phone'
  | 'actualQty'
  | 'unitPrice'
  | 'proxyCost'

const WEEKLY_PLAN_COLUMNS_STORAGE_KEY = 'weekly-plan-visible-columns'
const defaultVisibleColumns: ColumnKey[] = [
  'deliveryDate',
  'supplier',
  'unit',
  'plannedQty',
  'transporter',
  'headPlateNumber',
  'tailPlateNumber',
]

type RowFormState = {
  deliveryDate: string
  supplier: string
  goodsName: string
  model: MaterialModel
  unit: string
  status: WeeklyPlanItemStatus
  plannedQty: string
  transporter: string
  headPlateNumber: string
  tailPlateNumber: string
  phone: string
  actualQty: string
  unitPrice: string
}

type RowDialogState = {
  mode: 'create' | 'edit'
  itemId: number | null
} | null

type HistoryOptions = {
  supplier: string[]
  goodsName: string[]
  unit: string[]
  transporter: string[]
  headPlateNumber: string[]
  tailPlateNumber: string[]
  phone: string[]
}

type PlanFormState = {
  projectIds: string[]
  month: string
  session: string
  title: string
  weekStartDate: string
  approverUserId: string
  editorUserId: string
}

const EMPTY_HISTORY_OPTIONS: HistoryOptions = {
  supplier: [],
  goodsName: [],
  unit: [],
  transporter: [],
  headPlateNumber: [],
  tailPlateNumber: [],
  phone: [],
}

function HistorySuggestionInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: string[]
}) {
  const [open, setOpen] = useState(false)
  const filteredOptions = useMemo(() => {
    const keyword = value.trim().toLowerCase()
    const baseOptions = keyword ? options.filter((option) => option.toLowerCase().includes(keyword)) : options
    return baseOptions.slice(0, 8)
  }, [options, value])

  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label}
      <div className="relative">
        <input
          type="text"
          value={value}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
        />
        {open && filteredOptions.length > 0 ? (
          <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onChange(option)
                  setOpen(false)
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                {option}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  )
}

function ProjectMultiSelect({
  projects,
  selectedIds,
  onChange,
  label,
}: {
  projects: Project[]
  selectedIds: string[]
  onChange: (next: string[]) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [open])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedProjects = projects.filter((project) => selectedSet.has(String(project.id)))

  const toggleProject = (projectId: string) => {
    const next = selectedSet.has(projectId)
      ? selectedIds.filter((id) => id !== projectId)
      : [...selectedIds, projectId]
    onChange(next)
  }

  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label}
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="flex min-h-[52px] w-full flex-wrap items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm outline-none focus:ring-2 focus:ring-blue-300"
        >
          {selectedProjects.length ? (
            selectedProjects.map((project) => (
              <span
                key={project.id}
                className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200"
              >
                {project.name}
              </span>
            ))
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
            {projects.map((project) => (
              <label
                key={project.id}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(String(project.id))}
                  onChange={() => toggleProject(String(project.id))}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                />
                <span>{project.name}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>
    </label>
  )
}

const proxyCostValue = (actualQty: string | null | undefined, unitPrice: string | null | undefined): number | null => {
  const parsedActualQty = parseFloat(actualQty ?? '')
  const parsedUnitPrice = parseFloat(unitPrice ?? '')
  if (!Number.isFinite(parsedActualQty) || !Number.isFinite(parsedUnitPrice)) return null
  return parsedActualQty * parsedUnitPrice
}

const proxyCost = (item: Pick<PlanItem, 'actualQty' | 'unitPrice'>, locale: string): string => {
  const total = proxyCostValue(item.actualQty, item.unitPrice)
  if (total == null) return '—'
  return total.toLocaleString(locale === 'fr' ? 'fr-FR' : 'zh-CN', { maximumFractionDigits: 2 })
}

const getStatusTone = (status: WeeklyPlanItemStatus): string => {
  if (status === 'in_transit') return 'bg-amber-50 hover:bg-amber-100/70'
  if (status === 'arrived') return 'bg-emerald-50 hover:bg-emerald-100/70'
  if (status === 'cancelled') return 'bg-rose-50 hover:bg-rose-100/70'
  return 'hover:bg-slate-50'
}

const getStatusBadgeClass = (status: WeeklyPlanItemStatus): string => {
  if (status === 'in_transit') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-200'
  if (status === 'arrived') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200'
  if (status === 'cancelled') return 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
  return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200'
}

const toEditableModel = (value: unknown): MaterialModel => normalizeMaterialModel(value) ?? createEmptyMaterialModel()

const createEmptyRowForm = (): RowFormState => ({
  deliveryDate: '',
  supplier: '',
  goodsName: '',
  model: createEmptyMaterialModel(),
  unit: '',
  status: 'planned',
  plannedQty: '',
  transporter: '',
  headPlateNumber: '',
  tailPlateNumber: '',
  phone: '',
  actualQty: '',
  unitPrice: '',
})

const createRowFormFromItem = (item: PlanItem): RowFormState => ({
  deliveryDate: formatDateInput(item.deliveryDate),
  supplier: item.supplier ?? '',
  goodsName: item.goodsName ?? '',
  model: toEditableModel(item.model),
  unit: item.unit ?? '',
  status: normalizeWeeklyPlanItemStatus(item.status),
  plannedQty: item.plannedQty ?? '',
  transporter: item.transporter ?? '',
  headPlateNumber: item.headPlateNumber ?? '',
  tailPlateNumber: item.tailPlateNumber ?? '',
  phone: item.phone ?? '',
  actualQty: item.actualQty ?? '',
  unitPrice: item.unitPrice ?? '',
})

const trimNullable = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

const parseNullableNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export default function WeeklyPlanDetailClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const weeklyT = t.weeklyPlans
  const { canCreateMaterials } = useResourcesSession()
  const params = useParams()
  const router = useRouter()
  const planId = params?.id as string

  const [plan, setPlan] = useState<Plan | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [signerUsers, setSignerUsers] = useState<WeeklyPlanSignerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [planForm, setPlanForm] = useState<PlanFormState>({
    projectIds: [],
    month: '',
    session: '',
    title: '',
    weekStartDate: '',
    approverUserId: '',
    editorUserId: '',
  })
  const [savingPlan, setSavingPlan] = useState(false)
  const [planMessage, setPlanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [rowDialog, setRowDialog] = useState<RowDialogState>(null)
  const [rowForm, setRowForm] = useState<RowFormState>(createEmptyRowForm())
  const [historyOptions, setHistoryOptions] = useState<HistoryOptions>(EMPTY_HISTORY_OPTIONS)
  const [rowSaving, setRowSaving] = useState(false)
  const [rowError, setRowError] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(defaultVisibleColumns)
  const [columnsReady, setColumnsReady] = useState(false)
  const [columnSelectorOpen, setColumnSelectorOpen] = useState(false)
  const columnSelectorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = `${plan ? `${plan.title} · ` : ''}${weeklyT.detail.title} | ${t.title}`
  }, [plan, t.title, weeklyT.detail.title])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(WEEKLY_PLAN_COLUMNS_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ColumnKey[]
        const valid = parsed.filter((item) => defaultVisibleColumns.includes(item) || ['phone', 'actualQty', 'unitPrice', 'proxyCost'].includes(item))
        if (valid.length) setVisibleColumns(valid)
      }
    } catch {
      // ignore
    } finally {
      setColumnsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!columnsReady || typeof window === 'undefined') return
    window.localStorage.setItem(WEEKLY_PLAN_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns))
  }, [columnsReady, visibleColumns])

  useEffect(() => {
    if (!columnSelectorOpen) return
    const handler = (event: MouseEvent | TouchEvent) => {
      if (columnSelectorRef.current && !columnSelectorRef.current.contains(event.target as Node)) {
        setColumnSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [columnSelectorOpen])

  const resolveLoadErrorMessage = useCallback((status: number) => {
    if (status === 401 || status === 403) return weeklyT.status.permissionDenied
    if (status === 404) return weeklyT.status.notFound
    return weeklyT.status.loadFailed
  }, [weeklyT.status.loadFailed, weeklyT.status.notFound, weeklyT.status.permissionDenied])

  const resolvePlanSaveErrorMessage = useCallback((status: number) => {
    if (status === 400) return weeklyT.status.invalidStartDate
    if (status === 401 || status === 403) return weeklyT.status.permissionDenied
    if (status === 409) return weeklyT.status.duplicatePlan
    return weeklyT.status.saveFailed
  }, [weeklyT.status.duplicatePlan, weeklyT.status.invalidStartDate, weeklyT.status.permissionDenied, weeklyT.status.saveFailed])

  const columnOptions: TableField[] = [
    { key: 'deliveryDate', label: weeklyT.detail.columns.deliveryDate, width: '160px' },
    { key: 'supplier', label: weeklyT.detail.columns.supplier, width: '130px' },
    { key: 'unit', label: weeklyT.detail.columns.unit, width: '90px' },
    { key: 'plannedQty', label: weeklyT.detail.columns.plannedQty, width: '100px' },
    { key: 'actualQty', label: weeklyT.detail.columns.actualQty, width: '110px' },
    { key: 'unitPrice', label: weeklyT.detail.columns.unitPrice, width: '120px' },
    { key: 'transporter', label: weeklyT.detail.columns.transporter, width: '120px' },
    { key: 'headPlateNumber', label: weeklyT.detail.columns.headPlateNumber, width: '140px' },
    { key: 'tailPlateNumber', label: weeklyT.detail.columns.tailPlateNumber, width: '140px' },
    { key: 'phone', label: weeklyT.detail.columns.phone, width: '120px' },
    { key: 'proxyCost', label: weeklyT.detail.columns.proxyCost, width: '130px' },
  ]

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/finance/projects', { credentials: 'include' })
      if (!res.ok) return
      const data = (await res.json()) as { projects?: Project[] }
      setProjects(data.projects ?? [])
    } catch {
      // ignore
    }
  }, [])

  const fetchSignerUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/weekly-plans/chinese-users', { credentials: 'include' })
      if (!res.ok) return
      const data = (await res.json()) as { users?: WeeklyPlanSignerOption[] }
      setSignerUsers(data.users ?? [])
    } catch {
      // ignore
    }
  }, [])

  const fetchHistoryOptions = useCallback(async (projectIds: number[]) => {
    if (!projectIds.length) return
    try {
      const params = new URLSearchParams()
      projectIds.forEach((projectId) => params.append('projectId', String(projectId)))
      const res = await fetch(`/api/weekly-plans/options?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) return
      const data = (await res.json()) as { options?: Partial<HistoryOptions> }
      setHistoryOptions({
        supplier: data.options?.supplier ?? [],
        goodsName: data.options?.goodsName ?? [],
        unit: data.options?.unit ?? [],
        transporter: data.options?.transporter ?? [],
        headPlateNumber: data.options?.headPlateNumber ?? [],
        tailPlateNumber: data.options?.tailPlateNumber ?? [],
        phone: data.options?.phone ?? [],
      })
    } catch {
      // Ignore history dropdown failures.
    }
  }, [])

  const fetchPlan = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/weekly-plans/${planId}`, { credentials: 'include' })
      const data = (await res.json()) as { plan?: Plan }
      if (!res.ok) throw new Error(resolveLoadErrorMessage(res.status))

      const nextPlan = data.plan ?? null
      setPlan(nextPlan)
      if (nextPlan) {
        const nextProjectIds = (nextPlan.projects.length
          ? nextPlan.projects
          : [{ projectId: nextPlan.projectId, sortOrder: 0, project: nextPlan.project }]).map((entry) => String(entry.projectId))
        setPlanForm({
          projectIds: nextProjectIds,
          month: String(nextPlan.month),
          session: String(nextPlan.session),
          title: nextPlan.title,
          weekStartDate: formatDateInput(nextPlan.weekStartDate),
          approverUserId: nextPlan.approverUserId ? String(nextPlan.approverUserId) : '',
          editorUserId: nextPlan.editorUserId ? String(nextPlan.editorUserId) : '',
        })
        void fetchHistoryOptions(nextProjectIds.map(Number))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [fetchHistoryOptions, planId, resolveLoadErrorMessage])

  useEffect(() => {
    void fetchProjects()
    void fetchSignerUsers()
    void fetchPlan()
  }, [fetchPlan, fetchProjects, fetchSignerUsers])

  useEffect(() => {
    if (!plan || !signerUsers.length) return
    setPlanForm((current) => {
      const nextApproverUserId =
        current.approverUserId || matchWeeklyPlanSignerId(plan.approverName, signerUsers)
      const nextEditorUserId = current.editorUserId || matchWeeklyPlanSignerId(plan.editorName, signerUsers)
      if (nextApproverUserId === current.approverUserId && nextEditorUserId === current.editorUserId) {
        return current
      }
      return {
        ...current,
        approverUserId: nextApproverUserId,
        editorUserId: nextEditorUserId,
      }
    })
  }, [plan, signerUsers])

  const fetchRecentPrice = async (goodsName: string, model: MaterialModel | null) => {
    try {
      const params = new URLSearchParams({ goodsName })
      if (model) params.set('model', JSON.stringify(model))
      const res = await fetch(`/api/weekly-plans/recent-price?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) return null
      const data = (await res.json()) as { price?: number | null }
      return data.price ?? null
    } catch {
      return null
    }
  }

  const closeRowDialog = () => {
    if (rowSaving) return
    setRowDialog(null)
    setRowForm(createEmptyRowForm())
    setRowError(null)
  }

  const openCreateRowDialog = () => {
    if (!canCreateMaterials) return
    setRowDialog({ mode: 'create', itemId: null })
    setRowForm(createEmptyRowForm())
    setRowError(null)
  }

  const openEditRowDialog = (item: PlanItem) => {
    if (!canCreateMaterials) return
    setRowDialog({ mode: 'edit', itemId: item.id })
    setRowForm(createRowFormFromItem(item))
    setRowError(null)
  }

  const updateRowField = (field: keyof Omit<RowFormState, 'model'>, value: string) => {
    setRowForm((current) => ({ ...current, [field]: value }))
  }

  const updateRowStatus = (value: string) => {
    const nextStatus = normalizeWeeklyPlanItemStatus(value)
    setRowForm((current) => ({
      ...current,
      status: nextStatus,
      actualQty: nextStatus === 'arrived' ? current.actualQty : '',
    }))
  }

  const updateRowModelDimension = (
    index: number,
    field: keyof MaterialModel['dimensions'][number],
    value: string,
  ) => {
    setRowForm((current) => ({
      ...current,
      model: {
        dimensions: current.model.dimensions.map((dimension, dimensionIndex) =>
          dimensionIndex === index ? { ...dimension, [field]: value } : dimension,
        ),
      },
    }))
  }

  const addRowModelDimension = () => {
    setRowForm((current) => ({
      ...current,
      model: { dimensions: [...current.model.dimensions, { label: '', value: '', unit: '' }] },
    }))
  }

  const removeRowModelDimension = (index: number) => {
    setRowForm((current) => {
      const nextDimensions = current.model.dimensions.filter((_, dimensionIndex) => dimensionIndex !== index)
      return {
        ...current,
        model: {
          dimensions: nextDimensions.length > 0 ? nextDimensions : [{ label: '', value: '', unit: '' }],
        },
      }
    })
  }

  const handleSaveRow = async () => {
    if (!rowDialog || !canCreateMaterials) return
    setRowSaving(true)
    setRowError(null)

    try {
      const normalizedModel = normalizeMaterialModel(rowForm.model)
      const goodsName = trimNullable(rowForm.goodsName)
      const currentUnitPrice = rowForm.unitPrice.trim()
      let fallbackPrice: number | null = null
      if (!currentUnitPrice && goodsName && normalizedModel) {
        fallbackPrice = await fetchRecentPrice(goodsName, normalizedModel)
      }

      const payload = {
        deliveryDate: trimNullable(rowForm.deliveryDate),
        supplier: trimNullable(rowForm.supplier),
        goodsName,
        model: normalizedModel,
        unit: trimNullable(rowForm.unit),
        status: rowForm.status,
        plannedQty: parseNullableNumber(rowForm.plannedQty),
        transporter: trimNullable(rowForm.transporter),
        headPlateNumber: trimNullable(rowForm.headPlateNumber),
        tailPlateNumber: trimNullable(rowForm.tailPlateNumber),
        phone: trimNullable(rowForm.phone),
        actualQty: rowForm.status === 'arrived' ? parseNullableNumber(rowForm.actualQty) : null,
        unitPrice: currentUnitPrice ? parseNullableNumber(currentUnitPrice) : fallbackPrice,
      }

      const isCreate = rowDialog.mode === 'create'
      const url = isCreate
        ? `/api/weekly-plans/${planId}/items`
        : `/api/weekly-plans/${planId}/items/${rowDialog.itemId}`

      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(weeklyT.status.saveFailed)
      await fetchPlan()
      closeRowDialog()
    } catch (e) {
      setRowError((e as Error).message)
    } finally {
      setRowSaving(false)
    }
  }

  const handleDeleteRow = async (itemId: number) => {
    setDeleting(itemId)
    try {
      const res = await fetch(`/api/weekly-plans/${planId}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) throw new Error(weeklyT.status.deleteFailed)
      setPlan((currentPlan) =>
        currentPlan ? { ...currentPlan, items: currentPlan.items.filter((entry) => entry.id !== itemId) } : currentPlan,
      )
    } catch {
      // Ignore here.
    } finally {
      setDeleting(null)
    }
  }

  const handleDeletePlan = async () => {
    if (!confirm(weeklyT.detail.deletePlanConfirm)) return
    try {
      const res = await fetch(`/api/weekly-plans/${planId}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) router.push('/resources/weekly-plans')
    } catch {
      // Ignore.
    }
  }

  const handlePlanSave = async () => {
    if (!canCreateMaterials) return
    if (!planForm.weekStartDate || !planForm.projectIds.length || !planForm.month || !planForm.session) {
      setPlanMessage({ type: 'error', text: weeklyT.status.createValidationFailed })
      return
    }

    setSavingPlan(true)
    setPlanMessage(null)
    try {
      const res = await fetch(`/api/weekly-plans/${planId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectIds: planForm.projectIds.map(Number),
          month: Number(planForm.month),
          session: Number(planForm.session),
          title: planForm.title || undefined,
          weekStartDate: planForm.weekStartDate,
          approverUserId: planForm.approverUserId ? Number(planForm.approverUserId) : null,
          editorUserId: planForm.editorUserId ? Number(planForm.editorUserId) : null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { code?: string }
      if (!res.ok) {
        if (data.code === 'INVALID_WEEKLY_PLAN_SIGNER') {
          throw new Error(weeklyT.status.invalidSigner)
        }
        throw new Error(resolvePlanSaveErrorMessage(res.status))
      }
      setPlanMessage({ type: 'success', text: weeklyT.detail.planSaved })
      await fetchPlan()
    } catch (e) {
      setPlanMessage({ type: 'error', text: (e as Error).message })
    } finally {
      setSavingPlan(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-slate-400">{weeklyT.status.loading}</div>
  }
  if (error || !plan) {
    return <div className="p-20 text-center text-rose-600">{error ?? weeklyT.status.notFound}</div>
  }

  const computedEndDate = formatDateInput(calculateWeekEndDate(planForm.weekStartDate))
  const planRange = formatPlanDateRange(plan.weekStartDate, plan.weekEndDate)
  const planProjects = plan.projects.length ? plan.projects : [{ projectId: plan.projectId, sortOrder: 0, project: plan.project }]
  const visibleColumnSet = new Set(visibleColumns)
  const displayedFields = columnOptions.filter((field) => visibleColumnSet.has(field.key))

  const statusSummary = plan.items.reduce(
    (summary, item) => {
      const status = normalizeWeeklyPlanItemStatus(item.status)
      summary[status] += 1
      const cost = proxyCostValue(item.actualQty, item.unitPrice)
      if (cost != null && status !== 'cancelled') summary.proxyCost += cost
      return summary
    },
    { planned: 0, in_transit: 0, arrived: 0, cancelled: 0, proxyCost: 0 },
  )
  const proxyCostTotalLabel = statusSummary.proxyCost.toLocaleString(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
    maximumFractionDigits: 2,
  })
  const rowProxyPreview = proxyCost(
    { actualQty: rowForm.status === 'arrived' ? rowForm.actualQty : null, unitPrice: rowForm.unitPrice },
    locale,
  )

  return (
    <main className="min-h-screen bg-slate-50 pb-20 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources, href: '/resources' },
          { label: t.tabs.weeklyPlans, href: '/resources/weekly-plans' },
          { label: plan.title },
        ]}
      />

      <section className="mx-auto max-w-[1900px] px-4 pb-14 pt-6 sm:px-6 xl:px-10">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3">
              <Link
                href="/resources/weekly-plans"
                className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
              >
                ← {weeklyT.detail.backToList}
              </Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {planProjects.map((entry) => (
                <span
                  key={`${plan.id}-${entry.projectId}`}
                  className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200"
                >
                  {entry.project.name}
                </span>
              ))}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">
              {weeklyT.detail.title} <span className="text-blue-600">{plan.title}</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {planRange ? `${weeklyT.detail.rangePrefix}${locale === 'fr' ? ' : ' : '：'}${planRange}` : weeklyT.detail.rangeMissing}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(`/api/weekly-plans/${planId}/export?format=excel`, '_blank')}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {weeklyT.detail.exportExcel}
            </button>
            <button
              type="button"
              onClick={() => window.open(`/api/weekly-plans/${planId}/export?format=pdf`, '_blank')}
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
            >
              {weeklyT.detail.exportPdf}
            </button>
            {canCreateMaterials ? (
              <button
                type="button"
                onClick={() => void handleDeletePlan()}
                className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600"
              >
                {weeklyT.detail.deletePlan}
              </button>
            ) : null}
          </div>
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-[minmax(420px,2.4fr)_110px_110px_170px_170px_minmax(180px,1fr)_minmax(180px,1fr)_auto]">
            <div className="min-w-0 md:col-span-2 xl:col-span-4 2xl:col-span-1">
              <ProjectMultiSelect
                projects={projects}
                selectedIds={planForm.projectIds}
                onChange={(next) => {
                  setPlanForm((current) => ({ ...current, projectIds: next }))
                  setPlanMessage(null)
                }}
                label={weeklyT.detail.form.projects}
              />
            </div>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {weeklyT.detail.form.month}
              <input
                type="number"
                min={1}
                max={12}
                value={planForm.month}
                disabled={!canCreateMaterials}
                onChange={(e) => {
                  setPlanForm((current) => ({ ...current, month: e.target.value }))
                  setPlanMessage(null)
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {weeklyT.detail.form.session}
              <input
                type="number"
                min={1}
                value={planForm.session}
                disabled={!canCreateMaterials}
                onChange={(e) => {
                  setPlanForm((current) => ({ ...current, session: e.target.value }))
                  setPlanMessage(null)
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {weeklyT.detail.form.weekStartDate}
              <input
                type="date"
                value={planForm.weekStartDate}
                disabled={!canCreateMaterials}
                onChange={(e) => {
                  setPlanForm((current) => ({ ...current, weekStartDate: e.target.value }))
                  setPlanMessage(null)
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {weeklyT.detail.form.weekEndDate}
              <input
                type="date"
                readOnly
                value={computedEndDate}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              {weeklyT.detail.form.title}
              <input
                type="text"
                value={planForm.title}
                disabled={!canCreateMaterials}
                onChange={(e) => {
                  setPlanForm((current) => ({ ...current, title: e.target.value }))
                  setPlanMessage(null)
                }}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
              />
            </label>

            <WeeklyPlanSignerSelect
              label={weeklyT.detail.form.approverName}
              placeholder={weeklyT.createDialog.placeholders.approverName}
              value={planForm.approverUserId}
              options={signerUsers}
              disabled={!canCreateMaterials}
              onChange={(value) => {
                setPlanForm((current) => ({ ...current, approverUserId: value }))
                setPlanMessage(null)
              }}
            />

            <WeeklyPlanSignerSelect
              label={weeklyT.detail.form.editorName}
              placeholder={weeklyT.createDialog.placeholders.editorName}
              value={planForm.editorUserId}
              options={signerUsers}
              disabled={!canCreateMaterials}
              onChange={(value) => {
                setPlanForm((current) => ({ ...current, editorUserId: value }))
                setPlanMessage(null)
              }}
            />

            {canCreateMaterials ? (
              <div className="flex items-end md:col-span-2 xl:col-span-4 2xl:col-span-1">
                <button
                  type="button"
                  disabled={savingPlan}
                  onClick={() => void handlePlanSave()}
                  className="h-[42px] rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingPlan ? weeklyT.detail.savingPlanInfo : weeklyT.detail.savePlanInfo}
                </button>
              </div>
            ) : null}
          </div>

          {planMessage ? (
            <p className={`mt-3 text-sm ${planMessage.type === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {planMessage.text}
            </p>
          ) : null}
        </div>

        <div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-sm text-blue-800 shadow-sm">
          {weeklyT.detail.statusNote}
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{weeklyT.detail.summary.planned}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{statusSummary.planned}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">{weeklyT.detail.summary.inTransit}</p>
            <p className="mt-2 text-3xl font-semibold text-amber-900">{statusSummary.in_transit}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">{weeklyT.detail.summary.arrived}</p>
            <p className="mt-2 text-3xl font-semibold text-emerald-900">{statusSummary.arrived}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">{weeklyT.detail.summary.cancelled}</p>
            <p className="mt-2 text-3xl font-semibold text-rose-900">{statusSummary.cancelled}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{weeklyT.detail.summary.proxyCost}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">{proxyCostTotalLabel}</p>
          </div>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div ref={columnSelectorRef} className="relative">
            <button
              type="button"
              onClick={() => setColumnSelectorOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <span>{weeklyT.detail.columnSelector.label}</span>
              <span className="text-slate-400">{weeklyT.detail.columnSelector.selectedCount(visibleColumns.length)}</span>
            </button>
            {columnSelectorOpen ? (
              <div className="absolute z-20 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                {columnOptions.map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={visibleColumnSet.has(option.key)}
                      onChange={() =>
                        setVisibleColumns((current) =>
                          current.includes(option.key)
                            ? current.filter((item) => item !== option.key)
                            : [...current, option.key],
                        )
                      }
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {canCreateMaterials ? (
            <button
              type="button"
              onClick={openCreateRowDialog}
              className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50"
            >
              + {weeklyT.detail.addRow}
            </button>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-md">
          <table className="w-full min-w-[1280px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <th className="sticky left-0 bg-slate-50 px-2 py-3">{weeklyT.detail.columns.number}</th>
                <th className="px-3 py-3 text-center" style={{ minWidth: '140px' }}>{weeklyT.detail.columns.goodsName}</th>
                <th className="px-3 py-3 text-center" style={{ minWidth: '180px' }}>{weeklyT.detail.columns.model}</th>
                <th className="px-3 py-3 text-center" style={{ minWidth: '110px' }}>{weeklyT.detail.columns.status}</th>
                {displayedFields.map((field) => (
                  <th key={field.key} className="px-3 py-3 text-center" style={{ minWidth: field.width }}>
                    {field.label}
                  </th>
                ))}
                {canCreateMaterials ? <th className="px-3 py-3 text-center">{weeklyT.detail.columns.actions}</th> : null}
              </tr>
            </thead>

            <tbody>
              {plan.items.map((item, index) => {
                const rowStatus = normalizeWeeklyPlanItemStatus(item.status)
                const rowBg = getStatusTone(rowStatus)
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-100 transition ${rowBg} ${canCreateMaterials ? 'cursor-pointer' : ''}`}
                    onClick={() => openEditRowDialog(item)}
                  >
                    <td className="sticky left-0 bg-inherit px-2 py-2 text-center text-xs text-slate-400">{index + 1}</td>
                    <td className={`px-2 py-2 text-center ${!item.goodsName ? 'text-slate-300' : 'text-slate-800'}`}>
                      {item.goodsName ?? weeklyT.detail.noValue}
                    </td>
                    <td className={`px-2 py-2 text-center ${!item.model ? 'text-slate-300' : 'font-medium text-slate-800'}`}>
                      {formatMaterialModel(item.goodsName, item.model) || weeklyT.detail.noValue}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(rowStatus)}`}>
                        {weeklyT.detail.statusOptions[rowStatus]}
                      </span>
                    </td>
                    {displayedFields.map((field) => (
                      <td key={field.key} className="px-2 py-2 text-center text-slate-800">
                        {field.key === 'proxyCost'
                          ? rowStatus === 'cancelled'
                            ? weeklyT.detail.noValue
                            : proxyCost(item, locale)
                          : item[field.key] ?? weeklyT.detail.noValue}
                      </td>
                    ))}
                    {canCreateMaterials ? (
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditRowDialog(item)
                            }}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                          >
                            {weeklyT.detail.editRow}
                          </button>
                          <button
                            type="button"
                            disabled={deleting === item.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDeleteRow(item.id)
                            }}
                            className="rounded-lg p-1.5 text-slate-300 hover:bg-rose-50 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {rowDialog ? (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4" onClick={closeRowDialog}>
            <div className="flex min-h-full items-start justify-center sm:items-center">
              <div
                className="my-4 flex max-h-[calc(100vh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      {rowDialog.mode === 'create' ? weeklyT.detail.createRowTitle : weeklyT.detail.editRowTitle}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{weeklyT.detail.rowDialogHint}</p>
                  </div>
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    onClick={closeRowDialog}
                  >
                    ×
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      {weeklyT.detail.columns.status}
                      <select
                        value={rowForm.status}
                        onChange={(e) => updateRowStatus(e.target.value)}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                      >
                        <option value="planned">{weeklyT.detail.statusOptions.planned}</option>
                        <option value="in_transit">{weeklyT.detail.statusOptions.in_transit}</option>
                        <option value="arrived">{weeklyT.detail.statusOptions.arrived}</option>
                        <option value="cancelled">{weeklyT.detail.statusOptions.cancelled}</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      {weeklyT.detail.columns.deliveryDate}
                      <input
                        type="date"
                        value={rowForm.deliveryDate}
                        onChange={(e) => updateRowField('deliveryDate', e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </label>

                    <HistorySuggestionInput label={weeklyT.detail.columns.supplier} value={rowForm.supplier} onChange={(value) => updateRowField('supplier', value)} options={historyOptions.supplier} />
                    <HistorySuggestionInput label={weeklyT.detail.columns.goodsName} value={rowForm.goodsName} onChange={(value) => updateRowField('goodsName', value)} options={historyOptions.goodsName} />
                    <HistorySuggestionInput label={weeklyT.detail.columns.unit} value={rowForm.unit} onChange={(value) => updateRowField('unit', value)} options={historyOptions.unit} />

                    <label className="flex flex-col gap-1 text-sm text-slate-700">
                      {weeklyT.detail.columns.plannedQty}
                      <input
                        type="number"
                        step="any"
                        value={rowForm.plannedQty}
                        onChange={(e) => updateRowField('plannedQty', e.target.value)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    </label>

                    <HistorySuggestionInput label={weeklyT.detail.columns.transporter} value={rowForm.transporter} onChange={(value) => updateRowField('transporter', value)} options={historyOptions.transporter} />
                    <HistorySuggestionInput label={weeklyT.detail.columns.headPlateNumber} value={rowForm.headPlateNumber} onChange={(value) => updateRowField('headPlateNumber', value)} options={historyOptions.headPlateNumber} />
                    <HistorySuggestionInput label={weeklyT.detail.columns.tailPlateNumber} value={rowForm.tailPlateNumber} onChange={(value) => updateRowField('tailPlateNumber', value)} options={historyOptions.tailPlateNumber} />
                    <HistorySuggestionInput label={weeklyT.detail.columns.phone} value={rowForm.phone} onChange={(value) => updateRowField('phone', value)} options={historyOptions.phone} />
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{weeklyT.detail.modelEditor.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{weeklyT.detail.modelEditor.hint}</p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                        onClick={addRowModelDimension}
                      >
                        {weeklyT.detail.modelEditor.addDimension}
                      </button>
                    </div>

                    <div className="mt-4 space-y-3">
                      {rowForm.model.dimensions.map((dimension, index) => (
                        <div key={`row-dimension-${index}`} className="grid grid-cols-[1.2fr_1fr_110px_44px] gap-3">
                          <input
                            type="text"
                            placeholder={weeklyT.detail.modelEditor.dimensionLabelPlaceholder}
                            value={dimension.label}
                            onChange={(e) => updateRowModelDimension(index, 'label', e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <input
                            type="text"
                            placeholder={weeklyT.detail.modelEditor.dimensionValuePlaceholder}
                            value={dimension.value}
                            onChange={(e) => updateRowModelDimension(index, 'value', e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <input
                            type="text"
                            placeholder={weeklyT.detail.modelEditor.dimensionUnitPlaceholder}
                            value={dimension.unit ?? ''}
                            onChange={(e) => updateRowModelDimension(index, 'unit', e.target.value)}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                          />
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 bg-white text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                            onClick={() => removeRowModelDimension(index)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600">
                      {weeklyT.detail.modelEditor.previewLabel}
                      {locale === 'fr' ? ' : ' : '：'}
                      {formatMaterialModel(rowForm.goodsName, rowForm.model) || weeklyT.detail.noValue}
                    </div>
                  </div>

                  <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{weeklyT.detail.executionCard.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {rowForm.status === 'arrived'
                          ? weeklyT.detail.executionCard.arrivedHint
                          : rowForm.status === 'in_transit'
                            ? weeklyT.detail.executionCard.inTransitHint
                            : rowForm.status === 'cancelled'
                              ? weeklyT.detail.executionCard.cancelledHint
                              : weeklyT.detail.executionCard.plannedHint}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_220px]">
                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        {weeklyT.detail.columns.actualQty}
                        <input
                          type="number"
                          step="any"
                          value={rowForm.actualQty}
                          disabled={rowForm.status !== 'arrived'}
                          onChange={(e) => updateRowField('actualQty', e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-100 disabled:text-slate-400"
                        />
                        <span className="text-xs text-slate-400">{weeklyT.detail.executionCard.actualQtyHelper}</span>
                      </label>

                      <label className="flex flex-col gap-1 text-sm text-slate-700">
                        {weeklyT.detail.columns.unitPrice}
                        <input
                          type="number"
                          step="any"
                          value={rowForm.unitPrice}
                          onChange={(e) => updateRowField('unitPrice', e.target.value)}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300"
                        />
                      </label>

                      <div className="rounded-2xl bg-white px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{weeklyT.detail.executionCard.proxyCostLabel}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">{rowProxyPreview}</p>
                      </div>
                    </div>
                  </div>

                  {rowError ? <p className="mt-4 text-sm text-rose-600">{rowError}</p> : null}
                </div>

                <div className="flex shrink-0 justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
                  <button
                    type="button"
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                    onClick={closeRowDialog}
                  >
                    {weeklyT.detail.modelEditor.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={rowSaving}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleSaveRow()}
                  >
                    {rowSaving ? weeklyT.detail.savingRow : weeklyT.detail.saveRow}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}
