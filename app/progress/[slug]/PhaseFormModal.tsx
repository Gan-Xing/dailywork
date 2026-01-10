 'use client'

import type { RefObject } from 'react'

import type { IntervalSide, PhaseDefinitionDTO, PhaseIntervalPayload, PhaseMeasure } from '@/lib/progressTypes'
import type { getProgressCopy } from '@/lib/i18n/progress'
import { formatProgressCopy } from '@/lib/i18n/progress'

type PhaseCopy = ReturnType<typeof getProgressCopy>['phase']

export interface PhaseFormModalProps {
  open: boolean
  canManage: boolean
  t: PhaseCopy
  designLength: number
  roadLength: number
  measure: PhaseMeasure
  name: string
  definitionId: number | null
  editingId: number | null
  definitions: PhaseDefinitionDTO[]
  pointHasSides: boolean
  intervals: PhaseIntervalPayload[]
  sideOptions: { value: IntervalSide; label: string }[]
  defaultLayers: string[]
  layerOptions: string[]
  isPending: boolean
  error: string | null
  nameInputRef: RefObject<HTMLInputElement>
  onClose: () => void
  onReset: () => void
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onTemplateSelect: (definition: PhaseDefinitionDTO) => void
  onNameChange: (value: string) => void
  onMeasureChange: (value: PhaseMeasure) => void
  onPointHasSidesChange: (checked: boolean) => void
  onIntervalChange: (index: number, patch: Partial<PhaseIntervalPayload>) => void
  onToggleIntervalLayer: (index: number, layer: string) => void
  onAddInterval: () => void
  onRemoveInterval: (index: number) => void
}

