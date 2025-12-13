import type React from 'react'
import { useCallback, useMemo, useRef, useState, useTransition } from 'react'

import { computeDesign, normalizeLabel, normalizePhaseDTO } from '../phaseEditorUtils'
import { type PhaseEditorProps } from '../phaseEditorTypes'
import type {
  PhaseDTO,
  PhaseDefinitionDTO,
  PhaseIntervalPayload,
  PhaseMeasure,
  PhasePayload,
} from '@/lib/progressTypes'
import type { WorkflowBinding, WorkflowLayerTemplate } from '@/lib/progressWorkflow'
import type { Locale } from '@/lib/i18n'
import { formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'

type UsePhaseManagementParams = {
  road: PhaseEditorProps['road']
  initialPhases: PhaseDTO[]
  phaseDefinitions: PhaseDefinitionDTO[]
  workflows: WorkflowBinding[]
  canManage: boolean
  locale: Locale
  t: ReturnType<typeof import('@/lib/i18n/progress').getProgressCopy>['phase']
  roadStart: number
  roadEnd: number
  addToast: ReturnType<typeof import('@/components/ToastProvider').useToast>['addToast']
  onSelectionReset: () => void
  clearSelectedSegment: () => void
}

type UsePhaseManagementResult = {
  phases: PhaseDTO[]
  definitions: PhaseDefinitionDTO[]
  definitionId: number | null
  editingId: number | null
  name: string
  measure: PhaseMeasure
  pointHasSides: boolean
  intervals: PhaseIntervalPayload[]
  error: string | null
  isPending: boolean
  deletingId: number | null
  deleteTarget: PhaseDTO | null
  deleteError: string | null
  showFormModal: boolean
  defaultLayers: string[]
  defaultInterval: PhaseIntervalPayload
  layerOptions: string[]
  designLength: number
  workflowMap: Map<number, WorkflowBinding>
  workflowLayersByPhaseId: Map<number, { layers: WorkflowLayerTemplate[]; phaseName: string }>
  nameInputRef: React.RefObject<HTMLInputElement>
  setName: (value: string) => void
  setMeasure: (value: PhaseMeasure) => void
  setPointHasSides: (value: boolean) => void
  setDefinitionId: (value: number | null) => void
  setIntervals: (value: PhaseIntervalPayload[]) => void
  applyDefinitionTemplate: (definition: PhaseDefinitionDTO) => void
  openCreateModal: () => void
  closeFormModal: () => void
  startEdit: (phase: PhaseDTO) => void
  handleSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleDelete: (phase: PhaseDTO) => void
  confirmDelete: () => Promise<void>
  resetDeleteState: () => void
  resetForm: () => void
  updateInterval: (index: number, patch: Partial<PhaseIntervalPayload>) => void
  toggleIntervalLayer: (index: number, layerName: string) => void
  addInterval: () => void
  removeInterval: (index: number) => void
  setPhases: React.Dispatch<React.SetStateAction<PhaseDTO[]>>
  setDefinitions: React.Dispatch<React.SetStateAction<PhaseDefinitionDTO[]>>
}

export function usePhaseManagement({
  road,
  initialPhases,
  phaseDefinitions,
  workflows,
  canManage,
  locale,
  t,
  roadStart,
  roadEnd,
  addToast,
  onSelectionReset,
  clearSelectedSegment,
}: UsePhaseManagementParams): UsePhaseManagementResult {
  const [phases, setPhases] = useState<PhaseDTO[]>(() => initialPhases.map(normalizePhaseDTO))
  const [definitions, setDefinitions] = useState<PhaseDefinitionDTO[]>(phaseDefinitions)
  const [definitionId, setDefinitionId] = useState<number | null>(() => phaseDefinitions[0]?.id ?? null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [name, setName] = useState(() => phaseDefinitions[0]?.name ?? '')
  const [measure, setMeasure] = useState<PhaseMeasure>(() => phaseDefinitions[0]?.measure ?? 'LINEAR')
  const [pointHasSides, setPointHasSides] = useState(() => Boolean(phaseDefinitions[0]?.pointHasSides))
  const [intervals, setIntervals] = useState<PhaseIntervalPayload[]>([
    { startPk: roadStart, endPk: roadEnd, side: 'BOTH', spec: '', layers: [], billQuantity: null },
  ])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PhaseDTO | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const workflowMap = useMemo(() => {
    const map = new Map<number, WorkflowBinding>()
    workflows.forEach((item) => map.set(item.phaseDefinitionId, item))
    return map
  }, [workflows])

  const workflowLayersByPhaseId = useMemo(() => {
    const map = new Map<number, { layers: WorkflowLayerTemplate[]; phaseName: string }>()
    phases.forEach((phase) => {
      const binding = workflowMap.get(phase.definitionId)
      if (binding?.layers?.length) {
        map.set(phase.id, { layers: binding.layers, phaseName: binding.phaseName ?? phase.name })
      } else if (phase.resolvedLayers?.length) {
        const fallbackLayers: WorkflowLayerTemplate[] = phase.resolvedLayers.map((layerName, idx) => ({
          id: `${phase.id}-layer-${idx + 1}`,
          name: layerName,
          stage: idx + 1,
          dependencies: [],
          checks: [],
        }))
        map.set(phase.id, { layers: fallbackLayers, phaseName: phase.name })
      }
    })
    return map
  }, [phases, workflowMap])

  const currentPhaseForForm = useMemo(
    () => (editingId ? phases.find((item) => item.id === editingId) ?? null : null),
    [editingId, phases],
  )

  const workflowLayersForForm = useMemo(() => {
    if (currentPhaseForForm) {
      return workflowLayersByPhaseId.get(currentPhaseForForm.id)?.layers?.map((layer) => layer.name) ?? []
    }
    const defId = definitionId ?? null
    if (defId) {
      const binding = workflows.find((wf) => wf.phaseDefinitionId === defId)
      if (binding?.layers?.length) {
        return binding.layers.map((layer) => layer.name)
      }
    }
    return []
  }, [currentPhaseForForm, definitionId, workflowLayersByPhaseId, workflows])

  const defaultLayers = useMemo(() => {
    const def = definitions.find((item) => item.id === definitionId) ?? definitions[0]
    const definitionLayers = def?.defaultLayers ?? []
    if (definitionLayers.length) return definitionLayers
    if (currentPhaseForForm?.resolvedLayers?.length) return currentPhaseForForm.resolvedLayers
    if (workflowLayersForForm.length) return workflowLayersForForm
    return []
  }, [currentPhaseForForm?.resolvedLayers, definitionId, definitions, workflowLayersForForm])

  const defaultInterval = useMemo<PhaseIntervalPayload>(
    () => ({ startPk: roadStart, endPk: roadEnd, side: 'BOTH', spec: '', layers: defaultLayers, billQuantity: null }),
    [defaultLayers, roadEnd, roadStart],
  )

  const designLength = useMemo(() => computeDesign(measure, intervals), [measure, intervals])

  const updateInterval = (index: number, patch: Partial<PhaseIntervalPayload>) => {
    setIntervals((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)))
  }

  const layerOptions = useMemo(() => {
    const set = new Set<string>(defaultLayers)
    workflowLayersForForm.forEach((layer) => set.add(layer))
    intervals.forEach((interval) => {
      interval.layers?.forEach((layer: string) => set.add(layer))
    })
    return Array.from(set)
  }, [defaultLayers, intervals, workflowLayersForForm])

  const applyDefinitionTemplate = useCallback(
    (definition: PhaseDefinitionDTO) => {
      setDefinitionId(definition.id)
      setName(definition.name)
      setMeasure(definition.measure)
      setPointHasSides(definition.measure === 'POINT' ? Boolean(definition.pointHasSides) : false)
    },
    [],
  )

  const toggleIntervalLayer = (index: number, layerName: string) => {
    setIntervals((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item
        const layers = Array.isArray(item.layers) ? [...item.layers] : []
        const exists = layers.some((layer) => normalizeLabel(layer) === normalizeLabel(layerName))
        const nextLayers = exists
          ? layers.filter((layer) => normalizeLabel(layer) !== normalizeLabel(layerName))
          : [...layers, layerName]
        return { ...item, layers: nextLayers }
      }),
    )
  }

  const addInterval = () => {
    setIntervals((prev) => [...prev, { ...defaultInterval }])
  }

  const removeInterval = (index: number) => {
    setIntervals((prev) => prev.filter((_, idx) => idx !== index))
  }

  const resetForm = () => {
    const defaultDefinition = definitions[0]
    setDefinitionId(defaultDefinition?.id ?? null)
    setName(defaultDefinition?.name ?? '')
    setMeasure(defaultDefinition?.measure ?? 'LINEAR')
    setPointHasSides(Boolean(defaultDefinition?.pointHasSides))
    setIntervals([defaultInterval])
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
    setIntervals(
      normalized.intervals.map((i) => ({
        startPk: i.startPk,
        endPk: i.endPk,
        side: i.side,
        spec: i.spec ?? '',
        layers: Array.isArray(i.layers) ? i.layers : [],
        billQuantity: i.billQuantity ?? null,
      })),
    )
    setPointHasSides(Boolean(normalized.pointHasSides))
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
    if (!canManage) return
    startTransition(async () => {
      const intervalInvalid = intervals.some((item) => {
        const start = Number(item.startPk)
        const end = Number(item.endPk)
        return !Number.isFinite(start) || !Number.isFinite(end)
      })
      if (intervalInvalid) {
        setError(t.errors.invalidRange)
        return
      }
      if (!definitionId) {
        setError(t.errors.definitionMissing)
        return
      }
      const payload: PhasePayload = {
        phaseDefinitionId: definitionId,
        name,
        measure,
        pointHasSides: measure === 'POINT' ? pointHasSides : false,
        intervals: intervals.map((item) => {
          const startPk = Number(item.startPk)
          const endPk = Number(item.endPk)
          const spec = typeof item.spec === 'string' ? item.spec.trim() : ''
          const billQuantityInput = item.billQuantity
          const numericBillQuantity =
            billQuantityInput === null || billQuantityInput === undefined
              ? null
              : Number(billQuantityInput)
          const layers =
            measure === 'POINT'
              ? Array.from(
                new Set(
                  (item.layers?.length
                    ? item.layers
                    : layerOptions.length
                      ? layerOptions
                      : defaultLayers
                  ).filter(Boolean),
                ),
              )
              : []
          return {
            startPk,
            endPk,
            side: item.side,
            spec: spec || undefined,
            layers,
            billQuantity:
              numericBillQuantity === null || !Number.isFinite(numericBillQuantity)
                ? undefined
                : numericBillQuantity,
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
        setError(data.message ?? t.errors.saveFailed)
        return
      }
      const phase = normalizePhaseDTO(data.phase)
      setDefinitions((prev) => {
        const existing = prev.find((d) => d.id === phase.definitionId)
        if (!existing) {
          return [
            ...prev,
            {
              id: phase.definitionId,
              name: phase.definitionName,
              measure: phase.measure,
              pointHasSides: phase.pointHasSides,
              defaultLayers: phase.resolvedLayers,
              defaultChecks: phase.resolvedChecks,
              isActive: true,
              unitPrice: null,
              createdAt: phase.createdAt,
              updatedAt: phase.updatedAt,
            },
          ]
        }
        return prev.map((item) =>
          item.id === phase.definitionId
            ? {
              ...item,
              measure: phase.measure,
              pointHasSides: phase.pointHasSides,
              defaultLayers: phase.resolvedLayers,
              defaultChecks: phase.resolvedChecks,
              updatedAt: phase.updatedAt,
            }
            : item,
        )
      })
      setPhases((prev) =>
        editingId ? prev.map((item) => (item.id === editingId ? phase : item)) : [...prev, phase],
      )
      const localizedName = localizeProgressTerm('phase', phase.name, locale)
      addToast(
        editingId
          ? formatProgressCopy(t.success.updated, { name: localizedName })
          : formatProgressCopy(t.success.created, { name: localizedName }),
        { tone: 'success' },
      )
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
        setDeleteError(data.message ?? t.errors.deleteFailed)
        return
      }
      setPhases((prev) => prev.filter((item) => item.id !== deleteTarget.id))
      if (editingId === deleteTarget.id) {
        resetForm()
      }
      clearSelectedSegment()
      onSelectionReset()
      resetDeleteState()
    } catch {
      setDeleteError(t.errors.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  return {
    phases,
    definitions,
    definitionId,
    editingId,
    name,
    measure,
    pointHasSides,
    intervals,
    error,
    isPending,
    deletingId,
    deleteTarget,
    deleteError,
    showFormModal,
    defaultLayers,
    defaultInterval,
    layerOptions,
    designLength,
    workflowMap,
    workflowLayersByPhaseId,
    nameInputRef,
    setName,
    setMeasure,
    setPointHasSides,
    setDefinitionId,
    setIntervals,
    applyDefinitionTemplate,
    openCreateModal,
    closeFormModal,
    startEdit,
    handleSubmit,
    handleDelete,
    confirmDelete,
    resetDeleteState,
    resetForm,
    updateInterval,
    toggleIntervalLayer,
    addInterval,
    removeInterval,
    setPhases,
    setDefinitions,
  }
}
