'use client'

import type { Locale } from '@/lib/i18n'
import type { getProgressCopy } from '@/lib/i18n/progress'
import { formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressList, localizeProgressTerm, localizeProgressText } from '@/lib/i18n/progressDictionary'
import type { IntervalSide, InspectionStatus } from '@/lib/progressTypes'
import type { WorkflowLayerTemplate } from '@/lib/progressWorkflow'

import {
  buildCheckStatusBaseKey,
  buildCheckStatusKey,
  formatPK,
  normalizeLabel,
  normalizeRange,
  statusPriority,
} from './phaseEditorUtils'
import type {
  SelectedSegment,
  SideBooking,
  WorkflowStatusMaps,
} from './phaseEditorTypes'

type PhaseCopy = ReturnType<typeof getProgressCopy>['phase']
type WorkflowCopy = ReturnType<typeof getProgressCopy>['workflow']

export interface InspectionDrawerProps {
  selectedSegment: SelectedSegment | null
  locale: Locale
  t: PhaseCopy
  workflowCopy: WorkflowCopy
  enforcedSide: IntervalSide | null
  selectedSide: IntervalSide
  setSelectedSide: (side: IntervalSide) => void
  startPkInput: string
  setStartPkInput: (value: string) => void
  endPkInput: string
  setEndPkInput: (value: string) => void
  appointmentDateInput: string
  setAppointmentDateInput: (value: string) => void
  submissionNumberInput: string
  setSubmissionNumberInput: (value: string) => void
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
  submitInspection: () => void
  listJoiner: string
  workflowPhaseNameForContext: string | null
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
  onClose: () => void
}

