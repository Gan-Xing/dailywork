import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildLinearView,
  buildPointView,
  buildCheckStatusBaseKey,
  buildCheckStatusKey,
  normalizeLabel,
  normalizeRange,
  snapshotMatches,
  statusPriority,
  workflowStatusTone,
} from '../phaseEditorUtils'
import {
  type AlertDialogState,
  type InspectionEntrySubmitPayload,
  type InspectionSlice,
  type InspectionSubmitBatch,
  type LatestPointInspection,
  type SelectedSegment,
  type SideBooking,
  type WorkflowStatusMaps,
} from '../phaseEditorTypes'
import { type AlertTone } from '@/components/AlertDialog'
import type { Locale } from '@/lib/i18n'
import type { IntervalSide, InspectionStatus, PhaseDTO } from '@/lib/progressTypes'
import type { WorkflowBinding, WorkflowLayerTemplate } from '@/lib/progressWorkflow'
import { localizeProgressList, localizeProgressTerm, localizeProgressText } from '@/lib/i18n/progressDictionary'

export type InspectionDrawerProps = {
  selectedSegment: SelectedSegment | null
  locale: Locale
  t: ReturnType<typeof import('@/lib/i18n/progress').getProgressCopy>['phase']
  workflowCopy: ReturnType<typeof import('@/lib/i18n/progress').getProgressCopy>['workflow']
  enforcedSide: IntervalSide | null
  selectedSide: IntervalSide
  setSelectedSide: (value: IntervalSide) => void
  startPkInput: string
  setStartPkInput: (value: string) => void
  endPkInput: string
  setEndPkInput: (value: string) => void
  appointmentDateInput: string
  setAppointmentDateInput: (value: string) => void
  selectedLayers: string[]
  selectedChecks: string[]
  selectedTypes: string[]
  activeInspectionTypes: string[]
  uniqueLayerOptions: string[]
  uniqueCheckOptions: string[]
  allowedCheckSet: Set<string> | null
  showLegacySelection: boolean
  remark: string
  setRemark: (value: string) => void
  submitError: string | null
  submitPending: boolean
  resetInspectionForm: () => void
  submitInspection: () => Promise<void>
  listJoiner: string
  workflowPhaseNameForContext: string
  workflowLayerNameMap: Map<string, string> | null
  workflowStatusMaps: WorkflowStatusMaps
  workflowLayerByName: Map<string, WorkflowLayerTemplate> | null
  localizedWorkflowPhaseName: string | null
  localizedWorkflowSideRule: string | null
  sideBooking: SideBooking
  resolveWorkflowStatusLabel: (status?: InspectionStatus) => string
  resolveWorkflowStatusTone: (status?: InspectionStatus) => string
  shouldSplitLayerBySide: (layer: WorkflowLayerTemplate) => boolean
  resolveSplitTargetSide: (layer: WorkflowLayerTemplate) => IntervalSide | null
  isStatusLocked: (status?: InspectionStatus) => boolean
  isLayerSelected: (name: string) => boolean
  isLayerDisabled: (name: string) => boolean
  toggleLayerSelection: (name: string) => void
  isCheckSelected: (name: string) => boolean
  toggleCheck: (name: string) => void
  toggleToken: (value: string, list: string[], setter: (next: string[]) => void) => void
  setSelectedTypes: (types: string[]) => void
  displayPhaseName: (name?: string) => string
  displayLayerName: (name: string) => string
  displayCheckName: (name: string) => string
}

type UseInspectionFlowParams = {
  phases: PhaseDTO[]
  workflowMap: Map<number, WorkflowBinding>
  workflowLayersByPhaseId: Map<number, { layers: WorkflowLayerTemplate[]; phaseName: string }>
  road: { id: number; slug: string }
  locale: Locale
  t: ReturnType<typeof import('@/lib/i18n/progress').getProgressCopy>['phase']
  workflowCopy: ReturnType<typeof import('@/lib/i18n/progress').getProgressCopy>['workflow']
  defaultInspectionTypes: string[]
  sideLabelMap: { LEFT: string; RIGHT: string }
  roadLength: number
  roadStart: number
  roadEnd: number
  canInspect: boolean
  canViewInspection: boolean
  addToast: ReturnType<typeof import('@/components/ToastProvider').useToast>['addToast']
}

