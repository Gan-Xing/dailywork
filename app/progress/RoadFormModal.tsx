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
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/80 px-4 py-6 backdrop-blur sm:items-center sm:py-10"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl shadow-emerald-500/20">
        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
              {copy.admin.badge}
            </p>
            <h2 className="text-xl font-semibold text-slate-50">{copy.admin.title}</h2>
            <p className="text-sm text-slate-200/80">{copy.admin.description}</p>
          </div>
          {editingId ? (
            <span className="rounded-full bg-amber-200/80 px-3 py-1 text-xs font-semibold text-slate-900">
              {formatProgressCopy(copy.admin.editMode, { id: editingId })}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="absolute right-4 top-4 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/20"
          onClick={onClose}
          aria-label={copy.actions.close}
        >
          ×
        </button>
        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-slate-100">
              {copy.form.slugLabel}
              <input
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
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
            <label className="flex flex-col gap-2 text-sm text-slate-100">
              {copy.form.nameLabel}
              <input
                ref={nameInputRef}
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder={copy.form.namePlaceholder}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-100">
              {copy.form.startLabel}
              <input
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                value={form.startPk}
                onChange={(event) => onChange({ startPk: event.target.value })}
                placeholder={copy.form.startPlaceholder}
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-100">
              {copy.form.endLabel}
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 placeholder:text-slate-200/60 focus:border-emerald-300 focus:outline-none"
                  value={form.endPk}
                  onChange={(event) => onChange({ endPk: event.target.value })}
                  placeholder={copy.form.endPlaceholder}
                  required
                />
                {editingId ? (
                  <button
                    type="button"
                    className="rounded-xl border border-white/20 px-3 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
                    onClick={onReset}
                  >
                    {copy.form.exitEdit}
                  </button>
                ) : null}
              </div>
            </label>
            <label className="flex flex-col gap-2 text-sm text-slate-100 md:col-span-2">
              项目归属
              <select
                className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-slate-50 focus:border-emerald-300 focus:outline-none"
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
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-400/30 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {editingId ? copy.actions.save : copy.actions.add}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
            >
              {copy.actions.cancel}
            </button>
            {error ? <span className="text-sm text-amber-200">{error}</span> : null}
            {isPending ? (
              <span className="text-xs text-slate-200/70">{copy.admin.saving}</span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
