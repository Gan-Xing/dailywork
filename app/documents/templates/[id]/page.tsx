import { notFound } from 'next/navigation'

import { getTemplate } from '@/lib/server/templateStore'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'

import TemplateEditForm from './TemplateEditForm'

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) return notFound()
  const tpl = id === 'file-bordereau' ? await loadBordereauTemplateFromFile() : await getTemplate(id)
  if (!tpl) return notFound()

  const sourceLabel = id === 'file-bordereau' ? '来源：文件系统' : '来源：数据库'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Template</p>
          <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{tpl.name}</h1>
          <p className="text-sm text-slate-600">
            状态：{tpl.status} · 版本 v{tpl.version} · {sourceLabel}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">HTML 预览</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">只读</span>
          </div>
          <div className="mt-3 max-h-[520px] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800">
            <pre className="whitespace-pre-wrap break-all">{tpl.html.slice(0, 5000)}</pre>
            {tpl.html.length > 5000 ? <p className="mt-2 text-[11px] text-slate-500">…内容过长已截断</p> : null}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-800 shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">占位符字段</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700">
              {Array.isArray(tpl.placeholders) ? tpl.placeholders.length : 0} 个
            </span>
          </div>
          <div className="mt-3 space-y-2 text-xs text-slate-800">
            {Array.isArray(tpl.placeholders) && tpl.placeholders.length ? (
              (tpl.placeholders as Array<{ key: string; path?: string }>).map((ph) => (
                <div key={ph.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="font-semibold text-slate-900">{ph.key}</p>
                  {ph.path && ph.path !== ph.key ? <p className="text-[11px] text-slate-600">path: {ph.path}</p> : null}
                </div>
              ))
            ) : (
              <p className="text-slate-600">暂无占位符，请检查模版内容。</p>
            )}
          </div>
        </div>
      </div>

      {id !== 'file-bordereau' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-md">
          <TemplateEditForm template={tpl} />
        </div>
      ) : null}
    </div>
  )
}
