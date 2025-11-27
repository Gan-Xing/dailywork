/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import type {
  CheckDefinitionDTO,
  IntervalSide,
  LayerDefinitionDTO,
  PhaseDTO,
  PhaseDefinitionDTO,
  PhaseIntervalPayload,
  PhasePayload,
  RoadSectionDTO,
} from '@/lib/progressTypes'
import type { PhaseMeasure } from '@/lib/progressTypes'

interface Props {
  road: RoadSectionDTO
  initialPhases: PhaseDTO[]
  phaseDefinitions: PhaseDefinitionDTO[]
  layerOptions: LayerDefinitionDTO[]
  checkOptions: CheckDefinitionDTO[]
  canManage: boolean
  canInspect: boolean
}

const sideOptions: { value: IntervalSide; label: string }[] = [
  { value: 'BOTH', label: '双侧' },
  { value: 'LEFT', label: '左侧' },
  { value: 'RIGHT', label: '右侧' },
]

type Status = '未验收' | '验收中' | '已验收' | '非设计'

interface Segment {
  start: number
  end: number
  status: Status
}

interface Side {
  label: '左侧' | '右侧'
  segments: Segment[]
}

interface LinearView {
  left: Side
  right: Side
  total: number
}

interface PointView {
  total: number
  points: { startPk: number; endPk: number; side: IntervalSide }[]
}

const inspectionTypes = ['现场验收', '测量验收', '试验验收', '其他']

const statusTone: Record<Status, string> = {
  未验收: 'bg-gradient-to-r from-white via-slate-100 to-white text-slate-900 shadow-sm shadow-slate-900/10',
  验收中: 'bg-gradient-to-r from-amber-300 via-orange-200 to-amber-200 text-slate-900 shadow-md shadow-amber-400/30',
  已验收: 'bg-gradient-to-r from-emerald-300 via-lime-200 to-emerald-200 text-slate-900 shadow-md shadow-emerald-400/30',
  非设计: 'bg-slate-800 text-slate-100 shadow-inner shadow-slate-900/30',
}

const normalizePhaseDTO = (phase: PhaseDTO): PhaseDTO => ({
  ...phase,
  resolvedLayers: Array.isArray(phase.resolvedLayers) ? [...phase.resolvedLayers] : [],
  resolvedChecks: Array.isArray(phase.resolvedChecks) ? [...phase.resolvedChecks] : [],
  definitionLayerIds: Array.isArray(phase.definitionLayerIds) ? [...phase.definitionLayerIds] : [],
  definitionCheckIds: Array.isArray(phase.definitionCheckIds) ? [...phase.definitionCheckIds] : [],
  layerIds: Array.isArray(phase.layerIds) ? [...phase.layerIds] : [],
  checkIds: Array.isArray(phase.checkIds) ? [...phase.checkIds] : [],
  intervals: phase.intervals.map((interval) => ({
    startPk: Number(interval.startPk) || 0,
    endPk: Number(interval.endPk) || 0,
    side: interval.side,
  })),
})

const formatPK = (value: number) => {
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const computeDesign = (measure: PhaseMeasure, intervals: PhaseIntervalPayload[]) =>
  measure === 'POINT'
    ? intervals.length
    : intervals.reduce((sum, item) => {
        const start = Number(item.startPk)
        const end = Number(item.endPk)
        const safeStart = Number.isFinite(start) ? start : 0
        const safeEnd = Number.isFinite(end) ? end : safeStart
        const [orderedStart, orderedEnd] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
        const raw = orderedEnd - orderedStart
        const base = raw === 0 ? 1 : raw
        const factor = item.side === 'BOTH' ? 2 : 1
        return sum + base * factor
      }, 0)

const normalizeInterval = (interval: PhaseIntervalPayload, measure: PhaseMeasure) => {
  const start = Number(interval.startPk)
  const end = Number(interval.endPk)
  const safeStart = Number.isFinite(start) ? start : 0
  const safeEnd = measure === 'POINT' ? safeStart : Number.isFinite(end) ? end : safeStart
  const [orderedStart, orderedEnd] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart]
  return {
    startPk: orderedStart,
    endPk: orderedEnd,
    side: interval.side,
  }
}

const fillNonDesignGaps = (segments: Segment[], start: number, end: number) => {
  const sorted = [...segments].sort((a, b) => a.start - b.start)
  const result: Segment[] = []
  let cursor = start
  sorted.forEach((seg) => {
    if (seg.start > cursor) {
      result.push({ start: cursor, end: seg.start, status: '非设计' })
    }
    result.push(seg)
    cursor = Math.max(cursor, seg.end)
  })
  if (cursor < end) {
    result.push({ start: cursor, end, status: '非设计' })
  }
  return result
}