export function InspectionDrawer({
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
  onClose,
}: InspectionDrawerProps) {
  if (!selectedSegment) return null

  const workflowLayerNameMapSafe = workflowLayerNameMap ?? new Map()
  const startValue = Number(startPkInput)
  const endValue = Number(endPkInput)
  const hasStartInput = startPkInput.trim() !== '' && Number.isFinite(startValue)
  const hasEndInput = endPkInput.trim() !== '' && Number.isFinite(endValue)
  const [targetStart, targetEnd] = hasStartInput && hasEndInput
    ? normalizeRange(startValue, endValue)
    : normalizeRange(selectedSegment.start ?? 0, selectedSegment.end ?? 0)
  const phaseNameForKey = workflowPhaseNameForContext ?? selectedSegment.workflow?.phaseName ?? selectedSegment.phase

  const buildCheckKeyForSide = (
    layer: WorkflowLayerTemplate,
    check: WorkflowLayerTemplate['checks'][number],
    side: IntervalSide,
  ) =>
    buildCheckStatusKey({
      phaseId: selectedSegment.phaseId,
      phaseName: phaseNameForKey,
      layerId: layer.id,
      layerName: layer.name,
      checkId: check.id,
      checkName: check.name,
      side,
      startPk: targetStart,
      endPk: targetEnd,
    })

  const buildCheckKeyFallbackForSide = (
    layer: WorkflowLayerTemplate,
    check: WorkflowLayerTemplate['checks'][number],
    side: IntervalSide,
  ) =>
    buildCheckStatusKey({
      phaseId: selectedSegment.phaseId,
      phaseName: phaseNameForKey,
      layerId: null,
      layerName: layer.name,
      checkId: null,
      checkName: check.name,
      side,
      startPk: targetStart,
      endPk: targetEnd,
    })

  const buildCheckBaseKeyForLayer = (
    layer: WorkflowLayerTemplate,
    check: WorkflowLayerTemplate['checks'][number],
  ) =>
    buildCheckStatusBaseKey({
      phaseId: selectedSegment.phaseId,
      phaseName: phaseNameForKey,
      layerId: layer.id,
      layerName: layer.name,
      checkId: check.id,
      checkName: check.name,
      startPk: targetStart,
      endPk: targetEnd,
    })

  const buildCheckBaseKeyFallbackForLayer = (
    layer: WorkflowLayerTemplate,
    check: WorkflowLayerTemplate['checks'][number],
  ) =>
    buildCheckStatusBaseKey({
      phaseId: selectedSegment.phaseId,
      phaseName: phaseNameForKey,
      layerId: null,
      layerName: layer.name,
      checkId: null,
      checkName: check.name,
      startPk: targetStart,
      endPk: targetEnd,
    })

  const resolveCheckSideStatus = (layer: WorkflowLayerTemplate, check: WorkflowLayerTemplate['checks'][number]) => {
    const baseKey = buildCheckBaseKeyForLayer(layer, check)
    const fallbackBaseKey = buildCheckBaseKeyFallbackForLayer(layer, check)
    return workflowStatusMaps.checkStatusBySide.get(baseKey) ?? workflowStatusMaps.checkStatusBySide.get(fallbackBaseKey)
  }

  const resolveCheckStatus = (
    layer: WorkflowLayerTemplate,
    check: WorkflowLayerTemplate['checks'][number],
    side: IntervalSide,
  ) => {
    const key = buildCheckKeyForSide(layer, check, side)
    const fallbackKey = buildCheckKeyFallbackForSide(layer, check, side)
    const direct =
      workflowStatusMaps.checkStatus.get(key) ?? workflowStatusMaps.checkStatus.get(fallbackKey)
    if (direct) return direct
    const sideStatus = resolveCheckSideStatus(layer, check)
    if (side === 'LEFT') return sideStatus?.LEFT
    if (side === 'RIGHT') return sideStatus?.RIGHT
    return null
  }

  const resolveLayerStatusForSide = (layer: WorkflowLayerTemplate, side: IntervalSide) => {
    const statuses: InspectionStatus[] = []
    layer.checks.forEach((check) => {
      const candidate = resolveCheckStatus(layer, check, side)
      if (candidate) {
        statuses.push(candidate)
      }
    })
    if (statuses.length !== layer.checks.length) return undefined
    const hasAllLocked = statuses.every((item) => (statusPriority[item] ?? 0) >= (statusPriority.SCHEDULED ?? 0))
    if (!hasAllLocked) return undefined
    const worst = statuses.reduce<InspectionStatus | undefined>((acc, item) => {
      if (!acc) return item
      return (statusPriority[item] ?? 0) < (statusPriority[acc] ?? 0) ? item : acc
    }, undefined)
    return worst
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur sm:items-center sm:py-10">
      <div className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-slate-900/70 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400" />
        <div className="relative flex flex-wrap items-center gap-3 px-6 pt-5 pr-12 sm:pr-16">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-100">
            <span className="inline-flex items-center rounded-full bg-emerald-300/15 px-3 py-1.5 text-base font-semibold uppercase tracking-[0.2em] text-emerald-100 ring-1 ring-emerald-300/40">
              {t.inspection.title}
            </span>
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
              {displayPhaseName(selectedSegment.phase)}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
              {selectedSegment.sideLabel}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
              {formatPK(selectedSegment.start)} → {formatPK(selectedSegment.end)}
            </span>
            {selectedSegment.spec ? (
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-100 ring-1 ring-white/10">
                {t.form.intervalSpec}：{selectedSegment.spec}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/20"
            onClick={onClose}
            aria-label={t.delete.close}
          >
            ×
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          <div className="grid gap-4 border-t border-white/5 bg-white/2 px-6 py-6 text-sm text-slate-100 lg:grid-cols-5">
            <div className="lg:col-span-5 space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <label className="flex flex-col gap-1 text-xs text-slate-200">
                  <span className="font-semibold">{t.inspection.sideLabel}</span>
                  {(() => {
                    const sideOptionsForSelect = enforcedSide
                      ? [
                          {
                            value: enforcedSide,
                            label:
                              enforcedSide === 'LEFT'
                                ? t.inspection.sideLeft
                                : enforcedSide === 'RIGHT'
                                  ? t.inspection.sideRight
                                  : t.inspection.sideBoth,
                          },
                        ]
                      : [
                          { value: 'LEFT' as const, label: t.inspection.sideLeft },
                          { value: 'RIGHT' as const, label: t.inspection.sideRight },
                          { value: 'BOTH' as const, label: t.inspection.sideBoth },
                        ]
                    return (
                      <select
                        className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                        value={selectedSide}
                        onChange={(e) => setSelectedSide(e.target.value as IntervalSide)}
                        disabled={Boolean(enforcedSide)}
                      >
                        {sideOptionsForSelect.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            disabled={
                              !enforcedSide &&
                              Boolean(
                                sideBooking.lockedSide &&
                                  ((option.value === 'LEFT' && sideBooking.lockedSide !== 'LEFT') ||
                                    (option.value === 'RIGHT' && sideBooking.lockedSide !== 'RIGHT') ||
                                    (option.value === 'BOTH' && sideBooking.lockedSide)),
                              )
                            }
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-200">
                  <span className="font-semibold">{t.inspection.startLabel}</span>
                  <input
                    type="number"
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                    value={startPkInput}
                    onChange={(e) => setStartPkInput(e.target.value)}
                    placeholder={t.inspection.startPlaceholder}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-200">
                  <span className="font-semibold">{t.inspection.endLabel}</span>
                  <input
                    type="number"
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                    value={endPkInput}
                    onChange={(e) => setEndPkInput(e.target.value)}
                    placeholder={t.inspection.endPlaceholder}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-200">
                  <span className="font-semibold">{t.inspection.appointmentLabel}</span>
                  <input
                    type="date"
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                    value={appointmentDateInput}
                    onChange={(e) => setAppointmentDateInput(e.target.value)}
                    placeholder={t.inspection.appointmentPlaceholder}
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-slate-200">
                  <span className="font-semibold">提交单编号（可选）</span>
                  <input
                    type="number"
                    className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 focus:border-emerald-300 focus:outline-none"
                    value={submissionNumberInput}
                    onChange={(e) => setSubmissionNumberInput(e.target.value)}
                    placeholder="填入提交单编号，不填则不绑定"
                  />
                </label>
              </div>

              {selectedSegment.workflow && selectedSegment.workflowLayers?.length ? (
                selectedSegment.measure === 'POINT' ? (
                  <div className="space-y-4 rounded-3xl border border-emerald-300/30 bg-slate-900/70 p-4 shadow-inner shadow-emerald-400/15">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                      <span className="rounded-full bg-emerald-300/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-950">
                        {workflowCopy.timelineBadge}
                      </span>
                      <span className="font-semibold text-emerald-50">
                        {localizedWorkflowPhaseName ?? selectedSegment.workflow.phaseName}
                      </span>
                      {localizedWorkflowSideRule ? (
                        <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] text-emerald-50">
                          {localizedWorkflowSideRule}
                        </span>
                      ) : null}
                    </div>
                    <div className="relative space-y-3 border-l border-dashed border-emerald-300/30 pl-4">
                      {selectedSegment.workflowLayers.flatMap((layer) => {
                        let sideSequence: IntervalSide[]
                        if (enforcedSide) {
                          sideSequence = [enforcedSide]
                        } else if (shouldSplitLayerBySide(layer)) {
                          sideSequence = ['LEFT', 'RIGHT']
                        } else if (sideBooking.lockedSide) {
                          sideSequence = [sideBooking.lockedSide === 'LEFT' ? 'RIGHT' : 'LEFT', sideBooking.lockedSide]
                        } else {
                          sideSequence = [selectedSide]
                        }
                        return sideSequence.map((sideKey) => {
                          const dependsNames = (layer.dependencies ?? []).map((id) => workflowLayerNameMapSafe.get(id) ?? id)
                          const lockNames = (layer.lockStepWith ?? []).map((id) => workflowLayerNameMapSafe.get(id) ?? id)
                          const parallelNames = (layer.parallelWith ?? []).map((id) => workflowLayerNameMapSafe.get(id) ?? id)
                          const localizedLayerName = localizeProgressTerm('layer', layer.name, locale, {
                            phaseName: workflowPhaseNameForContext ?? undefined,
                          })
                          const localizedDescription = layer.description ? localizeProgressText(layer.description, locale) : null
                          const leftLayerStatus = resolveLayerStatusForSide(layer, 'LEFT')
                          const rightLayerStatus = resolveLayerStatusForSide(layer, 'RIGHT')
                          const currentLayerStatus =
                            sideKey === 'LEFT'
                              ? leftLayerStatus
                              : sideKey === 'RIGHT'
                                ? rightLayerStatus
                                : resolveLayerStatusForSide(layer, sideKey)
                          const splitLayerStatus =
                            sideBooking.lockedSide !== null &&
                            leftLayerStatus &&
                            rightLayerStatus &&
                            leftLayerStatus !== rightLayerStatus
                          const isReadOnly =
                            sideBooking.lockedSide !== null &&
                            sideKey !== sideBooking.lockedSide &&
                            sideBooking.lockedSide !== null
                          const allChecksLocked = layer.checks.every((check) => {
                            const checkStatus = resolveCheckStatus(layer, check, sideKey)
                            return isStatusLocked(checkStatus ?? undefined)
                          })
                          const layerLocked = isReadOnly || allChecksLocked
                          const layerTone = resolveWorkflowStatusTone(currentLayerStatus)
                          const sideLabelInline =
                            sideKey === 'LEFT' ? t.inspection.sideLeft : sideKey === 'RIGHT' ? t.inspection.sideRight : ''
                          return (
                            <div
                              key={`${layer.id}-${sideKey}`}
                              className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-slate-900/30"
                            >
                              <div className="absolute -left-[9px] top-5 h-4 w-4 rounded-full border border-emerald-200/70 bg-emerald-400/80 shadow-md shadow-emerald-400/50" />
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-950">
                                      {formatProgressCopy(workflowCopy.stageName, { value: layer.stage })}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (layerLocked) return
                                        toggleLayerSelection(localizedLayerName)
                                      }}
                                      className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${
                                        layerLocked
                                          ? `${layerTone} cursor-not-allowed opacity-90`
                                          : isLayerSelected(localizedLayerName)
                                            ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-400/30'
                                            : isLayerDisabled(localizedLayerName)
                                              ? 'cursor-not-allowed bg-white/5 text-slate-400'
                                              : 'bg-white/10 text-slate-50 hover:bg-white/20'
                                      }`}
                                    >
                                      {localizedLayerName}
                                    </button>
                                    {splitLayerStatus ? (
                                      <div className="flex items-center gap-1">
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(leftLayerStatus)}`}
                                        >
                                          {t.inspection.sideLeft}·{resolveWorkflowStatusLabel(leftLayerStatus)}
                                        </span>
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(rightLayerStatus)}`}
                                        >
                                          {t.inspection.sideRight}·{resolveWorkflowStatusLabel(rightLayerStatus)}
                                        </span>
                                      </div>
                                    ) : (
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(currentLayerStatus)}`}
                                      >
                                        {sideLabelInline ? `${sideLabelInline}·` : ''}
                                        {resolveWorkflowStatusLabel(currentLayerStatus)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-300">
                                    {dependsNames.length ? (
                                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                                        {formatProgressCopy(workflowCopy.timelineDepends, {
                                          deps: dependsNames.join(listJoiner),
                                        })}
                                      </span>
                                    ) : (
                                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-200">
                                        {workflowCopy.timelineFree}
                                      </span>
                                    )}
                                    {lockNames.length ? (
                                      <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] text-amber-100">
                                        {formatProgressCopy(workflowCopy.lockedWith, {
                                          peers: lockNames.join(listJoiner),
                                        })}
                                      </span>
                                    ) : null}
                                    {parallelNames.length ? (
                                      <span className="rounded-full bg-blue-300/20 px-2 py-0.5 text-[10px] text-blue-50">
                                        {formatProgressCopy(workflowCopy.parallelWith, {
                                          peers: parallelNames.join(listJoiner),
                                        })}
                                      </span>
                                    ) : null}
                                  </div>
                                  {localizedDescription ? (
                                    <p className="text-[11px] text-slate-200">{localizedDescription}</p>
                                  ) : null}
                                </div>
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-slate-200">
                                  {formatProgressCopy(workflowCopy.bindingChecks, {
                                    count: layer.checks.length,
                                  })}
                                </span>
                              </div>
                              <div className="mt-3 grid gap-2 md:grid-cols-2">
                                {layer.checks.map((check, idx) => {
                                  const checkKey = buildCheckKeyForSide(layer, check, sideKey)
                                  const checkStatus = resolveCheckStatus(layer, check, sideKey)
                                  const checkBaseKey = buildCheckBaseKeyForLayer(layer, check)
                                  const checkSideStatus = resolveCheckSideStatus(layer, check)
                                  const splitCheckStatus =
                                    sideBooking.lockedSide !== null &&
                                    checkSideStatus?.LEFT &&
                                    checkSideStatus?.RIGHT &&
                                    checkSideStatus.LEFT !== checkSideStatus.RIGHT
                                  const currentCheckStatus =
                                    sideKey === 'LEFT'
                                      ? checkSideStatus?.LEFT ?? checkStatus
                                      : sideKey === 'RIGHT'
                                        ? checkSideStatus?.RIGHT ?? checkStatus
                                        : checkStatus
                                  const tone = resolveWorkflowStatusTone(currentCheckStatus ?? undefined)
                                  const typeLabels = check.types.map((type) => localizeProgressTerm('type', type, locale))
                                  const checkLocked = layerLocked || isStatusLocked(currentCheckStatus ?? undefined)
                                  const localizedCheck = localizeProgressTerm('check', check.name, locale)
                                  const layerSelected = isLayerSelected(localizedLayerName)
                                  const checkSelected = isCheckSelected(localizedCheck) && layerSelected
                                  return (
                                    <div
                                      key={`${layer.id}-${idx}-${check.name}`}
                                      className="rounded-xl border border-white/10 bg-white/5 p-3 shadow-inner shadow-slate-900/20"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        {splitCheckStatus ? (
                                          <>
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(checkSideStatus?.LEFT)}`}
                                            >
                                              {t.inspection.sideLeft}·{resolveWorkflowStatusLabel(checkSideStatus?.LEFT)}
                                            </span>
                                            <span
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${resolveWorkflowStatusTone(checkSideStatus?.RIGHT)}`}
                                            >
                                              {t.inspection.sideRight}·{resolveWorkflowStatusLabel(checkSideStatus?.RIGHT)}
                                            </span>
                                          </>
                                        ) : (
                                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>
                                            {sideLabelInline ? `${sideLabelInline}·` : ''}
                                            {resolveWorkflowStatusLabel(currentCheckStatus ?? undefined)}
                                          </span>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (checkLocked) return
                                            if (!layerSelected) return
                                            if (allowedCheckSet && !allowedCheckSet.has(localizedCheck)) return
                                            toggleCheck(localizedCheck)
                                          }}
                                          className={`rounded-full px-2.5 py-1 text-sm font-semibold transition ${
                                            checkLocked
                                              ? `${tone} cursor-not-allowed opacity-90`
                                              : !layerSelected
                                                ? 'cursor-not-allowed bg-white/5 text-slate-400 opacity-60'
                                                : checkSelected
                                                  ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-400/30'
                                                  : allowedCheckSet && !allowedCheckSet.has(localizeProgressTerm('check', check.name, locale))
                                                    ? 'cursor-not-allowed bg-white/5 text-slate-400'
                                                    : 'bg-white/10 text-slate-50 hover:bg-white/20'
                                          }`}
                                        >
                                          {localizeProgressTerm('check', check.name, locale)}
                                        </button>
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {typeLabels.map((typeLabel) => (
                                          <span
                                            key={`${check.name}-${typeLabel}`}
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}
                                          >
                                            {typeLabel}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/5 p-4 shadow-inner shadow-emerald-400/20">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-100">
                      <span className="rounded-full bg-emerald-300/25 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-50">
                        {workflowCopy.badge}
                      </span>
                      <span className="font-semibold text-emerald-50">
                        {localizedWorkflowPhaseName ?? selectedSegment.workflow.phaseName}
                      </span>
                      <span className="text-emerald-100/80">{workflowCopy.ruleTitle}</span>
                      {localizedWorkflowSideRule ? (
                        <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-[10px] text-emerald-50">
                          {localizedWorkflowSideRule}
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      {selectedSegment.workflowLayers.map((layer) => {
                        const dependsNames = (layer.dependencies ?? []).map((id) => workflowLayerNameMapSafe.get(id) ?? id)
                        const lockNames = (layer.lockStepWith ?? []).map((id) => workflowLayerNameMapSafe.get(id) ?? id)
                        const parallelNames = (layer.parallelWith ?? []).map((id) => workflowLayerNameMapSafe.get(id) ?? id)
                        const localizedLayerName = localizeProgressTerm('layer', layer.name, locale, {
                          phaseName: workflowPhaseNameForContext ?? undefined,
                        })
                        const checkSummary = layer.checks
                          .map((check) => {
                            const checkName = localizeProgressTerm('check', check.name, locale)
                            const typeText = localizeProgressList('type', check.types, locale).join(' / ')
                            return `${checkName} (${typeText})`
                          })
                          .join('; ')
                        const localizedDescription = layer.description ? localizeProgressText(layer.description, locale) : null
                        return (
                          <div
                            key={layer.id}
                            className="rounded-2xl border border-emerald-200/30 bg-white/5 p-3 text-[11px] text-emerald-50 shadow-inner shadow-emerald-500/10"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{localizedLayerName}</span>
                              <span className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-950">
                                {formatProgressCopy(workflowCopy.stageName, { value: layer.stage })}
                              </span>
                            </div>
                            <p className="mt-1 text-emerald-100/80">
                              {dependsNames.length
                                ? formatProgressCopy(workflowCopy.timelineDepends, {
                                    deps: dependsNames.join(listJoiner),
                                  })
                                : workflowCopy.timelineFree}
                            </p>
                            {lockNames.length ? (
                              <p className="text-emerald-100/80">
                                {formatProgressCopy(workflowCopy.lockedWith, {
                                  peers: lockNames.join(listJoiner),
                                })}
                              </p>
                            ) : null}
                            {parallelNames.length ? (
                              <p className="text-emerald-100/80">
                                {formatProgressCopy(workflowCopy.parallelWith, {
                                  peers: parallelNames.join(listJoiner),
                                })}
                              </p>
                            ) : null}
                            {localizedDescription ? <p className="text-emerald-100/80">{localizedDescription}</p> : null}
                            {checkSummary ? <p className="mt-1 text-emerald-50">{checkSummary}</p> : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              ) : null}

              {showLegacySelection ? (
                <>
                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.layersLabel}</p>
                    {uniqueLayerOptions.length === 0 ? (
                      <p className="text-[11px] text-amber-200">{t.inspection.layersEmpty}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {uniqueLayerOptions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selectedLayers.includes(item)
                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                                : isLayerDisabled(item)
                                  ? 'cursor-not-allowed bg-white/5 text-slate-400 opacity-60'
                                  : 'bg-white/10 text-slate-100 hover:bg-white/15'
                            }`}
                            onClick={() => {
                              toggleLayerSelection(item)
                            }}
                          >
                            {displayLayerName(item)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                    <p className="text-xs font-semibold text-slate-200">{t.inspection.checksLabel}</p>
                    {uniqueCheckOptions.length === 0 ? (
                      <p className="text-[11px] text-amber-200">{t.inspection.checksEmpty}</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {uniqueCheckOptions.map((item) => (
                          <button
                            key={item}
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                              selectedChecks.includes(item)
                                ? 'bg-emerald-300 text-slate-900 shadow shadow-emerald-300/40'
                                : allowedCheckSet && !allowedCheckSet.has(item)
                                  ? 'cursor-not-allowed bg-white/5 text-slate-400 opacity-60'
                                  : 'bg-white/10 text-slate-100 hover:bg-white/15'
                            }`}
                            onClick={() => {
                              if (allowedCheckSet && !allowedCheckSet.has(item)) return
                              toggleCheck(item)
                            }}
                          >
                            {displayCheckName(item)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : null}

              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                <p className="text-xs font-semibold text-slate-200">{t.inspection.typesLabel}</p>
                <div className="flex flex-wrap gap-2">
                  {activeInspectionTypes.map((item) => (
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
                      {localizeProgressTerm('type', item, locale)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-slate-900/30">
                <p className="text-xs font-semibold text-slate-200">{t.inspection.remarkLabel}</p>
                <textarea
                  className="h-20 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-50 shadow-inner shadow-slate-900/40 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={t.inspection.remarkPlaceholder}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-slate-900/60 px-6 py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-sm ${submitError ? 'font-semibold text-amber-200' : 'text-slate-200'}`}>
              {submitError ? submitError : t.inspection.typesHint}
            </p>
            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[320px] sm:grid-cols-2">
              <button
                type="button"
                className="w-full rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-white/40 hover:bg-white/5"
                onClick={() => {
                  onClose()
                  resetInspectionForm()
                }}
              >
                {t.inspection.cancel}
              </button>
              <button
                type="button"
                className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submitPending}
                onClick={submitInspection}
              >
                {submitPending ? t.inspection.submitting : t.inspection.submit}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
