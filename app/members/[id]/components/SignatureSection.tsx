import { useEffect, useMemo, useRef, useState } from 'react'

import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type SignatureEntry = {
  id: number
  version: number
  isActive: boolean
  createdAt: string
  createdBy: { id: number; name: string | null; username: string } | null
  file: {
    id: number
    originalName: string
    mimeType: string
    size: number
    url: string
  }
}

type Props = {
  t: MemberCopy
  memberId: number
  canViewSignature: boolean
  canUploadSignature: boolean
  canDeleteSignature: boolean
}

const formatBytes = (size: number) => {
  if (!Number.isFinite(size)) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

export function SignatureSection({
  t,
  memberId,
  canViewSignature,
  canUploadSignature,
  canDeleteSignature,
}: Props) {
  const [signatures, setSignatures] = useState<SignatureEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activatingId, setActivatingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canShowSection = canViewSignature || canUploadSignature
  const activeSignature = useMemo(
    () => signatures.find((item) => item.isActive) ?? null,
    [signatures],
  )

  const loadSignatures = async () => {
    if (!canViewSignature) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}/signatures`)
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const payload = (await res.json()) as { signatures?: SignatureEntry[] }
      setSignatures(payload.signatures ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signaturePanel.loadError)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canViewSignature) {
      void loadSignatures()
    }
  }, [canViewSignature, memberId])

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}/signatures/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const payload = (await res.json()) as {
        uploadUrl: string
        storageKey: string
        requiredHeaders?: Record<string, string>
      }

      const uploadRes = await fetch(payload.uploadUrl, {
        method: 'PUT',
        headers: payload.requiredHeaders,
        body: file,
      })
      if (!uploadRes.ok) {
        throw new Error(t.signaturePanel.uploadFailed)
      }

      const finalizeRes = await fetch(`/api/members/${memberId}/signatures`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: payload.storageKey,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
        }),
      })
      if (!finalizeRes.ok) {
        throw new Error(await finalizeRes.text())
      }
      const finalizePayload = (await finalizeRes.json()) as { signature?: SignatureEntry }
      const signature = finalizePayload.signature
      if (signature) {
        setSignatures((prev) => {
          const rest = prev
            .filter((item) => item.id !== signature.id)
            .map((item) => ({ ...item, isActive: false }))
          return [signature, ...rest]
        })
      } else if (canViewSignature) {
        await loadSignatures()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signaturePanel.uploadFailed)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleActivate = async (signatureId: number) => {
    setActivatingId(signatureId)
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}/signatures/${signatureId}`, {
        method: 'PATCH',
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      const payload = (await res.json()) as { signature?: SignatureEntry }
      if (payload.signature) {
        setSignatures((prev) =>
          prev.map((item) =>
            item.id === payload.signature?.id
              ? payload.signature
              : { ...item, isActive: false },
          ),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signaturePanel.activateFailed)
    } finally {
      setActivatingId(null)
    }
  }

  const handleDelete = async (signatureId: number) => {
    setDeletingId(signatureId)
    setError(null)
    try {
      const res = await fetch(`/api/members/${memberId}/signatures/${signatureId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(await res.text())
      }
      setSignatures((prev) => prev.filter((item) => item.id !== signatureId))
      if (canViewSignature) {
        await loadSignatures()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.signaturePanel.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  if (!canShowSection) return null

  return (
    <section className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{t.signaturePanel.title}</p>
          <p className="text-xs text-slate-500">{t.signaturePanel.hint}</p>
        </div>
        {canUploadSignature ? (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void handleUpload(file)
                }
              }}
            />
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="rounded-full bg-sky-500 px-4 py-1 text-xs font-semibold text-white shadow-sm shadow-sky-200/60 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? t.signaturePanel.uploading : t.signaturePanel.upload}
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-xs text-rose-500">{error}</p> : null}

      {canViewSignature ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">{t.signaturePanel.current}</p>
            {activeSignature ? (
              <div className="mt-3 flex flex-col gap-3">
                <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <img
                    src={activeSignature.file.url}
                    alt={t.signaturePanel.previewAlt}
                    className="max-h-32 object-contain"
                  />
                </div>
                <div className="text-xs text-slate-600">
                  <p>{activeSignature.file.originalName}</p>
                  <p>
                    {formatBytes(activeSignature.file.size)} · {new Date(activeSignature.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-400">{t.signaturePanel.empty}</p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-500">{t.signaturePanel.history}</p>
            {loading ? (
              <p className="mt-3 text-xs text-slate-400">{t.signaturePanel.loading}</p>
            ) : signatures.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">{t.signaturePanel.empty}</p>
            ) : (
              <div className="mt-3 space-y-3">
                {signatures.map((signature) => (
                  <div
                    key={signature.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <div className="text-xs text-slate-600">
                      <p className="font-semibold text-slate-800">
                        {t.signaturePanel.versionLabel(signature.version)}{' '}
                        {signature.isActive ? (
                          <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            {t.signaturePanel.active}
                          </span>
                        ) : null}
                      </p>
                      <p>{signature.file.originalName}</p>
                      <p>
                        {formatBytes(signature.file.size)} · {new Date(signature.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {canUploadSignature && !signature.isActive ? (
                        <button
                          type="button"
                          onClick={() => handleActivate(signature.id)}
                          disabled={activatingId === signature.id}
                          className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {activatingId === signature.id
                            ? t.signaturePanel.activating
                            : t.signaturePanel.setActive}
                        </button>
                      ) : null}
                      {canDeleteSignature ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(signature.id)}
                          disabled={deletingId === signature.id}
                          className="rounded-full border border-rose-200 px-3 py-1 text-[10px] font-semibold text-rose-600 hover:border-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingId === signature.id
                            ? t.signaturePanel.deleting
                            : t.signaturePanel.delete}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">{t.signaturePanel.viewDenied}</p>
      )}
    </section>
  )
}