export function useInspectionFlow({
  phases,
  workflowMap,
  workflowLayersByPhaseId,
  road,
  locale,
  t,
  workflowCopy,
  defaultInspectionTypes,
  sideLabelMap,
  roadLength,
  roadStart,
  roadEnd,
  canInspect,
  canViewInspection,
  addToast,
}: UseInspectionFlowParams) {
  const [inspectionSlices, setInspectionSlices] = useState<InspectionSlice[]>([])
  const [latestPointInspections, setLatestPointInspections] = useState<Map<string, LatestPointInspection>>(
    () => new Map(),
  )
  const measureByPhaseId = useMemo(() => new Map(phases.map((p) => [p.id, p.measure])), [phases])
  const topLayerNamesByPhaseId = useMemo(() => {
    const map = new Map<number, Set<string>>()
    workflowLayersByPhaseId.forEach((value, phaseId) => {
      const layers = value?.layers ?? []
      if (layers.length <= 1) return
      const maxStage = Math.max(...layers.map((layer) => layer.stage ?? 1))
      const names = layers
        .filter((layer) => (layer.stage ?? 1) === maxStage)
        .map((layer) => normalizeLabel(layer.name))
        .filter(Boolean)
      if (names.length) {
        map.set(phaseId, new Set(names))
      }
    })
    return map
  }, [workflowLayersByPhaseId])

  const phaseIdByWorkflow = useMemo(() => {
    const map = new Map<string, number>()
    phases.forEach((phase) => {
      const binding = workflowMap.get(phase.definitionId)
      if (binding?.id && !map.has(binding.id)) {
        map.set(binding.id, phase.id)
      }
      if (!binding?.id) {
        if (phase.name === '土方' && !map.has('earthwork')) {
          map.set('earthwork', phase.id)
        }
        if (phase.name === '垫层' && !map.has('subbase')) {
          map.set('subbase', phase.id)
        }
      }
    })
    return map
  }, [phases, workflowMap])

  const earthworkPhaseId = phaseIdByWorkflow.get('earthwork') ?? null
  const subbasePhaseId = phaseIdByWorkflow.get('subbase') ?? null
  const earthworkTopLayerName = useMemo(() => {
    if (!earthworkPhaseId) return null
    const names = topLayerNamesByPhaseId.get(earthworkPhaseId)
    if (!names || names.size === 0) return null
    return Array.from(names.values())[0] ?? null
  }, [earthworkPhaseId, topLayerNamesByPhaseId])

  const resolveLinearInspectionSlices = useCallback(
    (phase: PhaseDTO): InspectionSlice[] => {
      return inspectionSlices.filter((insp) => insp.phaseId === phase.id)
    },
    [inspectionSlices],
  )

  const linearViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'LINEAR')
      .map((phase) => {
        const slices = resolveLinearInspectionSlices(phase)
        return {
          phase,
          isDependencyDriven: false,
          view: buildLinearView(
            phase,
            roadLength,
            { left: sideLabelMap.LEFT, right: sideLabelMap.RIGHT },
            slices,
          ),
        }
      })
  }, [
    phases,
    resolveLinearInspectionSlices,
    roadLength,
    sideLabelMap.LEFT,
    sideLabelMap.RIGHT,
  ])

  const pointViews = useMemo(() => {
    return phases
      .filter((phase) => phase.measure === 'POINT')
      .map((phase) => ({
        phase,
        view: buildPointView(phase, roadStart, roadEnd),
      }))
  }, [phases, roadStart, roadEnd])

  const resolveWorkflowSelection = (phase: PhaseDTO) => {
    const binding = workflowMap.get(phase.definitionId)
    if (!binding) return null
    const sortedLayers = [...binding.layers].sort((a, b) => {
      if (a.stage !== b.stage) return a.stage - b.stage
      return a.name.localeCompare(b.name, 'zh-Hans')
    })
    const layerNames = sortedLayers.map((layer) => layer.name)
    const checkNames = sortedLayers.flatMap((layer) => layer.checks.map((check) => check.name))
    const typeOptions =
      binding.defaultTypes && binding.defaultTypes.length ? binding.defaultTypes : defaultInspectionTypes
    return { binding, sortedLayers, layerNames, checkNames, typeOptions }
  }

  const [selectedSegment, setSelectedSegment] = useState<SelectedSegment | null>(null)
  const [selectedSide, setSelectedSide] = useState<IntervalSide>('BOTH')
  const [startPkInput, setStartPkInput] = useState<string>('')
  const [endPkInput, setEndPkInput] = useState<string>('')
  const [appointmentDateInput, setAppointmentDateInput] = useState<string>('')
  const [submissionNumberInput, setSubmissionNumberInput] = useState<string>('')
  const [selectedLayers, setSelectedLayers] = useState<string[]>([])
  const [selectedChecks, setSelectedChecks] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [remark, setRemark] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [alertDialog, setAlertDialog] = useState<AlertDialogState | null>(null)
  const [submitPending, setSubmitPending] = useState(false)
  const [manualCheckExclusions, setManualCheckExclusions] = useState<string[]>([])

  const openInspectionModal = (phase: PhaseDTO, segment: SelectedSegment) => {
    const workflowSelection = resolveWorkflowSelection(phase)
    let workflowLayers = workflowSelection?.sortedLayers
    let layers = workflowSelection?.layerNames.length ? workflowSelection.layerNames : segment.layers
    if (workflowSelection?.sortedLayers?.length && segment.layers.length) {
      const targetTokens = new Set(
        segment.layers.flatMap((name) => normalizeLayerTokens(name, phase.name)),
      )
      const filtered = workflowSelection.sortedLayers.filter((layer) =>
        normalizeLayerTokens(layer.name, phase.name).some((token) => targetTokens.has(token)),
      )
      if (filtered.length) {
        workflowLayers = filtered
        layers = filtered.map((layer) => layer.name)
      }
    }
    const checks = workflowSelection?.checkNames.length ? workflowSelection.checkNames : segment.checks
    const typeOptions = workflowSelection?.typeOptions ?? defaultInspectionTypes
    setSelectedSegment({
      ...segment,
      phase: localizeProgressTerm('phase', phase.name, locale),
      layers: localizeProgressList('layer', layers, locale, { phaseName: phase.name }),
      checks: localizeProgressList('check', checks, locale),
      workflow: workflowSelection?.binding,
      workflowLayers,
      workflowTypeOptions: typeOptions,
    })
  }

  const handlePointSelect = (segment: SelectedSegment) => {
    if (!canInspect) {
      alert(t.alerts.noInspectPermission)
      return
    }
    const phase = phases.find((item) => item.id === segment.phaseId)
    if (!phase) return
    openInspectionModal(phase, segment)
  }

  const toggleToken = (value: string, list: string[], setter: (next: string[]) => void) => {
    const exists = list.includes(value)
    setter(exists ? list.filter((item) => item !== value) : [...list, value])
  }

  const isLayerSelected = (name: string) =>
    selectedLayers.some((item) => normalizeLabel(item) === normalizeLabel(name))

  const isCheckSelected = (name: string) =>
    selectedChecks.some((item) => normalizeLabel(item) === normalizeLabel(name))

  const isStatusLocked = (status?: InspectionStatus) => {
    if (!status) return false
    return (statusPriority[status] ?? 0) >= (statusPriority.SCHEDULED ?? 0)
  }

  const toggleCheck = (value: string) => {
    const exists = selectedChecks.includes(value)
    if (exists) {
      setSelectedChecks((prev) => prev.filter((item) => item !== value))
      setManualCheckExclusions((prev) => (prev.includes(value) ? prev : [...prev, value]))
    } else {
      setSelectedChecks((prev) => [...prev, value])
      setManualCheckExclusions((prev) => prev.filter((item) => item !== value))
    }
  }

  const resetInspectionForm = useCallback(() => {
    setSelectedLayers([])
    setSelectedChecks([])
    setSelectedTypes([])
    setRemark('')
    setSubmitError(null)
    setAppointmentDateInput('')
    setSubmissionNumberInput('')
    setAlertDialog(null)
  }, [])

  const raiseSubmitError = (message: string, tone: AlertTone = 'warning') => {
    setSubmitError(message)
    setAlertDialog({
      title: t.inspection.dialogTitle,
      description: message,
      tone,
    })
  }

  const performSubmit = async (
    entries: InspectionEntrySubmitPayload[],
    options?: { skipReset?: boolean },
  ) => {
    if (!entries.length) {
      raiseSubmitError(t.errors.submitLayerMissing)
      return false
    }
    setSubmitPending(true)
    setSubmitError(null)
    const res = await fetch('/api/inspection-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ entries }),
    })
    const data = (await res.json().catch(() => ({}))) as { message?: string; details?: string[] }
    setSubmitPending(false)
    if (!res.ok) {
      const detailText =
        data.details && Array.isArray(data.details) && data.details.length
          ? data.details.join(' / ')
          : ''
      const message = detailText
        ? `${data.message ?? t.errors.submitFailed}：${detailText}`
        : data.message ?? t.errors.submitFailed
      raiseSubmitError(message)
      return false
    }
    addToast(t.inspection.submitSuccess, { tone: 'success' })
    // fire refresh without blocking modal close
    void fetchLatestInspections()
    if (!options?.skipReset) {
      setSelectedSegment(null)
      resetInspectionForm()
    }
    return true
  }

  const workflowStatusLabelMap: Record<InspectionStatus, string> = {
    PENDING: t.status.pending,
    SCHEDULED: t.status.scheduled ?? t.status.pending,
    SUBMITTED: t.status.submitted ?? t.status.inProgress,
    IN_PROGRESS: t.status.inProgress,
    APPROVED: t.status.approved,
  }

  const resolveWorkflowStatusLabel = (status?: InspectionStatus) =>
    status ? workflowStatusLabelMap[status] ?? status : t.pointBadge.none

  const resolveWorkflowStatusTone = (status?: InspectionStatus) =>
    status ? workflowStatusTone[status] ?? workflowStatusTone.PENDING : workflowStatusTone.PENDING

  const normalizeLayerTokens = useCallback(
    (value: string, phaseName: string) => {
      const tokens = value
        .split(/[\\/，,;]/)
        .map((item) => item.trim())
        .filter(Boolean)
      const candidates = tokens.flatMap((token) => [
        token,
        localizeProgressTerm('layer', token, 'zh', { phaseName }),
        localizeProgressTerm('layer', token, 'fr', { phaseName }),
      ])
      return candidates
        .filter(Boolean)
        .map((item) => normalizeLabel(item))
    },
    [],
  )

  const selectedPhaseName = selectedSegment?.phase ?? ''
  const selectedWorkflowPhaseName = selectedSegment?.workflow?.phaseName ?? ''
  const selectedWorkflowSideRule = selectedSegment?.workflow?.sideRule ?? ''
  const selectedWorkflowLayers = selectedSegment?.workflowLayers ?? null
  const selectedWorkflowTypeOptions = selectedSegment?.workflowTypeOptions ?? null

  const [workflowLayerNameMap, workflowLayerByName, workflowChecksByLayerName, workflowTypesByLayerName, workflowCheckTypesByName, workflowCheckMetaByName] = useMemo(() => {
    if (!selectedWorkflowLayers?.length) {
      return [null, null, null, null, null, null]
    }
    const layerNameMap = new Map<string, string>()
    const layerByName = new Map<string, WorkflowLayerTemplate>()
    const checksByLayerName = new Map<string, Set<string>>()
    const typesByLayerName = new Map<string, Set<string>>()
    const checkTypesByName = new Map<string, Set<string>>()
    const checkMetaByName = new Map<string, { layerId: string; order: number; types: Set<string> }>()

    selectedWorkflowLayers.forEach((layer) => {
      const localizedName = localizeProgressTerm('layer', layer.name, locale, {
        phaseName: selectedWorkflowPhaseName || selectedPhaseName,
      })
      layerNameMap.set(layer.id, localizedName)
      const names = [
        layer.name,
        localizedName,
        localizeProgressTerm('layer', layer.name, 'zh', { phaseName: selectedPhaseName }),
        localizeProgressTerm('layer', layer.name, 'fr', { phaseName: selectedPhaseName }),
      ]
      names
        .filter(Boolean)
        .forEach((name) => layerByName.set(normalizeLabel(name), layer))

      const localizedChecks = layer.checks.map((check) => localizeProgressTerm('check', check.name, locale))
      const mergedChecks = new Set<string>([
        ...layer.checks.map((check) => check.name),
        ...localizedChecks,
      ])
      const namesForChecks = [layer.name, localizedName]
      namesForChecks.forEach((name) => checksByLayerName.set(normalizeLabel(name), mergedChecks))

      const typeSet = new Set<string>()
      layer.checks.forEach((check) =>
        check.types.forEach((type) => {
          typeSet.add(type)
          typeSet.add(localizeProgressTerm('type', type, locale))
        }),
      )
      namesForChecks.forEach((name) => typesByLayerName.set(normalizeLabel(name), typeSet))

      layer.checks.forEach((check, idx) => {
        const namesForMeta = [
          check.name,
          localizedChecks[idx],
          localizeProgressTerm('check', check.name, 'zh'),
          localizeProgressTerm('check', check.name, 'fr'),
        ]
        namesForMeta
          .filter(Boolean)
          .forEach((name) => checkMetaByName.set(normalizeLabel(name), { layerId: layer.id, order: idx, types: new Set(check.types) }))
        const typeSetForCheck = new Set<string>()
        check.types.forEach((type) => {
          typeSetForCheck.add(type)
          typeSetForCheck.add(localizeProgressTerm('type', type, locale))
        })
        const checkNames = [check.name, localizedChecks[idx]]
        checkNames.forEach((name) => checkTypesByName.set(normalizeLabel(name), typeSetForCheck))
      })
    })

    return [layerNameMap, layerByName, checksByLayerName, typesByLayerName, checkTypesByName, checkMetaByName]
  }, [locale, selectedPhaseName, selectedWorkflowLayers, selectedWorkflowPhaseName])

  const localizedWorkflowPhaseName = useMemo(() => {
    if (!selectedWorkflowPhaseName) return null
    return localizeProgressTerm('phase', selectedWorkflowPhaseName, locale)
  }, [locale, selectedWorkflowPhaseName])

  const localizedWorkflowSideRule = useMemo(() => {
    if (!selectedWorkflowSideRule) return null
    return localizeProgressText(selectedWorkflowSideRule, locale)
  }, [locale, selectedWorkflowSideRule])

  const workflowPhaseNameForContext = useMemo(
    () => selectedWorkflowPhaseName || selectedPhaseName,
    [selectedPhaseName, selectedWorkflowPhaseName],
  )

  const workflowStatusMaps = useMemo(() => {
    const checkStatus = new Map<string, InspectionStatus>()
    const checkStatusBySide = new Map<string, { LEFT?: InspectionStatus; RIGHT?: InspectionStatus }>()
    const checkStatusMeta = new Map<string, { status: InspectionStatus; updatedAt: number }>()
    const checkStatusBySideMeta = new Map<
      string,
      { LEFT?: { status: InspectionStatus; updatedAt: number }; RIGHT?: { status: InspectionStatus; updatedAt: number } }
    >()
    if (!selectedSegment?.workflowLayers?.length) {
      return { checkStatus, checkStatusBySide }
    }
    const startValue = Number(startPkInput)
    const endValue = Number(endPkInput)
    const hasStartInput = startPkInput.trim() !== '' && Number.isFinite(startValue)
    const hasEndInput = endPkInput.trim() !== '' && Number.isFinite(endValue)
    const [targetStart, targetEnd] = hasStartInput && hasEndInput
      ? normalizeRange(startValue, endValue)
      : normalizeRange(selectedSegment.start ?? 0, selectedSegment.end ?? 0)
    const recordStatus = (key: string, status: InspectionStatus, updatedAt: number) => {
      const prev = checkStatusMeta.get(key)
      if (
        !prev ||
        (statusPriority[status] ?? 0) > (statusPriority[prev.status] ?? 0) ||
        ((statusPriority[status] ?? 0) === (statusPriority[prev.status] ?? 0) && updatedAt >= prev.updatedAt)
      ) {
        checkStatusMeta.set(key, { status, updatedAt })
      }
    }

    const recordSideStatus = (key: string, side: 'LEFT' | 'RIGHT', status: InspectionStatus, updatedAt: number) => {
      const prev = checkStatusBySideMeta.get(key) ?? {}
      const current = prev[side]
      if (
        !current ||
        (statusPriority[status] ?? 0) > (statusPriority[current.status] ?? 0) ||
        ((statusPriority[status] ?? 0) === (statusPriority[current.status] ?? 0) && updatedAt >= current.updatedAt)
      ) {
        checkStatusBySideMeta.set(key, { ...prev, [side]: { status, updatedAt } })
      }
    }

    latestPointInspections.forEach((snapshot) => {
      if (snapshot.phaseId !== selectedSegment.phaseId) return
      const [snapshotStart, snapshotEnd] = normalizeRange(snapshot.startPk, snapshot.endPk)
      if (snapshotStart !== targetStart || snapshotEnd !== targetEnd) return
      const keyInput = {
        phaseId: snapshot.phaseId,
        phaseName: snapshot.phaseName ?? (selectedWorkflowPhaseName || selectedPhaseName),
        layerId: snapshot.layerId ?? null,
        layerName: snapshot.layerName ?? snapshot.layerId ?? null,
        checkId: snapshot.checkId ?? null,
        checkName: snapshot.checkName ?? snapshot.checkId ?? null,
        startPk: targetStart,
        endPk: targetEnd,
      }
      const sideKey = buildCheckStatusKey({ ...keyInput, side: snapshot.side })
      const baseKey = buildCheckStatusBaseKey(keyInput)
      const status = snapshot.status ?? 'PENDING'
      const updatedAt = snapshot.updatedAt ?? 0
      recordStatus(sideKey, status, updatedAt)
      if (snapshot.side === 'BOTH') {
        recordSideStatus(baseKey, 'LEFT', status, updatedAt)
        recordSideStatus(baseKey, 'RIGHT', status, updatedAt)
      } else {
        recordSideStatus(baseKey, snapshot.side === 'LEFT' ? 'LEFT' : 'RIGHT', status, updatedAt)
      }
    })

    checkStatusMeta.forEach((entry, key) => {
      checkStatus.set(key, entry.status)
    })
    checkStatusBySideMeta.forEach((entry, key) => {
      const value: { LEFT?: InspectionStatus; RIGHT?: InspectionStatus } = {}
      if (entry.LEFT) value.LEFT = entry.LEFT.status
      if (entry.RIGHT) value.RIGHT = entry.RIGHT.status
      checkStatusBySide.set(key, value)
    })

    return { checkStatus, checkStatusBySide }
  }, [endPkInput, latestPointInspections, selectedPhaseName, selectedSegment, selectedWorkflowPhaseName, startPkInput])

  const allowedCheckSet = useMemo(() => {
    if (!workflowChecksByLayerName) return null
    const aggregated = new Set<string>()
    selectedLayers.forEach((layer) => {
      const checks = workflowChecksByLayerName.get(normalizeLabel(layer))
      checks?.forEach((check) => aggregated.add(check))
    })
    return aggregated
  }, [selectedLayers, workflowChecksByLayerName])

  const activeInspectionTypes = useMemo(() => {
    const base =
      selectedWorkflowTypeOptions && selectedWorkflowTypeOptions.length
        ? selectedWorkflowTypeOptions
        : defaultInspectionTypes
    const baseSet = new Set(base)
    if (!workflowTypesByLayerName || !selectedLayers.length) return base
    const scoped = new Set<string>()
    selectedLayers.forEach((layer) => {
      const types = workflowTypesByLayerName.get(normalizeLabel(layer))
      types?.forEach((type) => {
        if (baseSet.has(type)) {
          scoped.add(type)
        }
      })
    })
    if (!scoped.size) return base
    return base.filter((type) => scoped.has(type))
  }, [defaultInspectionTypes, selectedLayers, selectedWorkflowTypeOptions, workflowTypesByLayerName])

  const allowedWorkflowStages = useMemo(() => {
    if (!workflowLayerByName || !selectedLayers.length) return null
    let minStage = Infinity
    selectedLayers.forEach((layer) => {
      const meta = workflowLayerByName.get(normalizeLabel(layer))
      if (meta && Number.isFinite(meta.stage)) {
        minStage = Math.min(minStage, meta.stage)
      }
    })
    if (!Number.isFinite(minStage)) return null
    return new Set<number>([minStage, minStage + 1])
  }, [selectedLayers, workflowLayerByName])

  const isLayerDisabled = (layerName: string) => {
    if (!workflowLayerByName) return false
    const meta = workflowLayerByName.get(normalizeLabel(layerName))
    if (!meta) return false
    const targetId = meta.id
    const isCompatibleWith = (selectedMeta: WorkflowLayerTemplate) => {
      if (selectedMeta.id === targetId) return true
      const lockPair =
        selectedMeta.lockStepWith?.includes(targetId) || meta.lockStepWith?.includes(selectedMeta.id)
      const parallelPair =
        selectedMeta.parallelWith?.includes(targetId) || meta.parallelWith?.includes(selectedMeta.id)
      return lockPair || parallelPair
    }
    const hasSelection = selectedLayers.length > 0
    if (hasSelection && allowedWorkflowStages && !allowedWorkflowStages.has(meta.stage)) {
      const compatible = selectedLayers.some((selected) => {
        const selectedMeta = workflowLayerByName.get(normalizeLabel(selected))
        if (!selectedMeta) return false
        return isCompatibleWith(selectedMeta)
      })
      return !compatible
    }
    if (!hasSelection) return false
    for (const selected of selectedLayers) {
      const selectedMeta = workflowLayerByName.get(normalizeLabel(selected))
      if (!selectedMeta) continue
      if (!isCompatibleWith(selectedMeta)) {
        return true
      }
    }
    return false
  }

  const uniqueLayerOptions = useMemo(
    () => Array.from(new Set(selectedSegment?.layers ?? [])),
    [selectedSegment?.layers],
  )

  const uniqueCheckOptions = useMemo(
    () => Array.from(new Set(selectedSegment?.checks ?? [])),
    [selectedSegment?.checks],
  )

  const findLayerOptionLabel = (layerName: string) => {
    const normalized = normalizeLabel(layerName)
    return uniqueLayerOptions.find((item) => normalizeLabel(item) === normalized) ?? layerName
  }

  const findCheckOptionLabel = (checkName: string) => {
    const normalized = normalizeLabel(checkName)
    return uniqueCheckOptions.find((item) => normalizeLabel(item) === normalized) ?? checkName
  }

  const toggleLayerSelection = (layerName: string) => {
    if (isLayerDisabled(layerName)) return
    const normalized = normalizeLabel(layerName)
    const meta = workflowLayerByName?.get(normalized)
    const group = new Set<string>([findLayerOptionLabel(layerName)])
    if (meta?.lockStepWith?.length && selectedWorkflowLayers) {
      meta.lockStepWith.forEach((id) => {
        const target = selectedWorkflowLayers.find((item) => item.id === id)
        const targetName = target
          ? localizeProgressTerm('layer', target.name, locale, {
            phaseName: workflowPhaseNameForContext,
          })
          : null
        if (targetName) {
          group.add(findLayerOptionLabel(targetName))
        }
      })
    }
    const allSelected = Array.from(group).every((name) => selectedLayers.includes(name))
    if (allSelected) {
      setSelectedLayers((prev) => prev.filter((item) => !group.has(item)))
    } else {
      setSelectedLayers((prev) => {
        const next = prev.filter((item) => !group.has(item))
        group.forEach((item) => {
          if (!next.includes(item)) next.push(item)
        })
        return next
      })
    }
  }

  useEffect(() => {
    if (!selectedSegment || typeof window === 'undefined') return
    const frame = window.requestAnimationFrame(() => {
      setSelectedLayers([])
      setSelectedChecks(
        selectedSegment.checks.length === 1 ? [selectedSegment.checks[0]] : [],
      )
      setSelectedTypes([])
      setRemark('')
      setSubmitError(null)
      setSelectedSide(selectedSegment.side)
      setStartPkInput(String(selectedSegment.start ?? ''))
      setEndPkInput(String(selectedSegment.end ?? ''))
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      setAppointmentDateInput(tomorrow.toISOString().slice(0, 10))
      setManualCheckExclusions([])
      setSubmissionNumberInput('')
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedSegment])

  useEffect(() => {
    if (!workflowChecksByLayerName) return
    let nextChecks: string[] | null = null
    let nextManual: string[] | null = null

    if (!allowedCheckSet || !allowedCheckSet.size) {
      if (selectedChecks.length) {
        nextChecks = []
      }
      if (manualCheckExclusions.length) {
        nextManual = []
      }
    } else {
      const manualSet = new Set(manualCheckExclusions)
      const candidateChecks = Array.from(allowedCheckSet).filter((item) => !manualSet.has(item))
      const cleanedManual = manualCheckExclusions.filter((item) => allowedCheckSet.has(item))
      if (cleanedManual.length !== manualCheckExclusions.length) {
        nextManual = cleanedManual
      }
      const prevSet = new Set(selectedChecks)
      const changed =
        candidateChecks.length !== selectedChecks.length ||
        candidateChecks.some((item) => !prevSet.has(item))
      if (changed) {
        nextChecks = candidateChecks
      }
    }

    if (!nextChecks && !nextManual) return
    if (typeof window === 'undefined') return
    const frame = window.requestAnimationFrame(() => {
      if (nextManual) setManualCheckExclusions(nextManual)
      if (nextChecks) setSelectedChecks(nextChecks)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [allowedCheckSet, manualCheckExclusions, selectedChecks, selectedLayers, workflowChecksByLayerName])

  const prevSideRef = useRef<IntervalSide>(selectedSide)
  useEffect(() => {
    if (prevSideRef.current === selectedSide) return
    if (typeof window === 'undefined') {
      prevSideRef.current = selectedSide
      return
    }
    const frame = window.requestAnimationFrame(() => {
      setSelectedLayers([])
      setSelectedChecks([])
      setSelectedTypes([])
      setManualCheckExclusions([])
      prevSideRef.current = selectedSide
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedSide])

  useEffect(() => {
    const allowed = activeInspectionTypes
    if (!allowed.length) return
    const allowedSet = new Set(allowed)
    const union = new Set<string>()
    selectedChecks.forEach((check) => {
      const types = workflowCheckTypesByName?.get(normalizeLabel(check))
      types?.forEach((type) => {
        if (allowedSet.has(type)) {
          union.add(type)
        }
      })
    })
    const next = union.size ? allowed.filter((type) => union.has(type)) : allowed
    const changed =
      next.length !== selectedTypes.length || next.some((type, idx) => type !== selectedTypes[idx])
    if (!changed) return
    if (typeof window === 'undefined') return
    const frame = window.requestAnimationFrame(() => {
      setSelectedTypes(next)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeInspectionTypes, selectedChecks, selectedTypes, workflowCheckTypesByName])

  const fetchLatestInspections = useCallback(
    async (options?: { phaseId?: number; signalCancelled?: () => boolean }) => {
      if (!canViewInspection) {
        setInspectionSlices([])
        setLatestPointInspections(new Map())
        return
      }
      const isCancelled = options?.signalCancelled ?? (() => false)
      const search = new URLSearchParams({
        roadSlug: road.slug,
        sortField: 'updatedAt',
        sortOrder: 'desc',
        pageSize: '500',
      })
      if (options?.phaseId) {
        search.set('phaseId', String(options.phaseId))
      }
      const url = `/api/inspection-entries?${search.toString()}`
      try {
        const res = await fetch(url, { credentials: 'include' })
        if (!res.ok) {
          if (!isCancelled()) {
            setInspectionSlices([])
            setLatestPointInspections(new Map())
          }
          return
        }
        const data = (await res.json()) as {
          items?: Array<{
            phaseId: number
            phaseName?: string | null
            startPk: number
            endPk: number
            side: IntervalSide
            status: InspectionStatus
            layerId?: string | number | null
            layerName?: string | null
            checkId?: string | number | null
            checkName?: string | null
            updatedAt: string
          }>
        }
        if (!data.items || isCancelled()) return
        const map = new Map<string, LatestPointInspection>()
        const sliceMap = new Map<string, InspectionSlice>()
        const applySnapshot = (snapshot: LatestPointInspection) => {
          const ts = snapshot.updatedAt ?? 0
          const statusKey = buildCheckStatusKey({
            phaseId: snapshot.phaseId,
            phaseName: snapshot.phaseName,
            layerId: snapshot.layerId,
            layerName: snapshot.layerName,
            checkId: snapshot.checkId,
            checkName: snapshot.checkName,
            side: snapshot.side,
            startPk: snapshot.startPk,
            endPk: snapshot.endPk,
          })
          const existing = map.get(statusKey)
          const existingPriority = statusPriority[existing?.status ?? 'PENDING'] ?? 0
          const incomingPriority = statusPriority[snapshot.status ?? 'PENDING'] ?? 0
          const shouldReplace =
            !existing ||
            incomingPriority > existingPriority ||
            (incomingPriority === existingPriority && (snapshot.updatedAt ?? 0) >= (existing.updatedAt ?? 0))
          if (shouldReplace) {
            map.set(statusKey, snapshot)
          }

          const phaseMeasure = measureByPhaseId.get(snapshot.phaseId)
          const topLayerNames = topLayerNamesByPhaseId.get(snapshot.phaseId)
          const normalizedLayerName =
            snapshot.layerName || snapshot.layerId
              ? normalizeLabel(String(snapshot.layerName ?? snapshot.layerId))
              : null
          const restrictToTopLayer =
            phaseMeasure === 'LINEAR' && topLayerNames && topLayerNames.size > 0
          const skipSlice =
            restrictToTopLayer && (!normalizedLayerName || !topLayerNames.has(normalizedLayerName))

          if (!skipSlice) {
            const sliceKey = `${snapshot.phaseId}:${snapshot.side}:${snapshot.startPk}:${snapshot.endPk}`
            const prevSlice = sliceMap.get(sliceKey)
            const prevPriority = statusPriority[prevSlice?.status ?? 'PENDING'] ?? 0
            if (
              !prevSlice ||
              incomingPriority > prevPriority ||
              (incomingPriority === prevPriority && ts >= (prevSlice.updatedAt ?? 0))
            ) {
              sliceMap.set(sliceKey, {
                phaseId: snapshot.phaseId,
                side: snapshot.side,
                startPk: snapshot.startPk,
                endPk: snapshot.endPk,
                status: snapshot.status ?? 'PENDING',
                updatedAt: ts,
              })
            }
          }
        }

        data.items.forEach((item) => {
          const ts = new Date(item.updatedAt).getTime() || 0
          const [orderedStart, orderedEnd] = normalizeRange(Number(item.startPk), Number(item.endPk))
          const side = item.side ?? 'BOTH'
          const snapshot: LatestPointInspection = {
            phaseId: Number(item.phaseId),
            phaseName: item.phaseName ?? null,
            layerId: item.layerId !== undefined && item.layerId !== null ? String(item.layerId) : null,
            layerName:
              item.layerName ??
              (item.layerId !== undefined && item.layerId !== null ? String(item.layerId) : null),
            checkId: item.checkId !== undefined && item.checkId !== null ? String(item.checkId) : null,
            checkName:
              item.checkName ??
              (item.checkId !== undefined && item.checkId !== null ? String(item.checkId) : null),
            side,
            startPk: orderedStart,
            endPk: orderedEnd,
            status: item.status ?? 'PENDING',
            updatedAt: ts,
          }

          const isEarthwork = earthworkPhaseId && snapshot.phaseId === earthworkPhaseId
          const isSubbase = subbasePhaseId && snapshot.phaseId === subbasePhaseId
          const hasEarthworkMapping = earthworkPhaseId && subbasePhaseId

          if (!isEarthwork || !hasEarthworkMapping) {
            applySnapshot(snapshot)
          }

          // Map subbase (Couche de forme) schedules to earthwork as completed.
          if (isSubbase && earthworkPhaseId) {
            const statusLevel = statusPriority[snapshot.status ?? 'PENDING'] ?? 0
            if (statusLevel >= (statusPriority.SCHEDULED ?? 0)) {
              const mappedLayerName = earthworkTopLayerName ?? snapshot.layerName ?? snapshot.layerId
              applySnapshot({
                ...snapshot,
                phaseId: earthworkPhaseId,
                status: 'APPROVED',
                layerId: mappedLayerName ? String(mappedLayerName) : null,
                layerName: mappedLayerName ? String(mappedLayerName) : null,
              })
            }
          }
        })
        if (!isCancelled()) {
          setLatestPointInspections(map)
          setInspectionSlices(Array.from(sliceMap.values()))
        }
      } catch (err) {
        if (!isCancelled()) {
          setInspectionSlices([])
          setLatestPointInspections(new Map())
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn(t.alerts.fetchInspectionFailed, err)
        }
      }
    },
    [
      canViewInspection,
      earthworkPhaseId,
      earthworkTopLayerName,
      measureByPhaseId,
      road.slug,
      subbasePhaseId,
      t.alerts.fetchInspectionFailed,
      topLayerNamesByPhaseId,
    ],
  )

  useEffect(() => {
    const controller = { cancelled: false }
    fetchLatestInspections({ signalCancelled: () => controller.cancelled })
    return () => {
      controller.cancelled = true
    }
  }, [fetchLatestInspections])

  const enforcedSide = useMemo<IntervalSide | null>(
    () =>
      selectedSegment && selectedSegment.measure === 'POINT' && selectedSegment.pointHasSides
        ? selectedSegment.side
        : null,
    [selectedSegment],
  )

  const intervalRange = useMemo(() => {
    const start = Number(startPkInput || selectedSegment?.start || 0)
    const end = Number(endPkInput || selectedSegment?.end || 0)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null
    return normalizeRange(start, end)
  }, [endPkInput, selectedSegment?.end, selectedSegment?.start, startPkInput])

  const sideBooking = useMemo(() => {
    if (!selectedSegment || !intervalRange) {
      return { left: false, right: false, both: false, lockedSide: null as IntervalSide | null }
    }
    if (selectedSegment.measure === 'LINEAR') {
      return { left: false, right: false, both: false, lockedSide: null as IntervalSide | null }
    }
    const [rangeStart, rangeEnd] = intervalRange
    const matchLeft = snapshotMatches(selectedSegment.phaseId, 'LEFT', rangeStart, rangeEnd)
    const matchRight = snapshotMatches(selectedSegment.phaseId, 'RIGHT', rangeStart, rangeEnd)
    const matchBoth = snapshotMatches(selectedSegment.phaseId, 'BOTH', rangeStart, rangeEnd)
    let left = false
    let right = false
    let both = false
    latestPointInspections.forEach((snapshot) => {
      const statusLevel = statusPriority[snapshot.status] ?? 0
      if (statusLevel < (statusPriority.SCHEDULED ?? 0)) return
      if (matchBoth(snapshot)) {
        both = true
      }
      if (matchLeft(snapshot)) {
        left = true
      }
      if (matchRight(snapshot)) {
        right = true
      }
    })
    let lockedSide: IntervalSide | null = null
    if (enforcedSide) {
      lockedSide = enforcedSide
    } else if (!both) {
      if (left && !right) lockedSide = 'RIGHT'
      if (right && !left) lockedSide = 'LEFT'
    }
    return { left, right, both, lockedSide }
  }, [enforcedSide, intervalRange, latestPointInspections, selectedSegment])

  useEffect(() => {
    const lockedSide = sideBooking.lockedSide
    if (!lockedSide) return
    if (selectedSide === lockedSide) return
    if (typeof window === 'undefined') return
    const frame = window.requestAnimationFrame(() => {
      setSelectedSide(lockedSide)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [selectedSide, sideBooking.lockedSide])

  const listJoiner = locale === 'fr' ? ', ' : ' / '
  const displayPhaseName = (name?: string) => (name ? localizeProgressTerm('phase', name, locale) : '')
  const displayLayerName = (name: string) =>
    localizeProgressTerm('layer', name, locale, {
      phaseName: selectedSegment?.workflow?.phaseName ?? selectedSegment?.phase,
    })
  const displayCheckName = (name: string) => localizeProgressTerm('check', name, locale)

  const latestInspectionByPhase = useMemo(() => {
    const map = new Map<number, number>()
    inspectionSlices.forEach((item) => {
      const existing = map.get(item.phaseId) ?? 0
      if (item.updatedAt > existing) {
        map.set(item.phaseId, item.updatedAt)
      }
    })
    return map
  }, [inspectionSlices])

  const sortedPhases = useMemo(() => {
    if (!phases.length) return phases
    const order = new Map(phases.map((phase, index) => [phase.id, index]))
    return [...phases].sort((a, b) => {
      const aInspection = latestInspectionByPhase.get(a.id) ?? 0
      const bInspection = latestInspectionByPhase.get(b.id) ?? 0
      if (aInspection !== bInspection) return bInspection - aInspection
      const aUpdatedRaw = new Date(a.updatedAt).getTime()
      const bUpdatedRaw = new Date(b.updatedAt).getTime()
      const aUpdated = Number.isFinite(aUpdatedRaw) ? aUpdatedRaw : 0
      const bUpdated = Number.isFinite(bUpdatedRaw) ? bUpdatedRaw : 0
      if (aUpdated !== bUpdated) return bUpdated - aUpdated
      return (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)
    })
  }, [phases, latestInspectionByPhase])

  const resolvePointProgress = useCallback(
    (
      phaseId: number,
      side: IntervalSide,
      startPk: number,
      endPk: number,
      allowedLayers: string[] = [],
    ) => {
      const workflowLayers = workflowLayersByPhaseId.get(phaseId)
      const phaseNameFallback = phases.find((item) => item.id === phaseId)?.name ?? ''
      const phaseNameForContext = workflowLayers?.phaseName ?? phaseNameFallback
      const [targetStart, targetEnd] = normalizeRange(startPk, endPk)
      const layers = workflowLayers?.layers ?? []
      if (!layers.length) {
        return { percent: 0, completedLayers: 0, totalLayers: 0 }
      }
      const allowedLayerSet = new Set(
        allowedLayers.map((layer) => normalizeLabel(layer)).filter(Boolean),
      )
      const effectiveLayers = allowedLayerSet.size
        ? layers.filter((layer) => allowedLayerSet.has(normalizeLabel(layer.name)))
        : layers
      const candidatesForSide = (targetSide: IntervalSide) =>
        targetSide === 'BOTH' ? (['BOTH', 'LEFT', 'RIGHT'] as IntervalSide[]) : ([targetSide, 'BOTH'] as IntervalSide[])

      const totalChecks = effectiveLayers.reduce((sum, layer) => sum + layer.checks.length, 0)
      if (!totalChecks) {
        return { percent: 0, completedLayers: 0, totalLayers: 0 }
      }

      let completedChecks = 0
      effectiveLayers.forEach((layer) => {
        layer.checks.forEach((check) => {
          const hasApproved = candidatesForSide(side).some((candidateSide) => {
            const keyWithIds = buildCheckStatusKey({
              phaseId,
              phaseName: phaseNameForContext,
              layerId: layer.id,
              layerName: layer.name,
              checkId: check.id,
              checkName: check.name,
              side: candidateSide,
              startPk: targetStart,
              endPk: targetEnd,
            })
            const keyWithNames = buildCheckStatusKey({
              phaseId,
              phaseName: phaseNameForContext,
              layerId: null,
              layerName: layer.name,
              checkId: null,
              checkName: check.name,
              side: candidateSide,
              startPk: targetStart,
              endPk: targetEnd,
            })
            const snapshot = latestPointInspections.get(keyWithIds) ?? latestPointInspections.get(keyWithNames)
            return snapshot?.status === 'APPROVED'
          })
          if (hasApproved) {
            completedChecks += 1
          }
        })
      })
      const percent = (completedChecks / totalChecks) * 100
      return { percent, completedLayers: completedChecks, totalLayers: totalChecks }
    },
    [
      latestPointInspections,
      phases,
      workflowLayersByPhaseId,
    ],
  )

  const shouldSplitLayerBySide = useCallback(
    (layer: WorkflowLayerTemplate) => {
      if (!selectedSegment || !intervalRange) return false
      if (selectedSide !== 'BOTH') return false
      const [rangeStart, rangeEnd] = intervalRange
      let hasLeft = false
      let hasRight = false
      layer.checks.forEach((check) => {
        const baseKey = buildCheckStatusBaseKey({
          phaseId: selectedSegment.phaseId,
          phaseName: workflowPhaseNameForContext,
          layerId: layer.id,
          layerName: layer.name,
          checkId: check.id,
          checkName: check.name,
          startPk: rangeStart,
          endPk: rangeEnd,
        })
        const entry = workflowStatusMaps.checkStatusBySide.get(baseKey)
        if (entry?.LEFT) hasLeft = true
        if (entry?.RIGHT) hasRight = true
      })
      return (hasLeft && !hasRight) || (hasRight && !hasLeft)
    },
    [
      intervalRange,
      selectedSegment,
      selectedSide,
      workflowPhaseNameForContext,
      workflowStatusMaps.checkStatusBySide,
    ],
  )

  const resolveSplitTargetSide = useCallback(
    (layer: WorkflowLayerTemplate): IntervalSide | null => {
      if (!intervalRange || !selectedSegment) return null
      const [rangeStart, rangeEnd] = intervalRange
      let leftBooked = false
      let rightBooked = false
      layer.checks.forEach((check) => {
        const baseKey = buildCheckStatusBaseKey({
          phaseId: selectedSegment.phaseId,
          phaseName: workflowPhaseNameForContext,
          layerId: layer.id,
          layerName: layer.name,
          checkId: check.id,
          checkName: check.name,
          startPk: rangeStart,
          endPk: rangeEnd,
        })
        const entry = workflowStatusMaps.checkStatusBySide.get(baseKey)
        if (entry?.LEFT && (statusPriority[entry.LEFT] ?? 0) >= (statusPriority.SCHEDULED ?? 0)) {
          leftBooked = true
        }
        if (entry?.RIGHT && (statusPriority[entry.RIGHT] ?? 0) >= (statusPriority.SCHEDULED ?? 0)) {
          rightBooked = true
        }
      })
      if (leftBooked && !rightBooked) return 'RIGHT'
      if (rightBooked && !leftBooked) return 'LEFT'
      return null
    },
    [intervalRange, selectedSegment, workflowPhaseNameForContext, workflowStatusMaps.checkStatusBySide],
  )

  const showLegacySelection = !(
    selectedSegment?.workflow &&
    selectedSegment.workflowLayers?.length &&
    selectedSegment.measure === 'POINT'
  )

  const submitInspection = async () => {
    if (!selectedSegment) return
    const hasStart = startPkInput.trim() !== ''
    const hasEnd = endPkInput.trim() !== ''
    const startPk = Number(startPkInput)
    const endPk = Number(endPkInput)
    if (!hasStart || !hasEnd || !Number.isFinite(startPk) || !Number.isFinite(endPk)) {
      raiseSubmitError(t.errors.submitRangeInvalid)
      return
    }
    if (!selectedLayers.length) {
      raiseSubmitError(t.errors.submitLayerMissing)
      return
    }
    if (!selectedChecks.length) {
      raiseSubmitError(t.errors.submitCheckMissing)
      return
    }
    const allowedTypes = activeInspectionTypes
    const normalizedTypes = selectedTypes.filter((type) => allowedTypes.includes(type))
    if (!normalizedTypes.length) {
      raiseSubmitError(t.errors.submitTypeMissing)
      return
    }
    if (!appointmentDateInput) {
      raiseSubmitError(t.errors.submitAppointmentMissing)
      return
    }
    const submissionNumberText = submissionNumberInput.trim()
    const submissionNumber =
      submissionNumberText === '' ? undefined : Number(submissionNumberText)
    if (submissionNumberText && !Number.isFinite(submissionNumber)) {
      raiseSubmitError('提交单编号需为数字')
      return
    }
    const targetSide = enforcedSide ?? selectedSide
    const payloadBase: Omit<InspectionSubmitBatch, 'side' | 'layers' | 'checks'> = {
      phaseId: selectedSegment.phaseId,
      startPk,
      endPk,
      types: normalizedTypes,
      remark,
      appointmentDate: appointmentDateInput,
    }
    const splitLayerSideMap = new Map<string, IntervalSide>()
    selectedLayers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (!meta) return
      const target = shouldSplitLayerBySide(meta) ? resolveSplitTargetSide(meta) : null
      if (target) {
        splitLayerSideMap.set(meta.id, target)
      }
    })

    const singleLeft = { layers: [] as string[], checks: [] as string[] }
    const singleRight = { layers: [] as string[], checks: [] as string[] }
    const bothGroup = { layers: [] as string[], checks: [] as string[] }
    let hasMissingCheckMeta = false

    selectedLayers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta && splitLayerSideMap.has(meta.id)) {
        const target = splitLayerSideMap.get(meta.id)
        if (target === 'LEFT') singleLeft.layers.push(layer)
        else if (target === 'RIGHT') singleRight.layers.push(layer)
      } else {
        bothGroup.layers.push(layer)
      }
    })

    const layerGroupById = new Map<string, IntervalSide | 'BOTH'>()
    singleLeft.layers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta) layerGroupById.set(meta.id, 'LEFT')
    })
    singleRight.layers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta) layerGroupById.set(meta.id, 'RIGHT')
    })
    bothGroup.layers.forEach((layer) => {
      const meta = workflowLayerByName?.get(normalizeLabel(layer))
      if (meta) layerGroupById.set(meta.id, 'BOTH')
    })

    selectedChecks.forEach((check) => {
      const normalizedCheck = normalizeLabel(check)
      let meta = workflowCheckMetaByName?.get(normalizedCheck) ?? null
      let target: IntervalSide | 'BOTH' | undefined = meta
        ? splitLayerSideMap.get(meta.layerId) ?? layerGroupById.get(meta.layerId)
        : undefined
      let layerId = meta?.layerId ?? null

      if (!target || !layerId) {
        for (const layer of selectedLayers) {
          const checks = workflowChecksByLayerName?.get(normalizeLabel(layer))
          if (checks?.has(normalizedCheck)) {
            const layerMeta = workflowLayerByName?.get(normalizeLabel(layer))
            if (layerMeta) {
              meta = meta ?? { layerId: layerMeta.id, order: 0, types: new Set<string>() }
              layerId = layerMeta.id
              target = splitLayerSideMap.get(layerMeta.id) ?? layerGroupById.get(layerMeta.id)
              break
            }
          }
        }
      }

      if (!meta) {
        hasMissingCheckMeta = true
        bothGroup.checks.push(check)
        return
      }

      const finalTarget = target ?? targetSide
      if (finalTarget === 'LEFT') {
        singleLeft.checks.push(check)
      } else if (finalTarget === 'RIGHT') {
        singleRight.checks.push(check)
      } else {
        bothGroup.checks.push(check)
      }
    })

    const payloads: InspectionSubmitBatch[] = []
    if (hasMissingCheckMeta) {
      payloads.push({
        ...payloadBase,
        side: targetSide,
        layers: selectedLayers,
        checks: selectedChecks,
      })
    } else {
      if (singleLeft.layers.length) {
        payloads.push({
          ...payloadBase,
          side: 'LEFT',
          layers: singleLeft.layers,
          checks: singleLeft.checks,
        })
      }
      if (singleRight.layers.length) {
        payloads.push({
          ...payloadBase,
          side: 'RIGHT',
          layers: singleRight.layers,
          checks: singleRight.checks,
        })
      }
      if (bothGroup.layers.length) {
        payloads.push({
          ...payloadBase,
          side: targetSide,
          layers: bothGroup.layers,
          checks: bothGroup.checks,
        })
      }
    }
    if (!payloads.length) {
      raiseSubmitError(t.errors.submitLayerMissing)
      return
    }

    const entries = payloads.flatMap((payload) => {
      const [normalizedStart, normalizedEnd] = normalizeRange(payload.startPk, payload.endPk)
      const uniqueLayers = Array.from(new Set(payload.layers))
      const uniqueChecks = Array.from(new Set(payload.checks))
      const uniqueTypes = Array.from(new Set(payload.types))
      const remarkText = (payload.remark ?? '').trim()
      const appointmentDate = payload.appointmentDate || undefined
      return uniqueLayers.flatMap((layerName) =>
        uniqueChecks.map<InspectionEntrySubmitPayload>((checkName) => ({
          roadId: road.id,
          phaseId: payload.phaseId,
          side: payload.side,
          startPk: normalizedStart,
          endPk: normalizedEnd,
          layerName,
          checkName,
          types: uniqueTypes,
          remark: remarkText || undefined,
          appointmentDate,
          status: 'SCHEDULED',
          submissionNumber,
        })),
      )
    })

    if (!entries.length) {
      raiseSubmitError(t.errors.submitLayerMissing)
      return
    }

    await performSubmit(entries)
  }

  return {
    linearViews,
    pointViews,
    sortedPhases,
    selectedSegment,
    setSelectedSegment,
    inspectionSlices,
    openInspectionModal,
    handlePointSelect,
    resolvePointProgress,
    fetchLatestInspections,
    resetInspectionForm,
    alertDialog,
    setAlertDialog,
    inspectionDrawerProps: {
      selectedSegment,
      locale,
      t,
      workflowCopy,
      enforcedSide,
      selectedSide,
      setSelectedSide,
      startPkInput,
      setStartPkInput,
      endPkInput,
      setEndPkInput,
      appointmentDateInput,
      setAppointmentDateInput,
      submissionNumberInput,
      setSubmissionNumberInput,
      selectedLayers,
      selectedChecks,
      selectedTypes,
      activeInspectionTypes,
      uniqueLayerOptions,
      uniqueCheckOptions,
      allowedCheckSet,
      showLegacySelection,
      remark,
      setRemark,
      submitError,
      submitPending,
      resetInspectionForm,
      submitInspection,
      listJoiner,
      workflowPhaseNameForContext,
      workflowLayerNameMap,
      workflowStatusMaps,
      workflowLayerByName,
      localizedWorkflowPhaseName,
      localizedWorkflowSideRule,
      sideBooking,
      resolveWorkflowStatusLabel,
      resolveWorkflowStatusTone,
      shouldSplitLayerBySide,
      resolveSplitTargetSide,
      isStatusLocked,
      isLayerSelected,
      isLayerDisabled,
      toggleLayerSelection,
      isCheckSelected,
      toggleCheck,
      toggleToken,
      setSelectedTypes,
      displayPhaseName,
      displayLayerName,
      displayCheckName,
    },
  }
}
