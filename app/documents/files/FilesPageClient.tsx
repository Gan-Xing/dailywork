'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { MultiSelectFilter, type MultiSelectOption } from '@/components/MultiSelectFilter'
import { FILE_LINK_ENTITY_TYPES } from '@/lib/constants/fileLinkEntityTypes'
import { PHOTO_CATEGORIES } from '@/lib/constants/fileCategories'
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
  nationality: string | null
  birthDate: string | null
}

type BoqItemRecord = {
  id: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  projectId: number
  project: { id: number; name: string; code: string | null }
}

type BoqItemMeta = {
  id: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  projectId: number
  projectName: string
  projectCode: string | null
}

type LeaderLogOptionRecord = {
  id: number
  date: string
  supervisorId: number
  supervisorName: string
}

type LeaderLogMeta = LeaderLogOptionRecord

type EditableFileLink = {
  id?: number
  entityType: string
  entityId: string
  purpose?: string | null
  label?: string | null
  meta?: unknown
}

const formatBytes = (size: number) => {
  if (!Number.isFinite(size)) return '-'
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

const fileKey = (file: File) => `${file.name}-${file.size}-${file.lastModified}`

const mergeFiles = (current: File[], incoming: File[]) => {
  if (incoming.length === 0) return current
  const seen = new Set(current.map(fileKey))
  const next = [...current]
  incoming.forEach((file) => {
    const key = fileKey(file)
    if (seen.has(key)) return
    seen.add(key)
    next.push(file)
  })
  return next
}

const parseString = (value?: string | string[]) => {
  if (!value) return ''
  if (Array.isArray(value)) return value.join(',')
  return value
}

const normalizeBoqLabelText = (value: string) => value.replace(/\s+/g, ' ').trim()

const resolveBoqProjectLabel = (projectName: string, projectCode: string | null, locale: string) => {
  const rawProjectName = normalizeBoqLabelText(projectName || '')
  const code = projectCode ?? ''
  const isBondoukou = code === 'project-bondoukou-city' || rawProjectName.includes('邦杜库')
  const isTanda = code === 'project-tanda-city' || rawProjectName.includes('丹达')
  if (isBondoukou) return locale === 'fr' ? 'Voiries de Bondoukou' : '邦杜库市政'
  if (isTanda) return locale === 'fr' ? 'Voiries de Tanda' : '丹达市政'
  if (rawProjectName) return rawProjectName
  return locale === 'fr' ? 'Projet sans nom' : '未命名项目'
}

const resolveBoqDesignation = (designationZh: string, designationFr: string, locale: string) => {
  const zh = normalizeBoqLabelText(designationZh || '')
  const fr = normalizeBoqLabelText(designationFr || '')
  if (locale === 'fr') return fr || zh
  return zh || fr
}

const toBoqItemMeta = (item: BoqItemRecord): BoqItemMeta => ({
  id: item.id,
  code: item.code,
  designationZh: item.designationZh,
  designationFr: item.designationFr,
  unit: item.unit,
  projectId: item.projectId,
  projectName: item.project.name,
  projectCode: item.project.code,
})

const formatBoqItemLabel = (item: BoqItemMeta, locale: string) => {
  const projectLabel = resolveBoqProjectLabel(item.projectName, item.projectCode, locale)
  const designation = resolveBoqDesignation(item.designationZh, item.designationFr, locale)
  const code = normalizeBoqLabelText(item.code || '')
  return [projectLabel, code, designation].filter(Boolean).join(' · ')
}

const formatBoqMetaLabel = (meta: {
  boqItemCode?: string
  designationZh?: string
  designationFr?: string
  projectName?: string
  projectCode?: string | null
}, locale: string) => {
  const projectLabel = resolveBoqProjectLabel(meta.projectName ?? '', meta.projectCode ?? null, locale)
  const designation = resolveBoqDesignation(meta.designationZh ?? '', meta.designationFr ?? '', locale)
  const code = normalizeBoqLabelText(meta.boqItemCode ?? '')
  if (!projectLabel && !code && !designation) return ''
  return [projectLabel, code, designation].filter(Boolean).join(' · ')
}

const formatLeaderLogMetaLabel = (meta: { date?: string; supervisorName?: string }) => {
  const date = meta.date?.trim() ?? ''
  const supervisor = meta.supervisorName?.trim() ?? ''
  return [date, supervisor].filter(Boolean).join(' · ')
}

const buildBoqLinkMeta = (item: BoqItemMeta) => ({
  boqItemCode: item.code,
  designationZh: item.designationZh,
  designationFr: item.designationFr,
  projectId: item.projectId,
  projectName: item.projectName,
  projectCode: item.projectCode,
  unit: item.unit,
})

const buildLeaderLogLinkMeta = (item: LeaderLogMeta) => ({
  date: item.date,
  supervisorId: item.supervisorId,
  supervisorName: item.supervisorName,
})

const useBoqItemSearch = (locale: string, cacheRef: { current: Map<string, BoqItemMeta> }) => {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<MultiSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = search.trim()
    const controller = new AbortController()
    const handle = setTimeout(() => {
      setLoading(true)
      const query = term ? `?search=${encodeURIComponent(term)}` : ''
      fetch(`/api/value/boq-items/search${query}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('failed')
          return res.json()
        })
        .then((data: { items?: BoqItemRecord[] }) => {
          const items = Array.isArray(data.items) ? data.items : []
          const metas = items.map(toBoqItemMeta)
          metas.forEach((meta) => cacheRef.current.set(String(meta.id), meta))
          setOptions(
            metas.map((meta) => ({
              value: String(meta.id),
              label: formatBoqItemLabel(meta, locale),
            })),
          )
          setError(null)
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return
          setOptions([])
          setError('failed')
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [search, locale, cacheRef])

  return { search, setSearch, options, loading, error }
}

const useLeaderLogSearch = (cacheRef: { current: Map<string, LeaderLogMeta> }) => {
  const [search, setSearch] = useState('')
  const [options, setOptions] = useState<MultiSelectOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const term = search.trim()
    const controller = new AbortController()
    const handle = setTimeout(() => {
      setLoading(true)
      const query = term ? `?search=${encodeURIComponent(term)}` : ''
      fetch(`/api/leader-logs/options${query}`, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error('failed')
          return res.json()
        })
        .then((data: { items?: LeaderLogOptionRecord[] }) => {
          const items = Array.isArray(data.items) ? data.items : []
          items.forEach((item) => cacheRef.current.set(String(item.id), item))
          setOptions(
            items.map((item) => ({
              value: String(item.id),
              label: [item.date, item.supervisorName].filter(Boolean).join(' · '),
            })),
          )
          setError(null)
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') return
          setOptions([])
          setError('failed')
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => {
      clearTimeout(handle)
      controller.abort()
    }
  }, [search, cacheRef])

  return { search, setSearch, options, loading, error }
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
  const [search, setSearch] = useState(() => parseString(query.search).trim())
  const [category, setCategory] = useState(() => parseString(query.category).trim())
  const [entityType, setEntityType] = useState(() => parseString(query.entityType).trim())
  const [entityId, setEntityId] = useState(() => parseString(query.entityId).trim())
  const [createdFrom, setCreatedFrom] = useState(() => parseString(query.createdFrom).trim())
  const [createdTo, setCreatedTo] = useState(() => parseString(query.createdTo).trim())
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
  const [uploadUserIds, setUploadUserIds] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [editingFile, setEditingFile] = useState<FileRow | null>(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editEntityType, setEditEntityType] = useState('')
  const [editEntityId, setEditEntityId] = useState('')
  const [editUserIds, setEditUserIds] = useState<string[]>([])
  const [editPurpose, setEditPurpose] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editLinks, setEditLinks] = useState<EditableFileLink[]>([])
  const [editLinkError, setEditLinkError] = useState<string | null>(null)
  const [editLoading, setEditLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const dragDepthRef = useRef(0)
  const boqItemCacheRef = useRef(new Map<string, BoqItemMeta>())
  const leaderLogCacheRef = useRef(new Map<string, LeaderLogMeta>())

  const [candidateUsers, setCandidateUsers] = useState<CandidateUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const uploadBoqSearch = useBoqItemSearch(locale, boqItemCacheRef)
  const editBoqSearch = useBoqItemSearch(locale, boqItemCacheRef)
  const filterBoqSearch = useBoqItemSearch(locale, boqItemCacheRef)
  const uploadLeaderLogSearch = useLeaderLogSearch(leaderLogCacheRef)
  const editLeaderLogSearch = useLeaderLogSearch(leaderLogCacheRef)
  const filterLeaderLogSearch = useLeaderLogSearch(leaderLogCacheRef)

  useEffect(() => {
    const needUsers =
      uploadEntityType === 'user' || (!!editingFile && editEntityType === 'user') || entityType === 'user'
    if (needUsers && candidateUsers.length === 0 && !loadingUsers) {
      setLoadingUsers(true)
      fetch('/api/members?basic=true')
        .then((res) => res.json())
        .then((data: { members: any[] }) => {
          const mapped = data.members.map((m) => ({
            id: m.id,
            name: m.name,
            nationality: m.nationality,
            birthDate: m.birthDate,
          })) as CandidateUser[]

          mapped.sort((a, b) => {
            const aIsChina = a.nationality === 'china'
            const bIsChina = b.nationality === 'china'
            if (aIsChina && !bIsChina) return -1
            if (!aIsChina && bIsChina) return 1
            return 0
          })

          setCandidateUsers(mapped)
        })
        .catch(() => {})
        .finally(() => setLoadingUsers(false))
    }
  }, [uploadEntityType, editEntityType, editingFile, entityType, candidateUsers.length, loadingUsers])

  useEffect(() => {
    setPageInput(String(page))
  }, [page])

  const categoryLabels = useMemo(() => copy.files.categories, [copy])
  const entityTypeOptions = useMemo(
    () =>
      FILE_LINK_ENTITY_TYPES.map((key) => ({
        value: key,
        label: copy.files.uploadPanel.entityTypes[key] ?? key,
      })),
    [copy],
  )
  const isPhotoCategory = useMemo(
    () => PHOTO_CATEGORIES.includes(uploadCategory as (typeof PHOTO_CATEGORIES)[number]),
    [uploadCategory],
  )

  const buildBoqLinkPayload = (entityId: string, labelOverride?: string) => {
    const meta = boqItemCacheRef.current.get(entityId)
    const label = labelOverride?.trim() || (meta ? formatBoqItemLabel(meta, locale) : '')
    return {
      entityType: 'actual-boq-item',
      entityId,
      label: label || undefined,
      meta: meta ? buildBoqLinkMeta(meta) : undefined,
    }
  }

  const buildLeaderLogLinkPayload = (entityId: string, labelOverride?: string) => {
    const meta = leaderLogCacheRef.current.get(entityId)
    const label =
      labelOverride?.trim() ||
      (meta ? [meta.date, meta.supervisorName].filter(Boolean).join(' · ') : '')
    return {
      entityType: 'leader-log',
      entityId,
      label: label || undefined,
      meta: meta ? buildLeaderLogLinkMeta(meta) : undefined,
    }
  }

  const renderBoqItemSelect = ({
    selected,
    onChange,
    searchState,
    multiple,
    zIndex,
    allLabel,
    disabled,
  }: {
    selected: string[]
    onChange: (next: string[]) => void
    searchState: ReturnType<typeof useBoqItemSearch>
    multiple: boolean
    zIndex: number
    allLabel: string
    disabled?: boolean
  }) => {
    const noOptionsLabel = searchState.error
      ? copy.files.messages.boqItemLoadFailed
      : copy.files.messages.boqItemSearchHint

    return (
      <MultiSelectFilter
        variant="form"
        label=""
        options={searchState.options}
        selected={selected}
        onChange={onChange}
        allLabel={allLabel}
        selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
        selectAllLabel={copy.files.dropdown.selectAll}
        clearLabel={copy.files.dropdown.clear}
        searchPlaceholder={copy.files.dropdown.search}
        noOptionsLabel={noOptionsLabel}
        multiple={multiple}
        zIndex={zIndex}
        disabled={disabled}
        searchValue={searchState.search}
        onSearchChange={searchState.setSearch}
      />
    )
  }

  const renderLeaderLogSelect = ({
    selected,
    onChange,
    searchState,
    multiple,
    zIndex,
    allLabel,
    disabled,
  }: {
    selected: string[]
    onChange: (next: string[]) => void
    searchState: ReturnType<typeof useLeaderLogSearch>
    multiple: boolean
    zIndex: number
    allLabel: string
    disabled?: boolean
  }) => {
    const noOptionsLabel = searchState.error
      ? copy.files.messages.leaderLogLoadFailed
      : copy.files.messages.leaderLogSearchHint

    return (
      <MultiSelectFilter
        variant="form"
        label=""
        options={searchState.options}
        selected={selected}
        onChange={onChange}
        allLabel={allLabel}
        selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
        selectAllLabel={copy.files.dropdown.selectAll}
        clearLabel={copy.files.dropdown.clear}
        searchPlaceholder={copy.files.dropdown.search}
        noOptionsLabel={noOptionsLabel}
        multiple={multiple}
        zIndex={zIndex}
        disabled={disabled}
        searchValue={searchState.search}
        onSearchChange={searchState.setSearch}
      />
    )
  }

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

  const setFileSelection = (files: File[]) => {
    const next = files.filter((file) => file instanceof File)
    if (next.length === 0) return
    setSelectedFiles((current) => mergeFiles(current, next))
    setUploadError(null)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    setFileSelection(files)
  }

  const openFileDialog = () => {
    if (uploading) return
    fileInputRef.current?.click()
  }

  const openCameraDialog = () => {
    if (uploading) return
    cameraInputRef.current?.click()
  }

  const handleDropzoneKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFileDialog()
    }
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setIsDragging(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)
    if (uploading) return
    const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []
    if (files.length > 0) {
      setFileSelection(files)
    }
  }

  const resetUpload = () => {
    setSelectedFiles([])
    setIsDragging(false)
    dragDepthRef.current = 0
    setUploadEntityType('')
    setUploadEntityId('')
    setUploadUserIds([])
    setUploadPurpose('')
    setUploadLabel('')
    setUploadError(null)
    uploadBoqSearch.setSearch('')
    uploadLeaderLogSearch.setSearch('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    if (cameraInputRef.current) {
      cameraInputRef.current.value = ''
    }
  }

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (selectedFiles.length === 0) {
      setUploadError(copy.files.messages.missingFile)
      return
    }
    if (!uploadCategory) {
      setUploadError(copy.files.messages.missingCategory)
      return
    }
    const isUserType = uploadEntityType === 'user'
    const hasUserIds = isUserType && uploadUserIds.length > 0
    const hasEntityId = !isUserType && uploadEntityType && uploadEntityId

    if ((uploadEntityType && !hasUserIds && !hasEntityId) || (!uploadEntityType && (uploadEntityId || uploadUserIds.length > 0))) {
      setUploadError(copy.files.messages.invalidLink)
      return
    }

    let links: any[] = []
    if (uploadEntityType) {
      if (isUserType) {
        links = uploadUserIds.map((id) => ({
          entityType: 'user',
          entityId: id,
          purpose: uploadPurpose.trim() || undefined,
          label: uploadLabel.trim() || undefined,
        }))
      } else if (uploadEntityId) {
        if (uploadEntityType === 'actual-boq-item') {
          const payload = buildBoqLinkPayload(uploadEntityId.trim(), uploadLabel.trim() || undefined)
          links = [
            {
              ...payload,
              purpose: uploadPurpose.trim() || undefined,
            },
          ]
        } else if (uploadEntityType === 'leader-log') {
          const payload = buildLeaderLogLinkPayload(uploadEntityId.trim(), uploadLabel.trim() || undefined)
          links = [
            {
              ...payload,
              purpose: uploadPurpose.trim() || undefined,
            },
          ]
        } else {
          links = [
            {
              entityType: uploadEntityType.trim(),
              entityId: uploadEntityId.trim(),
              purpose: uploadPurpose.trim() || undefined,
              label: uploadLabel.trim() || undefined,
            },
          ]
        }
      }
    }

    setUploading(true)
    setUploadError(null)
    try {
      for (const file of selectedFiles) {
        const contentType = file.type || 'application/octet-stream'
        const uploadRes = await fetch('/api/files/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            size: file.size,
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
          body: file,
        })

        if (!putRes.ok) {
          throw new Error(copy.files.messages.uploadFailed)
        }

        const finalizeRes = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageKey: uploadPayload.storageKey,
            originalName: file.name,
            mimeType: contentType,
            size: file.size,
            category: uploadCategory,
            links,
          }),
        })

        if (!finalizeRes.ok) {
          const errorBody = await finalizeRes.json().catch(() => ({}))
          throw new Error(errorBody.message ?? copy.files.messages.uploadFailed)
        }
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
      const payload = (await res.json()) as { file?: { url?: string; previewUrl?: string } }
      const targetUrl = payload.file?.previewUrl || payload.file?.url
      if (!targetUrl) {
        throw new Error(copy.files.messages.openFailed)
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      alert((error as Error).message || copy.files.messages.openFailed)
    } finally {
      setOpeningId(null)
    }
  }

  const handleEditClick = (row: FileRow) => {
    setEditingFile(row)
    setEditName(row.originalName)
    setEditCategory(row.category)
    setEditLinks(
      row.links.map((link) => ({
        id: link.id,
        entityType: link.entityType,
        entityId: link.entityId,
        purpose: link.purpose,
        label: link.label,
        meta: link.meta ?? null,
      })),
    )
    setEditEntityType('')
    setEditEntityId('')
    setEditUserIds([])
    setEditPurpose('')
    setEditLabel('')
    setEditLinkError(null)
    editBoqSearch.setSearch('')
    editLeaderLogSearch.setSearch('')
  }

  const handleAddEditLink = () => {
    setEditLinkError(null)
    const nextType = editEntityType.trim()
    const nextPurpose = editPurpose.trim() || undefined
    const nextLabel = editLabel.trim() || undefined

    if (!nextType) {
      setEditLinkError(copy.files.messages.invalidLink)
      return
    }

    const existing = new Set(editLinks.map((link) => `${link.entityType}:${link.entityId}`))
    const nextLinks: EditableFileLink[] = []

    if (nextType === 'user') {
      if (editUserIds.length === 0) {
        setEditLinkError(copy.files.messages.invalidLink)
        return
      }
      editUserIds.forEach((id) => {
        const key = `${nextType}:${id}`
        if (existing.has(key)) return
        existing.add(key)
        nextLinks.push({
          entityType: 'user',
          entityId: id,
          purpose: nextPurpose ?? null,
          label: nextLabel ?? null,
        })
      })
    } else {
      const entityId = editEntityId.trim()
      if (!entityId) {
        setEditLinkError(copy.files.messages.invalidLink)
        return
      }
      const key = `${nextType}:${entityId}`
      if (!existing.has(key)) {
        if (nextType === 'actual-boq-item') {
          const payload = buildBoqLinkPayload(entityId, nextLabel)
          nextLinks.push({
            entityType: payload.entityType,
            entityId: payload.entityId,
            purpose: nextPurpose ?? null,
            label: payload.label ?? null,
            meta: payload.meta ?? null,
          })
        } else if (nextType === 'leader-log') {
          const payload = buildLeaderLogLinkPayload(entityId, nextLabel)
          nextLinks.push({
            entityType: payload.entityType,
            entityId: payload.entityId,
            purpose: nextPurpose ?? null,
            label: payload.label ?? null,
            meta: payload.meta ?? null,
          })
        } else {
          nextLinks.push({
            entityType: nextType,
            entityId,
            purpose: nextPurpose ?? null,
            label: nextLabel ?? null,
          })
        }
      }
    }

    if (nextLinks.length === 0) {
      setEditLinkError(copy.files.messages.invalidLink)
      return
    }

    setEditLinks((current) => [...current, ...nextLinks])
    setEditEntityId('')
    setEditUserIds([])
    setEditPurpose('')
    setEditLabel('')
    setEditLinkError(null)
    editBoqSearch.setSearch('')
  }

  const handleRemoveEditLink = (index: number) => {
    setEditLinks((current) => current.filter((_, idx) => idx !== index))
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingFile || !editName.trim()) return
    if (!editCategory) {
      alert(copy.files.messages.missingCategory)
      return
    }
    setEditLoading(true)
    try {
      const links = editLinks.map((link) => ({
        entityType: link.entityType.trim(),
        entityId: link.entityId.trim(),
        purpose: link.purpose?.trim() || undefined,
        label: link.label?.trim() || undefined,
        meta: link.meta ?? undefined,
      }))

      if (links.some((link) => !link.entityType || !link.entityId)) {
        alert(copy.files.messages.invalidLink)
        return
      }

      const res = await fetch(`/api/files/${editingFile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalName: editName.trim(),
          category: editCategory,
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

  const handleDownload = async (fileId: number, originalName: string) => {
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
      const link = document.createElement('a')
      link.href = payload.file.url
      link.download = originalName
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      alert((error as Error).message || copy.files.messages.openFailed)
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
    const labels = links.map((link) => {
      const directLabel = link.label?.trim()
      if (directLabel) return directLabel
      if (link.entityType === 'leader-log') {
        const metaRecord = link.meta as { date?: string; supervisorName?: string } | null
        const metaLabel = metaRecord ? formatLeaderLogMetaLabel(metaRecord) : ''
        return metaLabel || `${link.entityType}#${link.entityId}`
      }
      const metaRecord = link.meta as
        | {
            boqItemCode?: string
            designationZh?: string
            designationFr?: string
            projectName?: string
            projectCode?: string | null
          }
        | null
      const metaLabel = metaRecord ? formatBoqMetaLabel(metaRecord, locale) : ''
      return metaLabel || `${link.entityType}#${link.entityId}`
    })
    if (labels.length <= 2) return labels.join(', ')
    return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`
  }

  return (
    <div className="space-y-6">
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
              <div className="space-y-2 text-sm text-slate-600">
                <span className="font-semibold text-slate-700">{copy.files.uploadPanel.fileLabel}</span>
                {isPhotoCategory ? (
                  <div className="grid gap-3 sm:hidden">
                    <button
                      type="button"
                      onClick={openCameraDialog}
                      disabled={uploading}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-left text-sm font-semibold text-emerald-700 transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(16,185,129,0.6)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>{copy.files.uploadPanel.cameraAction}</span>
                      <span className="rounded-full border border-emerald-200 bg-white px-2 py-1 text-[11px] text-emerald-700">
                        {copy.files.uploadPanel.dropAction}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={openFileDialog}
                      disabled={uploading}
                      className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>{copy.files.uploadPanel.albumAction}</span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                        {copy.files.uploadPanel.dropAction}
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={openFileDialog}
                    disabled={uploading}
                    className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-12px_rgba(15,23,42,0.25)] disabled:cursor-not-allowed disabled:opacity-60 sm:hidden"
                  >
                    <span>{copy.files.uploadPanel.fileLabel}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
                      {copy.files.uploadPanel.dropAction}
                    </span>
                  </button>
                )}
                {selectedFiles.length > 0 ? (
                  <div className="mt-2 space-y-2 text-xs text-slate-600 sm:hidden">
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                      <span className="font-semibold text-emerald-700">{copy.files.uploadPanel.selectedLabel}</span>
                      <span>{formatCopy(copy.files.uploadPanel.selectedCount, { count: selectedFiles.length })}</span>
                      <span className="text-slate-400">•</span>
                      <span>{formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))}</span>
                    </div>
                    <div className="grid gap-1">
                      {selectedFiles.slice(0, 3).map((file) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1"
                        >
                          <span className="min-w-0 truncate text-slate-700">{file.name}</span>
                          <span className="shrink-0 text-slate-400">{formatBytes(file.size)}</span>
                        </div>
                      ))}
                      {selectedFiles.length > 3 ? (
                        <div className="text-[11px] text-slate-500">
                          {formatCopy(copy.files.uploadPanel.selectedMore, {
                            count: selectedFiles.length - 3,
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div
                  role="button"
                  tabIndex={0}
                  aria-disabled={uploading}
                  aria-label={copy.files.uploadPanel.dropTitle}
                  onClick={openFileDialog}
                  onKeyDown={handleDropzoneKeyDown}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`hidden rounded-2xl border border-dashed px-4 py-4 transition sm:block ${
                    isDragging
                      ? 'border-emerald-300 bg-emerald-50/80 shadow-[0_0_0_4px_rgba(16,185,129,0.12)]'
                      : selectedFiles.length > 0
                        ? 'border-emerald-200 bg-emerald-50/40'
                        : 'border-slate-200 bg-slate-50 hover:border-emerald-200 hover:bg-emerald-50/40'
                  } ${uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V7m0 0-3 3m3-3 3 3" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-700">{copy.files.uploadPanel.dropTitle}</div>
                        <div className="text-xs text-slate-500">{copy.files.uploadPanel.dropSubtitle}</div>
                      </div>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                      {copy.files.uploadPanel.dropAction}
                    </span>
                  </div>
                  {selectedFiles.length > 0 ? (
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                        <span className="font-semibold text-emerald-700">{copy.files.uploadPanel.selectedLabel}</span>
                        <span>{formatCopy(copy.files.uploadPanel.selectedCount, { count: selectedFiles.length })}</span>
                        <span className="text-slate-400">•</span>
                        <span>{formatBytes(selectedFiles.reduce((total, file) => total + file.size, 0))}</span>
                      </div>
                      <div className="grid gap-1">
                        {selectedFiles.slice(0, 3).map((file) => (
                          <div
                            key={`${file.name}-${file.size}-${file.lastModified}`}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1"
                          >
                            <span className="min-w-0 truncate text-slate-700">{file.name}</span>
                            <span className="shrink-0 text-slate-400">{formatBytes(file.size)}</span>
                          </div>
                        ))}
                        {selectedFiles.length > 3 ? (
                          <div className="text-[11px] text-slate-500">
                            {formatCopy(copy.files.uploadPanel.selectedMore, {
                              count: selectedFiles.length - 3,
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-slate-500">{copy.files.uploadPanel.dropHint}</div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  accept={isPhotoCategory ? 'image/*' : undefined}
                  className="sr-only"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </div>
            </div>
            <div className="space-y-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
              <div>
                <div className="text-sm font-semibold text-slate-700">{copy.files.uploadPanel.linkTitle}</div>
                <div className="text-xs text-slate-500">{copy.files.uploadPanel.linkHint}</div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs text-slate-600">
                  <span>{copy.files.uploadPanel.entityType}</span>
                  <MultiSelectFilter
                    variant="form"
                    label=""
                    options={entityTypeOptions}
                    selected={uploadEntityType ? [uploadEntityType] : []}
                    onChange={(vals) => {
                      const next = vals[0] || ''
                      setUploadEntityType(next)
                      setUploadEntityId('')
                      setUploadUserIds([])
                      uploadBoqSearch.setSearch('')
                      uploadLeaderLogSearch.setSearch('')
                    }}
                    allLabel={copy.files.uploadPanel.categoryPlaceholder}
                    selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
                    selectAllLabel={copy.files.dropdown.selectAll}
                    clearLabel={copy.files.dropdown.clear}
                    searchPlaceholder={copy.files.dropdown.search}
                    multiple={false}
                    zIndex={30}
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs text-slate-600">
                  <span>{copy.files.uploadPanel.entityId}</span>
                  {uploadEntityType === 'user' ? (
                    <MultiSelectFilter
                      variant="form"
                      label=""
                      options={candidateUsers.map((user) => ({
                        value: String(user.id),
                        label: user.nationality === 'china' ? user.name : `${user.name} ${user.birthDate ? `(${user.birthDate.split('T')[0]})` : ''}`,
                      }))}
                      selected={uploadUserIds}
                      onChange={setUploadUserIds}
                      allLabel={loadingUsers ? 'Loading...' : copy.files.dropdown.all}
                      selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
                      selectAllLabel={copy.files.dropdown.selectAll}
                      clearLabel={copy.files.dropdown.clear}
                      searchPlaceholder={copy.files.dropdown.search}
                      disabled={loadingUsers}
                      zIndex={30}
                    />
                  ) : uploadEntityType === 'leader-log' ? (
                    renderLeaderLogSelect({
                      selected: uploadEntityId ? [uploadEntityId] : [],
                      onChange: (vals) => setUploadEntityId(vals[0] || ''),
                      searchState: uploadLeaderLogSearch,
                      multiple: false,
                      zIndex: 30,
                      allLabel: copy.files.dropdown.all,
                    })
                  ) : uploadEntityType === 'actual-boq-item' ? (
                    renderBoqItemSelect({
                      selected: uploadEntityId ? [uploadEntityId] : [],
                      onChange: (vals) => setUploadEntityId(vals[0] || ''),
                      searchState: uploadBoqSearch,
                      multiple: false,
                      zIndex: 30,
                      allLabel: copy.files.dropdown.all,
                    })
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
            <MultiSelectFilter
              variant="form"
              label=""
              options={categories.map((value) => ({
                value,
                label: categoryLabels[value] ?? value,
              }))}
              selected={category ? category.split(',') : []}
              onChange={(vals) => setCategory(vals.join(','))}
              allLabel={copy.files.filters.allLabel}
              selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
              selectAllLabel={copy.files.dropdown.selectAll}
              clearLabel={copy.files.dropdown.clear}
              searchPlaceholder={copy.files.dropdown.search}
              multiple={true}
              zIndex={20}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.entityTypeLabel}</span>
            <MultiSelectFilter
              variant="form"
              label=""
              options={entityTypeOptions}
              selected={entityType ? entityType.split(',') : []}
              onChange={(vals) => {
                const next = vals.join(',')
                setEntityType(next)
                if (next === 'user' || next === 'actual-boq-item' || next === 'leader-log') {
                  setEntityId('')
                  filterBoqSearch.setSearch('')
                  filterLeaderLogSearch.setSearch('')
                }
              }}
              allLabel={copy.files.filters.allLabel}
              selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
              selectAllLabel={copy.files.dropdown.selectAll}
              clearLabel={copy.files.dropdown.clear}
              searchPlaceholder={copy.files.dropdown.search}
              multiple={true}
              zIndex={20}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">{copy.files.filters.entityIdLabel}</span>
            {entityType === 'user' ? (
              <MultiSelectFilter
                variant="form"
                label=""
                options={candidateUsers.map((user) => ({
                  value: String(user.id),
                  label: user.nationality === 'china' ? user.name : `${user.name} ${user.birthDate ? `(${user.birthDate.split('T')[0]})` : ''}`,
                }))}
                selected={entityId ? entityId.split(',') : []}
                onChange={(vals) => setEntityId(vals.join(','))}
                allLabel={copy.files.filters.allLabel}
                selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
                selectAllLabel={copy.files.dropdown.selectAll}
                clearLabel={copy.files.dropdown.clear}
                searchPlaceholder={copy.files.dropdown.search}
                multiple={true}
                disabled={loadingUsers}
                zIndex={20}
              />
            ) : entityType === 'leader-log' ? (
              renderLeaderLogSelect({
                selected: entityId ? entityId.split(',') : [],
                onChange: (vals) => setEntityId(vals.join(',')),
                searchState: filterLeaderLogSearch,
                multiple: true,
                zIndex: 20,
                allLabel: copy.files.filters.allLabel,
              })
            ) : entityType === 'actual-boq-item' ? (
              renderBoqItemSelect({
                selected: entityId ? entityId.split(',') : [],
                onChange: (vals) => setEntityId(vals.join(',')),
                searchState: filterBoqSearch,
                multiple: true,
                zIndex: 20,
                allLabel: copy.files.filters.allLabel,
              })
            ) : (
              <input
                value={entityId}
                onChange={(event) => setEntityId(event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700 focus:border-emerald-300 focus:outline-none"
              />
            )}
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
                        <div className="grid grid-cols-2 justify-items-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditClick(row)}
                            className="w-full rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          >
                            {copy.files.table.actions.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpen(row.id)}
                            disabled={openingId === row.id}
                            className="w-full rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                          >
                            {copy.files.table.actions.open}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(row.id, row.originalName)}
                            className="w-full rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          >
                            {copy.files.table.actions.download}
                          </button>
                          {canDelete ? (
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id, isLocked)}
                              disabled={deletingId === row.id}
                              className="w-full rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-50 disabled:opacity-40"
                            >
                              {copy.files.table.actions.delete}
                            </button>
                          ) : <span />}
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
                <label className="flex flex-col gap-2 text-sm text-slate-600">
                  <span className="font-semibold text-slate-700">{copy.files.uploadPanel.categoryLabel}</span>
                  <select
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
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

                <div className="space-y-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">{copy.files.uploadPanel.linkTitle}</div>
                    <div className="text-xs text-slate-500">{copy.files.uploadPanel.linkHint}</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-600">{copy.files.editDialog.linksTitle}</div>
                    {editLinks.length > 0 ? (
                      <div className="space-y-2">
                        {editLinks.map((link, index) => {
                          const typeLabel = copy.files.uploadPanel.entityTypes[link.entityType] ?? link.entityType
                          const metaLabel =
                            link.entityType === 'leader-log'
                              ? (() => {
                                  const metaRecord = link.meta as
                                    | { date?: string; supervisorName?: string }
                                    | null
                                  return metaRecord ? formatLeaderLogMetaLabel(metaRecord) : ''
                                })()
                              : formatBoqMetaLabel(
                                  link.meta as {
                                    boqItemCode?: string
                                    designationZh?: string
                                    designationFr?: string
                                    projectName?: string
                                    projectCode?: string | null
                                  },
                                  locale,
                                )
                          const displayLabel =
                            link.label?.trim() || metaLabel || `${link.entityType}#${link.entityId}`
                          return (
                            <div
                              key={link.id ?? `${link.entityType}-${link.entityId}-${index}`}
                              className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-xs font-semibold text-slate-700">{typeLabel}</div>
                                <div className="truncate text-[11px] text-slate-500">{displayLabel}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveEditLink(index)}
                                className="shrink-0 rounded-full border border-rose-200 px-2 py-1 text-[11px] font-semibold text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                              >
                                {copy.files.editDialog.removeLinkAction}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">{copy.files.editDialog.linksEmpty}</div>
                    )}
                  </div>
                  <div className="border-t border-slate-200 pt-4">
                    <div className="text-xs font-semibold text-slate-600">{copy.files.editDialog.addLinkTitle}</div>
                  </div>
                  <div className="grid gap-3">
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      <span>{copy.files.uploadPanel.entityType}</span>
                      <MultiSelectFilter
                        variant="form"
                        label=""
                        options={entityTypeOptions}
                        selected={editEntityType ? [editEntityType] : []}
                        onChange={(vals) => {
                          const next = vals[0] || ''
                          setEditEntityType(next)
                          setEditEntityId('')
                          setEditUserIds([])
                          editBoqSearch.setSearch('')
                          editLeaderLogSearch.setSearch('')
                          setEditLinkError(null)
                        }}
                        allLabel={copy.files.uploadPanel.categoryPlaceholder}
                        selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
                        selectAllLabel={copy.files.dropdown.selectAll}
                        clearLabel={copy.files.dropdown.clear}
                        searchPlaceholder={copy.files.dropdown.search}
                        multiple={false}
                        zIndex={1300}
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-xs text-slate-600">
                      <span>{copy.files.uploadPanel.entityId}</span>
                      {editEntityType === 'user' ? (
                        <MultiSelectFilter
                          variant="form"
                          label=""
                          options={candidateUsers.map((user) => ({
                            value: String(user.id),
                            label: user.nationality === 'china' ? user.name : `${user.name} ${user.birthDate ? `(${user.birthDate.split('T')[0]})` : ''}`,
                          }))}
                          selected={editUserIds}
                          onChange={setEditUserIds}
                          allLabel={loadingUsers ? 'Loading...' : copy.files.dropdown.all}
                          selectedLabel={(count) => formatCopy(copy.files.dropdown.selected, { count })}
                          selectAllLabel={copy.files.dropdown.selectAll}
                          clearLabel={copy.files.dropdown.clear}
                          searchPlaceholder={copy.files.dropdown.search}
                          disabled={loadingUsers}
                          zIndex={1300}
                        />
                      ) : editEntityType === 'leader-log' ? (
                        renderLeaderLogSelect({
                          selected: editEntityId ? [editEntityId] : [],
                          onChange: (vals) => setEditEntityId(vals[0] || ''),
                          searchState: editLeaderLogSearch,
                          multiple: false,
                          zIndex: 1300,
                          allLabel: copy.files.dropdown.all,
                        })
                      ) : editEntityType === 'actual-boq-item' ? (
                        renderBoqItemSelect({
                          selected: editEntityId ? [editEntityId] : [],
                          onChange: (vals) => setEditEntityId(vals[0] || ''),
                          searchState: editBoqSearch,
                          multiple: false,
                          zIndex: 1300,
                          allLabel: copy.files.dropdown.all,
                        })
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
                  {editLinkError ? (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600">
                      {editLinkError}
                    </div>
                  ) : null}
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddEditLink}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    >
                      {copy.files.editDialog.addLinkAction}
                    </button>
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
