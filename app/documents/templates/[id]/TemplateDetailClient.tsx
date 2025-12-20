'use client'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { formatCopy, locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import TemplateEditForm from './TemplateEditForm'

type Placeholder = { key: string; path?: string }

type TemplateDetail = {
  id: string
  name: string
  status: string
  version: number
  language?: string | null
  html: string
  placeholders?: Placeholder[] | null
}

type Props = {
  template: TemplateDetail
  source: 'file' | 'database'
  showEditForm: boolean
}

export function TemplateDetailClient({ template, source, showEditForm }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)
  const breadcrumbLabel = template.name || copy.breadcrumbs.templateDetailFallback
  const statusLabel = copy.status.template[template.status] ?? template.status
  const sourceLabel =
    source === 'file' ? copy.templateDetail.source.file : copy.templateDetail.source.database
  const statusText = formatCopy(copy.templateDetail.statusTemplate, {
    status: statusLabel,
    version: template.version,
    source: sourceLabel,
  })
  const placeholders = Array.isArray(template.placeholders) ? template.placeholders : []
  const placeholderCount = formatCopy(copy.templateDetail.placeholders.countTemplate, {
    count: placeholders.length,
  })

  return (
    <div className="space-y-6">
      <Breadcrumbs
        variant="light"
        items={[
          { label: copy.breadcrumbs.home, href: '/' },
          { label: copy.breadcrumbs.documents, href: '/documents' },
          { label: copy.breadcrumbs.templates, href: '/documents/templates' },
          { label: breadcrumbLabel },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            {copy.templateDetail.badge}
          </p>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{template.name}</h1>
          <p className="text-sm text-slate-600">{statusText}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{copy.templateDetail.preview.title}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              {copy.templateDetail.preview.readOnly}
            </span>
          </div>
          <div className="mt-3 max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800">
            <pre className="whitespace-pre-wrap break-all">{template.html.slice(0, 5000)}</pre>
            {template.html.length > 5000 ? (
              <p className="mt-2 text-[11px] text-slate-500">{copy.templateDetail.preview.truncated}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">{copy.templateDetail.placeholders.title}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              {placeholderCount}
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-800">
            {placeholders.length ? (
              placeholders.map((ph) => (
                <div key={ph.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="font-semibold text-slate-900">{ph.key}</p>
                  {ph.path && ph.path !== ph.key ? (
                    <p className="text-[11px] text-slate-600">
                      {formatCopy(copy.templateDetail.placeholders.pathTemplate, { path: ph.path })}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-slate-600">{copy.templateDetail.placeholders.empty}</p>
            )}
          </div>
        </div>
      </div>

      {showEditForm ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
          <TemplateEditForm template={template} />
        </div>
      ) : null}
    </div>
  )
}