const buildLinearView = (phase: PhaseDTO, roadLength: number): LinearView => {
  const normalized = phase.intervals.map((i) => normalizeInterval(i, 'LINEAR'))
  const left: Segment[] = []
  const right: Segment[] = []
  normalized.forEach((interval) => {
    const seg = { start: interval.startPk, end: interval.endPk, status: '未验收' as Status }
    if (interval.side === 'LEFT') left.push(seg)
    if (interval.side === 'RIGHT') right.push(seg)
    if (interval.side === 'BOTH') {
      left.push(seg)
      right.push(seg)
    }
  })

  const maxEnd = Math.max(
    roadLength,
    ...normalized.map((i) => i.endPk),
    ...normalized.map((i) => i.startPk),
    0,
  )
  const total = Math.max(maxEnd, roadLength || 0, 1)

  return {
    left: { label: '左侧', segments: fillNonDesignGaps(left, 0, total) },
    right: { label: '右侧', segments: fillNonDesignGaps(right, 0, total) },
    total,
  }
}

const buildPointView = (phase: PhaseDTO, roadLength: number): PointView => {
  const normalized = phase.intervals.map((i) => normalizeInterval(i, 'POINT'))
  const maxEnd = Math.max(
    roadLength,
    ...normalized.map((i) => i.startPk),
    ...normalized.map((i) => i.endPk),
    0,
  )
  const total = Math.max(maxEnd, 1)
  return {
    total,
    points: normalized,
  }
}

const calcDesignBySide = (segments: Segment[]) =>
  segments.reduce((acc, seg) => (seg.status === '非设计' ? acc : acc + Math.max(0, seg.end - seg.start)), 0)

const calcCombinedPercent = (left: Segment[], right: Segment[]) => {
  const leftLen = calcDesignBySide(left)
  const rightLen = calcDesignBySide(right)
  const total = leftLen + rightLen || 1
  const completed = 0 // 未来接入验收状态，目前全部未施工
  return Math.round((completed / total) * 100)
}

