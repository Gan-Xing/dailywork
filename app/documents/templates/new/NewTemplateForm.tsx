'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TemplateStatus } from '@prisma/client'

import { locales, formatCopy } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type Placeholder = { key: string; path?: string }

export default function NewTemplateForm() {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const router = useRouter()

  const [name, setName] = useState('')
  const [language, setLanguage] = useState('fr')
  const [version, setVersion] = useState(1)
  const [status, setStatus] = useState<TemplateStatus | string>('DRAFT')
  const [type, setType] = useState('SUBMISSION')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  const templateTypes = ['SUBMISSION', 'LETTER', 'MINUTES', 'SUPPLY_REQUEST', 'DAILY_REPORT']
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Dynamically extract placeholders from HTML using Regex {{variable}}
  const placeholders: Placeholder[] = useMemo(() => {
    const regex = /\{\{([\w.]+)\}\}/g
    const found = new Set<string>()
    let match
    while ((match = regex.exec(html)) !== null) {
      found.add(match[1])
    }
    return Array.from(found).sort().map(key => ({ key }))
  }, [html])

  const handleSubmit = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/documents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, language, version, status, html, type }),
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? res.statusText)
      
      setMessage(copy.newTemplateForm.saved)
      
      // Redirect to the edit page of the newly created template
      if (json.id) {
         router.push(`/documents/templates/${json.id}`)
      } else {
         // Fallback if no ID returned (though it should)
         window.location.reload()
      }

    } catch (err) {
      setMessage((err as Error).message)
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
           <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            {copy.newTemplateForm.badge.title}
            <span className="h-[1px] w-10 bg-emerald-200" />
            {copy.newTemplateForm.badge.suffix}
          </div>
          {message ? <span className="text-xs text-emerald-700">{message}</span> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs text-slate-700">
            {copy.newTemplateForm.fields.name}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            />
          </label>
           <label className="space-y-1 text-xs text-slate-700">
            {copy.newTemplateForm.fields.status}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            >
              <option value="DRAFT">{copy.status.template.DRAFT}</option>
              <option value="PUBLISHED">{copy.status.template.PUBLISHED}</option>
              <option value="ARCHIVED">{copy.status.template.ARCHIVED}</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-slate-700">
            {copy.newTemplateForm.fields.type}
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
            {copy.newTemplateForm.fields.version}
            <input
              type="number"
              value={version}
              onChange={(e) => setVersion(Number(e.target.value) || 1)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
            />
          </label>
           <label className="space-y-1 text-xs text-slate-700">
            {copy.newTemplateForm.fields.language}
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
            <label className="text-xs text-slate-700">{copy.newTemplateForm.fields.html}</label>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving || !name || !html}
              className="rounded-full bg-emerald-500 px-6 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? copy.newTemplateForm.saving : copy.newTemplateForm.save}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="min-h-[600px] w-full flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-emerald-300 focus:outline-none"
            placeholder={copy.newTemplateForm.htmlPlaceholder}
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
                {placeholders.length}
              </span>
            </div>
             <p className="mt-2 text-xs text-slate-500">
              {locale === 'zh'
                ? '从 HTML 中自动提取的字段'
                : 'Fields extracted from HTML'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">
              {placeholders.length > 0 ? (
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