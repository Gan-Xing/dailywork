'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { formatCopy, locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import type { FileRow, FilesQuery } from './types'

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200]

type Props = {
  query: FilesQuery
  rows: FileRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  canUpload: boolean
  canDelete: boolean
  categories: readonly string[]
}

type CandidateUser = {
  id: number
  name: string
  birthDate: string | null
}

const formatBytes = (size: number) => {
  if (!Number.isFinite(size)) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const parseSingle = (value?: string | string[]) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] ?? ''
  return value
}

export function FilesPageClient({
  query,
  rows,
  total,
  page,
  pageSize,
  totalPages,
  canUpload,
  canDelete,
  categories,
}: Props) {
  const router = useRouter()
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const [search, setSearch] = useState(() => parseSingle(query.search).trim())
  const [category, setCategory] = useState(() => parseSingle(query.category).trim())
  const [entityType, setEntityType] = useState(() => parseSingle(query.entityType).trim())
  const [entityId, setEntityId] = useState(() => parseSingle(query.entityId).trim())
  const [createdFrom, setCreatedFrom] = useState(() => parseSingle(query.createdFrom).trim())
  const [createdTo, setCreatedTo] = useState(() => parseSingle(query.createdTo).trim())
  const [pageInput, setPageInput] = useState(String(page))

  const defaultUploadCategory = useMemo(() => {
    if (categories.includes('attachment')) return 'attachment'
    return categories[0] ?? ''
  }, [categories])

  const [uploadCategory, setUploadCategory] = useState(defaultUploadCategory)
  const [uploadEntityType, setUploadEntityType] = useState('')
  const [uploadEntityId, setUploadEntityId] = useState('')
  const [uploadPurpose, setUploadPurpose] = useState('')
  const [uploadLabel, setUploadLabel] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [editingFile, setEditingFile] = useState<FileRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editEntityType, setEditEntityType] = useState('')
  const [editEntityId, setEditEntityId] = useState('')
  const [editPurpose, setEditPurpose] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [candidateUsers, setCandidateUsers] = useState<CandidateUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    const needUsers = uploadEntityType === 'user' || (!!editingFile && editEntityType === 'user')
    if (needUsers && candidateUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true)
      fetch('/api/members?basic=true')
        .then((res) => res.json())
        .then((data: { members: any[] }) => {
          setCandidateUsers(
            data.members.map((m) => ({
              id: m.id,
              name: m.name,
              birthDate: m.birthDate,
            })),
          )
        })
        .catch(() => {})
        .finally(() => setLoadingUsers(false))
    }
  }, [uploadEntityType, editEntityType, editingFile, candidateUsers.length, loadingUsers])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const categoryLabels = useMemo(() => copy.files.categories, [copy])

  const buildParams = (overrides: Partial<Record<string, string | number>>) => {
    const params = new URLSearchParams()
    const values = {
      search,
      category,
      entityType,
      entityId,
      createdFrom,
      createdTo,
      page,
      pageSize,
      ...overrides,
    }
    if (values.search) params.set('search', String(values.search))
    if (values.category) params.set('category', String(values.category))
    if (values.entityType) params.set('entityType', String(values.entityType))
    if (values.entityId) params.set('entityId', String(values.entityId))
    if (values.createdFrom) params.set('createdFrom', String(values.createdFrom))
    if (values.createdTo) params.set('createdTo', String(values.createdTo))
    if (values.pageSize) params.set('pageSize', String(values.pageSize))
    if (values.page) params.set('page', String(values.page))
    return params
  }

  const applyFilters = () => {
    const params = buildParams({ page: 1 })
    const queryString = params.toString()
    router.push(queryString ? `/documents/files?${queryString}` : '/documents/files')
  }

  const resetFilters = () => {
    router.push('/documents/files')
  }

  const handlePageChange = (next: number) => {
    const params = buildParams({ page: next })
    router.push(`/documents/files?${params.toString()}`)
  }

  const handlePageSizeChange = (next: number) => {
    const params = buildParams({ page: 1, pageSize: next })
    router.push(`/documents/files?${params.toString()}`)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setSelectedFile(file)
  }

  const resetUpload = () => {
    setSelectedFile(null)
    setUploadEntityType('')
    setUploadEntityId('')
    setUploadPurpose('')
    setUploadLabel('')
    setUploadError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedFile) {
      setUploadError(copy.files.messages.missingFile)
      return
    }
    if (!uploadCategory) {
      setUploadError(copy.files.messages.missingCategory)
      return
    }
    if ((uploadEntityType && !uploadEntityId) || (!uploadEntityType && uploadEntityId)) {
      setUploadError(copy.files.messages.invalidLink)
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const contentType = selectedFile.type || 'application/octet-stream'
      const uploadRes = await fetch('/api/files/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType,
          size: selectedFile.size,
          category: uploadCategory,
        }),
      })

      if (!uploadRes.ok) {
        const errorBody = await uploadRes.json().catch(() => ({}))
        throw new Error(errorBody.error ?? errorBody.message ?? copy.files.messages.uploadFailed)
      }

      const uploadPayload = (await uploadRes.json()) as {
        uploadUrl: string
        storageKey: string
        requiredHeaders?: Record<string, string>
      }

      const putRes = await fetch(uploadPayload.uploadUrl, {
        method: 'PUT',
        headers: uploadPayload.requiredHeaders,
        body: selectedFile,
      })

      if (!putRes.ok) {
        throw new Error(copy.files.messages.uploadFailed)
      }

      const links = uploadEntityType && uploadEntityId
        ? [
            {
              entityType: uploadEntityType.trim(),
              entityId: uploadEntityId.trim(),
              purpose: uploadPurpose.trim() || undefined,
              label: uploadLabel.trim() || undefined,
            },
          ]
        : []

      const finalizeRes = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: uploadPayload.storageKey,
          originalName: selectedFile.name,
          mimeType: contentType,
          size: selectedFile.size,
          category: uploadCategory,
          links,
        }),
      })

      if (!finalizeRes.ok) {
        const errorBody = await finalizeRes.json().catch(() => ({}))
        throw new Error(errorBody.message ?? copy.files.messages.uploadFailed)
      }

      resetUpload()
      router.refresh()
    } catch (error) {
      setUploadError((error as Error).message || copy.files.messages.uploadFailed)
    } finally {
      setUploading(false)
    }
  }

  const handleOpen = async (fileId: number) => {
    setOpeningId(fileId)
    try {
      const res = await fetch(`/api/files/${fileId}?includeUrl=1`)
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.message ?? copy.files.messages.openFailed)
      }
      const payload = (await res.json()) as { file?: { url?: string } }
      if (!payload.file?.url) {
        throw new Error(copy.files.messages.openFailed)
      }
      window.open(payload.file.url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert((error as Error).message || copy.files.messages.openFailed)
    } finally {
      setOpeningId(null)
    }
  }

  const handleEditClick = (row: FileRow) => {
    setEditingFile(row)
    setEditName(row.originalName)
    
    // Populate with first link if available
    const link = row.links[0]
    setEditEntityType(link?.entityType || '')
    setEditEntityId(link?.entityId || '')
    setEditPurpose(link?.purpose || '')
    setEditLabel(link?.label || '')
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFile || !editName.trim()) return
    setEditLoading(true)
    try {
      const links = (editEntityType && editEntityId)
        ? [{
            entityType: editEntityType.trim(),
            entityId: editEntityId.trim(),
            purpose: editPurpose.trim() || undefined,
            label: editLabel.trim() || undefined,
          }]
        : []

      const res = await fetch(`/api/files/${editingFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: editName.trim(),
          links,
        }),
      })
      if (!res.ok) throw new Error()
      setEditingFile(null)
      router.refresh()
    } catch {
      alert(copy.files.editDialog.failed)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async (fileId: number, locked: boolean) => {
    if (locked) {
      alert(copy.files.table.deleteBlocked)
      return
    }
    if (!confirm(copy.files.table.deleteConfirm)) return
    setDeletingId(fileId)
    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.message ?? copy.files.messages.deleteFailed)
      }
      router.refresh()
    } catch (error) {
      alert((error as Error).message || copy.files.messages.deleteFailed)
    } finally {
      setDeletingId(null)
    }
  }

  const renderLinkSummary = (links: FileRow['links']) => {
    if (!links.length) return '-'
    const labels = links.map((link) => link.label || `${link.entityType}#${link.entityId}`)
    if (labels.length <= 2) return labels.join(', ')
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        variant="light"
        items={[
          { label: copy.breadcrumbs.home, href: '/' },
          { label: copy.breadcrumbs.documents, href: '/documents' },
          { label: copy.breadcrumbs.files },
        ]}
      />

      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {copy.files.badge.title}
        <span className="h-[1px] w-10 bg-emerald-200" />
        {copy.files.badge.suffix}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{copy.files.title}</h1>
            <p className="max-w-2xl text-slate-600">{copy.files.description}</p>
          </div>
        </div>
      </div>

      {canUpload ? (
        <form onSubmit={handleUpload} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">{copy.files.uploadPanel.title}</h2>
              <p className="text-sm text-slate-500">{copy.files.uploadPanel.helper}</p>
            </div>
            <button
              type="button"
              onClick={resetUpload}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            >
              {copy.files.uploadPanel.reset}
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,1fr]">
            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">{copy.files.uploadPanel.categoryLabel}</span>
                <select
                  value={uploadCategory}
                  onChange={(event) => setUploadCategory(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                >
                  <option value="">{copy.files.uploadPanel.categoryPlaceholder}</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {categoryLabels[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">{copy.files.uploadPanel.fileLabel}</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700"
                />
                {selectedFile ? (
                  <span className="text-xs text-slate-500">{selectedFile.name}</span>
                ) : null}
              </label>
            </div>
            <div className="space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-sm font-semibold text-slate-700">{copy.files.uploadPanel.linkTitle}</div>
                <div className="text-xs text-slate-500">{copy.files.uploadPanel.linkHint}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs text-slate-600">
                  <span>{copy.files.uploadPanel.entityType}</span>
                  <select
                    value={uploadEntityType}
                    onChange={(event) => {
                      setUploadEntityType(event.target.value)
                      if (event.target.value === 'user') {
                        setUploadEntityId('')
                      }
                    }}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                  >
                    <option value="">{copy.files.uploadPanel.categoryPlaceholder}</option>
                    {Object.entries(copy.files.uploadPanel.entityTypes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs text-slate-600">
                  <span>{copy.files.uploadPanel.entityId}</span>
                  {uploadEntityType === 'user' ? (
                    <select
                      value={uploadEntityId}
                      onChange={(event) => setUploadEntityId(event.target.value)}
                      disabled={loadingUsers}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none disabled:bg-slate-100"
                    >
                      <option value="">{loadingUsers ? 'Loading...' : copy.files.uploadPanel.categoryPlaceholder}</option>
                      {candidateUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} {user.birthDate ? `(${user.birthDate.split('T')[0]})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={uploadEntityId}
                      onChange={(event) => setUploadEntityId(event.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                    />
                  )}
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs text-slate-600">
                  <span>{copy.files.uploadPanel.purpose}</span>
                  <input
                    value={uploadPurpose}
                    onChange={(event) => setUploadPurpose(event.target.value)}
                    list="purpose-options"
                    placeholder={copy.files.uploadPanel.purposePlaceholder}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                  />
                  <datalist id="purpose-options">
                    {Object.entries(copy.files.uploadPanel.purposes).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </datalist>
                </label>
                <label className="flex flex-col gap-2 text-xs text-slate-600">
                  <span>{copy.files.uploadPanel.label}</span>
                  <input
                    value={uploadLabel}
                    onChange={(event) => setUploadLabel(event.target.value)}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
          {uploadError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {uploadError}
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-slate-500">{copy.files.uploadPanel.hint}</span>
            <button
              type="submit"
              disabled={uploading}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-emerald-200/60 disabled:cursor-not-allowed disabled:bg-emerald-300"
            >
              {uploading ? copy.files.uploadPanel.uploading : copy.files.uploadPanel.upload}
            </button>
          </div>
        </form>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">{copy.files.filters.title}</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr,1fr,1fr]">
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.categoryLabel}</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            >
              <option value="">{copy.files.filters.allLabel}</option>
              {categories.map((value) => (
                <option key={value} value={value}>
                  {categoryLabels[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.entityTypeLabel}</span>
            <input
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.entityIdLabel}</span>
            <input
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.dateFromLabel}</span>
            <input
              type="date"
              value={createdFrom}
              onChange={(event) => setCreatedFrom(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.dateToLabel}</span>
            <input
              type="date"
              value={createdTo}
              onChange={(event) => setCreatedTo(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.keywordLabel}</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.files.filters.keywordPlaceholder}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          >
            {copy.files.filters.reset}
          </button>
          <button
            type="button"
            onClick={applyFilters}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow transition hover:-translate-y-0.5 hover:shadow-emerald-200/60"
          >
            {copy.files.filters.apply}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-md">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{copy.files.table.title}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left">{copy.files.table.columns.file}</th>
                <th className="px-6 py-3 text-left">{copy.files.table.columns.category}</th>
                <th className="px-6 py-3 text-left">{copy.files.table.columns.links}</th>
                <th className="px-6 py-3 text-left">{copy.files.table.columns.owner}</th>
                <th className="px-6 py-3 text-left">{copy.files.table.columns.createdBy}</th>
                <th className="px-6 py-3 text-left">{copy.files.table.columns.createdAt}</th>
                <th className="px-6 py-3 text-right">{copy.files.table.columns.actions}</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-slate-500">
                    {copy.files.table.empty}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const isLocked = row.linkCount > 0 || row.signatureCount > 0
                  return (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-800">{row.originalName}</div>
                          <div className="text-xs text-slate-400">
                            {row.mimeType || '—'} · {formatBytes(row.size)}
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            {row.linkCount > 0 ? (
                              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                {copy.files.table.badges.linked}
                              </span>
                            ) : null}
                            {row.signatureCount > 0 ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-600">
                                {copy.files.table.badges.signature}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {categoryLabels[row.category] ?? row.category}
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[220px] truncate">{renderLinkSummary(row.links)}</div>
                      </td>
                      <td className="px-6 py-4">{row.ownerUser || '—'}</td>
                      <td className="px-6 py-4">{row.createdBy || '—'}</td>
                      <td className="px-6 py-4" suppressHydrationWarning>{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditClick(row)}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          >
                            {copy.files.table.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpen(row.id)}
                            disabled={openingId === row.id}
                            className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                          >
                            {copy.files.table.actions.open}
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id, isLocked)}
                              disabled={deletingId === row.id}
                              className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-40"
                            >
                              {copy.files.table.actions.delete}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
          <span>
            {formatCopy(copy.files.pagination.summary, {
              total,
              page,
              totalPages,
            })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span className="text-slate-400">{copy.files.pagination.pageSizeLabel}</span>
              <select
                value={pageSize}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (!Number.isFinite(value)) return
                  handlePageSizeChange(value)
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-300 focus:outline-none"
                aria-label={copy.files.pagination.pageSizeLabel}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => handlePageChange(Math.max(1, page - 1))}
            >
              {copy.files.pagination.prev}
            </button>
            <div className="flex items-center gap-1 text-xs text-slate-600">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                onBlur={() => {
                  const value = Number(pageInput)
                  if (!Number.isFinite(value)) {
                    setPageInput(String(page))
                    return
                  }
                  const next = Math.min(totalPages, Math.max(1, Math.round(value)))
                  if (next !== page) handlePageChange(next)
                  setPageInput(String(next))
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    const value = Number(pageInput)
                    const next = Number.isFinite(value)
                      ? Math.min(totalPages, Math.max(1, Math.round(value)))
                      : page
                    if (next !== page) handlePageChange(next)
                    setPageInput(String(next))
                  }
                }}
                className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2 py-1 text-center text-xs text-slate-700 focus:border-emerald-300 focus:outline-none"
                aria-label={copy.files.pagination.goTo}
              />
              <span className="text-slate-400">/ {totalPages}</span>
            </div>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
            >
              {copy.files.pagination.next}
            </button>
          </div>
        </div>
      </div>

      {editingFile && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <form
            onSubmit={submitEdit}
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200"
          >
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">{copy.files.editDialog.title}</h3>
            </div>
            <div className="max-h-[80vh] overflow-y-auto p-6">
              <div className="space-y-4">
                <label className="flex flex-col gap-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">{copy.files.editDialog.nameLabel}</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                    autoFocus
                  />
                </label>

                <div className="space-y-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{copy.files.uploadPanel.linkTitle}</div>
                    <div className="text-xs text-slate-500">{copy.files.uploadPanel.linkHint}</div>
                  </div>
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      <span>{copy.files.uploadPanel.entityType}</span>
                      <select
                        value={editEntityType}
                        onChange={(event) => {
                          setEditEntityType(event.target.value)
                          if (event.target.value === 'user') {
                            setEditEntityId('')
                          }
                        }}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                      >
                        <option value="">{copy.files.uploadPanel.categoryPlaceholder}</option>
                        {Object.entries(copy.files.uploadPanel.entityTypes).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      <span>{copy.files.uploadPanel.entityId}</span>
                      {editEntityType === 'user' ? (
                        <select
                          value={editEntityId}
                          onChange={(event) => setEditEntityId(event.target.value)}
                          disabled={loadingUsers}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none disabled:bg-slate-100"
                        >
                          <option value="">{loadingUsers ? 'Loading...' : copy.files.uploadPanel.categoryPlaceholder}</option>
                          {candidateUsers.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name} {user.birthDate ? `(${user.birthDate.split('T')[0]})` : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={editEntityId}
                          onChange={(event) => setEditEntityId(event.target.value)}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                        />
                      )}
                    </label>
                  </div>
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      <span>{copy.files.uploadPanel.purpose}</span>
                      <input
                        value={editPurpose}
                        onChange={(event) => setEditPurpose(event.target.value)}
                        list="edit-purpose-options"
                        placeholder={copy.files.uploadPanel.purposePlaceholder}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                      />
                      <datalist id="edit-purpose-options">
                        {Object.entries(copy.files.uploadPanel.purposes).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      <span>{copy.files.uploadPanel.label}</span>
                      <input
                        value={editLabel}
                        onChange={(event) => setEditLabel(event.target.value)}
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingFile(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  disabled={editLoading}
                >
                  {copy.files.editDialog.cancel}
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:bg-emerald-300"
                >
                  {editLoading ? copy.files.editDialog.saving : copy.files.editDialog.save}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
