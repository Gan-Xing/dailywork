'use client'

import { useState, useRef } from 'react'

import { TemplateStatus } from '@prisma/client'

import { locales, formatCopy } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type Template = {
  id: string
  name: string
  type?: string | null
  status: TemplateStatus | string
  version: number
  language?: string | null
  html: string
}

type Placeholder = { key: string; path?: string }

export default function TemplateEditForm({
  template,
  placeholders,
}: {
  template: Template
  placeholders?: Placeholder[]
}) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const [name, setName] = useState(template.name)
  const [status, setStatus] = useState<TemplateStatus | string>(template.status ?? 'DRAFT')
  const [version, setVersion] = useState(template.version)
  const [language, setLanguage] = useState(template.language ?? 'fr')
  const [type, setType] = useState(template.type ?? 'SUBMISSION')
  const [html, setHtml] = useState(template.html)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const templateTypes = ['SUBMISSION', 'LETTER', 'MINUTES', 'SUPPLY_REQUEST', 'DAILY_REPORT']

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/documents/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, status, version, language, html, type }),
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? res.statusText)
      setMessage(copy.templateEditForm.saved)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const insertPlaceholder = (key: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const textToInsert = `{{${key}}}`
    const currentHtml = html
    const newHtml = currentHtml.substring(0, start) + textToInsert + currentHtml.substring(end)

    setHtml(newHtml)

    // Restore focus and update cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length)
    }, 0)
  }

  return (
    <div className="flex h-full flex-col space-y-4 lg:flex-row lg:space-x-6 lg:space-y-0">
      {/* Left Column: Form Fields and Code Editor */}
      <div className="flex flex-1 flex-col space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{copy.templateEditForm.title}</h2>
          {message ? <span className="text-xs text-emerald-700">{message}</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs text-slate-700">
            {copy.templateEditForm.fields.name}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            {copy.templateEditForm.fields.status}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TemplateStatus)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            >
              <option value="DRAFT">{copy.status.template.DRAFT}</option>
              <option value="PUBLISHED">{copy.status.template.PUBLISHED}</option>
              <option value="ARCHIVED">{copy.status.template.ARCHIVED}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            {copy.templateEditForm.fields.type}
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            >
              {templateTypes.map((value) => (
                <option key={value} value={value}>
                  {copy.documentType?.[value] ?? value}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            {copy.templateEditForm.fields.version}
            <input
              type="number"
              value={version}
              onChange={(e) => setVersion(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            {copy.templateEditForm.fields.language}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            >
              {locales.map((loc) => (
                <option key={loc} value={loc}>
                  {loc.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-1 flex-col space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-700">{copy.templateEditForm.fields.html}</label>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !name || !html}
              className="rounded-full bg-emerald-500 px-6 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? copy.templateEditForm.saving : copy.templateEditForm.save}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="min-h-[600px] w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-emerald-300 focus:outline-none"
            spellCheck={false}
          />
        </div>
      </div>

      {/* Right Column: Placeholders Reference */}
      <div className="w-full lg:w-80 lg:shrink-0">
        <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col space-y-4 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                {copy.templateDetail.placeholders.title}
              </p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
                {placeholders?.length ?? 0}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {locale === 'zh'
                ? '点击字段插入到编辑器'
                : 'Click field to insert into editor'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              {placeholders && placeholders.length > 0 ? (
                placeholders.map((ph) => (
                  <button
                    key={ph.key}
                    type="button"
                    onClick={() => insertPlaceholder(ph.key)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:border-emerald-300 hover:bg-emerald-50 hover:shadow-sm"
                  >
                    <p className="font-mono text-xs font-semibold text-emerald-700">
                      {ph.key}
                    </p>
                    {ph.path && ph.path !== ph.key ? (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        {formatCopy(copy.templateDetail.placeholders.pathTemplate, {
                          path: ph.path,
                        })}
                      </p>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-600">
                  {copy.templateDetail.placeholders.empty}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}