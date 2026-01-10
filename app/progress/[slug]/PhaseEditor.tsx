/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useRef } from 'react'

import dynamic from 'next/dynamic'
import Link from 'next/link'

import { useInspectionFlow } from './hooks/useInspectionFlow'
import { usePhaseManagement } from './hooks/usePhaseManagement'
import { PointLane } from './PointLane'
import { calcCompletedBySide, formatPK, statusTone } from './phaseEditorUtils'
import type { PhaseEditorProps, Status } from './phaseEditorTypes'
import type { DeletePhaseDialogProps } from './DeletePhaseDialog'
import type { InspectionDrawerProps } from './InspectionDrawer'
import type { PhaseFormModalProps } from './PhaseFormModal'
import { AlertDialog } from '@/components/AlertDialog'
import { useToast } from '@/components/ToastProvider'
import { getProgressCopy, formatProgressCopy } from '@/lib/i18n/progress'
import { localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { IntervalSide, PhaseMeasure } from '@/lib/progressTypes'

const PhaseFormModal = dynamic<PhaseFormModalProps>(
  () => import('./PhaseFormModal').then((mod) => mod.PhaseFormModal),
  { ssr: false, loading: () => null },
)

const DeletePhaseDialog = dynamic<DeletePhaseDialogProps>(
  () => import('./DeletePhaseDialog').then((mod) => mod.DeletePhaseDialog),
  { ssr: false, loading: () => null },
)

const InspectionDrawer = dynamic<InspectionDrawerProps>(
  () => import('./InspectionDrawer').then((mod) => mod.InspectionDrawer),
  { ssr: false, loading: () => null },
)

export function PhaseEditor({
  road,
  initialPhases,
  phaseDefinitions,
  workflows,
  canManage,
  canInspect,
  canViewInspection,
}: PhaseEditorProps) {
  const { locale } = usePreferredLocale('zh', locales)
  const progressCopy = getProgressCopy(locale)
  const t = progressCopy.phase
  const workflowCopy = progressCopy.workflow
  const sideOptions = useMemo<{ value: IntervalSide; label: string }[]>(
    () => [
      { value: 'BOTH', label: t.form.sideBoth },
      { value: 'LEFT', label: t.form.sideLeft },
      { value: 'RIGHT', label: t.form.sideRight },
    ],
    [t.form.sideBoth, t.form.sideLeft, t.form.sideRight],
  )
  const sideLabelMap = useMemo(
    () => ({
      BOTH: t.form.sideBoth,
      LEFT: t.form.sideLeft,
      RIGHT: t.form.sideRight,
    }),
    [t.form.sideBoth, t.form.sideLeft, t.form.sideRight],
  )
  const defaultInspectionTypes = t.inspection.types
  const { addToast } = useToast()

  const roadStart = useMemo(() => {
    const start = Number(road.startPk)
    return Number.isFinite(start) ? start : 0
  }, [road.startPk])
  const roadEnd = useMemo(() => {
    const end = Number(road.endPk)
    return Number.isFinite(end) ? end : roadStart
  }, [road.endPk, roadStart])

  const resetInspectionFormRef = useRef<() => void>(() => {})
  const clearSelectedSegmentRef = useRef<() => void>(() => {})

  const phaseState = usePhaseManagement({
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
    onSelectionReset: () => resetInspectionFormRef.current(),
    clearSelectedSegment: () => clearSelectedSegmentRef.current(),
  })

  const roadLength = useMemo(() => {
    const start = Number(road.startPk)
    const end = Number(road.endPk)
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return Math.abs(end - start)
    }
    const maxPhaseEnd = Math.max(
      0,
      ...phaseState.phases.flatMap((phase) =>
        phase.intervals.map((i) => Math.max(Number(i.startPk) || 0, Number(i.endPk) || 0)),
      ),
    )
    return maxPhaseEnd || 0
  }, [phaseState.phases, road.endPk, road.startPk])

  const {
    linearViews,
    pointViews,
    sortedPhases,
    selectedSegment,
    setSelectedSegment,
    openInspectionModal,
    handlePointSelect,
    resolvePointProgress,
    resetInspectionForm,
    alertDialog,
    setAlertDialog,
    inspectionDrawerProps,
  } = useInspectionFlow({
    phases: phaseState.phases,
    workflowMap: phaseState.workflowMap,
    workflowLayersByPhaseId: phaseState.workflowLayersByPhaseId,
    road: { id: road.id, slug: road.slug },
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
  })

  useEffect(() => {
    resetInspectionFormRef.current = resetInspectionForm
    clearSelectedSegmentRef.current = () => setSelectedSegment(null)
  }, [resetInspectionForm, setSelectedSegment])

  const statusLabel = (status: Status) => {
    switch (status) {
      case 'pending':
        return t.status.pending
      case 'scheduled':
        return t.status.scheduled ?? t.status.pending
      case 'submitted':
        return t.status.submitted ?? t.status.inProgress
      case 'inProgress':
        return t.status.inProgress
      case 'approved':
        return t.status.approved
      default:
        return t.status.nonDesign
    }
  }

  return (
    <div className="space-y-8">
      <AlertDialog
        open={Boolean(alertDialog)}
        title={alertDialog?.title ?? ''}
        description={alertDialog?.description}
        tone={alertDialog?.tone ?? 'info'}
        actionLabel={alertDialog?.actionLabel ?? t.inspection.dialogClose}
        cancelLabel={alertDialog?.cancelLabel}
        onAction={alertDialog?.onAction}
        onCancel={alertDialog?.onCancel}
        onClose={() => setAlertDialog(null)}
      />
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold text-slate-900">{t.title}</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              {formatProgressCopy(t.roadLengthLabel, {
                length: roadLength || t.roadLengthUnknown,
              })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {canViewInspection ? (
              <Link
                href="/progress/inspections"
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-100"
              >
                {progressCopy.nav.inspections}
              </Link>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:bg-emerald-600"
                onClick={phaseState.openCreateModal}
              >
                {t.addButton}
              </button>
            ) : null}
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {canManage ? t.manageTip : t.viewOnlyTip}
        </p>
      </section>

      {phaseState.showFormModal ? (
        <PhaseFormModal
          open={phaseState.showFormModal}
          canManage={canManage}
          t={t}
          designLength={phaseState.designLength}
          roadLength={roadLength}
          measure={phaseState.measure}
          name={phaseState.name}
          definitionId={phaseState.definitionId}
          editingId={phaseState.editingId}
          definitions={phaseState.definitions}
          pointHasSides={phaseState.pointHasSides}
          intervals={phaseState.intervals}
          sideOptions={sideOptions}
          defaultLayers={phaseState.defaultLayers}
          layerOptions={phaseState.layerOptions}
          isPending={phaseState.isPending}
          error={phaseState.error}
          nameInputRef={phaseState.nameInputRef}
          onClose={phaseState.closeFormModal}
          onReset={phaseState.resetForm}
          onSubmit={phaseState.handleSubmit}
          onTemplateSelect={phaseState.applyDefinitionTemplate}
          onNameChange={phaseState.setName}
          onMeasureChange={(value: PhaseMeasure) => {
            phaseState.setMeasure(value)
            if (value === 'LINEAR') {
              phaseState.setPointHasSides(false)
            }
          }}
          onPointHasSidesChange={phaseState.setPointHasSides}
          onIntervalChange={phaseState.updateInterval}
          onToggleIntervalLayer={phaseState.toggleIntervalLayer}
          onAddInterval={phaseState.addInterval}
          onRemoveInterval={phaseState.removeInterval}
        />
      ) : null}

      {phaseState.deleteTarget && canManage ? (
        <DeletePhaseDialog
          open={Boolean(phaseState.deleteTarget && canManage)}
          phase={phaseState.deleteTarget}
          t={t}
          deleteError={phaseState.deleteError}
          deletingId={phaseState.deletingId}
          onCancel={phaseState.resetDeleteState}
          onConfirm={phaseState.confirmDelete}
        />
      ) : null}

      <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {t.list.legend}
          <span className="h-px w-12 bg-slate-200" />
          <div className="flex flex-wrap items-center gap-3">
            {[
              { key: 'pending' as Status, tone: statusTone.pending, label: t.status.pending },
              { key: 'scheduled' as Status, tone: statusTone.scheduled ?? t.status.pending, label: t.status.scheduled ?? t.status.pending },
              { key: 'submitted' as Status, tone: statusTone.submitted, label: t.status.submitted ?? t.status.inProgress },
              { key: 'inProgress' as Status, tone: statusTone.inProgress, label: t.status.inProgress },
              { key: 'approved' as Status, tone: statusTone.approved, label: t.status.approved },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-1">
                <span className={`inline-block h-4 w-4 rounded-sm ring-1 ring-slate-200 ${item.tone}`} aria-label={item.label} />
                <span className="text-[11px] font-semibold text-slate-700">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {phaseState.phases.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
            {t.list.empty}
          </div>
        ) : (
          <div className="space-y-6">
            {sortedPhases.map((phase) => {
              const linear = phase.measure === 'LINEAR' ? linearViews.find((item) => item.phase.id === phase.id) : null
              const point = phase.measure === 'POINT' ? pointViews.find((item) => item.phase.id === phase.id) : null
              const pointRangeLabel = point
                ? `${formatPK(point.view.min)} – ${formatPK(point.view.max)}`
                : `${phase.designLength}`
              const localizedPhaseName = localizeProgressTerm('phase', phase.name, locale)

              return (
                <div
                  key={phase.id}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold text-slate-900">{localizedPhaseName}</h3>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                        {phase.measure === 'POINT'
                          ? formatProgressCopy(t.card.measurePoint, { value: phase.designLength })
                          : formatProgressCopy(t.card.measureLinear, { value: phase.designLength })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {phase.measure === 'LINEAR' && linear ? (
                        (() => {
                          const totalDesign =
                            (linear.view.left?.designTotal ?? 0) + (linear.view.right?.designTotal ?? 0)
                          const completedLen =
                            calcCompletedBySide(linear.view.left.segments) +
                            calcCompletedBySide(linear.view.right.segments)
                          const percent = totalDesign > 0 ? Math.round((completedLen / totalDesign) * 100) : 0
                          return (
                            <span className="text-sm font-semibold text-emerald-700">
                              {formatProgressCopy(t.card.completed, {
                                percent,
                              })}
                            </span>
                          )
                        })()
                      ) : null}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            onClick={() => phaseState.startEdit(phase)}
                          >
                            {t.card.edit}
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-rose-200 px-3 py-2 text-[11px] font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                            onClick={() => phaseState.handleDelete(phase)}
                            disabled={phaseState.deletingId === phase.id}
                          >
                            {phaseState.deletingId === phase.id ? t.card.deleting : t.card.delete}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {phase.measure === 'LINEAR' && linear ? (
                    <div className="mt-4 space-y-4">
                      {[linear.view.left, linear.view.right]
                        .filter((side) => side.designTotal > 0)
                        .map((side) => {
                          const sideStart = side.segments.length ? formatPK(side.segments[0].start) : ''
                          const sideEnd = side.segments.length
                            ? formatPK(side.segments[side.segments.length - 1].end)
                            : ''
                          return (
                            <div key={side.label} className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                  {side.label}
                                </span>
                                <span className="text-slate-500">
                                  {sideStart} – {sideEnd}
                                </span>
                              </div>
                              <div className="rounded-full bg-slate-100 p-1 shadow-inner shadow-slate-200/60">
                                <div className="flex h-8 overflow-hidden rounded-full bg-slate-200">
                                  {side.segments
                                    .filter((seg) => seg.status !== 'nonDesign')
                                    .map((seg, idx) => {
                                      const base = Math.max(side.designTotal, 1)
                                      const width = (Math.max(0, seg.end - seg.start) / base) * 100
                                      const isApprovedLock = seg.status === 'approved' && !(linear?.isDependencyDriven ?? false)
                                      const startLabel = formatPK(seg.start)
                                      const endLabel = formatPK(seg.end)
                                      return (
                                        <button
                                          key={`${seg.start}-${seg.end}-${idx}`}
                                          type="button"
                                          className={`${statusTone[seg.status]} group flex h-full items-center justify-center text-[10px] font-semibold transition hover:opacity-90`}
                                          style={{ width: `${width}%` }}
                                          title={`${side.label} ${startLabel} ~ ${endLabel} · ${statusLabel(seg.status)}`}
                                          onClick={() => {
                                            if (isApprovedLock) return
                                            if (!canInspect) {
                                              alert(t.alerts.noInspectPermission)
                                              return
                                            }
                                            const sideLabel = side.label
                                            const sideValue = sideLabel === sideLabelMap.LEFT ? 'LEFT' : 'RIGHT'
                                            openInspectionModal(phase, {
                                              phase: phase.name,
                                              phaseId: phase.id,
                                              measure: phase.measure,
                                              layers: phase.resolvedLayers,
                                              checks: phase.resolvedChecks,
                                              side: sideValue,
                                              sideLabel,
                                              start: seg.start,
                                              end: seg.end,
                                              spec: seg.spec ?? null,
                                              billQuantity: seg.billQuantity ?? null,
                                              pointHasSides: phase.pointHasSides,
                                            })
                                          }}
                                        >
                                          <span className="px-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                                            {startLabel}–{endLabel}
                                          </span>
                                        </button>
                                      )
                                    })}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : null}

                  {phase.measure === 'POINT' && point ? (
                    <div className="mt-4 space-y-3">
                      {phase.pointHasSides ? (
                        <div className="space-y-3">
                          {[
                            { side: 'LEFT' as const, label: sideLabelMap.LEFT },
                            { side: 'RIGHT' as const, label: sideLabelMap.RIGHT },
                          ].map((row) => {
                            const rowPoints = point.view.points.filter(
                              (p) => p.side === row.side || p.side === 'BOTH',
                            )
                            if (!rowPoints.length) return null
                            return (
                              <PointLane
                                key={row.side}
                                phase={phase}
                                points={rowPoints}
                                label={row.label}
                                showHeader
                                rangeLabel={undefined}
                                containerClassName="relative h-24 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 shadow-inner shadow-slate-100"
                                sideLabelMap={sideLabelMap}
                                resolvePointProgress={resolvePointProgress}
                                onPointSelect={handlePointSelect}
                              />
                            )
                          })}
                        </div>
                      ) : (
                        <PointLane
                          phase={phase}
                          points={point.view.points}
                          rangeLabel={pointRangeLabel}
                          containerClassName="relative mt-2 h-28 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 shadow-inner shadow-slate-100"
                          sideLabelMap={sideLabelMap}
                          resolvePointProgress={resolvePointProgress}
                          onPointSelect={handlePointSelect}
                        />
                      )}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {inspectionDrawerProps.selectedSegment ? (
        <InspectionDrawer
          {...inspectionDrawerProps}
          onClose={() => setSelectedSegment(null)}
        />
      ) : null}
    </div>
  )
}
