'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from 'react'

import { AlertDialog, type AlertTone } from '@/components/AlertDialog'
import { AccessDenied } from '@/components/AccessDenied'
import { locales } from '@/lib/i18n'
import {
  getLeaderLogsCopy,
  leaderLogBreadcrumbs,
  leaderLogDateLocales,
} from '@/lib/i18n/leaderLogs'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { ReportsHeader } from '../ReportsHeader'

export const dynamic = 'force-dynamic'

type SessionUser = {
  id: number
  username: string
  permissions: string[]
  roles: { id: number; name: string }[]
}

type LeaderOption = {
  id: number
  username: string
  name: string
  frenchName: string | null
  label: string
}

type LeaderLogItem = {
  id: number
  date: string
  supervisorId: number
  supervisorName: string
  contentRaw: string
  photoCount: number
  createdAt: string
  updatedAt: string
}

type FileUser = {
  id: number
  name: string
  username: string
}

type LeaderLogPhoto = {
  id: number
  originalName: string
  createdAt: string
  createdBy?: FileUser | null
}

const formatDateInput = (date: Date) => date.toISOString().split('T')[0]

const monthLabel = (date: Date, locale: string) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)

const formatDateTime = (value: string, locale: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const buildCalendar = (anchor: Date) => {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(firstOfMonth)
  const weekday = start.getDay()
  start.setDate(start.getDate() - weekday)

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start)
    day.setDate(start.getDate() + index)
    return {
      date: day,
      key: formatDateInput(day),
      inCurrentMonth: day.getMonth() === anchor.getMonth(),
    }
  })
}

const formatMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

