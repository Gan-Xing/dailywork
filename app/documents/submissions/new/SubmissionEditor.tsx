'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DocumentStatus } from '@prisma/client'

import { formatCopy, locales, type Locale } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { localizeProgressList, localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import type { InspectionListItem } from '@/lib/progressTypes'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { SubmissionData, SubmissionItem, Party } from '@/types/documents'

type TemplateOption = { id: string; name: string; version: number; status: string; html?: string; placeholders: Array<{ key: string; path?: string }> }

type Props = {
  initialSubmission?: {
    id: number
    title: string | null
    templateId: string | null
    templateVersion?: number | null
    data: any
    status: DocumentStatus
  }
  canManage?: boolean
  canEdit?: boolean
  currentUser?: { id: number; username: string } | null
}

const buildDefaultData = (): SubmissionData => {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const currentTime = now.toISOString().slice(11, 16)
  return {
    documentMeta: {
      projectName:
        "TRAVAUX DE RENFORCEMENT DE LA ROUTE BONDOUKOU -BOUNA Y COMPRIS L'AMENAGEMENT DES TRAVERSEES DE BOUNA, BONDOUKOU ET AGNIBILEKROU",
      projectCode: 'QUA-VOIR-BDK-TANDA',
      contractNumbers: ['090/2025', '091/2025'],
      bordereauNumber: 1,
      subject: 'Transmission de Demandes de Réception',
    },
    parties: {
      sender: {
        organization: 'CRBC',
        date: today,
        lastName: 'GAN',
        firstName: 'XING',
        time: currentTime,
      },
      recipient: {
        organization: 'PORTEO',
        date: '',
        lastName: '',
        firstName: '',
      },
    },
    items: [{ designation: '', quantity: undefined, observation: '' }],
    comments: '',
  }
}

export default function SubmissionEditor({ initialSubmission, canManage = false, canEdit = false }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [loadingTpls, setLoadingTpls] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rendering, setRendering] = useState(false)
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(initialSubmission?.templateId ?? 'file-bordereau')
  const [data, setData] = useState<SubmissionData>(initialSubmission?.data ?? buildDefaultData())
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null)
  const [status, setStatus] = useState<DocumentStatus>(initialSubmission?.status ?? DocumentStatus.DRAFT)
  const [title, setTitle] = useState(initialSubmission?.title ?? '')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [showBaseModal, setShowBaseModal] = useState(false)
  const [inspectionOptions, setInspectionOptions] = useState<InspectionListItem[]>([])
  const [selectedInspectionIds, setSelectedInspectionIds] = useState<number[]>([])
  const [initialInspectionIds, setInitialInspectionIds] = useState<number[]>([])
  const [inspectionSearch, setInspectionSearch] = useState('')
  const [inspectionError, setInspectionError] = useState<string | null>(null)
  const [loadingInspections, setLoadingInspections] = useState(false)
  const hasLoadedInspectionBindingRef = useRef(false)
  const isReadOnly = !canEdit
  const statusLabel = copy.status.document[status] ?? status
  const statusText = formatCopy(copy.submissionEditor.template.statusTemplate, { status: statusLabel })

  const selectedTemplate = useMemo(
    () => templates.find((tpl) => tpl.id === selectedTemplateId),
    [selectedTemplateId, templates],
  )

  const formatTplName = (name: string) => name.replace(/\s+v\d+$/i, '').trim()

  const formatPk = (value: number) => {
    if (!Number.isFinite(value)) return ''
    const km = Math.floor(value / 1000)
    const m = Math.round(value % 1000)
    return `PK${km}+${String(m).padStart(3, '0')}`
  }

  const getRawLayers = (inspection: InspectionListItem) => {
    if (inspection.layers && inspection.layers.length) return inspection.layers
    const layer = (inspection as any).layerName
    return layer ? [layer] : []
  }

  const getRawChecks = (inspection: InspectionListItem) => {
    if (inspection.checks && inspection.checks.length) return inspection.checks
    const check = (inspection as any).checkName
    return check ? [check] : []
  }

  const buildInspectionDescription = (inspection: InspectionListItem) => {
    const locale: Locale = 'fr' // 对齐 PDF 默认法语导出
    const sideLabelMap: Record<string, string> = { LEFT: 'Gauche', RIGHT: 'Droite', BOTH: 'Deux côtés' }
    const sideLabel = sideLabelMap[inspection.side] ?? inspection.side
    const rangeText = `${formatPk(inspection.startPk)} → ${formatPk(inspection.endPk)}`
    const roadText = resolveRoadName({ slug: inspection.roadSlug, name: inspection.roadName }, locale)
    const phaseText = localizeProgressTerm('phase', inspection.phaseName, locale)
    const localisation = `${roadText} · ${phaseText} · ${sideLabel} · ${rangeText}`
    const rawLayers = getRawLayers(inspection)
    const rawChecks = getRawChecks(inspection)
    const layers = localizeProgressList('layer', rawLayers, locale, { phaseName: inspection.phaseName })
    const checks = localizeProgressList('check', rawChecks, locale, { phaseName: inspection.phaseName })
    const nature = [...layers, ...checks].filter(Boolean).join(' / ')
    const descriptionParts = [localisation]
    if (nature) descriptionParts.push(nature)
    return descriptionParts.join('\n')
  }

  const parseErrorMessage = useCallback(async (res: Response) => {
    try {
      const json = (await res.json()) as { message?: string }
      return json.message ?? res.statusText
    } catch {
      try {
        const text = await res.text()
        return text || res.statusText
      } catch {
        return res.statusText
      }
    }
  }, [])

  const validateForm = useCallback((): boolean => {
    const errs: Record<string, string> = {}
    if (!data.documentMeta.projectName.trim()) errs.projectName = copy.submissionEditor.validation.projectName
    if (!data.documentMeta.projectCode.trim()) errs.projectCode = copy.submissionEditor.validation.projectCode
    if (!data.documentMeta.bordereauNumber || data.documentMeta.bordereauNumber <= 0) {
      errs.bordereauNumber = copy.submissionEditor.validation.bordereauNumber
    }
    if (!data.documentMeta.subject.trim()) errs.subject = copy.submissionEditor.validation.subject
    if (!data.parties.sender.organization.trim()) errs.senderOrg = copy.submissionEditor.validation.senderOrg
    if (!data.parties.recipient.organization.trim()) errs.recipientOrg = copy.submissionEditor.validation.recipientOrg
    const hasItem = (data.items || []).length > 0
    if (!hasItem) errs.items = copy.submissionEditor.validation.items
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }, [copy.submissionEditor.validation, data])

  const handleRender = useCallback(async () => {
    if (!validateForm()) return
    setRendering(true)
    setError(null)
    try {
      const res = await fetch('/api/documents/submissions/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId, data }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const json = (await res.json()) as { renderedHtml?: string }
      setRenderedHtml(json.renderedHtml ?? '')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setRendering(false)
    }
  }, [data, parseErrorMessage, selectedTemplateId, validateForm])

  const fetchInspectionOptions = useCallback(async (options?: { keepSelection?: boolean; searchTerm?: string }) => {
    setLoadingInspections(true)
    setInspectionError(null)
    try {
      const search = new URLSearchParams({
        pageSize: '50',
        sortField: 'updatedAt',
        sortOrder: 'desc',
      })
      const keyword = options?.searchTerm?.trim() ?? ''
      if (keyword) search.set('keyword', keyword)
      const res = await fetch(`/api/inspection-entries?${search.toString()}`, { credentials: 'include' })
      const json = (await res.json()) as { items?: InspectionListItem[]; message?: string }
      if (!res.ok) {
        throw new Error(json.message ?? copy.submissionEditor.errors.loadInspections)
      }
      const merged = new Map<number, InspectionListItem>()
      ;(json.items ?? []).forEach((item) => merged.set(item.id, item))
      if (initialSubmission?.id) {
        const boundRes = await fetch(
          `/api/inspection-entries?documentId=${initialSubmission.id}&pageSize=100&sortField=updatedAt&sortOrder=desc`,
          { credentials: 'include' },
        )
        const boundJson = (await boundRes.json()) as { items?: InspectionListItem[]; message?: string }
        if (!boundRes.ok) {
          throw new Error(boundJson.message ?? copy.submissionEditor.errors.loadBoundInspections)
        }
        const boundItems = boundJson.items ?? []
        boundItems.forEach((item) => merged.set(item.id, item))
        if (!hasLoadedInspectionBindingRef.current && !options?.keepSelection) {
          const boundIds = boundItems.map((item) => item.id)
          setSelectedInspectionIds(boundIds)
          setInitialInspectionIds(boundIds)
          hasLoadedInspectionBindingRef.current = true
        }
      }
      setInspectionOptions(Array.from(merged.values()))
    } catch (err) {
      setInspectionError((err as Error).message)
    } finally {
      setLoadingInspections(false)
    }
  }, [copy.submissionEditor.errors, initialSubmission?.id])

  const toggleInspectionSelection = (id: number) => {
    if (isReadOnly) return
    setSelectedInspectionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const clearInspectionSelection = () => setSelectedInspectionIds([])

  const toggleAllVisibleInspections = () => {
    if (isReadOnly) return
    if (!inspectionOptions.length) return
    const visibleIds = inspectionOptions.map((item) => item.id)
    const allSelected = visibleIds.every((id) => selectedInspectionIds.includes(id))
    if (allSelected) {
      setSelectedInspectionIds((prev) => prev.filter((id) => !visibleIds.includes(id)))
    } else {
      const merged = new Set([...selectedInspectionIds, ...visibleIds])
      setSelectedInspectionIds(Array.from(merged))
    }
  }

  const applyInspectionBinding = async (documentId: number) => {
    const uniqueSelected = Array.from(new Set(selectedInspectionIds))
    const toBind = uniqueSelected.filter((id) => !initialInspectionIds.includes(id))
    const toUnbind = initialInspectionIds.filter((id) => !uniqueSelected.includes(id))

    if (!toBind.length && !toUnbind.length) return

    if (toBind.length) {
      const res = await fetch('/api/inspection-entries/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: toBind, payload: { documentId } }),
      })
      const json = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        throw new Error(json.message ?? copy.submissionEditor.errors.bindInspections)
      }
    }

    if (toUnbind.length) {
      const res = await fetch('/api/inspection-entries/bulk-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: toUnbind, payload: { documentId: null } }),
      })
      const json = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        throw new Error(json.message ?? copy.submissionEditor.errors.unbindInspections)
      }
    }

    setInitialInspectionIds(uniqueSelected)
  }

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTpls(true)
      try {
        const res = await fetch('/api/documents/templates', { credentials: 'include' })
        const json = (await res.json()) as { items?: TemplateOption[]; message?: string }
        if (!res.ok) throw new Error(json.message ?? copy.submissionEditor.errors.loadTemplates)
        const items = json.items ?? []
        setTemplates(items)
        if ((!selectedTemplateId || !items.find((t) => t.id === selectedTemplateId)) && items.length) {
          setSelectedTemplateId(items[0].id ?? null)
        }
      } catch (err) {
        // Fallback to本地文件模版
        const fallback: TemplateOption = {
          id: 'file-bordereau',
          name: 'Bordereau',
          version: 1,
          status: 'PUBLISHED',
          html: '',
          placeholders: [],
        }
        setTemplates([fallback])
        if (!selectedTemplateId) setSelectedTemplateId(fallback.id)
        setError((err as Error).message)
      } finally {
        setLoadingTpls(false)
      }
    }
    loadTemplates()
  }, [copy.submissionEditor.errors.loadTemplates, selectedTemplateId])

  useEffect(() => {
    hasLoadedInspectionBindingRef.current = false
    setInitialInspectionIds([])
    setSelectedInspectionIds([])
    void fetchInspectionOptions({ searchTerm: '' })
  }, [fetchInspectionOptions, initialSubmission?.id])

  useEffect(() => {
    const now = new Date()
    const dateNow = now.toISOString().slice(0, 10)
    const timeNow = now.toISOString().slice(11, 16)
    if (data.parties.sender.date && data.parties.sender.time) return
    setData((prev) => ({
      ...prev,
      parties: {
        ...prev.parties,
        sender: {
          ...prev.parties.sender,
          date: prev.parties.sender.date || dateNow,
          time: prev.parties.sender.time || timeNow,
        },
      },
    }))
  }, [data.parties.sender.date, data.parties.sender.time])

  useEffect(() => {
    if (!selectedTemplateId || rendering) return
    if (renderedHtml) return
    // 自动渲染一次，避免旧缓存导致预览/导出不一致
    void handleRender()
  }, [handleRender, rendering, renderedHtml, selectedTemplateId])

  const handleSave = async (nextStatus: DocumentStatus) => {
    if (isReadOnly) {
      setError(copy.submissionEditor.errors.readOnly)
      return
    }
    if (!selectedTemplateId) {
      setError(copy.submissionEditor.errors.selectTemplate)
      return
    }
    if (!validateForm()) return
    setSaving(true)
    setError(null)
    try {
      const baseItems =
        data.items && data.items.length === 1 && isEmptyItem(data.items[0]) ? [] : data.items || []

      const selectedInspections = inspectionOptions.filter((item) => selectedInspectionIds.includes(item.id))
      const existingDesignations = new Set(
        baseItems.map((item) => (item.designation ?? '').trim()).filter(Boolean),
      )

      const grouped = new Map<
        string,
        {
          sample: InspectionListItem
          checks: Set<string>
          layers: Set<string>
        }
      >()

      selectedInspections.forEach((inspection) => {
        const rawLayers = getRawLayers(inspection)
        const layerKey = rawLayers.length ? rawLayers[0].trim().toLowerCase() : ''
        const key = [
          inspection.roadSlug ?? inspection.roadName,
          inspection.phaseId,
          inspection.side,
          inspection.startPk,
          inspection.endPk,
          layerKey,
        ].join('|')
        const existing = grouped.get(key)
        if (existing) {
          getRawChecks(inspection).forEach((check) => existing.checks.add(check))
          rawLayers.forEach((layer) => existing.layers.add(layer))
        } else {
          grouped.set(key, {
            sample: inspection,
            checks: new Set(getRawChecks(inspection)),
            layers: new Set(rawLayers),
          })
        }
      })

      const autoItems =
        Array.from(grouped.values())
          .map((group) => {
            const merged: InspectionListItem = {
              ...group.sample,
              layers: Array.from(group.layers),
              checks: Array.from(group.checks),
            }
            return buildInspectionDescription(merged).trim()
          })
          .filter((desc) => desc && !existingDesignations.has(desc))
          .map((desc) => ({ designation: desc, quantity: 2, observation: '' })) ?? []
      const itemsPayload = [...baseItems, ...autoItems]

      const payload = {
        title,
        status: nextStatus,
        data: { ...data, items: itemsPayload },
        templateId: selectedTemplateId,
        templateVersion: selectedTemplate?.version ?? null,
      }
      const res = await fetch(initialSubmission ? `/api/documents/submissions/${initialSubmission.id}` : '/api/documents/submissions', {
        method: initialSubmission ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const json = (await res.json()) as { submission?: { id: number; submission?: { submissionNumber?: number | null } } }
      setStatus(nextStatus)
      const submissionId = initialSubmission?.id ?? json.submission?.id ?? null
      const submissionNumber = json.submission?.submission?.submissionNumber ?? null
      if (submissionId) {
        if (autoItems.length) {
          setData((prev) => ({ ...prev, items: itemsPayload }))
        }
        await applyInspectionBinding(submissionId)
        void fetchInspectionOptions({ keepSelection: true, searchTerm: inspectionSearch })
      }
      if (json.submission?.id && !initialSubmission) {
        const target = submissionNumber ? `/documents/submissions/${submissionNumber}` : `/documents/submissions/${json.submission.id}`
        window.location.href = target
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPdf = async () => {
    if (!validateForm()) return
    setError(null)
    try {
      const res = await fetch('/api/documents/submissions/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selectedTemplateId, data }),
      })
      if (!res.ok) {
        throw new Error(await parseErrorMessage(res))
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = title?.trim()
        ? `${title.trim()}.pdf`
        : initialSubmission?.id
          ? `submission-${initialSubmission.id}.pdf`
          : 'submission.pdf'
      a.download = filename
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const addItem = () => {
    setData((prev) => ({ ...prev, items: [...(prev.items || []), { designation: '', quantity: undefined, observation: '' }] }))
  }

  const updateItem = (index: number, key: keyof SubmissionItem, value: string) => {
    setData((prev) => {
      const nextItems = [...(prev.items || [])]
      const existing = nextItems[index] || { designation: '', quantity: undefined, observation: '' }
      const updated: SubmissionItem = { ...existing, [key]: key === 'quantity' ? Number(value) || undefined : value }
      nextItems[index] = updated
      return { ...prev, items: nextItems }
    })
  }

  const isEmptyItem = (item?: SubmissionItem | null) => {
    if (!item) return true
    const designation = (item.designation ?? '').trim()
    const observation = (item.observation ?? '').trim()
    const quantity = item.quantity
    const quantityEmpty = quantity === null || quantity === undefined || Number.isNaN(Number(quantity))
    return !designation && !observation && quantityEmpty
  }

  const removeItem = (index: number) => {
    setData((prev) => {
      const nextItems = [...(prev.items || [])]
      nextItems.splice(index, 1)
      return { ...prev, items: nextItems }
    })
  }

  const updateParty = (role: 'sender' | 'recipient', key: keyof Party, value: string) => {
    setData((prev) => ({
      ...prev,
      parties: {
        ...prev.parties,
        [role]: {
          ...(prev.parties as any)[role],
          [key]: value,
        },
      },
    }))
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {initialSubmission ? copy.submissionEditor.badge.edit : copy.submissionEditor.badge.create}
          </div>
          <div className="flex gap-2 text-xs font-semibold">
            <Link
              href="/documents/submissions"
              className="rounded-full border border-slate-200 px-4 py-2 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
            >
              {copy.submissionEditor.back}
            </Link>
          </div>
        </div>

        {error ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">{error}</div> : null}

        <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`rounded-full px-4 py-2 text-sm transition ${activeTab === 'form' ? 'bg-emerald-500 text-white shadow shadow-emerald-300/40' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {copy.submissionEditor.tabs.form}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={`rounded-full px-4 py-2 text-sm transition ${activeTab === 'preview' ? 'bg-sky-500 text-white shadow shadow-sky-300/40' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
          >
            {copy.submissionEditor.tabs.preview}
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={() => setShowBaseModal(true)}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400 hover:bg-slate-100"
            >
              {copy.submissionEditor.baseFields.label}
            </button>
          ) : null}
          {isReadOnly ? (
            <span className="rounded-full bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-700">
              {copy.submissionEditor.baseFields.readOnly}
            </span>
          ) : null}
        </div>

        {activeTab === 'form' ? (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
            <fieldset className={`space-y-4 border-0 p-0 ${isReadOnly ? 'opacity-75' : ''}`} disabled={isReadOnly}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm font-semibold text-slate-900">{copy.submissionEditor.template.label}</label>
                <select
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  value={selectedTemplateId ?? ''}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  disabled={loadingTpls}
                >
                  <option value="">{copy.submissionEditor.template.placeholder}</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {formatTplName(tpl.name)} v{tpl.version} (
                      {copy.status.template[tpl.status] ?? tpl.status})
                    </option>
                  ))}
                </select>
                <label className="text-sm font-semibold text-slate-900">{copy.submissionEditor.template.titleLabel}</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={copy.submissionEditor.template.titlePlaceholder}
                  className="min-w-[200px] rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                />
                <span className="rounded-full bg-slate-100 px-3 py-2 text-[11px] font-semibold text-slate-700">
                  {statusText}
                </span>
                {loadingTpls ? (
                  <span className="text-xs text-slate-500">{copy.submissionEditor.template.loading}</span>
                ) : null}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{copy.submissionEditor.summary.title}</h3>
                  <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                    <div className="space-y-1 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">{copy.submissionEditor.summary.fields.projectName}</p>
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800">{data.documentMeta.projectName || '—'}</p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">{copy.submissionEditor.summary.fields.projectCode}</p>
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800">{data.documentMeta.projectCode || '—'}</p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">{copy.submissionEditor.summary.fields.contractNumber}</p>
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800">
                        {(data.documentMeta.contractNumbers ?? []).join(', ') || '—'}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-700">
                      <p className="font-semibold text-slate-900">{copy.submissionEditor.summary.fields.recipient}</p>
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800">
                        {[data.parties.recipient.organization, data.parties.recipient.lastName, data.parties.recipient.firstName]
                          .filter(Boolean)
                          .join(' / ') || '—'}
                      </p>
                    </div>
                    <div className="space-y-1 text-xs text-slate-700 md:col-span-2">
                      <p className="font-semibold text-slate-900">{copy.submissionEditor.summary.fields.sender}</p>
                      <p className="rounded-xl bg-white px-3 py-2 text-sm text-slate-800">
                        {[data.parties.sender.organization, data.parties.sender.lastName, data.parties.sender.firstName].filter(Boolean).join(' / ') ||
                          '—'}
                      </p>
                    </div>
                  </div>
                  {!canManage ? (
                    <p className="mt-1 text-xs text-slate-500">{copy.submissionEditor.summary.hint}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-[1fr,8fr,1.5fr,1.5fr]">
                  <label className="space-y-1 text-xs text-slate-700">
                    {copy.submissionEditor.meta.submissionNumber}
                    <input
                      type="number"
                      value={data.documentMeta.bordereauNumber}
                      onChange={(e) =>
                        setData({
                          ...data,
                          documentMeta: { ...data.documentMeta, bordereauNumber: Number(e.target.value) || 0 },
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                    />
                    {fieldErrors.bordereauNumber ? <span className="text-xs text-amber-700">{fieldErrors.bordereauNumber}</span> : null}
                  </label>
                  <label className="space-y-1 text-xs text-slate-700">
                    {copy.submissionEditor.meta.subject}
                    <input
                      value={data.documentMeta.subject}
                      onChange={(e) => setData({ ...data, documentMeta: { ...data.documentMeta, subject: e.target.value } })}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                    />
                    {fieldErrors.subject ? <span className="text-xs text-amber-700">{fieldErrors.subject}</span> : null}
                  </label>
                  <label className="space-y-1 text-xs text-slate-700">
                    {copy.submissionEditor.meta.submissionDate}
                    <input
                      type="date"
                      value={data.parties.sender.date}
                      onChange={(e) => updateParty('sender', 'date', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                  <label className="space-y-1 text-xs text-slate-700">
                    {copy.submissionEditor.meta.submissionTime}
                    <input
                      type="time"
                      value={data.parties.sender.time ?? ''}
                      onChange={(e) => updateParty('sender', 'time', e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">{copy.submissionEditor.items.title}</p>
                  <button
                    type="button"
                    onClick={addItem}
                    className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                  >
                    {copy.submissionEditor.items.add}
                  </button>
                </div>
                <div className="space-y-3">
                  {(data.items || []).map((item, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-[8fr,1fr,2fr,1fr] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <label className="space-y-1 text-xs text-slate-700">
                        {copy.submissionEditor.items.description}
                        <textarea
                          value={item.designation}
                          onChange={(e) => updateItem(idx, 'designation', e.target.value)}
                          className="h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-slate-700">
                        {copy.submissionEditor.items.quantity}
                        <input
                          type="number"
                          value={item.quantity ?? ''}
                          onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                        />
                      </label>
                      <label className="space-y-1 text-xs text-slate-700">
                        {copy.submissionEditor.items.remark}
                        <input
                          value={item.observation ?? ''}
                          onChange={(e) => updateItem(idx, 'observation', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                        />
                      </label>
                      <div className="flex items-start justify-end">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="mt-6 min-w-[72px] rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-50"
                          aria-label={copy.submissionEditor.items.removeAria}
                        >
                          {copy.submissionEditor.items.remove}
                        </button>
                      </div>
                    </div>
                  ))}
                  {(data.items || []).length === 0 && fieldErrors.items ? (
                    <p className="text-xs text-amber-700">{fieldErrors.items}</p>
                  ) : null}
                </div>
              </div>

              <div className="space-y-1 text-xs text-slate-700">
                {copy.submissionEditor.comments.label}
                <textarea
                  value={data.comments ?? ''}
                  onChange={(e) => setData({ ...data, comments: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                />
              </div>

              <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{copy.submissionEditor.inspections.title}</p>
                    <p className="text-xs text-slate-500">{copy.submissionEditor.inspections.hint}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      value={inspectionSearch}
                      onChange={(e) => setInspectionSearch(e.target.value)}
                      placeholder={copy.submissionEditor.inspections.searchPlaceholder}
                      className="w-48 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => fetchInspectionOptions({ keepSelection: true, searchTerm: inspectionSearch })}
                      disabled={loadingInspections}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {loadingInspections
                        ? copy.submissionEditor.inspections.searchLoading
                        : copy.submissionEditor.inspections.searchButton}
                    </button>
                    <button
                      type="button"
                      onClick={toggleAllVisibleInspections}
                      disabled={!inspectionOptions.length}
                      className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {copy.submissionEditor.inspections.toggleAll}
                    </button>
                  </div>
                </div>

                {inspectionError ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{inspectionError}</div>
                ) : null}

                <div className="space-y-2">
                  {inspectionOptions.map((item) => {
                    const checked = selectedInspectionIds.includes(item.id)
                    const layers = item.layers ?? []
                    const checks = item.checks ?? []
                    const types = item.types ?? []
                    const boundToCurrent = initialSubmission?.id && item.documentId === initialSubmission.id
                    const boundMeta = `${
                      item.submissionNumber ? `#${item.submissionNumber}` : ''
                    }${item.submissionCode ? ` (${item.submissionCode})` : ''}`.trim()
                    const boundLabel = boundMeta
                      ? formatCopy(copy.submissionEditor.inspections.boundLabelTemplate, { label: boundMeta })
                      : copy.submissionEditor.inspections.unbound
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/50"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleInspectionSelection(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleInspectionSelection(item.id)
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInspectionSelection(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-400"
                          aria-label={formatCopy(copy.submissionEditor.inspections.ariaSelectTemplate, { id: item.id })}
                        />
                        <div className="flex-1 space-y-2">
                          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {item.roadName} · {item.phaseName}
                              </span>
                              <span className="rounded-full bg-slate-900/80 px-2 py-1 text-[11px] font-semibold text-slate-50">
                                {formatPk(item.startPk)} → {formatPk(item.endPk)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                                {item.status}
                              </span>
                              <span
                                className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                                  boundToCurrent
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : item.documentId
                                      ? 'bg-amber-100 text-amber-700'
                                      : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {boundToCurrent ? copy.submissionEditor.inspections.boundCurrent : boundLabel}
                              </span>
                            </div>
                          </div>
                          <div className="grid gap-2 text-[11px] text-slate-700 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {layers.length ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.layer}：{layers.join(' / ')}
                              </span>
                            ) : null}
                            {checks.length ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.content}：{checks.join(' / ')}
                              </span>
                            ) : null}
                            {types.length ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.type}：{types.join(' / ')}
                              </span>
                            ) : null}
                            {item.appointmentDate ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.appointment}：{item.appointmentDate.slice(0, 10)}
                              </span>
                            ) : null}
                            {item.submissionNumber !== null && item.submissionNumber !== undefined ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.submissionNumber}：{item.submissionNumber}
                              </span>
                            ) : item.submissionOrder !== null && item.submissionOrder !== undefined ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.submissionNumber}：{item.submissionOrder}
                              </span>
                            ) : null}
                            {item.remark ? (
                              <span className="inline-flex rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">
                                {copy.submissionEditor.inspections.labels.remark}：{item.remark}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {!inspectionOptions.length ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                      {loadingInspections
                        ? copy.submissionEditor.inspections.emptyLoading
                        : copy.submissionEditor.inspections.empty}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    {formatCopy(copy.submissionEditor.inspections.selectedCountTemplate, {
                      count: selectedInspectionIds.length,
                    })}
                  </span>
                  <span className="text-slate-500">{copy.submissionEditor.inspections.syncHint}</span>
                </div>
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={handleRender}
                disabled={rendering}
                className="rounded-full bg-emerald-500 px-4 py-2 text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rendering ? copy.submissionEditor.actions.rendering : copy.submissionEditor.actions.render}
              </button>
              {canEdit ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave(DocumentStatus.DRAFT)}
                    disabled={saving}
                    className="rounded-full border border-slate-300 px-4 py-2 text-slate-800 hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && status === DocumentStatus.DRAFT
                      ? copy.submissionEditor.actions.savingDraft
                      : copy.submissionEditor.actions.saveDraft}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(DocumentStatus.FINAL)}
                    disabled={saving}
                    className="rounded-full bg-sky-500 px-4 py-2 text-white shadow-md shadow-sky-300/30 transition hover:-translate-y-0.5 hover:shadow-sky-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving && status === DocumentStatus.FINAL
                      ? copy.submissionEditor.actions.savingFinal
                      : copy.submissionEditor.actions.saveFinal}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-full border border-slate-300 px-4 py-2 text-slate-800 hover:border-slate-400 hover:bg-slate-100"
              >
                {copy.submissionEditor.actions.exportPdf}
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === 'preview' ? (
          <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{copy.submissionEditor.preview.title}</p>
                <p className="text-xs text-slate-500">
                  {copy.submissionEditor.preview.templateLabel}
                  {selectedTemplate ? formatTplName(selectedTemplate.name) : copy.submissionEditor.preview.templateEmpty}{' '}
                  {selectedTemplate?.version ? `v${selectedTemplate.version}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={handleRender}
                  disabled={rendering}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {rendering ? copy.submissionEditor.actions.rendering : copy.submissionEditor.preview.refresh}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="rounded-full border border-slate-300 px-4 py-2 text-slate-800 hover:border-slate-400 hover:bg-slate-100"
                >
                  {copy.submissionEditor.preview.exportPdf}
                </button>
              </div>
            </div>
            <div className="min-h-[420px] rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900">
              {renderedHtml ? (
                <iframe
                  title={copy.submissionEditor.preview.frameTitle}
                  className="mx-auto block h-[900px] w-full max-w-[860px] rounded-xl border border-slate-200 bg-white shadow-inner"
                  sandbox=""
                  srcDoc={renderedHtml}
                />
              ) : (
                <p className="text-slate-500">{copy.submissionEditor.preview.emptyHint}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
      {showBaseModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{copy.submissionEditor.baseModal.title}</h3>
              <button
                type="button"
                onClick={() => setShowBaseModal(false)}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              >
                {copy.submissionEditor.baseModal.close}
              </button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-700 md:col-span-2">
                {copy.submissionEditor.baseModal.fields.projectName}
                <textarea
                  value={data.documentMeta.projectName}
                  onChange={(e) => setData({ ...data, documentMeta: { ...data.documentMeta, projectName: e.target.value } })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                {copy.submissionEditor.baseModal.fields.projectCode}
                <input
                  value={data.documentMeta.projectCode}
                  onChange={(e) => setData({ ...data, documentMeta: { ...data.documentMeta, projectCode: e.target.value } })}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                />
              </label>
              <label className="space-y-1 text-xs text-slate-700">
                {copy.submissionEditor.baseModal.fields.contractNumbers}
                <input
                  value={data.documentMeta.contractNumbers.join(', ')}
                  onChange={(e) =>
                    setData({
                      ...data,
                      documentMeta: { ...data.documentMeta, contractNumbers: e.target.value.split(',').map((v) => v.trim()).filter(Boolean) },
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                />
              </label>
              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-sm font-semibold text-slate-900">{copy.submissionEditor.baseModal.fields.senderTitle}</p>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.organization}
                  <input
                    value={data.parties.sender.organization}
                    onChange={(e) => updateParty('sender', 'organization', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.lastName}
                  <input
                    value={data.parties.sender.lastName}
                    onChange={(e) => updateParty('sender', 'lastName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.firstName}
                  <input
                    value={data.parties.sender.firstName}
                    onChange={(e) => updateParty('sender', 'firstName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.signature}
                  <input
                    value={data.parties.sender.signature ?? ''}
                    onChange={(e) => updateParty('sender', 'signature', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
              </div>

              <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:col-span-2">
                <p className="text-sm font-semibold text-slate-900">{copy.submissionEditor.baseModal.fields.recipientTitle}</p>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.organization}
                  <input
                    value={data.parties.recipient.organization}
                    onChange={(e) => updateParty('recipient', 'organization', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.date}
                  <input
                    type="date"
                    value={data.parties.recipient.date}
                    onChange={(e) => updateParty('recipient', 'date', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.lastName}
                  <input
                    value={data.parties.recipient.lastName}
                    onChange={(e) => updateParty('recipient', 'lastName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.firstName}
                  <input
                    value={data.parties.recipient.firstName}
                    onChange={(e) => updateParty('recipient', 'firstName', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.time}
                  <input
                    value={data.parties.recipient.time ?? ''}
                    onChange={(e) => updateParty('recipient', 'time', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
                <label className="space-y-1 text-xs text-slate-700">
                  {copy.submissionEditor.baseModal.fields.signature}
                  <input
                    value={data.parties.recipient.signature ?? ''}
                    onChange={(e) => updateParty('recipient', 'signature', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBaseModal(false)}
                className="rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-100"
              >
                {copy.submissionEditor.baseModal.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