export function PhaseFormModal({
  open,
  canManage,
  t,
  designLength,
  roadLength,
  measure,
  name,
  definitionId,
  editingId,
  definitions,
  pointHasSides,
  intervals,
  sideOptions,
  defaultLayers,
  layerOptions,
  isPending,
  error,
  nameInputRef,
  onClose,
  onReset,
  onSubmit,
  onTemplateSelect,
  onNameChange,
  onMeasureChange,
  onPointHasSidesChange,
  onIntervalChange,
  onToggleIntervalLayer,
  onAddInterval,
  onRemoveInterval,
}: PhaseFormModalProps) {
  if (!open || !canManage) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-6 sm:items-center sm:py-10"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-emerald-200/30"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 sm:right-4 sm:top-4"
          onClick={onClose}
          aria-label={t.delete.close}
        >
          ×
        </button>
        <div className="max-h-[90vh] overflow-y-auto p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            {editingId ? (
              <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                {formatProgressCopy(t.form.editingBadge, { id: editingId })}
              </span>
            ) : (
              <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-900">
                {t.form.creatingBadge}
              </span>
            )}
            <button
              type="button"
              className="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={onReset}
            >
              {definitionId ? t.form.resetEdit : t.form.resetNew}
            </button>
            <span className="text-xs text-slate-500">
              {formatProgressCopy(t.form.designSummary, {
                length: roadLength || t.roadLengthUnknown,
                design:
                  measure === 'POINT'
                    ? formatProgressCopy(t.form.designHintPoint, { design: designLength })
                    : formatProgressCopy(t.form.designHintLinear, { design: designLength }),
              })}
            </span>
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                {t.form.templateLabel}
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                  value={definitionId ?? ''}
                  onChange={(e) => {
                    const value = e.target.value
                    if (!value) return
                    const found = definitions.find((item) => item.id === Number(value))
                    if (found) {
                      onTemplateSelect(found)
                    }
                  }}
                >
                  {definitions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.measure === 'POINT' ? t.form.measureOptionPoint : t.form.measureOptionLinear}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                {t.form.nameLabel}
                <input
                  ref={nameInputRef}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                  value={name}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder={t.form.namePlaceholder}
                  required
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-700">
                {t.form.measureLabel}
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                  value={measure}
                  onChange={(e) => onMeasureChange(e.target.value as PhaseMeasure)}
                >
                  <option value="LINEAR">{t.form.measureOptionLinear}</option>
                  <option value="POINT">{t.form.measureOptionPoint}</option>
                </select>
              </label>
              <div className="flex flex-col justify-end text-sm text-slate-700">
                <span className="text-xs text-slate-500">
                  {t.form.designHintPrefix}
                  {measure === 'POINT'
                    ? formatProgressCopy(t.form.designHintPoint, { design: designLength })
                    : formatProgressCopy(t.form.designHintLinear, { design: designLength })}
                </span>
                {measure === 'POINT' ? (
                  <label className="mt-2 flex items-center gap-2 text-[12px] text-slate-600">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-500"
                      checked={pointHasSides}
                      onChange={(e) => onPointHasSidesChange(e.target.checked)}
                    />
                    <span className="font-semibold">{t.form.pointSidesLabel}</span>
                    <span className="text-[11px] text-slate-500">{t.form.pointSidesHint}</span>
                  </label>
                ) : null}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-sm text-slate-700">
                <p>{t.form.intervalTitle}</p>
                <button
                  type="button"
                  onClick={onAddInterval}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-white"
                >
                  {t.form.intervalAdd}
                </button>
              </div>

              <div className="space-y-3">
                {intervals.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 md:grid-cols-6 md:items-center"
                  >
                    <label className="flex flex-col items-center gap-1 text-center">
                      {t.form.intervalStart}
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                        value={Number.isFinite(item.startPk) ? item.startPk : ''}
                        onChange={(e) =>
                          onIntervalChange(index, {
                            startPk: e.target.value === '' ? Number.NaN : Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="flex flex-col items-center gap-1 text-center">
                      {t.form.intervalEnd}
                      <input
                        type="number"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                        value={Number.isFinite(item.endPk) ? item.endPk : ''}
                        onChange={(e) =>
                          onIntervalChange(index, { endPk: e.target.value === '' ? Number.NaN : Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="flex flex-col items-center gap-1 text-center">
                      {t.form.intervalSide}
                      <select
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                        value={item.side}
                        onChange={(e) => onIntervalChange(index, { side: e.target.value as IntervalSide })}
                      >
                        {sideOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col items-center gap-1 text-center">
                      {t.form.intervalSpec}
                      <input
                        type="text"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                        value={item.spec ?? ''}
                        onChange={(e) => onIntervalChange(index, { spec: e.target.value })}
                        placeholder={t.form.intervalSpec}
                      />
                    </label>
                    <div className="md:col-span-2 flex flex-col gap-3 md:flex-row md:items-center md:gap-3">
                      <label className="flex w-full flex-col items-center gap-1 text-center md:mb-0">
                        {t.form.intervalBillQuantity}
                        <input
                          type="number"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                          value={Number.isFinite(item.billQuantity ?? Number.NaN) ? item.billQuantity ?? '' : ''}
                          onChange={(e) =>
                            onIntervalChange(index, {
                              billQuantity: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                        />
                      </label>
                      {intervals.length > 1 ? (
                        <button
                          type="button"
                          className="w-full self-end rounded-xl border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 md:w-auto md:ml-auto md:self-center"
                          onClick={() => onRemoveInterval(index)}
                        >
                          {t.form.intervalDelete}
                        </button>
                      ) : null}
                    </div>
                    {measure === 'POINT' && layerOptions.length ? (
                      <div className="md:col-span-6 flex flex-wrap gap-2">
                        {(layerOptions.length ? layerOptions : defaultLayers).map((layer) => {
                          const selected =
                            (item.layers?.length ? item.layers : defaultLayers).some(
                              (layerName) => layerName.trim().toLowerCase() === layer.trim().toLowerCase(),
                            )
                          return (
                            <button
                              key={`${index}-${layer}`}
                              type="button"
                              onClick={() => onToggleIntervalLayer(index, layer)}
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                selected
                                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200/60'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {layer}
                            </button>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t.form.save}
              </button>
              {error ? <span className="text-sm text-amber-700">{error}</span> : null}
              {isPending ? <span className="text-xs text-slate-500">{t.form.saving}</span> : null}
            </div>
            <p className="text-xs text-slate-500">{t.note.measure}</p>
          </form>
        </div>
      </div>
    </div>
  )
}