export default function LeaderLogsPage() {
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const t = getLeaderLogsCopy(locale)
  const {
    home: breadcrumbHome,
    reports: breadcrumbReports,
    logs: breadcrumbLogs,
  } = leaderLogBreadcrumbs[locale]
  const dateLocale = leaderLogDateLocales[locale]

  const [selectedDate, setSelectedDate] = useState(() => formatDateInput(new Date()))
  const [monthCursor, setMonthCursor] = useState(() => new Date())

  const [session, setSession] = useState<SessionUser | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [alertDialog, setAlertDialog] = useState<{ title: string; description: string; tone?: AlertTone } | null>(
    null,
  )

  const [leaderOptions, setLeaderOptions] = useState<LeaderOption[]>([])
  const [leaderLoading, setLeaderLoading] = useState(true)
  const [leaderError, setLeaderError] = useState<string | null>(null)

  const [logs, setLogs] = useState<LeaderLogItem[]>([])
  const [logsLoading, setLogsLoading] = useState(true)
  const [logsError, setLogsError] = useState<string | null>(null)

  const [monthDates, setMonthDates] = useState<Set<string>>(new Set())
  const [monthLoading, setMonthLoading] = useState(true)
  const [monthError, setMonthError] = useState<string | null>(null)

  const [recentLogs, setRecentLogs] = useState<LeaderLogItem[]>([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [recentError, setRecentError] = useState<string | null>(null)

  const [viewMode, setViewMode] = useState<'team' | 'person'>('team')
  const [selectedLeaderId, setSelectedLeaderId] = useState<number | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create')
  const [editorLogId, setEditorLogId] = useState<number | null>(null)
  const [editorDate, setEditorDate] = useState(selectedDate)
  const [editorLeaderId, setEditorLeaderId] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [editorError, setEditorError] = useState<string | null>(null)
  const [editorSaving, setEditorSaving] = useState(false)
  const [editorReadOnly, setEditorReadOnly] = useState(false)
  const [editorLoading, setEditorLoading] = useState(false)

  const [editorPhotos, setEditorPhotos] = useState<LeaderLogPhoto[]>([])
  const [editorPhotosLoading, setEditorPhotosLoading] = useState(false)
  const [editorPhotosError, setEditorPhotosError] = useState<string | null>(null)
  const [editorPhotosUploading, setEditorPhotosUploading] = useState(false)
  const [editorPhotoOpenId, setEditorPhotoOpenId] = useState<number | null>(null)
  const [uploadMode, setUploadMode] = useState<'camera' | 'album' | 'drop'>('drop')
  const [isMobile, setIsMobile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepthRef = useRef(0)

  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  const monthKey = useMemo(() => formatMonthKey(monthCursor), [monthCursor])
  const calendarDays = useMemo(() => buildCalendar(monthCursor), [monthCursor])
  const selectedDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(selectedDate)),
    [dateLocale, selectedDate],
  )

  const canView = session?.permissions.some((perm) => perm === 'report:view' || perm === 'report:edit') ?? false
  const canEdit = session?.permissions.includes('report:edit') ?? false
  const canEditAll = session?.permissions.includes('leader-log:edit-all') ?? false
  const canViewAll =
    session?.permissions.includes('leader-log:view-all') ||
    session?.permissions.includes('leader-log:edit-all') ||
    false
  const canViewFiles =
    session?.permissions.includes('file:view') || session?.permissions.includes('file:manage') || false
  const canUploadFiles =
    session?.permissions.includes('file:upload') || session?.permissions.includes('file:manage') || false

  useEffect(() => {
    const loadSession = async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' })
        const data = (await res.json()) as { user?: SessionUser | null }
        setSession(data.user ?? null)
      } catch {
        setSession(null)
      } finally {
        setAuthLoaded(true)
      }
    }
    void loadSession()
  }, [])

  useEffect(() => {
    if (!authLoaded) return
    if (!canViewAll) {
      setViewMode('person')
    }
  }, [authLoaded, canViewAll])

  const fetchLeaders = useCallback(async () => {
    setLeaderLoading(true)
    setLeaderError(null)
    try {
      const response = await fetch('/api/leader-logs/leaders', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load leaders')
      }
      const data = (await response.json()) as { leaders: LeaderOption[] }
      setLeaderOptions(data.leaders ?? [])
    } catch (error) {
      setLeaderError(error instanceof Error ? error.message : '加载负责人失败')
      setLeaderOptions([])
    } finally {
      setLeaderLoading(false)
    }
  }, [])

  const fetchLogsForDate = useCallback(async (date: string, leaderId?: number) => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const params = new URLSearchParams({ date })
      if (leaderId) {
        params.set('supervisorId', String(leaderId))
      }
      const response = await fetch(`/api/leader-logs?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load logs')
      }
      const data = (await response.json()) as { logs: LeaderLogItem[] }
      setLogs(data.logs ?? [])
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : '加载日志失败')
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }, [])

  const fetchMonthDates = useCallback(async (key: string, leaderId?: number) => {
    setMonthLoading(true)
    setMonthError(null)
    try {
      const params = new URLSearchParams({ month: key })
      if (leaderId) {
        params.set('supervisorId', String(leaderId))
      }
      const response = await fetch(`/api/leader-logs?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load month data')
      }
      const data = (await response.json()) as { dates: string[] }
      setMonthDates(new Set(data.dates ?? []))
    } catch (error) {
      setMonthError(error instanceof Error ? error.message : '加载日历失败')
      setMonthDates(new Set())
    } finally {
      setMonthLoading(false)
    }
  }, [])

  const fetchRecentLogs = useCallback(async (leaderId?: number) => {
    setRecentLoading(true)
    setRecentError(null)
    try {
      const params = new URLSearchParams({ limit: '5' })
      if (leaderId) {
        params.set('supervisorId', String(leaderId))
      }
      const response = await fetch(`/api/leader-logs?${params.toString()}`, { cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Failed to load recent logs')
      }
      const data = (await response.json()) as { logs: LeaderLogItem[] }
      setRecentLogs(data.logs ?? [])
    } catch (error) {
      setRecentError(error instanceof Error ? error.message : '加载最近日志失败')
      setRecentLogs([])
    } finally {
      setRecentLoading(false)
    }
  }, [])

  const fetchEditorPhotos = useCallback(
    async (logId: number) => {
      if (!canViewFiles) {
        setEditorPhotos([])
        return
      }
      setEditorPhotosLoading(true)
      setEditorPhotosError(null)
      try {
        const params = new URLSearchParams({
          entityType: 'leader-log',
          entityId: String(logId),
          category: 'site-photo',
          pageSize: '200',
        })
        const response = await fetch(`/api/files?${params.toString()}`, { cache: 'no-store' })
        if (!response.ok) {
          throw new Error('Failed to load photos')
        }
        const data = (await response.json()) as { items?: any[] }
        const items = Array.isArray(data.items) ? data.items : []
        setEditorPhotos(
          items.map((item) => ({
            id: item.id,
            originalName: item.originalName,
            createdAt: item.createdAt,
            createdBy: item.createdBy ?? null,
          })),
        )
      } catch (error) {
        setEditorPhotosError(error instanceof Error ? error.message : t.photos.error)
        setEditorPhotos([])
      } finally {
        setEditorPhotosLoading(false)
      }
    },
    [canViewFiles, t.photos.error],
  )

  const ensureDraftLog = useCallback(
    async (dateKey: string, leaderId: number) => {
      setEditorLoading(true)
      setEditorError(null)
      try {
        const response = await fetch('/api/leader-logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logDate: dateKey,
            supervisorId: leaderId,
            contentRaw: '',
          }),
        })
        if (response.ok) {
          const data = (await response.json()) as { log?: LeaderLogItem }
          if (data.log) return data.log
        }
        if (response.status === 409) {
          const params = new URLSearchParams({
            date: dateKey,
            supervisorId: String(leaderId),
          })
          const existingRes = await fetch(`/api/leader-logs?${params.toString()}`, {
            cache: 'no-store',
          })
          if (existingRes.ok) {
            const data = (await existingRes.json()) as { logs?: LeaderLogItem[] }
            if (data.logs?.length) return data.logs[0]
          }
        }
        const errorBody = await response.json().catch(() => ({}))
        throw new Error(errorBody?.message ?? '创建日志失败')
      } catch (error) {
        setEditorError(error instanceof Error ? error.message : '创建日志失败')
        return null
      } finally {
        setEditorLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!authLoaded) return
    if (!canView) {
      setLeaderLoading(false)
      setLogsLoading(false)
      setMonthLoading(false)
      setRecentLoading(false)
      return
    }
    void fetchLeaders()
  }, [authLoaded, canView, fetchLeaders])

  useEffect(() => {
    if (!authLoaded || !canView) return
    const leaderId =
      viewMode === 'person' ? selectedLeaderId ?? session?.id ?? undefined : undefined
    void fetchLogsForDate(selectedDate, leaderId)
  }, [authLoaded, canView, fetchLogsForDate, selectedDate, selectedLeaderId, session?.id, viewMode])

  useEffect(() => {
    if (!authLoaded || !canView) return
    const leaderId =
      viewMode === 'person' ? selectedLeaderId ?? session?.id ?? undefined : undefined
    void fetchMonthDates(monthKey, leaderId)
  }, [authLoaded, canView, fetchMonthDates, monthKey, selectedLeaderId, session?.id, viewMode])

  useEffect(() => {
    if (!authLoaded || !canView) return
    const leaderId =
      viewMode === 'person' ? selectedLeaderId ?? session?.id ?? undefined : undefined
    void fetchRecentLogs(leaderId)
  }, [authLoaded, canView, fetchRecentLogs, selectedLeaderId, session?.id, viewMode])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(max-width: 768px)')
    const updateMode = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      setUploadMode(mobile ? 'album' : 'drop')
    }
    updateMode()
    if (media.addEventListener) {
      media.addEventListener('change', updateMode)
      return () => media.removeEventListener('change', updateMode)
    }
    media.addListener(updateMode)
    return () => media.removeListener(updateMode)
  }, [])

  useEffect(() => {
    if (!editorOpen || !editorLogId) {
      setEditorPhotos([])
      setEditorPhotosError(null)
      return
    }
    void fetchEditorPhotos(editorLogId)
  }, [editorLogId, editorOpen, fetchEditorPhotos])

  const logsByLeaderId = useMemo(() => {
    const map = new Map<number, LeaderLogItem>()
    logs.forEach((log) => {
      map.set(log.supervisorId, log)
    })
    return map
  }, [logs])

  const hasLogContent = useCallback((log?: LeaderLogItem | null) => {
    if (!log) return false
    return log.contentRaw.trim().length > 0
  }, [])

  const hasLogPhotos = useCallback((log?: LeaderLogItem | null) => {
    if (!log) return false
    return log.photoCount > 0
  }, [])

  useEffect(() => {
    if (!leaderOptions.length) return
    if (viewMode !== 'person') return
    const fallback =
      leaderOptions.find((leader) => leader.id === session?.id)?.id ??
      leaderOptions[0]?.id ??
      null
    if (selectedLeaderId === null || !leaderOptions.some((leader) => leader.id === selectedLeaderId)) {
      setSelectedLeaderId(fallback)
    }
  }, [leaderOptions, selectedLeaderId, session?.id, viewMode])

  const leaderIdSet = useMemo(() => new Set(leaderOptions.map((leader) => leader.id)), [leaderOptions])

  const orphanLogs = useMemo(
    () => logs.filter((log) => !leaderIdSet.has(log.supervisorId)),
    [logs, leaderIdSet],
  )

  const orderedLeaders = useMemo(() => {
    if (!session?.id) return leaderOptions
    const current = leaderOptions.find((leader) => leader.id === session.id)
    const rest = leaderOptions.filter((leader) => leader.id !== session.id)
    return current ? [current, ...rest] : leaderOptions
  }, [leaderOptions, session?.id])

  const activeLeader = useMemo(() => {
    if (viewMode !== 'person') return null
    const targetId = selectedLeaderId ?? session?.id ?? null
    if (!targetId) return null
    return leaderOptions.find((leader) => leader.id === targetId) ?? null
  }, [leaderOptions, selectedLeaderId, session?.id, viewMode])

  const listLeaders = useMemo(() => {
    if (viewMode === 'person') {
      return activeLeader ? [activeLeader] : []
    }
    return orderedLeaders
  }, [activeLeader, orderedLeaders, viewMode])

  const totalLeaders = listLeaders.length
  const filledLeaders = listLeaders.filter((leader) => {
    const log = logsByLeaderId.get(leader.id)
    return hasLogContent(log) || hasLogPhotos(log)
  }).length
  const pendingLeaders = Math.max(totalLeaders - filledLeaders, 0)
  const fillPercent = totalLeaders ? Math.round((filledLeaders / totalLeaders) * 100) : 0

  const handleMonthChange = (offset: number) => {
    setMonthCursor((prev) => {
      const next = new Date(prev)
      next.setMonth(prev.getMonth() + offset)
      return next
    })
  }

  const handleDateChange = (value: string) => {
    setSelectedDate(value)
    if (value) {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) {
        setMonthCursor(parsed)
      }
    }
  }

  const openAlert = (message: string, tone: AlertTone = 'warning') => {
    setAlertDialog({
      title: t.alerts.title,
      description: message,
      tone,
    })
  }

  const openCreate = async (leader: LeaderOption, dateOverride?: string) => {
    if (!canEdit) {
      openAlert(t.alerts.createDenied)
      return
    }
    if (!canEditAll && leader.id !== session?.id) {
      openAlert(t.list.readOnly)
      return
    }
    const nextDate = dateOverride ?? selectedDate
    setEditorMode('create')
    setEditorLogId(null)
    setEditorDate(nextDate)
    setEditorLeaderId(String(leader.id))
    setEditorContent('')
    setEditorError(null)
    setEditorReadOnly(false)
    setEditorOpen(true)
    const draft = await ensureDraftLog(nextDate, leader.id)
    if (draft) {
      setEditorLogId(draft.id)
      setEditorContent(draft.contentRaw)
      setEditorMode('edit')
    }
  }

  const openEdit = (log: LeaderLogItem) => {
    const editable = canEdit && (canEditAll || log.supervisorId === session?.id)
    setEditorMode('edit')
    setEditorLogId(log.id)
    setEditorDate(log.date)
    setEditorLeaderId(String(log.supervisorId))
    setEditorContent(log.contentRaw)
    setEditorError(null)
    setEditorReadOnly(!editable)
    setEditorLoading(false)
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditorError(null)
    setEditorSaving(false)
    setEditorReadOnly(false)
    setEditorLoading(false)
    setEditorPhotos([])
    setEditorPhotosError(null)
    setEditorPhotosLoading(false)
    setEditorPhotosUploading(false)
    setEditorPhotoOpenId(null)
  }

  const submitEditor = async () => {
    if (editorLoading) return
    if (!editorDate) {
      setEditorError(t.formErrors.dateRequired)
      return
    }
    if (canEditAll && !editorLeaderId) {
      setEditorError(t.formErrors.leaderRequired)
      return
    }
    if (editorMode === 'edit' && !editorLogId) {
      setEditorError(t.formErrors.dateRequired)
      return
    }
    setEditorSaving(true)
    setEditorError(null)
    try {
      const isCreate = editorMode === 'create'
      const url = isCreate ? '/api/leader-logs' : `/api/leader-logs/${editorLogId}`
      const method = isCreate ? 'POST' : 'PUT'
      const payload = isCreate
        ? {
            logDate: editorDate,
            supervisorId: canEditAll ? Number(editorLeaderId) : undefined,
            contentRaw: editorContent,
          }
        : { contentRaw: editorContent }
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.message ?? 'Failed to save')
      }
      setEditorOpen(false)
      setEditorSaving(false)
      const refreshLeaderId =
        viewMode === 'person'
          ? Number(editorLeaderId) || selectedLeaderId || session?.id || undefined
          : undefined
      if (editorMode === 'create' && editorDate !== selectedDate) {
        handleDateChange(editorDate)
      } else {
        void fetchLogsForDate(editorDate, refreshLeaderId)
      }
      void fetchMonthDates(formatMonthKey(new Date(editorDate)), refreshLeaderId)
      void fetchRecentLogs(refreshLeaderId)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : '保存失败')
      setEditorSaving(false)
    }
  }

  const openPhotoDialog = () => {
    if (editorPhotosUploading) return
    photoInputRef.current?.click()
  }

  const openCameraDialog = () => {
    if (editorPhotosUploading) return
    cameraInputRef.current?.click()
  }

  const uploadPhotos = async (files: File[]) => {
    if (!editorLogId || editorReadOnly || !canUploadFiles) return
    const supervisorId = Number(editorLeaderId)
    if (!Number.isFinite(supervisorId)) {
      setEditorPhotosError(t.formErrors.leaderRequired)
      return
    }
    setEditorPhotosUploading(true)
    setEditorPhotosError(null)
    try {
      for (const file of files) {
        const contentType = file.type || 'application/octet-stream'
        const uploadRes = await fetch('/api/files/upload-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            contentType,
            size: file.size,
            category: 'site-photo',
          }),
        })

        if (!uploadRes.ok) {
          const errorBody = await uploadRes.json().catch(() => ({}))
          throw new Error(errorBody.error ?? errorBody.message ?? t.photos.uploadFailed)
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
          throw new Error(t.photos.uploadFailed)
        }

        const leaderLabel = editorLeaderLabel || editorLeaderId
        const logLabel = [editorDate, leaderLabel].filter(Boolean).join(' · ')
        const links = [
          {
            entityType: 'user',
            entityId: String(supervisorId),
          },
          {
            entityType: 'leader-log',
            entityId: String(editorLogId),
            label: logLabel || undefined,
            meta: {
              date: editorDate,
              supervisorId,
              supervisorName: leaderLabel,
            },
          },
        ]

        const finalizeRes = await fetch('/api/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageKey: uploadPayload.storageKey,
            originalName: file.name,
            mimeType: contentType,
            size: file.size,
            category: 'site-photo',
            ownerUserId: supervisorId,
            links,
          }),
        })

        if (!finalizeRes.ok) {
          const errorBody = await finalizeRes.json().catch(() => ({}))
          throw new Error(errorBody.message ?? t.photos.uploadFailed)
        }
      }

      await fetchEditorPhotos(editorLogId)
      const refreshLeaderId =
        viewMode === 'person'
          ? Number(editorLeaderId) || selectedLeaderId || session?.id || undefined
          : undefined
      void fetchLogsForDate(editorDate, refreshLeaderId)
      void fetchMonthDates(formatMonthKey(new Date(editorDate)), refreshLeaderId)
      void fetchRecentLogs(refreshLeaderId)
    } catch (error) {
      setEditorPhotosError(error instanceof Error ? error.message : t.photos.uploadFailed)
    } finally {
      setEditorPhotosUploading(false)
      if (photoInputRef.current) {
        photoInputRef.current.value = ''
      }
      if (cameraInputRef.current) {
        cameraInputRef.current.value = ''
      }
    }
  }

  const handlePhotoSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : []
    if (files.length === 0) return
    void uploadPhotos(files)
  }

  const handleDropzoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openPhotoDialog()
    }
  }

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current += 1
    setIsDragging(true)
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    if (!isDragging) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current -= 1
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0
      setIsDragging(false)
    }
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragDepthRef.current = 0
    setIsDragging(false)
    if (editorPhotosUploading || editorReadOnly || !editorLogId) return
    const files = event.dataTransfer.files ? Array.from(event.dataTransfer.files) : []
    if (files.length > 0) {
      void uploadPhotos(files)
    }
  }

  const handleOpenPhoto = async (fileId: number) => {
    setEditorPhotoOpenId(fileId)
    try {
      const res = await fetch(`/api/files/${fileId}?includeUrl=1`)
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.message ?? t.photos.openFailed)
      }
      const payload = (await res.json()) as { file?: { url?: string; previewUrl?: string } }
      const targetUrl = payload.file?.previewUrl || payload.file?.url
      if (!targetUrl) {
        throw new Error(t.photos.openFailed)
      }
      window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setEditorPhotosError(error instanceof Error ? error.message : t.photos.openFailed)
    } finally {
      setEditorPhotoOpenId(null)
    }
  }

  const editorLeaderLabel = useMemo(() => {
    const leaderId = Number(editorLeaderId)
    const leader = leaderOptions.find((item) => item.id === leaderId)
    return leader?.label ?? logsByLeaderId.get(leaderId)?.supervisorName ?? ''
  }, [editorLeaderId, leaderOptions, logsByLeaderId])

  const visibleRecentLogs = useMemo(
    () => {
      if (viewMode === 'person' && activeLeader) {
        return recentLogs.filter((log) => log.supervisorId === activeLeader.id)
      }
      return recentLogs
    },
    [activeLeader, recentLogs, viewMode],
  )

  const handleCalendarSelect = (dateKey: string, hasLog: boolean) => {
    handleDateChange(dateKey)
    if (viewMode !== 'person' || !activeLeader) return
    if (!hasLog) {
      void openCreate(activeLeader, dateKey)
    }
  }

  const alertNode = (
    <AlertDialog
      open={Boolean(alertDialog)}
      title={alertDialog?.title ?? ''}
      description={alertDialog?.description}
      tone={alertDialog?.tone ?? 'info'}
      actionLabel={t.alerts.close}
      onClose={() => setAlertDialog(null)}
    />
  )

  if (authLoaded && !canView) {
    return (
      <>
        {alertNode}
        <AccessDenied
          locale={locale}
          permissions={['report:view', 'report:edit']}
          hint={t.accessHint}
        />
      </>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {alertNode}
      <ReportsHeader
        className="z-30 py-4"
        breadcrumbs={[
          { label: breadcrumbHome, href: '/' },
          { label: breadcrumbReports, href: '/reports' },
          { label: breadcrumbLogs },
        ]}
        title={breadcrumbLogs}
        locale={locale}
        onLocaleChange={setLocale}
      />
      <section className="relative mx-auto flex w-full max-w-[1700px] flex-col gap-8 overflow-hidden px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -right-10 -top-24 h-72 w-72 rounded-full bg-amber-200/40 blur-3xl" />
          <div className="absolute -left-16 top-32 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl" />
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
        <div className="absolute -right-20 -top-28 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1.2fr,1fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t.header.title}</p>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{t.header.subtitle}</h1>
            <p className="text-sm text-slate-500">{t.header.description}</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1">
                {t.stats.leaders} · {totalLeaders}
              </span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                {t.stats.filled} · {filledLeaders}
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                {t.stats.pending} · {pendingLeaders}
              </span>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>{t.stats.filled}</span>
                <span className="font-semibold text-slate-700">{fillPercent}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-white">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-sky-500 via-blue-500 to-emerald-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <section className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t.list.badge}
                </p>
                <h2 className="text-xl font-semibold text-slate-900">{selectedDateLabel}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {t.stats.filled} {filledLeaders} · {t.stats.pending} {pendingLeaders}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
              </div>
            </div>

            {leaderLoading || logsLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.calendar.loading}</p>
            ) : leaderError || logsError ? (
              <p className="mt-4 text-sm text-rose-500">{leaderError ?? logsError}</p>
            ) : totalLeaders === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t.list.empty}</p>
            ) : (
              <div className="mt-4 grid gap-4">
                {listLeaders.map((leader) => {
                  const log = logsByLeaderId.get(leader.id)
                  const contentReady = hasLogContent(log)
                  const hasPhotos = hasLogPhotos(log)
                  const statusLabel = log
                    ? contentReady
                      ? t.list.filled
                      : hasPhotos
                        ? t.list.photoOnly
                        : t.list.pending
                    : t.list.pending
                  const isSelf = leader.id === session?.id
                  const editable = canEdit && (canEditAll || isSelf)
                  return (
                    <div
                      key={leader.id}
                      className={`group relative overflow-hidden rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md ${
                        isSelf
                          ? 'border-sky-200 bg-sky-50/60 shadow-sky-100/70'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      {isSelf ? (
                        <div className="absolute left-0 top-4 h-[calc(100%-2rem)] w-1 rounded-full bg-gradient-to-b from-sky-400 via-blue-400 to-emerald-300" />
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{leader.label}</p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                            contentReady
                              ? 'bg-emerald-100 text-emerald-700'
                              : hasPhotos
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      {log ? (
                        <>
                          <p className="mt-3 max-h-16 overflow-hidden text-sm text-slate-600">
                            {contentReady ? log.contentRaw : hasPhotos ? t.list.photoOnlyHint : t.list.empty}
                          </p>
                          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                            <span>
                              {t.list.updatedPrefix} {formatDateTime(log.updatedAt, dateLocale)}
                            </span>
                            {editable ? (
                              <button
                                type="button"
                                onClick={() => openEdit(log)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                {contentReady || hasPhotos ? t.list.edit : t.list.create}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openEdit(log)}
                                className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                              >
                                {t.list.view}
                              </button>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                          <span>{t.list.empty}</span>
                          {editable ? (
                            <button
                              type="button"
                              onClick={() => void openCreate(leader)}
                              className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
                            >
                              {t.list.create}
                            </button>
                          ) : (
                            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-500">
                              {t.list.readOnly}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {viewMode === 'team' && orphanLogs.length ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      {t.list.otherLeaders}
                    </p>
                    <div className="mt-2 space-y-2 text-sm text-slate-600">
                      {orphanLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between gap-3">
                          <span>{log.supervisorName}</span>
                          {canEdit && (canEditAll || log.supervisorId === session?.id) ? (
                            <button
                              type="button"
                              onClick={() => openEdit(log)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              {t.list.edit}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openEdit(log)}
                              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                            >
                              {t.list.view}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t.calendar.badge}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {monthLabel(monthCursor, dateLocale)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleMonthChange(-1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.calendar.prevLabel}
                </button>
                <button
                  type="button"
                  onClick={() => handleMonthChange(1)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {t.calendar.nextLabel}
                </button>
              </div>
            </div>
            {canViewAll ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {t.mode.label}
                </span>
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode('team')}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      viewMode === 'team'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.mode.team}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('person')}
                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                      viewMode === 'person'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.mode.personal}
                  </button>
                </div>
                {viewMode === 'person' ? (
                  <select
                    value={selectedLeaderId ? String(selectedLeaderId) : ''}
                    onChange={(event) => {
                      const value = event.target.value
                      setSelectedLeaderId(value ? Number(value) : null)
                    }}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition focus:border-slate-400 focus:outline-none"
                  >
                    <option value="">{t.mode.leaderPlaceholder}</option>
                    {orderedLeaders.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.label}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 text-xs font-semibold text-slate-600">
                {t.mode.leaderLabel} · {activeLeader?.label ?? session?.username ?? '-'}
              </div>
            )}

            {monthLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.calendar.loading}</p>
            ) : monthError ? (
              <p className="mt-4 text-sm text-rose-500">{monthError}</p>
            ) : (
              <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
                {t.calendar.weekdays.map((day) => (
                  <span key={day} className="font-semibold text-slate-400">
                    {day}
                  </span>
                ))}
                {calendarDays.map((day) => {
                  const isSelected = selectedDate === day.key
                  const hasLog = monthDates.has(day.key)
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => handleCalendarSelect(day.key, hasLog)}
                      className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-xs font-semibold transition hover:-translate-y-0.5 hover:shadow-sm ${
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-300/60'
                          : hasLog
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white/80 text-slate-700'
                      } ${day.inCurrentMonth ? '' : 'opacity-40'}`}
                    >
                      <span>{day.date.getDate()}</span>
                      <span className="text-[10px] font-medium">
                        {hasLog ? t.calendar.filledLabel : t.calendar.pendingLabel}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-6 shadow-xl shadow-slate-200/40 backdrop-blur">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t.recent.badge}
              </p>
              <span className="text-xs text-slate-400">{visibleRecentLogs.length}</span>
            </div>
            {recentLoading ? (
              <p className="mt-4 text-sm text-slate-500">{t.recent.loading}</p>
            ) : recentError ? (
              <p className="mt-4 text-sm text-rose-500">{recentError}</p>
            ) : visibleRecentLogs.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">{t.recent.empty}</p>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleRecentLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{log.supervisorName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleDateChange(log.date)
                          openEdit(log)
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        {t.recent.view}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">
                      {hasLogContent(log)
                        ? log.contentRaw
                        : hasLogPhotos(log)
                          ? t.list.photoOnlyHint
                          : t.list.empty}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {t.recent.updatedPrefix} {formatDateTime(log.updatedAt, dateLocale)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="flex w-full max-w-[95vw] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl shadow-slate-900/40 sm:max-w-2xl max-h-[90vh]">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-lg font-semibold text-slate-900">
                  {editorMode === 'create' ? t.form.createTitle : t.form.editTitle}
                </p>
                <p className="text-sm text-slate-500">{editorLeaderLabel}</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                X
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                  {t.form.dateLabel}
                  <input
                    type="date"
                    value={editorDate}
                    onChange={(event) => setEditorDate(event.target.value)}
                    disabled={editorMode === 'edit' || editorReadOnly || editorLoading}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  />
                </label>
                <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                  {t.form.leaderLabel}
                  <select
                    value={editorLeaderId}
                    onChange={(event) => setEditorLeaderId(event.target.value)}
                    disabled={!canEditAll || editorMode === 'edit' || editorReadOnly || editorLoading}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  >
                    <option value="">{t.form.leaderLabel}</option>
                    {leaderOptions.map((leader) => (
                      <option key={leader.id} value={leader.id}>
                        {leader.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
                {t.form.contentHint}
              </div>
              <label className="flex flex-col gap-2 text-xs font-semibold text-slate-500">
                {t.form.contentLabel}
                <textarea
                  value={editorContent}
                  onChange={(event) => setEditorContent(event.target.value)}
                  rows={8}
                  disabled={editorReadOnly || editorLoading}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-100"
                  placeholder={t.form.contentPlaceholder}
                />
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{t.photos.title}</p>
                    <p className="text-xs text-slate-500">{t.photos.hint}</p>
                  </div>
                <div className="flex flex-wrap gap-1 rounded-full bg-slate-100 p-1 text-xs font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={() => setUploadMode('camera')}
                      disabled={
                        editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles || !editorLogId
                      }
                      className={`rounded-full px-3 py-1 transition ${
                        uploadMode === 'camera'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t.photos.camera}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('album')}
                      disabled={
                        editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles || !editorLogId
                      }
                      className={`rounded-full px-3 py-1 transition ${
                        uploadMode === 'album'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t.photos.album}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('drop')}
                      disabled={
                        editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles || !editorLogId
                      }
                      className={`rounded-full px-3 py-1 transition ${
                        uploadMode === 'drop'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {t.photos.drop}
                    </button>
                  </div>
                </div>
                <input
                  ref={photoInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                />
                {uploadMode === 'camera' ? (
                  <button
                    type="button"
                    onClick={openCameraDialog}
                    disabled={
                      editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles || !editorLogId
                    }
                    className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editorPhotosUploading ? t.photos.uploading : t.photos.camera}
                  </button>
                ) : uploadMode === 'album' ? (
                  <button
                    type="button"
                    onClick={openPhotoDialog}
                    disabled={
                      editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles || !editorLogId
                    }
                    className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {editorPhotosUploading ? t.photos.uploading : t.photos.album}
                  </button>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={openPhotoDialog}
                    onKeyDown={handleDropzoneKeyDown}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    aria-disabled={editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles}
                  className={`mt-3 flex items-center justify-between gap-3 rounded-2xl border border-dashed px-4 py-4 text-xs font-semibold transition ${
                      isDragging
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-700'
                    } ${
                      editorPhotosUploading || editorReadOnly || editorLoading || !canUploadFiles || !editorLogId
                        ? 'cursor-not-allowed opacity-60'
                        : 'cursor-pointer hover:border-slate-300 hover:bg-slate-50'
                    }`}
                >
                    <span>{t.photos.drop}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-500">
                      {t.photos.dropHint}
                    </span>
                  </div>
                )}
                {editorLoading && !editorLogId ? (
                  <p className="mt-3 text-xs text-slate-500">{t.photos.loading}</p>
                ) : editorPhotosLoading ? (
                  <p className="mt-3 text-xs text-slate-500">{t.photos.loading}</p>
                ) : editorPhotos.length === 0 ? (
                  <p className="mt-3 text-xs text-slate-500">{t.photos.empty}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {editorPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-slate-700">
                            {photo.originalName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {formatDateTime(photo.createdAt, dateLocale)}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPhoto(photo.id)}
                          disabled={editorPhotoOpenId === photo.id}
                          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
                        >
                          {t.photos.open}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {editorPhotosError ? (
                  <p className="mt-3 text-xs text-rose-500">{editorPhotosError}</p>
                ) : null}
              </div>
              {editorError ? <p className="text-sm text-rose-500">{editorError}</p> : null}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                {t.form.cancel}
              </button>
              {editorReadOnly ? null : (
                <button
                  type="button"
                  onClick={submitEditor}
                  disabled={editorSaving || editorLoading}
                  className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {editorSaving ? `${t.form.save}...` : t.form.save}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      </section>
    </main>
  )
}
