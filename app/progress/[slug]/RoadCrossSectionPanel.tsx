'use client'

import { useMemo, useState } from 'react'

import { useToast } from '@/components/ToastProvider'
import type {
  RoadCrossSectionDTO,
  RoadCrossSectionPayload,
  RoadCrossSectionStatus,
  RoadSectionDTO,
} from '@/lib/progressTypes'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import { locales } from '@/lib/i18n'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type RoadCrossSectionPanelProps = {
  road: RoadSectionDTO
  initialCrossSections: RoadCrossSectionDTO[]
  roadOptions: RoadSectionDTO[]
  canManage: boolean
}

type FormState = {
  startPk: string
  endPk: string
  profileCode: string
  carriagewayWidthM: string
  leftShoulderWidthM: string
  rightShoulderWidthM: string
  totalWidthM: string
  status: RoadCrossSectionStatus
  sourceDocumentId: string
  sourcePage: string
  sourceVersion: string
  referenceRoadId: string
  note: string
}

const statusLabels: Record<RoadCrossSectionStatus, string> = {
  APPROVED: '已确认',
  ASSUMED_FROM_REFERENCE: '参照口径',
  NEEDS_CONFIRMATION: '待确认',
  SUPERSEDED: '已作废',
}

const statusTone: Record<RoadCrossSectionStatus, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  ASSUMED_FROM_REFERENCE: 'border-sky-200 bg-sky-50 text-sky-700',
  NEEDS_CONFIRMATION: 'border-amber-200 bg-amber-50 text-amber-700',
  SUPERSEDED: 'border-slate-200 bg-slate-100 text-slate-600',
}

const inputClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100'

const textareaClass =
  'min-h-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100'

const toNumericText = (value: string) => {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : ''
}

const createEmptyForm = (road: RoadSectionDTO): FormState => ({
  startPk: toNumericText(road.startPk),
  endPk: toNumericText(road.endPk),
  profileCode: '',
  carriagewayWidthM: '',
  leftShoulderWidthM: '',
  rightShoulderWidthM: '',
  totalWidthM: '',
  status: 'NEEDS_CONFIRMATION',
  sourceDocumentId: '',
  sourcePage: '',
  sourceVersion: '',
  referenceRoadId: '',
  note: '',
})

const toFormState = (section: RoadCrossSectionDTO): FormState => ({
  startPk: String(section.startPk),
  endPk: String(section.endPk),
  profileCode: section.profileCode,
  carriagewayWidthM: String(section.carriagewayWidthM),
  leftShoulderWidthM: section.leftShoulderWidthM === null || section.leftShoulderWidthM === undefined
    ? ''
    : String(section.leftShoulderWidthM),
  rightShoulderWidthM: section.rightShoulderWidthM === null || section.rightShoulderWidthM === undefined
    ? ''
    : String(section.rightShoulderWidthM),
  totalWidthM: String(section.totalWidthM),
  status: section.status,
  sourceDocumentId: section.sourceDocumentId ? String(section.sourceDocumentId) : '',
  sourcePage: section.sourcePage ?? '',
  sourceVersion: section.sourceVersion ?? '',
  referenceRoadId: section.referenceRoadId ? String(section.referenceRoadId) : '',
  note: section.note ?? '',
})

const parseRequiredNumber = (value: string, label: string) => {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new Error(`${label}必须是有效数字`)
  }
  return number
}

const parseOptionalNumber = (value: string) => {
  if (!value.trim()) {
    return null
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    throw new Error('可选数值字段必须是有效数字')
  }
  return number
}

const parseOptionalId = (value: string, label: string) => {
  if (!value.trim()) {
    return null
  }
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`${label}无效`)
  }
  return id
}

const buildPayload = (form: FormState): RoadCrossSectionPayload => ({
  startPk: parseRequiredNumber(form.startPk, '起点桩号'),
  endPk: parseRequiredNumber(form.endPk, '终点桩号'),
  profileCode: form.profileCode.trim(),
  carriagewayWidthM: parseRequiredNumber(form.carriagewayWidthM, '车行道宽度'),
  leftShoulderWidthM: parseOptionalNumber(form.leftShoulderWidthM),
  rightShoulderWidthM: parseOptionalNumber(form.rightShoulderWidthM),
  totalWidthM: parseRequiredNumber(form.totalWidthM, '总宽度'),
  status: form.status,
  sourceDocumentId: parseOptionalId(form.sourceDocumentId, '来源文件 ID'),
  sourcePage: form.sourcePage.trim() || null,
  sourceVersion: form.sourceVersion.trim() || null,
  referenceRoadId: parseOptionalId(form.referenceRoadId, '参照道路'),
  note: form.note.trim() || null,
})