export function PhaseEditor({
  road,
  initialPhases,
  phaseDefinitions,
  layerOptions,
  checkOptions,
  canManage,
  canInspect,
}: Props) {
  const roadStart = useMemo(() => {
    const start = Number(road.startPk)
    return Number.isFinite(start) ? start : 0
  }, [road.startPk])

  const roadEnd = useMemo(() => {
    const end = Number(road.endPk)
    return Number.isFinite(end) ? end : roadStart
  }, [road.endPk, roadStart])

  const defaultInterval = useMemo<PhaseIntervalPayload>(
    () => ({ startPk: roadStart, endPk: roadEnd, side: 'BOTH' }),
    [roadStart, roadEnd],
  )

  const [phases, setPhases] = useState<PhaseDTO[]>(() => initialPhases.map(normalizePhaseDTO))
  const [definitions, setDefinitions] = useState<PhaseDefinitionDTO[]>(phaseDefinitions)
  const [layerOptionsState, setLayerOptionsState] = useState<LayerDefinitionDTO[]>(layerOptions)
  const [checkOptionsState, setCheckOptionsState] = useState<CheckDefinitionDTO[]>(checkOptions)
  const [name, setName] = useState('')
  const [measure, setMeasure] = useState<PhaseMeasure>('LINEAR')
  const [intervals, setIntervals] = useState<PhaseIntervalPayload[]>([defaultInterval])
  const [definitionId, setDefinitionId] = useState<number | null>(null)
  const [layerTokens, setLayerTokens] = useState<string[]>([])
  const [checkTokens, setCheckTokens] = useState<string[]>([])
  const [layerInput, setLayerInput] = useState('')
  const [checkInput, setCheckInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PhaseDTO | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const designLength = useMemo(() => computeDesign(measure, intervals), [measure, intervals])

  const roadLength = useMemo(() => {
    const start = Number(road.startPk)
    const end = Number(road.endPk)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.abs(end - start)
    }
    const maxPhaseEnd = Math.max(
      0,
      ...phases.flatMap((phase) =>
        phase.intervals.map((i) => Math.max(Number(i.startPk) || 0, Number(i.endPk) || 0)),
      ),
    )
    return maxPhaseEnd || 0
  }, [road.endPk, road.startPk, phases])

  const updateInterval = (index: number, patch: Partial<PhaseIntervalPayload>) => {
    setIntervals((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    )
  }

  const addInterval = () => {
    setIntervals((prev) => [...prev, { ...defaultInterval }])
  }

  const removeInterval = (index: number) => {
    setIntervals((prev) => prev.filter((_, idx) => idx !== index))
  }

  const resetForm = () => {
    setName('')
    setMeasure('LINEAR')
    setIntervals([defaultInterval])
    setDefinitionId(null)
    setLayerTokens([])
    setCheckTokens([])
    setLayerInput('')
    setCheckInput('')
    setEditingId(null)
    setError(null)
  }

  const resetDeleteState = () => {
    setDeleteTarget(null)
    setDeleteError(null)
    setDeletingId(null)
  }

  const openCreateModal = () => {
    resetForm()
    setShowFormModal(true)
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
  }

  const closeFormModal = () => {
    resetForm()
    setShowFormModal(false)
  }

  const startEdit = (phase: PhaseDTO) => {
    const normalized = normalizePhaseDTO(phase)
    setName(normalized.name)
    setMeasure(normalized.measure)
    setDefinitionId(normalized.definitionId)
    setLayerTokens(normalized.resolvedLayers)
    setCheckTokens(normalized.resolvedChecks)
    setLayerInput('')
    setCheckInput('')
    setIntervals(
      normalized.intervals.map((i) => ({
        startPk: i.startPk,
        endPk: i.endPk,
        side: i.side,
      })),
    )
    setEditingId(normalized.id)
    setError(null)
    requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    setShowFormModal(true)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSuccessMessage(null)
    if (!canManage) return
    startTransition(async () => {
      const intervalInvalid = intervals.some((item) => {
        const start = Number(item.startPk)
        const end = measure === 'POINT' ? start : Number(item.endPk)
        return !Number.isFinite(start) || !Number.isFinite(end)
      })
      if (intervalInvalid) {
        setError('请填写有效的起点/终点')
        return
      }
      const { ids: layerIds, newNames: newLayers } = splitTokensToIds(layerTokens, layerOptionsState)
      const { ids: checkIds, newNames: newChecks } = splitTokensToIds(checkTokens, checkOptionsState)
      const payload: PhasePayload = {
        phaseDefinitionId: definitionId ?? undefined,
        name,
        measure,
        layerIds,
        checkIds,
        newLayers,
        newChecks,
        intervals: intervals.map((item) => {
          const startPk = Number(item.startPk)
          const endPk = measure === 'POINT' ? startPk : Number(item.endPk)
          return {
            startPk,
            endPk,
            side: item.side,
          }
        }),
      }

      const target = editingId
        ? `/api/progress/${road.slug}/phases/${editingId}`
        : `/api/progress/${road.slug}/phases`
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(target, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { phase?: PhaseDTO; message?: string }
      if (!res.ok || !data.phase) {
        setError(data.message ?? '保存失败')
        return
      }
      const phase = normalizePhaseDTO(data.phase)
      if (!definitions.find((d) => d.id === phase.definitionId)) {
        setDefinitions((prev) => [
          ...prev,
          {
            id: phase.definitionId,
            name: phase.definitionName,
            measure: phase.measure,
            defaultLayers: phase.resolvedLayers,
            defaultChecks: phase.resolvedChecks,
            isActive: true,
            createdAt: phase.createdAt,
            updatedAt: phase.updatedAt,
          },
        ])
      }
      const layerPairs =
        phase.layerIds.length && phase.resolvedLayers.length === phase.layerIds.length
          ? phase.layerIds.map((id, idx) => ({ id, name: phase.resolvedLayers[idx] }))
          : phase.definitionLayerIds.map((id, idx) => ({ id, name: phase.resolvedLayers[idx] }))

      if (layerPairs.length) {
        setLayerOptionsState((prev) => {
          let next = [...prev]
          layerPairs.forEach(({ id, name }) => {
            if (!name || id <= 0) return
            const existingIndex = next.findIndex((opt) => opt.name === name)
            if (existingIndex >= 0) {
              const existing = next[existingIndex]
              if (existing.id <= 0) {
                next = [
                  ...next.slice(0, existingIndex),
                  { ...existing, id },
                  ...next.slice(existingIndex + 1),
                ]
              }
            } else {
              next = [...next, { id, name, isActive: true }]
            }
          })
          return next
        })
      }

      const checkPairs =
        phase.checkIds.length && phase.resolvedChecks.length === phase.checkIds.length
          ? phase.checkIds.map((id, idx) => ({ id, name: phase.resolvedChecks[idx] }))
          : phase.definitionCheckIds.map((id, idx) => ({ id, name: phase.resolvedChecks[idx] }))

      if (checkPairs.length) {
        setCheckOptionsState((prev) => {
          let next = [...prev]
          checkPairs.forEach(({ id, name }) => {
            if (!name || id <= 0) return
            const existingIndex = next.findIndex((opt) => opt.name === name)
            if (existingIndex >= 0) {
              const existing = next[existingIndex]
              if (existing.id <= 0) {
                next = [
                  ...next.slice(0, existingIndex),
                  { ...existing, id },
                  ...next.slice(existingIndex + 1),
                ]
              }
            } else {
              next = [...next, { id, name, isActive: true }]
            }
          })
          return next
        })
      }
      setPhases((prev) =>
        editingId ? prev.map((item) => (item.id === editingId ? phase : item)) : [...prev, phase],
      )
      setSuccessMessage(editingId ? `分项「${phase.name}」已更新` : `分项「${phase.name}」已创建`)
      setShowFormModal(false)
      resetForm()
    })
  }

  const handleDelete = (phase: PhaseDTO) => {
    if (!canManage) return
    setDeleteError(null)
    setDeleteTarget(phase)
  }

  const confirmDelete = async () => {
    if (!canManage || !deleteTarget) return
    setDeleteError(null)
    setDeletingId(deleteTarget.id)
    try {
      const res = await fetch(`/api/progress/${road.slug}/phases/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setDeleteError(data.message ?? '删除失败')
        return
      }
      setPhases((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) {
        resetForm()
      }
      if (selectedSegment?.phaseId === deleteTarget.id) {
        setSelectedSegment(null)
        resetInspectionForm()
      }
      resetDeleteState()
    } catch {
      setDeleteError('删除失败')
    } finally {
      setDeletingId(null)
    }
  }

  const linearViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'LINEAR')
      .map((phase) => ({
        phase,
        view: buildLinearView(phase, roadLength),
      }))
  }, [phases, roadLength])

  const pointViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'POINT')
      .map((phase) => ({
        phase,
        view: buildPointView(phase, roadLength),
      }))
  }, [phases, roadLength])

const toggleToken = (value: string, list: string[], setter: (next: string[]) => void) => {
  const exists = list.includes(value)
  setter(exists ? list.filter((item) => item !== value) : [...list, value])
}

const splitTokensToIds = (
  tokens: string[],
  options: { id: number; name: string }[],
): { ids: number[]; newNames: string[] } => {
  const normalized = tokens.map((t) => t.trim()).filter(Boolean)
  const ids: number[] = []
  const newNames: string[] = []
  normalized.forEach((token) => {
    const matched = options.find((opt) => opt.name === token)
    if (matched && matched.id > 0) {
      ids.push(matched.id)
    } else {
      newNames.push(token)
    }
  })
  return {
    ids: Array.from(new Set(ids)),
    newNames: Array.from(new Set(newNames)),
  }
}

const addLayerToken = () => {
  const value = layerInput.trim()
  if (!value) return
  if (!layerTokens.includes(value)) {
    setLayerTokens((prev) => [...prev, value])
  }
  if (!selectedLayers.includes(value)) {
    setSelectedLayers((prev) => [...prev, value])
  }
  setLayerInput('')
}

const addCheckToken = () => {
  const value = checkInput.trim()
  if (!value) return
  if (!checkTokens.includes(value)) {
    setCheckTokens((prev) => [...prev, value])
  }
  if (!selectedChecks.includes(value)) {
    setSelectedChecks((prev) => [...prev, value])
  }
  setCheckInput('')
}

  const resetInspectionForm = () => {
    setSelectedLayers([])
    setSelectedChecks([])
    setSelectedTypes([])
    setRemark('')
    setSubmitError(null)
  }

const submitInspection = async () => {
  if (!selectedSegment) return
  const hasStart = startPkInput.trim() !== ''
  const hasEnd = endPkInput.trim() !== ''
  const startPk = Number(startPkInput)
  const endPk = Number(endPkInput)
  if (!hasStart || !hasEnd || !Number.isFinite(startPk) || !Number.isFinite(endPk)) {
    setSubmitError('请输入有效的起点和终点')
    return
  }
  if (!selectedLayers.length) {
    setSubmitError('请选择至少一个层次')
    return
  }
  if (!selectedChecks.length) {
    setSubmitError('请选择至少一个验收内容')
    return
  }
  if (!selectedTypes.length) {
    setSubmitError('请选择至少一个验收类型')
    return
  }
  setSubmitPending(true)
  setSubmitError(null)
  const payload = {
    phaseId: selectedSegment.phaseId,
    side: selectedSide,
    startPk,
    endPk,
    layers: selectedLayers,
    checks: selectedChecks,
    types: selectedTypes,
    remark,
  }

  const res = await fetch(`/api/progress/${road.slug}/inspections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as { message?: string }
  setSubmitPending(false)
  if (!res.ok) {
    setSubmitError(data.message ?? '提交失败')
    return
  }
  setSelectedSegment(null)
  resetInspectionForm()
}

  const [selectedSegment, setSelectedSegment] = useState<{
    phase: string
    phaseId: number
    measure: PhaseMeasure
    layers: string[]
    checks: string[]
    side: IntervalSide
    sideLabel: string
    start: number
    end: number
  } | null>(null)
  const [selectedSide, setSelectedSide] = useState<IntervalSide>('BOTH')
  const [startPkInput, setStartPkInput] = useState<string>('')
  const [endPkInput, setEndPkInput] = useState<string>('')
  const [selectedLayers, setSelectedLayers] = useState<string[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitPending, setSubmitPending] = useState(false)
  const [inspectionCheckInput, setInspectionCheckInput] = useState('')
  const latestChecksByDefinition = useMemo(() => {
    const latest = new Map<number, { updatedAt: number; checks: string[] }>()
    phases.forEach((phase) => {
      const updatedAt = new Date(phase.updatedAt || phase.createdAt).getTime()
      const current = latest.get(phase.definitionId)
      if (!current || updatedAt > current.updatedAt) {
        latest.set(phase.definitionId, { updatedAt, checks: phase.resolvedChecks })
      }
    })
    const result = new Map<number, string[]>()
    latest.forEach((item, key) => {
      result.set(key, item.checks)
    })
    return result
  }, [phases])

  useEffect(() => {
    if (selectedSegment) {
      setSelectedLayers([])
      setSelectedChecks(
        selectedSegment.checks.length === 1 ? [selectedSegment.checks[0]] : [],
      )
      setSelectedTypes([])
      setRemark('')
      setSubmitError(null)
      setInspectionCheckInput('')
      setSelectedSide(selectedSegment.side)
      setStartPkInput(String(selectedSegment.start ?? ''))
      setEndPkInput(String(selectedSegment.end ?? ''))
    }
  }, [selectedSegment])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(null), 3200)
    return () => clearTimeout(timer)
  }, [successMessage])

  return (
    <div className="space-y-8">
      {successMessage ? (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm rounded-2xl border border-emerald-200/60 bg-emerald-50/90 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-xl shadow-emerald-400/30">
          {successMessage}
        </div>
      ) : null}
      <section className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-50">分项工程</h2>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
              道路长度（估算）：{roadLength || '未填写'} m
            </span>
          </div>
          {canManage ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-300 px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5"
              onClick={openCreateModal}
            >
              新增分项
            </button>
          ) : null}
        </div>
        <p className="mt-3 text-sm text-slate-200/80">
          {canManage
            ? '新增/编辑分项会在弹窗中完成，便于手机端查看。'
            : '当前账号缺少编辑权限，仅可查看已有分项。'}
        </p>
      </section>

      {showFormModal && canManage ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/70 px-4 py-6 sm:items-center sm:py-10"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeFormModal()
            }
          }}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90 shadow-2xl shadow-emerald-500/20 backdrop-blur"
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
              onClick={closeFormModal}
              aria-label="关闭"
            >
              ×
            </button>
            <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-8">
              <div className="flex flex-wrap items-center gap-3">
                {editingId ? (
                  <span className="rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
                    编辑分项 · ID {editingId}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
                    新增分项
                  </span>
                )}
                <button
                  type="button"
                  className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                  onClick={resetForm}
                >
                  {editingId ? '退出编辑' : '重置表单'}
                </button>
                <span className="text-xs text-slate-300">
                  道路长度（估算）：{roadLength || '未填写'} m · 设计量自动计算：
                  {measure === 'POINT' ? `${designLength} 个` : `${designLength} m`}
                </span>
              </div>

              <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 md:grid-cols-4">
                  <label className="flex flex-col gap-2 text-sm text-slate-100">
                    分项模板
                    <select
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={definitionId ?? ''}
                      onChange={(e) => {
                        const value = e.target.value
                        if (!value) {
                          setDefinitionId(null)
                          return
                        }
                        const found = definitions.find((item) => item.id === Number(value))
                        if (found) {
                          setDefinitionId(found.id)
                          setName(found.name)
                          setMeasure(found.measure)
                          setLayerTokens(found.defaultLayers)
                          const rememberedChecks = latestChecksByDefinition.get(found.id) ?? []
                          setCheckTokens(rememberedChecks.length ? rememberedChecks : found.defaultChecks)
                        }
                      }}
                    >
                      <option value="">自定义/新建</option>
                      {definitions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} · {item.measure === 'POINT' ? '单体' : '延米'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-100">
                    名称
                    <input
                      ref={nameInputRef}
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="如：土方"
                      required
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm text-slate-100">
                    显示方式
                    <select
                      className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                      value={measure}
                      onChange={(e) => setMeasure(e.target.value as PhaseMeasure)}
                    >
                      <option value="LINEAR">延米（按起终点展示进度）</option>
                      <option value="POINT">单体（按点位/条目展示）</option>
                    </select>
                  </label>
                  <div className="flex flex-col justify-end text-sm text-slate-100">
                    <span className="text-xs text-slate-300">
                      设计量自动计算：
                      {measure === 'POINT'
                        ? `${designLength} 个（按条目数）`
                        : `${designLength} m（双侧区间按左右叠加）`}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-100">
                    <p>起点-终点列表（起点=终点可表示一个点）</p>
                    <button
                      type="button"
                      onClick={addInterval}
                      className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    >
                      添加区间
                    </button>
                  </div>

                  <div className="space-y-3">
                    {intervals.map((item, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100 md:grid-cols-4 md:items-center"
                      >
                        <label className="flex flex-col gap-1">
                          起点
                          <input
                            type="number"
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={Number.isFinite(item.startPk) ? item.startPk : ''}
                            onChange={(e) =>
                              updateInterval(index, {
                                startPk: e.target.value === '' ? Number.NaN : Number(e.target.value),
                              })
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          终点
                          <input
                            type="number"
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={Number.isFinite(item.endPk) ? item.endPk : ''}
                            onChange={(e) =>
                              updateInterval(index, { endPk: e.target.value === '' ? Number.NaN : Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          侧别
                          <select
                            className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
                            value={item.side}
                            onChange={(e) => updateInterval(index, { side: e.target.value as IntervalSide })}
                          >
                            {sideOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-end justify-end">
                          {intervals.length > 1 ? (
                            <button
                              type="button"
                              className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:border-rose-200/60 hover:bg-rose-200/10"
                              onClick={() => removeInterval(index)}
                            >
                              删除
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-100">
                      <p>层次（当前分项使用的候选）</p>
                      <button
                        type="button"
                        onClick={addLayerToken}
                        className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                      >
                        添加
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                        placeholder="选择或新增层次，如：第一层上土"
                        value={layerInput}
                        onChange={(e) => setLayerInput(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        {layerOptionsState.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              layerTokens.includes(option.name)
                                ? 'bg-emerald-300 text-slate-900'
                                : 'bg-white/10 text-slate-100'
                            }`}
                            onClick={() => toggleToken(option.name, layerTokens, setLayerTokens)}
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                      {layerTokens.length === 0 ? (
                        <p className="text-xs text-slate-300">暂无已选层次，输入后点击添加，或从上方候选中选择。</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {layerTokens.map((item) => (
                            <span
                              key={item}
                              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100"
                            >
                              {item}
                              <button
                                type="button"
                                className="text-[10px] text-rose-200"
                                onClick={() => setLayerTokens((prev) => prev.filter((token) => token !== item))}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between text-sm text-slate-100">
                      <p>验收内容（当前分项使用的候选）</p>
                      <button
                        type="button"
                        onClick={addCheckToken}
                        className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                      >
                        添加
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                        placeholder="如：压实度/平整度"
                        value={checkInput}
                        onChange={(e) => setCheckInput(e.target.value)}
                      />
                      <div className="flex flex-wrap gap-2">
                        {checkOptionsState.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                              checkTokens.includes(option.name)
                                ? 'bg-emerald-300 text-slate-900'
                                : 'bg-white/10 text-slate-100'
                            }`}
                            onClick={() => toggleToken(option.name, checkTokens, setCheckTokens)}
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                      {checkTokens.length === 0 ? (
                        <p className="text-xs text-slate-300">暂无已选验收内容，输入后点击添加，或从上方候选中选择。</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {checkTokens.map((item) => (
                            <span
                              key={item}
                              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100"
                            >
                              {item}
                              <button
                                type="button"
                                className="text-[10px] text-rose-200"
                                onClick={() => setCheckTokens((prev) => prev.filter((token) => token !== item))}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    保存分项
                  </button>
                  {error ? <span className="text-sm text-amber-200">{error}</span> : null}
                  {isPending ? <span className="text-xs text-slate-200/70">正在保存...</span> : null}
                </div>
                <p className="text-xs text-slate-300">
                  说明：显示方式决定进度展示形态；设计量自动按区间或单体数量统计，延米类双侧会叠加左右长度。
                </p>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget && canManage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
          onClick={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              resetDeleteState()
            }
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-50">删除分项</p>
                <p className="text-sm font-semibold text-slate-100">确定删除「{deleteTarget.name}」？</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
                onClick={() => {
                  if (deletingId) return
                  resetDeleteState()
                }}
                aria-label="关闭删除确认"
              >
                ×
              </button>
            </div>
            <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
              <p>删除后会产生以下影响：</p>
              <ul className="space-y-1">
                <li>• 关联的区间与报检记录一并移除，无法恢复。</li>
                <li>• 仅影响当前分项，不改动其他分项。</li>
                <li>• 请确认已导出或备份必要数据。</li>
              </ul>
            </div>
            {deleteError ? <p className="mt-3 text-sm text-amber-200">{deleteError}</p> : null}
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={() => {
                  if (deletingId) return
                  resetDeleteState()
                }}
                disabled={Boolean(deletingId)}
              >
                取消
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-red-300/80 bg-red-500/10 px-5 py-2 text-sm font-semibold text-red-100 shadow-lg shadow-red-500/20 transition hover:-translate-y-0.5 hover:bg-red-500/20 hover:border-red-200 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={confirmDelete}
                disabled={deletingId === deleteTarget.id}
              >
                {deletingId === deleteTarget.id ? '正在删除...' : '确认删除'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
          已有分项（白色=未验收，可点击预约报检）
          <span className="h-px w-12 bg-white/30" />
          灰=非设计 白=未验收
        </div>

        {phases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/15 bg-white/5 p-6 text-sm text-slate-200/80">
            暂无分项，添加后将显示在此处。
          </div>
        ) : (
          <div className="space-y-6">
            {phases.map((phase) => {
              const linear = phase.measure === 'LINEAR' ? linearViews.find((item) => item.phase.id === phase.id) : null
              const point = phase.measure === 'POINT' ? pointViews.find((item) => item.phase.id === phase.id) : null

              return (
                <div
                  key={phase.id}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-50">{phase.name}</h3>
                      <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-100">
                        {phase.measure === 'POINT'
                          ? `单体 · 设计量 ${phase.designLength} 个`
                          : `延米 · 设计量 ${phase.designLength} m`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {phase.measure === 'LINEAR' && linear ? (
                        <span className="text-sm font-semibold text-emerald-200">
                          已完成 {calcCombinedPercent(linear.view.left.segments, linear.view.right.segments)}%
                        </span>
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                            onClick={() => startEdit(phase)}
                          >
                            编辑分项
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-rose-200/60 px-3 py-2 text-[11px] font-semibold text-rose-100 transition hover:border-rose-200 hover:bg-rose-200/10"
                            onClick={() => handleDelete(phase)}
                            disabled={deletingId === phase.id}
                          >
                            {deletingId === phase.id ? '删除中...' : '删除分项'}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {phase.measure === 'LINEAR' && linear ? (
                    <div className="mt-4 space-y-4">
                      {[linear.view.left, linear.view.right].map((side) => (
                        <div key={side.label} className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-slate-200/80">
                            <span className="rounded-full bg-white/10 px-2 py-1 text-[11px] font-semibold">
                              {side.label}
                            </span>
                            <span className="text-slate-300">
                              {formatPK(0)} – {formatPK(linear.view.total)}
                            </span>
                          </div>
                          <div className="rounded-full bg-slate-900/70 p-1 shadow-inner shadow-slate-900/50">
                            <div className="flex h-8 overflow-hidden rounded-full bg-slate-800/60">
                              {side.segments.map((seg, idx) => {
                                const width = Math.max(0, seg.end - seg.start) / linear.view.total * 100
                                return (
                                  <button
                                    key={`${seg.start}-${seg.end}-${idx}`}
                                    type="button"
                                    className={`${statusTone[seg.status]} flex h-full items-center justify-center text-[10px] font-semibold transition hover:opacity-90`}
                                    style={{ width: `${width}%` }}
                                    title={`${side.label} ${formatPK(seg.start)} ~ ${formatPK(seg.end)} · ${seg.status}`}
                                    onClick={() => {
                                      if (seg.status === '未验收') {
                                        if (!canInspect) {
                                          alert('缺少报检权限')
                                          return
                                        }
                                        const sideLabel = side.label
                                        setSelectedSegment({
                                          phase: phase.name,
                                          phaseId: phase.id,
                                          measure: phase.measure,
                                          layers: phase.resolvedLayers,
                                          checks: phase.resolvedChecks,
                                          side: sideLabel === '左侧' ? 'LEFT' : 'RIGHT',
                                          sideLabel,
                                          start: seg.start,
                                          end: seg.end,
                                        })
                                      }
                                    }}
                                  >
                                    <span className="px-1">
                                      {formatPK(seg.start)}–{formatPK(seg.end)}
                                    </span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {phase.measure === 'POINT' && point ? (
                    <div className="mt-4 space-y-3">
                      <div className="relative mt-2 h-28 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-slate-900/40">
                        <div className="absolute left-6 right-6 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800" />
                        <div className="relative flex h-full items-center justify-between">
                          {point.view.points.map((item, idx) => {
                            const position = Math.min(
                              100,
                              Math.max(0, Math.round((item.startPk / point.view.total) * 100)),
                            )
                            return (
                              <button
                                key={`${item.startPk}-${idx}`}
                                type="button"
                                className="absolute top-1/2 flex -translate-y-1/2 flex-col items-center gap-1 text-center transition hover:scale-105"
                                style={{ left: `${position}%`, transform: 'translate(-50%, -50%)' }}
                                onClick={() => {
                                  if (!canInspect) {
                                    alert('缺少报检权限')
                                    return
                                  }
                                  const sideLabel =
                                    item.side === 'LEFT'
                                      ? '左侧'
                                      : item.side === 'RIGHT'
                                        ? '右侧'
                                        : '双侧'
                                  setSelectedSegment({
                                    phase: phase.name,
                                    phaseId: phase.id,
                                    measure: phase.measure,
                                    layers: phase.resolvedLayers,
                                    checks: phase.resolvedChecks,
                                    side: item.side,
                                    sideLabel,
                                    start: item.startPk,
                                    end: item.endPk,
                                  })
                                }}
                              >
                                <div
                                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 text-xs font-semibold text-white shadow-lg shadow-emerald-400/25 ring-2 ring-white/20"
                                  title={`${formatPK(item.startPk)} · ${item.side === 'LEFT' ? '左侧' : item.side === 'RIGHT' ? '右侧' : '双侧'}`}
                                >
                                  {item.side === 'BOTH' ? '双侧' : item.side === 'LEFT' ? '左侧' : '右侧'}
                                </div>
                                <div className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                  {formatPK(item.startPk)}
                                  </div>
                                  <p className="text-[10px] text-slate-300">
                                    {item.side === 'BOTH' ? '双侧' : item.side === 'LEFT' ? '左侧' : '右侧'}
                                  </p>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {selectedSegment ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur sm:items-center sm:py-10">
          <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-slate-900/70 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400" />
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
                <span className="inline-flex items-center rounded-full bg-emerald-300/15 px-3 py-1.5 text-base font-semibold uppercase tracking-[0.2em] text-emerald-100 ring-1 ring-emerald-300/40">
                  预约报检
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                  {selectedSegment.phase}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                  {selectedSegment.sideLabel}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                  {formatPK(selectedSegment.start)} → {formatPK(selectedSegment.end)}
                </span>
              </div>
              <button
                type="button"
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                onClick={() => setSelectedSegment(null)}
                aria-label="关闭"
              >
                ×
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              <div className="grid gap-4 border-t border-white/5 bg-white/2 px-6 py-6 text-sm text-slate-100 lg:grid-cols-5">
                <div className="lg:col-span-5 space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-1 text-xs text-slate-200">
                      <span className="font-semibold">侧别</span>
                      <select
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                        value={selectedSide}
                        onChange={(e) => setSelectedSide(e.target.value as IntervalSide)}
                      >
                        <option value="LEFT">左侧</option>
                        <option value="RIGHT">右侧</option>
                        <option value="BOTH">双侧</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-200">
                      <span className="font-semibold">起点</span>
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                      value={startPkInput}
                      onChange={(e) => setStartPkInput(e.target.value)}
                      placeholder="输入起点 PK"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-200">
                    <span className="font-semibold">终点</span>
                    <input
                      type="number"
                      className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                      value={endPkInput}
                      onChange={(e) => setEndPkInput(e.target.value)}
                      placeholder="输入终点 PK"
                    />
                  </label>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">层次（多选）</p>
                    {selectedSegment.layers.length === 0 ? (
                      <p className="text-[11px] text-amber-200">暂无层次，请先在分项维护中添加。</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedSegment.layers.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selectedLayers.includes(item)
                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                                : 'bg-white/10 text-slate-100 hover:bg-white/15'
                            }`}
                            onClick={() => toggleToken(item, selectedLayers, setSelectedLayers)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">验收内容（多选，可临时添加）</p>
                    {selectedSegment.checks.length === 0 ? (
                      <p className="text-[11px] text-amber-200">暂无验收内容，请在分项维护中添加或临时新增。</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedSegment.checks.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selectedChecks.includes(item)
                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                                : 'bg-white/10 text-slate-100 hover:bg-white/15'
                            }`}
                            onClick={() => toggleToken(item, selectedChecks, setSelectedChecks)}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 min-w-0 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-200/60 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                        placeholder="临时新增验收内容"
                        value={inspectionCheckInput}
                        onChange={(e) => setInspectionCheckInput(e.target.value)}
                      />
                      <button
                        type="button"
                        className="rounded-xl border border-white/20 px-4 py-2 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10 whitespace-nowrap"
                        onClick={() => {
                          if (inspectionCheckInput.trim()) {
                            const value = inspectionCheckInput.trim()
                            if (!selectedChecks.includes(value)) {
                              setSelectedChecks((prev) => [...prev, value])
                            }
                            setInspectionCheckInput('')
                          }
                        }}
                      >
                        添加
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">验收类型（多选）</p>
                    <div className="flex flex-wrap gap-2">
                      {inspectionTypes.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                            selectedTypes.includes(item)
                              ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                              : 'bg-white/10 text-slate-100 hover:bg-white/15'
                          }`}
                          onClick={() => toggleToken(item, selectedTypes, setSelectedTypes)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-900/60 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-slate-300">
                  {submitError
                    ? submitError
                    : '提示：若区间与侧别与上方段落一致，可直接提交；否则请修改起讫点或侧别。'}
                </p>
                <div className="grid w-full gap-3 sm:w-auto sm:min-w-[320px] sm:grid-cols-2">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                    onClick={() => {
                      setSelectedSegment(null)
                      resetInspectionForm()
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitPending}
                    onClick={submitInspection}
                  >
                    {submitPending ? '提交中...' : '提交报检'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
