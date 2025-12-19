'use client'

import { useState } from 'react'

import { TemplateStatus } from '@prisma/client'

type Template = {
  id: string
  name: string
  status: TemplateStatus | string
  version: number
  language?: string
  html: string
}

export default function TemplateEditForm({ template }: { template: Template }) {
  const [name, setName] = useState(template.name)
  const [status, setStatus] = useState<TemplateStatus | string>(template.status ?? 'DRAFT')
  const [version, setVersion] = useState(template.version)
  const [language, setLanguage] = useState(template.language ?? 'fr')
  const [html, setHtml] = useState(template.html)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/documents/templates/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, status, version, language, html }),
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? res.statusText)
      setMessage('已保存模版')
    } catch (err) {
      setMessage((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">编辑模版</h2>
        {message ? <span className="text-xs text-emerald-700">{message}</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-700">
          名称
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-700">
          状态
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TemplateStatus)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="PUBLISHED">PUBLISHED</option>
            <option value="ARCHIVED">ARCHIVED</option>
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-700">
          版本
          <input
            type="number"
            value={version}
            onChange={(e) => setVersion(Number(e.target.value) || 1)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
          />
        </label>
        <label className="space-y-1 text-xs text-slate-700">
          语言
          <input
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-300 focus:outline-none"
          />
        </label>
      </div>
      <label className="space-y-1 text-xs text-slate-700">
        HTML（可包含 &lt;style&gt;）
        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          rows={18}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 focus:border-emerald-300 focus:outline-none"
        />
      </label>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !name || !html}
        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-300/30 transition hover:-translate-y-0.5 hover:shadow-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? '保存中…' : '保存修改'}
      </button>
    </div>
  )
}
