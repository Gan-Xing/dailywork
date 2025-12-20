'use client'

import { useState } from 'react'

import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export default function NewTemplateForm() {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const [name, setName] = useState('')
  const [language, setLanguage] = useState('fr')
  const [version, setVersion] = useState(1)
  const [status, setStatus] = useState('DRAFT')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/documents/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, language, version, status, html }),
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? res.statusText)
      setMessage(copy.newTemplateForm.saved)
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {copy.newTemplateForm.badge.title}
        <span className="h-[1px] w-10 bg-emerald-200" />
        {copy.newTemplateForm.badge.suffix}
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-md">
        <div className="space-y-3">
          {message ? <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">{message}</div> : null}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-xs text-slate-700">
              {copy.newTemplateForm.fields.name}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-xs text-slate-700">
              {copy.newTemplateForm.fields.language}
              <input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
              />
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
          </div>
          <label className="space-y-1 text-xs text-slate-700">
            {copy.newTemplateForm.fields.html}
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              rows={18}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-emerald-300 focus:outline-none"
              placeholder={copy.newTemplateForm.htmlPlaceholder}
            />
          </label>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !name || !html}
            className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? copy.newTemplateForm.saving : copy.newTemplateForm.save}
          </button>
        </div>
      </div>
    </div>
  )
}
