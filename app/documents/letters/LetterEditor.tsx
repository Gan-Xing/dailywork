'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useToast } from '@/components/ToastProvider'
import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type ProjectOption = { id: number; name: string }

type FileItem = {
  id: number
  originalName: string
  category: string
  createdAt: string
}

export type LetterDetail = {
  id: number
  documentId: number
  projectId: number
  projectName: string
  documentCode: string
  status: 'DRAFT' | 'FINAL' | 'ARCHIVED'
  subject: string
  senderOrg: string
  senderName: string
  recipientOrg: string
  recipientName: string
  issuedAt: string
  receivedAt: string
  content: string
  remark: string
}

type Props = {
  projects: ProjectOption[]
  initialLetter?: LetterDetail | null
  canEdit: boolean
  canDelete: boolean
}

type LetterDraft = {
  projectId: string
  documentCode: string
  subject: string
  senderOrg: string
  senderName: string
  recipientOrg: string
  recipientName: string
  issuedAt: string
  receivedAt: string
  status: 'DRAFT' | 'FINAL' | 'ARCHIVED'
  content: string
  remark: string
}

const toDateInput = (value?: string | null) => {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

export function LetterEditor({ projects, initialLetter, canEdit, canDelete }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const { addToast } = useToast()
  const router = useRouter()

  const [draft, setDraft] = useState<LetterDraft>({
    projectId: initialLetter ? String(initialLetter.projectId) : '',
    documentCode: initialLetter?.documentCode ?? '',
    subject: initialLetter?.subject ?? '',
    senderOrg: initialLetter?.senderOrg ?? '',
    senderName: initialLetter?.senderName ?? '',
    recipientOrg: initialLetter?.recipientOrg ?? '',
    recipientName: initialLetter?.recipientName ?? '',
    issuedAt: toDateInput(initialLetter?.issuedAt ?? null),
    receivedAt: toDateInput(initialLetter?.receivedAt ?? null),
    status: initialLetter?.status ?? 'DRAFT',
    content: initialLetter?.content ?? '',
    remark: initialLetter?.remark ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [attachments, setAttachments] = useState<FileItem[]>([])
  const [loadingAttachments, setLoadingAttachments] = useState(false)
  const [uploading, setUploading] = useState(false)

  const documentId = initialLetter?.documentId ?? null

  const selectedProject = useMemo(
    () => projects.find((project) => String(project.id) === draft.projectId) ?? null,
    [projects, draft.projectId],
  )

  useEffect(() => {
    if (!documentId) return
    let cancelled = false

    const loadAttachments = async () => {
      setLoadingAttachments(true)
      try {
        const response = await fetch(
          `/api/files?entityType=document&entityId=${documentId}&category=letter-receipt`,
          { credentials: 'include' },
        )
        const payload = (await response
          .json()
          .catch(() => ({}))) as { items?: FileItem[]; message?: string }
        if (!response.ok) {
          throw new Error(payload.message ?? copy.letters.messages.loadError)
        }
        if (cancelled) return
        setAttachments(payload.items ?? [])
      } catch (error) {
        if (!cancelled) {
          addToast((error as Error).message, { tone: 'danger' })
        }
      } finally {
        if (!cancelled) {
          setLoadingAttachments(false)
        }
      }
    }

    loadAttachments()

    return () => {
      cancelled = true
    }
  }, [addToast, copy.letters.messages.loadError, documentId])

  const handleSave = async () => {
    if (!canEdit) return
    if (!draft.projectId) {
      addToast(copy.letters.messages.requiredProject, { tone: 'warning' })
      return
    }
    if (!draft.subject.trim()) {
      addToast(copy.letters.messages.requiredSubject, { tone: 'warning' })
      return
    }

    setSaving(true)
    try {
      const basePayload = {
        subject: draft.subject.trim(),
        documentCode: draft.documentCode.trim() || undefined,
        senderOrg: draft.senderOrg.trim() || null,
        senderName: draft.senderName.trim() || null,
        recipientOrg: draft.recipientOrg.trim() || null,
        recipientName: draft.recipientName.trim() || null,
        issuedAt: draft.issuedAt || null,
        receivedAt: draft.receivedAt || null,
        status: draft.status,
        content: draft.content.trim() || null,
        remark: draft.remark.trim() || null,
      }
      const payload = initialLetter
        ? basePayload
        : {
            ...basePayload,
            projectId: Number(draft.projectId),
          }

      const response = await fetch(
        initialLetter ? `/api/documents/letters/${initialLetter.id}` : '/api/documents/letters',
        {
          method: initialLetter ? 'PATCH' : 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const result = (await response
        .json()
        .catch(() => ({}))) as { letter?: { id?: number }; message?: string }
      if (!response.ok) {
        throw new Error(result.message ?? copy.letters.messages.loadError)
      }
      addToast(copy.letters.messages.saved, { tone: 'success' })
      if (!initialLetter) {
        const letterId = result.letter?.id
        if (letterId) {
          router.push(`/documents/letters/${letterId}`)
          router.refresh()
        }
      } else {
        router.refresh()
      }
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!initialLetter || !canDelete) return
    if (!window.confirm(copy.letters.messages.deleteConfirm)) return
    setDeleting(true)
    try {
      const response = await fetch(`/api/documents/letters/${initialLetter.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await response
        .json()
        .catch(() => ({}))) as { message?: string }
      if (!response.ok) {
        throw new Error(payload.message ?? copy.letters.messages.loadError)
      }
      addToast(copy.letters.messages.deleteSuccess, { tone: 'success' })
      router.push('/documents/letters')
      router.refresh()
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setDeleting(false)
    }
  }

  const handleOpenFile = async (fileId: number) => {
    try {
      const res = await fetch(`/api/files/${fileId}?includeUrl=1`)
      const payload = (await res.json().catch(() => ({}))) as {
        file?: { url?: string; previewUrl?: string }
      }
      const targetUrl = payload.file?.previewUrl || payload.file?.url
      if (!res.ok || !targetUrl) {
        throw new Error(copy.letters.messages.loadError)
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    }
  }

  const handleUpload = async (file: File) => {
    if (!file || !documentId) return
    setUploading(true)
    try {
      const uploadRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          category: 'letter-receipt',
        }),
      })
      const uploadPayload = (await uploadRes.json().catch(() => ({}))) as {
        uploadUrl?: string
        storageKey?: string
        requiredHeaders?: Record<string, string>
        error?: string
        message?: string
      }
      if (!uploadRes.ok || !uploadPayload.uploadUrl || !uploadPayload.storageKey) {
        throw new Error(uploadPayload.error ?? uploadPayload.message ?? copy.letters.messages.uploadFailed)
      }

      const putRes = await fetch(uploadPayload.uploadUrl, {
        method: 'PUT',
        headers: uploadPayload.requiredHeaders,
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(copy.letters.messages.uploadFailed)
      }

      const registerRes = await fetch('/api/files', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: uploadPayload.storageKey,
          originalName: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          category: 'letter-receipt',
          links: [
            {
              entityType: 'document',
              entityId: String(documentId),
              purpose: 'letter-receipt',
              label: draft.documentCode || initialLetter?.documentCode || file.name,
            },
          ],
        }),
      })
      if (!registerRes.ok) {
        const payload = (await registerRes.json().catch(() => ({}))) as { message?: string }
        throw new Error(payload.message ?? copy.letters.messages.uploadFailed)
      }

      const refresh = await fetch(
        `/api/files?entityType=document&entityId=${documentId}&category=letter-receipt`,
        { credentials: 'include' },
      )
      const refreshed = (await refresh
        .json()
        .catch(() => ({}))) as { items?: FileItem[] }
      setAttachments(refreshed.items ?? [])
      addToast(copy.letters.messages.saved, { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">
            {initialLetter ? copy.letters.form.editTitle : copy.letters.form.newTitle}
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">{draft.subject || copy.letters.title}</h2>
          <p className="text-sm text-slate-600">
            {selectedProject?.name ?? copy.letters.messages.requiredProject}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {initialLetter && canDelete ? (
            <button
              type="button"
              className="rounded-full border border-rose-200 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-rose-600 transition hover:-translate-y-0.5 hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleDelete}
              disabled={deleting}
            >
              {copy.letters.form.delete}
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              className="rounded-full bg-emerald-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white shadow-sm shadow-emerald-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? copy.letters.messages.saving : copy.letters.form.save}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.project}
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.projectId}
            onChange={(event) => setDraft((prev) => ({ ...prev, projectId: event.target.value }))}
            disabled={!canEdit || Boolean(initialLetter)}
          >
            <option value="">{copy.letters.messages.requiredProject}</option>
            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.code}
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.documentCode}
            onChange={(event) => setDraft((prev) => ({ ...prev, documentCode: event.target.value }))}
            placeholder={copy.letters.form.codeHint}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500 lg:col-span-2">
          {copy.letters.form.subject}
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.subject}
            onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.senderOrg}
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.senderOrg}
            onChange={(event) => setDraft((prev) => ({ ...prev, senderOrg: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.senderName}
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.senderName}
            onChange={(event) => setDraft((prev) => ({ ...prev, senderName: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.recipientOrg}
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.recipientOrg}
            onChange={(event) => setDraft((prev) => ({ ...prev, recipientOrg: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.recipientName}
          <input
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.recipientName}
            onChange={(event) => setDraft((prev) => ({ ...prev, recipientName: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.issuedAt}
          <input
            type="date"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.issuedAt}
            onChange={(event) => setDraft((prev) => ({ ...prev, issuedAt: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.receivedAt}
          <input
            type="date"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.receivedAt}
            onChange={(event) => setDraft((prev) => ({ ...prev, receivedAt: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500">
          {copy.letters.form.status}
          <select
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            value={draft.status}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                status: event.target.value as LetterDraft['status'],
              }))
            }
            disabled={!canEdit}
          >
            <option value="DRAFT">{copy.status.document.DRAFT}</option>
            <option value="FINAL">{copy.status.document.FINAL}</option>
            <option value="ARCHIVED">{copy.status.document.ARCHIVED}</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-500 lg:col-span-2">
          {copy.letters.form.content}
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            rows={6}
            value={draft.content}
            onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
        <label className="text-xs font-semibold text-slate-500 lg:col-span-2">
          {copy.letters.form.remark}
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100"
            rows={2}
            value={draft.remark}
            onChange={(event) => setDraft((prev) => ({ ...prev, remark: event.target.value }))}
            disabled={!canEdit}
          />
        </label>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{copy.letters.form.attachments}</h3>
          {documentId && canEdit ? (
            <label className="cursor-pointer rounded-full border border-emerald-200 px-3 py-1 text-[11px] font-semibold text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50">
              {uploading ? copy.letters.messages.saving : copy.letters.form.upload}
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) {
                    handleUpload(file)
                  }
                  event.target.value = ''
                }}
                disabled={uploading}
              />
            </label>
          ) : null}
        </div>
        {loadingAttachments ? (
          <p className="mt-3 text-xs text-slate-500">{copy.letters.messages.loading ?? copy.letters.messages.loadError}</p>
        ) : attachments.length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {attachments.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => handleOpenFile(file.id)}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:border-emerald-200"
              >
                <span className="truncate">{file.originalName}</span>
                <span className="text-[10px] text-slate-400">{file.createdAt.slice(0, 10)}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">{copy.letters.messages.attachmentsEmpty}</p>
        )}
      </div>
    </div>
  )
}
