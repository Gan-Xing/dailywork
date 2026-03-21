'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { AccessDenied } from '@/components/AccessDenied'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'

import { ResourcesHeader } from '../ResourcesHeader'
import { useResourcesSession } from '../hooks/useResourcesSession'
import {
  calculateWeekEndDate,
  formatDateInput,
  formatPlanDateRange,
} from './materialsConfig'

type Project = { id: number; name: string }

type Plan = {
  id: number
  projectId: number
  project: Project
  month: number
  session: number
  title: string
  weekStartDate: string | null
  weekEndDate: string | null
  approverName: string | null
  editorName: string | null
  _count: { items: number }
  createdAt: string
  updatedAt: string
}

export default function WeeklyPlansPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const weeklyT = t.weeklyPlans
  const { canViewMaterials, canCreateMaterials, shouldShowAccessDenied } = useResourcesSession()

  const [plans, setPlans] = useState<Plan[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterProject, setFilterProject] = useState<string>('')

  // New plan dialog state
  const [newOpen, setNewOpen] = useState(false)
  const [newProject, setNewProject] = useState('')
  const [newMonth, setNewMonth] = useState('')
  const [newSession, setNewSession] = useState('')
  const [newWeekStartDate, setNewWeekStartDate] = useState('')
  const [newApprover, setNewApprover] = useState('')
  const [newEditor, setNewEditor] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = `${weeklyT.list.title} | ${t.title}`
  }, [t.title, weeklyT.list.title])

  const resolveListErrorMessage = useCallback((status: number) => {
    if (status === 401 || status === 403) return weeklyT.status.permissionDenied
    return weeklyT.status.loadFailed
  }, [weeklyT.status.loadFailed, weeklyT.status.permissionDenied])

  const resolveCreateErrorMessage = useCallback((status: number) => {
    if (status === 400) return weeklyT.status.createValidationFailed
    if (status === 401 || status === 403) return weeklyT.status.permissionDenied
    if (status === 409) return weeklyT.status.duplicatePlan
    return weeklyT.status.createFailed
  }, [
    weeklyT.status.createFailed,
    weeklyT.status.createValidationFailed,
    weeklyT.status.duplicatePlan,
    weeklyT.status.permissionDenied,
  ])

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filterProject) params.set('projectId', filterProject)
      const res = await fetch(`/api/weekly-plans?${params.toString()}`, { credentials: 'include' })
      const data = (await res.json()) as { plans?: Plan[] }
      if (!res.ok) throw new Error(resolveListErrorMessage(res.status))
      setPlans(data.plans ?? [])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [filterProject, resolveListErrorMessage])

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

  useEffect(() => { void fetchPlans() }, [fetchPlans])
  useEffect(() => { void fetchProjects() }, [fetchProjects])

  // Close dialog on outside click
  useEffect(() => {
    if (!newOpen) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        setNewOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [newOpen])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/weekly-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: Number(newProject),
          month: Number(newMonth),
          session: Number(newSession),
          weekStartDate: newWeekStartDate,
          approverName: newApprover || undefined,
          editorName: newEditor || undefined,
        }),
      })
      if (!res.ok) throw new Error(resolveCreateErrorMessage(res.status))
      setNewOpen(false)
      setNewProject('')
      setNewMonth('')
      setNewSession('')
      setNewWeekStartDate('')
      setNewApprover('')
      setNewEditor('')
      void fetchPlans()
    } catch (e) {
      setCreateError((e as Error).message)
    } finally {
      setCreating(false)
    }
  }

  if (shouldShowAccessDenied) {
    return (
      <AccessDenied
        locale={locale}
        permissions={['material:view']}
        hint={t.access.needMaterialView}
      />
    )
  }

  const computedWeekEndDate = formatDateInput(calculateWeekEndDate(newWeekStartDate))

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources, href: '/resources' },
          { label: t.tabs.weeklyPlans },
        ]}
      />

      <section className="mx-auto max-w-[1700px] px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14">
        {/* toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{weeklyT.list.title}</h2>
          <div className="ml-auto flex items-center gap-3">
            {/* project filter */}
            <select
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            >
              <option value="">{weeklyT.list.allProjects}</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>

            {canCreateMaterials && (
              <button
                type="button"
                onClick={() => setNewOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                + {weeklyT.list.create}
              </button>
            )}
          </div>
        </div>

        {/* list */}
        {loading && (
          <div className="flex items-center justify-center py-20 text-slate-400">{weeklyT.status.loading}</div>
        )}
        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}
        {!loading && !error && plans.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
            <span className="text-4xl">📋</span>
            <p>{weeklyT.list.empty}</p>
          </div>
        )}
        {!loading && !error && plans.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {plans.map((plan) => (
              <Link
                key={plan.id}
                href={`/resources/weekly-plans/${plan.id}`}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-md transition hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-900/10"
              >
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-blue-200 via-indigo-200 to-sky-200 opacity-40 transition group-hover:opacity-70 blur-2xl" />
                <div className="relative">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                      {plan.title}
                    </span>
                    <span className="text-xs text-slate-400">{weeklyT.list.rowCount(plan._count.items)}</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900 truncate">{plan.project.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {weeklyT.list.monthSession(plan.month, plan.session)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {formatPlanDateRange(plan.weekStartDate, plan.weekEndDate) || weeklyT.list.noRange}
                  </p>
                  {plan.approverName || plan.editorName ? (
                    <p className="mt-2 text-xs text-slate-400 truncate">
                      {weeklyT.list.approverEditor(plan.approverName, plan.editorName)}
                    </p>
                  ) : null}
                  <div className="mt-3 flex items-center gap-1 text-xs font-semibold text-slate-600 transition group-hover:translate-x-0.5">
                    {weeklyT.list.viewDetail} <span className="text-sm">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Create plan dialog */}
      {newOpen && canCreateMaterials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div
            ref={dialogRef}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{weeklyT.createDialog.title}</h3>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 transition hover:bg-slate-100"
              >
                ×
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={(e) => { void handleCreate(e) }}>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                {weeklyT.createDialog.fields.project} <span className="text-rose-500">*</span>
                <select
                  required
                  value={newProject}
                  onChange={(e) => setNewProject(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                >
                  <option value="">{weeklyT.createDialog.placeholders.selectProject}</option>
                  {projects.map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>
              </label>

              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
                  {weeklyT.createDialog.fields.month} <span className="text-rose-500">*</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    placeholder={weeklyT.createDialog.placeholders.month}
                    value={newMonth}
                    onChange={(e) => setNewMonth(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
                  {weeklyT.createDialog.fields.session} <span className="text-rose-500">*</span>
                  <input
                    type="number"
                    min={1}
                    required
                    placeholder={weeklyT.createDialog.placeholders.session}
                    value={newSession}
                    onChange={(e) => setNewSession(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </label>
              </div>

              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
                  {weeklyT.createDialog.fields.weekStartDate} <span className="text-rose-500">*</span>
                  <input
                    type="date"
                    required
                    value={newWeekStartDate}
                    onChange={(e) => setNewWeekStartDate(e.target.value)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-sm text-slate-700">
                  {weeklyT.createDialog.fields.weekEndDate}
                  <input
                    type="date"
                    readOnly
                    value={computedWeekEndDate}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </label>
              </div>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                {weeklyT.createDialog.fields.approverName}
                <input
                  type="text"
                  placeholder={weeklyT.createDialog.placeholders.approverName}
                  value={newApprover}
                  onChange={(e) => setNewApprover(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                {weeklyT.createDialog.fields.editorName}
                <input
                  type="text"
                  placeholder={weeklyT.createDialog.placeholders.editorName}
                  value={newEditor}
                  onChange={(e) => setNewEditor(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </label>

              {createError && (
                <p className="text-xs text-rose-600">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex flex-1 items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {creating ? weeklyT.createDialog.actions.creating : weeklyT.createDialog.actions.create}
                </button>
                <button
                  type="button"
                  onClick={() => setNewOpen(false)}
                  className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {weeklyT.createDialog.actions.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
