'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { ResourcesCopy } from '@/lib/i18n/resources'

type WeeklyPlanReceipt = {
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

const formatReceiptDate = (value: string, locale: string) => {
  try {
    return new Date(value).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'zh-CN')
  } catch {
    return value
  }
}

const isImageReceipt = (mimeType: string) => mimeType.trim().toLowerCase().startsWith('image/')

const getFileBadge = (mimeType: string, originalName: string) => {
  if (mimeType === 'application/pdf') return 'PDF'
  const extension = originalName.split('.').pop()?.trim().toUpperCase()
  return extension || 'FILE'
}

export function WeeklyPlanReceiptsPanel({
  planId,
  itemId,
  canEdit,
  locale,
  copy,
  loadingLabel,
}: {
  planId: number
  itemId: number | null
  canEdit: boolean
  locale: string
  copy: ResourcesCopy['weeklyPlans']['detail']['receipts']
  loadingLabel: string
}) {
  const [receipts, setReceipts] = useState<WeeklyPlanReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const canShow =
    Number.isFinite(planId) &&
    planId > 0 &&
    typeof itemId === 'number' &&
    Number.isFinite(itemId) &&
    itemId > 0

  const loadReceipts = useCallback(async () => {
    if (!canShow || !itemId) {
      setReceipts([])
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/weekly-plans/${planId}/items/${itemId}/receipts`, {
        credentials: 'include',
      })
      const payload = (await res.json().catch(() => ({}))) as {
        receipts?: WeeklyPlanReceipt[]
        error?: string
      }
      if (!res.ok) {
        throw new Error(payload.error ?? copy.loadFailed)
      }
      setReceipts(payload.receipts ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.loadFailed)
    } finally {
      setLoading(false)
    }
  }, [canShow, copy.loadFailed, itemId, planId])

  useEffect(() => {
    void loadReceipts()
  }, [loadReceipts])

  const uploadSingle = async (file: File) => {
    if (!itemId) return

    const uploadRes = await fetch(`/api/weekly-plans/${planId}/items/${itemId}/receipts/upload-url`, {
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
      throw new Error(uploadPayload.error ?? copy.uploadFailed)
    }

    const putRes = await fetch(uploadPayload.uploadUrl, {
      method: 'PUT',
      headers: uploadPayload.requiredHeaders,
      body: file,
    })
    if (!putRes.ok) {
      throw new Error(copy.uploadFailed)
    }

    const finalizeRes = await fetch(`/api/weekly-plans/${planId}/items/${itemId}/receipts`, {
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
      receipt?: WeeklyPlanReceipt
      error?: string
    }
    if (!finalizeRes.ok || !finalizePayload.receipt) {
      throw new Error(finalizePayload.error ?? copy.uploadFailed)
    }

    setReceipts((prev) => [
      finalizePayload.receipt!,
      ...prev.filter((receipt) => receipt.id !== finalizePayload.receipt!.id),
    ])
  }

  const handleUpload = async (files: File[]) => {
    if (!canEdit || uploading || !itemId) return
    if (!files.length) return

    setUploading(true)
    setError(null)
    try {
      for (const file of files) {
        await uploadSingle(file)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.uploadFailed)
    } finally {
      setUploading(false)
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (receiptId: number) => {
    if (!canEdit || deletingId || !itemId) return

    setDeletingId(receiptId)
    setError(null)
    try {
      const res = await fetch(`/api/weekly-plans/${planId}/items/${itemId}/receipts/${receiptId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const payload = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? copy.deleteFailed)
      }
      setReceipts((prev) => prev.filter((receipt) => receipt.id !== receiptId))
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  const summaryText = useMemo(() => {
    if (!canShow || !itemId) return copy.createHint
    return receipts.length ? copy.count(receipts.length) : copy.empty
  }, [canShow, copy, itemId, receipts.length])

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">{copy.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{canShow ? copy.hint : copy.createHint}</p>
          <p className="mt-1 text-xs text-slate-400">{summaryText}</p>
          {canShow ? <p className="mt-1 text-xs text-slate-400">{copy.supportedTypes}</p> : null}
        </div>

        {canShow && canEdit ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
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
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? copy.uploading : copy.upload}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 whitespace-pre-line text-sm text-rose-600">{error}</p> : null}
      {canShow && loading ? <p className="mt-3 text-sm text-slate-500">{loadingLabel}</p> : null}
      {!canShow ? <p className="mt-3 text-sm text-slate-400">{copy.createHint}</p> : null}
      {canShow && !loading && receipts.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{copy.empty}</p>
      ) : null}

      {canShow && receipts.length ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {receipts.map((receipt) => {
            const previewUrl = receipt.previewUrl || receipt.url
            const canPreviewImage = isImageReceipt(receipt.mimeType)

            return (
              <div
                key={receipt.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => window.open(receipt.url, '_blank', 'noopener,noreferrer')}
                  className="block w-full"
                  title={receipt.originalName}
                >
                  {canPreviewImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={receipt.originalName}
                      className="h-40 w-full bg-slate-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-40 w-full items-center justify-center bg-slate-100">
                      <span className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
                        {getFileBadge(receipt.mimeType, receipt.originalName)}
                      </span>
                    </div>
                  )}
                </button>

                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{receipt.originalName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatBytes(receipt.size)} · {formatReceiptDate(receipt.createdAt, locale)}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.open(receipt.url, '_blank', 'noopener,noreferrer')}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {copy.open}
                    </button>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => void handleDelete(receipt.id)}
                        disabled={deletingId === receipt.id}
                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === receipt.id ? copy.deleting : copy.delete}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
