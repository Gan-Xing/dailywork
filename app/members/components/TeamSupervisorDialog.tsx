import { useEffect, useMemo, useState } from 'react'

import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

import type { TeamSupervisorItem } from '../hooks/useTeamSupervisors'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type TeamSupervisorDialogProps = {
  t: MemberCopy
  locale: Locale
  open: boolean
  canManage: boolean
  loading: boolean
  error: string | null
  teamSupervisors: TeamSupervisorItem[]
  supervisorOptions: { value: string; label: string }[]
  projectOptions: { value: string; label: string }[]
  onClose: () => void
  onRefresh: () => Promise<void> | void
}

type EditingId = number | 'new' | null

export function TeamSupervisorDialog({
  t,
  locale,
  open,
  canManage,
  loading,
  error,
  teamSupervisors,
  supervisorOptions,
  projectOptions,
  onClose,
  onRefresh,
}: TeamSupervisorDialogProps) {
  const [editingId, setEditingId] = useState<EditingId>(null)
  const [draftTeam, setDraftTeam] = useState('')
  const [draftTeamZh, setDraftTeamZh] = useState('')
  const [draftSupervisorId, setDraftSupervisorId] = useState('')
  const [draftProjectId, setDraftProjectId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setEditingId(null)
      setDraftTeam('')
      setDraftTeamZh('')
      setDraftSupervisorId('')
      setDraftProjectId('')
      setActionError(null)
    }
  }, [open])

  const sortedSupervisors = useMemo(() => teamSupervisors, [teamSupervisors])

  const startCreate = () => {
    if (!canManage) return
    setEditingId('new')
    setDraftTeam('')
    setDraftTeamZh('')
    setDraftSupervisorId('')
    setDraftProjectId('')
    setActionError(null)
  }

  const startEdit = (item: TeamSupervisorItem) => {
    if (!canManage) return
    setEditingId(item.id)
    setDraftTeam(item.team)
    setDraftTeamZh(item.teamZh ?? '')
    setDraftSupervisorId(String(item.supervisorId))
    setDraftProjectId(item.project ? String(item.project.id) : '')
    setActionError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setDraftTeam('')
    setDraftTeamZh('')
    setDraftSupervisorId('')
    setDraftProjectId('')
    setActionError(null)
  }

  const submit = async () => {
    if (!draftTeam.trim()) {
      setActionError(t.teamSupervisor.teamRequired)
      return
    }
    if (!draftSupervisorId) {
      setActionError(t.teamSupervisor.supervisorRequired)
      return
    }
    setSubmitting(true)
    setActionError(null)
    try {
      const isCreate = editingId === 'new'
      const url = isCreate
        ? '/api/team-supervisors'
        : `/api/team-supervisors/${editingId}`
      const res = await fetch(url, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team: draftTeam.trim(),
          teamZh: draftTeamZh.trim(),
          supervisorId: Number(draftSupervisorId),
          projectId: draftProjectId ? Number(draftProjectId) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      await onRefresh()
      cancelEdit()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  const deleteRow = async (item: TeamSupervisorItem) => {
    if (!canManage) return
    const teamLabel = locale === 'zh' && item.teamZh?.trim() ? item.teamZh : item.team
    if (!confirm(t.teamSupervisor.deleteConfirm(teamLabel))) return
    setSubmitting(true)
    setActionError(null)
    try {
      const res = await fetch(`/api/team-supervisors/${item.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? t.feedback.submitError)
      }
      await onRefresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.feedback.submitError)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
      <div className="flex w-full max-w-4xl max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/30">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-lg font-semibold text-slate-900">{t.teamSupervisor.title}</p>
            <p className="text-sm text-slate-500">{t.teamSupervisor.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startCreate}
              disabled={!canManage}
              className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.teamSupervisor.add}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              X
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-12 gap-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span className="col-span-2">{t.teamSupervisor.team}</span>
            <span className="col-span-3">{t.teamSupervisor.teamZh}</span>
            <span className="col-span-3">{t.teamSupervisor.supervisor}</span>
            <span className="col-span-2">{t.teamSupervisor.project}</span>
            <span className="col-span-1 text-center">{t.teamSupervisor.edit}</span>
            <span className="col-span-1 text-center">{t.teamSupervisor.delete}</span>
          </div>

          {editingId === 'new' ? (
            <div className="grid grid-cols-12 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <input
                value={draftTeam}
                onChange={(event) => setDraftTeam(event.target.value)}
                placeholder={t.teamSupervisor.teamPlaceholder}
                className="col-span-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <input
                value={draftTeamZh}
                onChange={(event) => setDraftTeamZh(event.target.value)}
                placeholder={t.teamSupervisor.teamZhPlaceholder}
                className="col-span-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <select
                value={draftSupervisorId}
                onChange={(event) => setDraftSupervisorId(event.target.value)}
                className="col-span-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">{t.labels.empty}</option>
                {supervisorOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={draftProjectId}
                onChange={(event) => setDraftProjectId(event.target.value)}
                className="col-span-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">{t.labels.empty}</option>
                {projectOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  if (!submitting) void submit()
                }}
                className="col-span-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.teamSupervisor.confirm}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={cancelEdit}
                className="col-span-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.teamSupervisor.cancel}
              </button>
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {t.feedback.loading}
            </div>
          ) : null}

          {!loading && sortedSupervisors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              {t.teamSupervisor.empty}
            </div>
          ) : null}

          {sortedSupervisors.map((item) =>
            editingId === item.id ? (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
              >
                <input
                  value={draftTeam}
                  onChange={(event) => setDraftTeam(event.target.value)}
                  className="col-span-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <input
                  value={draftTeamZh}
                  onChange={(event) => setDraftTeamZh(event.target.value)}
                  className="col-span-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                <select
                  value={draftSupervisorId}
                  onChange={(event) => setDraftSupervisorId(event.target.value)}
                  className="col-span-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">{t.labels.empty}</option>
                  {supervisorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  value={draftProjectId}
                  onChange={(event) => setDraftProjectId(event.target.value)}
                  className="col-span-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                >
                  <option value="">{t.labels.empty}</option>
                  {projectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    if (!submitting) void submit()
                  }}
                  className="col-span-1 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.teamSupervisor.confirm}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={cancelEdit}
                  className="col-span-1 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.teamSupervisor.cancel}
                </button>
              </div>
            ) : (
              <div
                key={item.id}
                className="grid grid-cols-12 gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700"
              >
                <span className="col-span-2 truncate">{item.team}</span>
                <span className="col-span-3 truncate">{item.teamZh ?? t.labels.empty}</span>
                <span className="col-span-3 truncate">{item.supervisorLabel}</span>
                <span className="col-span-2 truncate">{item.project?.name ?? t.labels.empty}</span>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => startEdit(item)}
                  className="col-span-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.teamSupervisor.edit}
                </button>
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => {
                    if (!submitting) void deleteRow(item)
                  }}
                  className="col-span-1 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.teamSupervisor.delete}
                </button>
              </div>
            ),
          )}

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              {error}
            </div>
          ) : null}
          {actionError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-600">
              {actionError}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