const sortCrossSections = (sections: RoadCrossSectionDTO[]) =>
  [...sections].sort((left, right) => left.startPk - right.startPk || left.endPk - right.endPk || left.id - right.id)

const readErrorMessage = async (response: Response, fallback: string) => {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null
  return payload?.message ?? fallback
}

export function RoadCrossSectionPanel({
  road,
  initialCrossSections,
  roadOptions,
  canManage,
}: RoadCrossSectionPanelProps) {
  const { locale } = usePreferredLocale('zh', locales)
  const { addToast } = useToast()
  const [crossSections, setCrossSections] = useState(initialCrossSections)
  const [form, setForm] = useState<FormState>(() => createEmptyForm(road))
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'zh-CN', {
        maximumFractionDigits: 2,
      }),
    [locale],
  )

  const referenceOptions = useMemo(
    () =>
      roadOptions
        .filter(
          (item) =>
            item.id !== road.id &&
            (!road.projectId || !item.projectId || item.projectId === road.projectId),
        )
        .sort((left, right) =>
          resolveRoadName(left, locale).localeCompare(
            resolveRoadName(right, locale),
            locale === 'fr' ? 'fr-FR' : 'zh-CN',
          ),
        ),
    [locale, road.id, road.projectId, roadOptions],
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const formatMeter = (value: number | null | undefined) =>
    value === null || value === undefined ? '-' : `${numberFormatter.format(value)} m`

  const resetForm = () => {
    setEditingId(null)
    setForm(createEmptyForm(road))
    setIsFormOpen(false)
  }

  const startCreate = () => {
    setEditingId(null)
    setForm(createEmptyForm(road))
    setIsFormOpen(true)
  }

  const startEdit = (section: RoadCrossSectionDTO) => {
    setEditingId(section.id)
    setForm(toFormState(section))
    setIsFormOpen(true)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const payload = buildPayload(form)
      const response = await fetch(
        editingId
          ? `/api/roads/${road.id}/cross-sections/${editingId}`
          : `/api/roads/${road.id}/cross-sections`,
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, '保存横断面失败'))
      }
      const data = (await response.json()) as { crossSection: RoadCrossSectionDTO }
      setCrossSections((current) => {
        if (editingId) {
          return sortCrossSections(
            current.map((item) => (item.id === editingId ? data.crossSection : item)),
          )
        }
        return sortCrossSections([...current, data.crossSection])
      })
      addToast('横断面已保存', { tone: 'success' })
      resetForm()
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (section: RoadCrossSectionDTO) => {
    if (!window.confirm(`删除 ${section.profileCode} 的横断面记录？`)) {
      return
    }
    try {
      const response = await fetch(`/api/roads/${road.id}/cross-sections/${section.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, '删除横断面失败'))
      }
      setCrossSections((current) => current.filter((item) => item.id !== section.id))
      if (editingId === section.id) {
        resetForm()
      }
      addToast('横断面已删除', { tone: 'success' })
    } catch (error) {
      addToast((error as Error).message, { tone: 'danger' })
    }
  }

  return (
    <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Cross section</p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">标准横断面与宽度</h2>
          <p className="mt-2 text-sm text-slate-500">
            {crossSections.length
              ? `${crossSections.length} 条宽度口径已保存`
              : '暂无横断面口径'}
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={isFormOpen ? resetForm : startCreate}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSaving}
          >
            {isFormOpen ? '收起表单' : '新增横断面'}
          </button>
        ) : null}
      </div>

      {crossSections.length ? (
        <div className="divide-y divide-slate-100">
          {crossSections.map((section) => (
            <div key={section.id} className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-slate-950">{section.profileCode}</span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone[section.status]}`}
                  >
                    {statusLabels[section.status]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                    PK {numberFormatter.format(section.startPk)} - {numberFormatter.format(section.endPk)}
                  </span>
                </div>
                <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">车行道</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{formatMeter(section.carriagewayWidthM)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">左路肩</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{formatMeter(section.leftShoulderWidthM)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">右路肩</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{formatMeter(section.rightShoulderWidthM)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">总宽</dt>
                    <dd className="mt-1 font-semibold text-slate-900">{formatMeter(section.totalWidthM)}</dd>
                  </div>
                </dl>
                <div className="grid gap-2 text-xs text-slate-500 md:grid-cols-2">
                  <p>
                    来源：
                    {section.sourceDocument
                      ? `${section.sourceDocument.documentName}${section.sourceDocument.versionTag ? ` · ${section.sourceDocument.versionTag}` : ''}`
                      : section.sourceDocumentId
                        ? `文件 ID ${section.sourceDocumentId}`
                        : '未绑定'}
                    {section.sourcePage ? ` · ${section.sourcePage}` : ''}
                    {section.sourceVersion ? ` · ${section.sourceVersion}` : ''}
                  </p>
                  <p>
                    参照：
                    {section.referenceRoad
                      ? resolveRoadName(section.referenceRoad, locale)
                      : section.referenceRoadId
                        ? `道路 ID ${section.referenceRoadId}`
                        : '无'}
                  </p>
                </div>
                {section.note ? <p className="text-sm text-slate-600">{section.note}</p> : null}
              </div>
              {canManage ? (
                <div className="flex items-start gap-2 lg:justify-end">
                  <button
                    type="button"
                    onClick={() => startEdit(section)}
                    className="h-9 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    disabled={isSaving}
                  >
                    编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(section)}
                    className="h-9 rounded-xl border border-rose-200 px-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    disabled={isSaving}
                  >
                    删除
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-sm text-slate-500">还没有保存任何标准横断面或参照口径。</div>
      )}

      {canManage && isFormOpen ? (
        <form onSubmit={handleSubmit} className="mt-5 border-t border-slate-100 pt-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              起点桩号
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.startPk}
                onChange={(event) => setField('startPk', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              终点桩号
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.endPk}
                onChange={(event) => setField('endPk', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              横断面编号
              <input
                className={inputClass}
                value={form.profileCode}
                onChange={(event) => setField('profileCode', event.target.value)}
                disabled={isSaving}
                placeholder="如 PT-2B"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              状态
              <select
                className={inputClass}
                value={form.status}
                onChange={(event) => setField('status', event.target.value as RoadCrossSectionStatus)}
                disabled={isSaving}
              >
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              车行道宽度 m
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.carriagewayWidthM}
                onChange={(event) => setField('carriagewayWidthM', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              左路肩宽度 m
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.leftShoulderWidthM}
                onChange={(event) => setField('leftShoulderWidthM', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              右路肩宽度 m
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.rightShoulderWidthM}
                onChange={(event) => setField('rightShoulderWidthM', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              总宽度 m
              <input
                className={inputClass}
                inputMode="decimal"
                value={form.totalWidthM}
                onChange={(event) => setField('totalWidthM', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              来源文件 ID
              <input
                className={inputClass}
                inputMode="numeric"
                value={form.sourceDocumentId}
                onChange={(event) => setField('sourceDocumentId', event.target.value)}
                disabled={isSaving}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              来源页码
              <input
                className={inputClass}
                value={form.sourcePage}
                onChange={(event) => setField('sourcePage', event.target.value)}
                disabled={isSaving}
                placeholder="如 P03"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              来源版本
              <input
                className={inputClass}
                value={form.sourceVersion}
                onChange={(event) => setField('sourceVersion', event.target.value)}
                disabled={isSaving}
                placeholder="如 Ind 03"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
              参照道路
              <select
                className={inputClass}
                value={form.referenceRoadId}
                onChange={(event) => setField('referenceRoadId', event.target.value)}
                disabled={isSaving}
              >
                <option value="">无</option>
                {referenceOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {resolveRoadName(option, locale)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="mt-4 flex flex-col gap-1.5 text-sm font-semibold text-slate-700">
            备注
            <textarea
              className={textareaClass}
              value={form.note}
              onChange={(event) => setField('note', event.target.value)}
              disabled={isSaving}
              placeholder="如 2C/2D/2E/2F 按 2B 标准横断面执行"
            />
          </label>
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={resetForm}
              className="h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              disabled={isSaving}
            >
              取消
            </button>
            <button
              type="submit"
              className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving}
            >
              {isSaving ? '保存中...' : editingId ? '保存修改' : '保存横断面'}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}
