import Link from 'next/link'

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        Documents Hub
        <span className="h-[1px] w-10 bg-emerald-200" />
        Bordereau
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">文档管理</h1>
            <p className="max-w-2xl text-slate-600">
              先完成提交单（Bordereau）的线上填写、模版管理与 PDF 导出；保持字段与报检记录兼容，方便后续扩展函件、会议纪要、物资领用等类型。
            </p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">MVP</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">模版+提交单</span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">PDF 导出</span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">快速动作</p>
            <div className="mt-2 flex flex-col gap-2">
              <Link href="/documents/submissions/new" className="rounded-full bg-emerald-500 px-3 py-2 text-center text-white shadow transition hover:-translate-y-0.5 hover:shadow-emerald-300/40">
                新建提交单
              </Link>
              <Link
                href="/documents/templates"
                className="rounded-full border border-slate-200 px-3 py-2 text-center font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-100"
              >
                管理模版
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">提交单</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">列表 / 创建 / 预览 / PDF</h2>
            <p className="mt-2 text-sm text-slate-600">状态筛选、搜索、模版选择、实时预览与 PDF 导出；兼顾报检数据的稳定性。</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Link
                href="/documents/submissions"
                className="rounded-2xl bg-white px-4 py-2 text-slate-900 shadow-sm ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-200"
              >
                前往提交单 →
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">模版</p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">HTML 模版管理</h2>
            <p className="mt-2 text-sm text-slate-600">维护 `bordereau.html` 与占位符，发布/回滚；发布后用于创建提交单，支持字段自动生成表单。</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Link
                href="/documents/templates"
                className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:text-slate-900"
              >
                前往模版管理 →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
