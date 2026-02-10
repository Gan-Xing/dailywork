'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ResourcesCopy } from '@/lib/i18n/resources'

type MachinePhoto = {
  id: number
  originalName: string
  mimeType: string
  size: number
  createdAt: string
  url: string
  previewUrl: string | null
}

const formatBytes = (size: number) => {
  if (!Number.isFinite(size)) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function MachinePhotosPanel({
  t,
  machineId,
  canEdit,
}: {
  t: ResourcesCopy
  machineId: number
  canEdit: boolean
}) {
  const [photos, setPhotos] = useState<MachinePhoto[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canShow = Number.isFinite(machineId) && machineId > 0

  const loadPhotos = useCallback(async () => {
    if (!canShow) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/resources/machines/${machineId}/photos`, {
        credentials: 'include',
      })
      const payload = (await res.json().catch(() => ({}))) as { photos?: MachinePhoto[]; error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? t.common.loadFailed)
      }
      setPhotos(payload.photos ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t.common.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [canShow, machineId, t.common.loadFailed])

  useEffect(() => {
    void loadPhotos()
  }, [loadPhotos])

  const handleUploadClick = () => {
    inputRef.current?.click()
  }

  const uploadSingle = async (file: File) => {
    const uploadRes = await fetch(`/api/resources/machines/${machineId}/photos/upload-url`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    })
    const uploadPayload = (await uploadRes.json().catch(() => ({}))) as {
      uploadUrl?: string
      storageKey?: string
      requiredHeaders?: Record<string, string>
      error?: string
    }
    if (!uploadRes.ok || !uploadPayload.uploadUrl || !uploadPayload.storageKey) {
      throw new Error(uploadPayload.error ?? t.machines.photos.uploadFailed)
    }

    const putRes = await fetch(uploadPayload.uploadUrl, {
      method: 'PUT',
      headers: uploadPayload.requiredHeaders,
      body: file,
    })
    if (!putRes.ok) {
      throw new Error(t.machines.photos.uploadFailed)
    }

    const finalizeRes = await fetch(`/api/resources/machines/${machineId}/photos`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storageKey: uploadPayload.storageKey,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      }),
    })
    const finalizePayload = (await finalizeRes.json().catch(() => ({}))) as {
      photo?: MachinePhoto
      error?: string
    }
    if (!finalizeRes.ok || !finalizePayload.photo) {
      throw new Error(finalizePayload.error ?? t.machines.photos.uploadFailed)
    }

    setPhotos((prev) => [finalizePayload.photo!, ...prev.filter((p) => p.id !== finalizePayload.photo!.id)])
  }

  const handleUpload = async (files: File[]) => {
    if (!canEdit || uploading) return
    if (!files.length) return
    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        await uploadSingle(file)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.machines.photos.uploadFailed)
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (photoId: number) => {
    if (!canEdit || deletingId) return
    setDeletingId(photoId)
    setError(null)
    try {
      const res = await fetch(`/api/resources/machines/${machineId}/photos/${photoId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? t.machines.photos.deleteFailed)
      }
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    } catch (err) {
      setError(err instanceof Error ? err.message : t.machines.photos.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  const hint = useMemo(() => {
    const count = photos.length
    const base = count ? t.machines.photos.count(count) : t.machines.photos.empty
    return canEdit ? base : `${base} · ${t.machines.photos.readOnly}`
  }, [canEdit, photos.length, t])

  if (!canShow) return null

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t.machines.photos.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
        </div>

        {canEdit ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? [])
                if (selected.length) {
                  void handleUpload(selected)
                }
              }}
            />
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? t.machines.photos.uploading : t.machines.photos.upload}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-600 whitespace-pre-line">{error}</p> : null}
      {loading ? <p className="mt-3 text-xs text-slate-500">{t.common.loading}</p> : null}

      {!loading && photos.length === 0 ? (
        <p className="mt-3 text-xs text-slate-400">{t.machines.photos.empty}</p>
      ) : null}

      {photos.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <button
                type="button"
                className="block w-full"
                onClick={() => window.open(photo.url, '_blank', 'noopener,noreferrer')}
                title={photo.originalName}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.previewUrl || photo.url}
                  alt={photo.originalName}
                  className="h-36 w-full object-cover"
                />
              </button>

              <div className="border-t border-slate-100 p-2">
                <p className="truncate text-[11px] font-semibold text-slate-700">{photo.originalName}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  {formatBytes(photo.size)} · {new Date(photo.createdAt).toLocaleDateString()}
                </p>
              </div>

              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(photo.id)}
                  disabled={deletingId === photo.id}
                  className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-rose-600 shadow-sm ring-1 ring-rose-200 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingId === photo.id ? t.machines.photos.deleting : t.machines.photos.delete}
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}

