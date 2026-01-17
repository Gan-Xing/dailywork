'use client'

import { useState } from 'react'
import Link from 'next/link'

import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import TemplateActions from './TemplateActions'
import { getTemplateHtml } from './actions'
import { TemplatePreviewModal } from './TemplatePreviewModal'

type TemplateItem = {
  id: string
  name: string
  type?: string | null
  status: string
  version: number
  language?: string | null
  updatedAt: string
}

type Props = {
  items: TemplateItem[]
  canCreate: boolean
  canUpdate: boolean
}

const formatName = (name: string) => name.replace(/\s+v\d+$/i, '').trim()

export function TemplatesPageClient({ items, canCreate, canUpdate }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const handlePreview = async (id: string, name: string) => {
    setLoadingId(id)
    try {
      const html = await getTemplateHtml(id)
      setPreviewHtml(html)
      setPreviewTitle(name)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">


      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{copy.templates.title}</h1>
            <p className="text-sm text-slate-600">{copy.templates.description}</p>
          </div>
          {canCreate ? (
            <Link
              href="/documents/templates/new"
              className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-amber-200/30 transition hover:-translate-y-0.5 hover:shadow-amber-300/40"
            >
              {copy.templates.create}
            </Link>
          ) : (
            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-500">
              {copy.templates.create}
            </span>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-7 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            <span>{copy.templates.columns.name}</span>
            <span>{copy.templates.columns.type}</span>
            <span>{copy.templates.columns.status}</span>
            <span>{copy.templates.columns.version}</span>
            <span>{copy.templates.columns.language}</span>
            <span>{copy.templates.columns.updatedAt}</span>
            <span className="text-right">{copy.templates.columns.actions}</span>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {items.map((tpl) => (
              <div key={tpl.id} className="grid grid-cols-7 items-center gap-2 px-4 py-3 text-sm text-slate-800">
                <span className="font-semibold text-slate-900">{formatName(tpl.name)}</span>
                <span className="text-xs text-slate-600">
                  {copy.documentType?.[tpl.type ?? ''] ?? tpl.type ?? '-'}
                </span>
                <span className="text-xs text-emerald-700">
                  {copy.status.template[tpl.status] ?? tpl.status}
                </span>
                <span className="text-xs text-slate-600">v{tpl.version}</span>
                <span className="text-xs text-slate-600">{tpl.language}</span>
                <span className="text-xs text-slate-500">{tpl.updatedAt || ''}</span>
                <div className="flex justify-end gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => handlePreview(tpl.id, formatName(tpl.name))}
                    disabled={loadingId === tpl.id}
                    className="rounded-full bg-emerald-500 px-3 py-1 text-white shadow disabled:opacity-70"
                  >
                    {loadingId === tpl.id ? '...' : copy.templates.actions.view}
                  </button>
                  {canUpdate ? (
                    <>
                      <Link
                        href={`/documents/templates/${tpl.id}`}
                        className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                      >
                        {copy.templates.actions.edit}
                      </Link>
                      <TemplateActions id={tpl.id} status={tpl.status} />
                    </>
                  ) : null}
                </div>
              </div>
            ))}
            {!items.length ? (
              <div className="px-4 py-6 text-sm text-slate-500">{copy.templates.empty}</div>
            ) : null}
          </div>
        </div>
      </div>

      <TemplatePreviewModal
        open={!!previewHtml}
        title={previewTitle}
        html={previewHtml ?? ''}
        onClose={() => setPreviewHtml(null)}
      />
    </div>
  )
}

