'use client'

import { useEffect, useRef, type FormEvent } from 'react'

import { formatProgressCopy, getProgressCopy } from '@/lib/i18n/progress'

import type { RoadFormState } from './types'

interface Props {
  open: boolean
  form: RoadFormState
  editingId: number | null
  error: string | null
  isPending: boolean
  copy: ReturnType<typeof getProgressCopy>
  projects: Array<{ id: number; name: string; code: string | null }>
  onClose: () => void
  onChange: (updates: Partial<RoadFormState>) => void
  onReset: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export default function RoadFormModal({
  open,
  form,
  editingId,
  error,
  isPending,
  copy,
  projects,
  onClose,
  onChange,
  onReset,
  onSubmit,
}: Props) {
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/40 px-4 py-6 backdrop-blur sm:items-center sm:py-10"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-emerald-200/30">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {copy.admin.badge}
            </p>
            <h2 className="text-xl font-semibold text-slate-900">{copy.admin.title}</h2>
            <p className="text-sm text-slate-600">{copy.admin.description}</p>
          </div>
          {editingId ? (
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
              {formatProgressCopy(copy.admin.editMode, { id: editingId })}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          onClick={onClose}
          aria-label={copy.actions.close}
        >
          ×
        </button>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              {copy.form.slugLabel}
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                value={form.slug}
                onChange={(event) =>
                  onChange({ slug: event.target.value.toLowerCase() })
                }
                placeholder={copy.form.slugPlaceholder}
                pattern="[a-z0-9-]+"
                title={copy.form.slugTitle}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              {copy.form.nameLabel}
              <input
                ref={nameInputRef}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder={copy.form.namePlaceholder}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              {copy.form.startLabel}
              <input
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                value={form.startPk}
                onChange={(event) => onChange({ startPk: event.target.value })}
                placeholder={copy.form.startPlaceholder}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700">
              {copy.form.endLabel}
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                  value={form.endPk}
                  onChange={(event) => onChange({ endPk: event.target.value })}
                  placeholder={copy.form.endPlaceholder}
                  required
                />
                {editingId ? (
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    onClick={onReset}
                  >
                    {copy.form.exitEdit}
                  </button>
                ) : null}
              </div>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-700 md:col-span-2">
              项目归属
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-300 focus:outline-none"
                value={form.projectId}
                onChange={(event) => onChange({ projectId: event.target.value })}
              >
                <option value="">未绑定项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={String(project.id)}>
                    {project.code ? `${project.name}（${project.code}）` : project.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-200/60 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {editingId ? copy.actions.save : copy.actions.add}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.actions.cancel}
            </button>
            {error ? <span className="text-sm text-amber-700">{error}</span> : null}
            {isPending ? (
              <span className="text-xs text-slate-500">{copy.admin.saving}</span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
