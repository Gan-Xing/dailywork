import Link from 'next/link'

import { listTemplates } from '@/lib/server/templateStore'
import { loadBordereauTemplateFromFile } from '@/lib/documents/templateLoader'

import TemplateActions from './TemplateActions'

function formatDate(value: Date | null) {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

function formatName(name: string) {
  // 去掉尾部的“ v数字”重复信息，避免列表出现 “v1 v1”
  return name.replace(/\s+v\d+$/i, '').trim()
}

export default async function TemplatesPage() {
  const templates = await listTemplates()
  const items = templates.length ? templates : [await loadBordereauTemplateFromFile()]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          Templates
          <span className="h-[1px] w-10 bg-emerald-200" />
          管理
        </div>
        <Link
          href="/documents/submissions"
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-100"
        >
          返回提交单 →
        </Link>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">模版列表</h1>
            <p className="text-sm text-slate-600">维护提交单 HTML 模版，解析占位符并发布后可用于创建。</p>
          </div>
          <Link
            href="/documents/templates/new"
            className="rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-amber-200/30 transition hover:-translate-y-0.5 hover:shadow-amber-300/40"
          >
            新建模版
          </Link>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-6 gap-2 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
            <span>名称</span>
            <span>状态</span>
            <span>版本</span>
            <span>语言</span>
            <span>更新时间</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-slate-100 bg-white">
            {items.map((tpl) => (
              <div key={tpl.id} className="grid grid-cols-6 items-center gap-2 px-4 py-3 text-sm text-slate-800">
                <span className="font-semibold text-slate-900">{formatName(tpl.name)}</span>
                <span className="text-xs text-emerald-700">{tpl.status}</span>
                <span className="text-xs text-slate-600">v{tpl.version}</span>
                <span className="text-xs text-slate-600">{tpl.language}</span>
                <span className="text-xs text-slate-500">{formatDate(tpl.updatedAt) || ''}</span>
                <div className="flex justify-end gap-2 text-xs font-semibold">
                  <Link href={`/documents/templates/${tpl.id}`} className="rounded-full bg-emerald-500 px-3 py-1 text-white shadow">
                    查看
                  </Link>
                  <Link
                    href={`/documents/templates/${tpl.id}`}
                    className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                  >
                    编辑
                  </Link>
                  <TemplateActions id={tpl.id} status={tpl.status} />
                </div>
              </div>
            ))}
            {!items.length ? (
              <div className="px-4 py-6 text-sm text-slate-500">暂无模版，请先创建或运行 seed 脚本。</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
