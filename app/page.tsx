import Link from 'next/link'

const modules = [
  {
    title: '日报系统',
    href: '/reports',
    tone: 'from-blue-400/80 via-cyan-300/80 to-emerald-300/60',
    description: '快速进入日报录入与日历视图，保持现场信息连续更新。',
    tags: ['创建/编辑', '月历视图', '最近更新'],
    cta: '进入日报',
  },
  {
    title: '项目进度',
    href: '/progress',
    tone: 'from-orange-300/80 via-amber-200/80 to-rose-300/80',
    description: '汇总工期节点、关键风险与甘特视图，规划对齐更直观。',
    tags: ['里程碑', '风险跟踪', '甘特预览'],
    cta: '查看进度',
  },
] as const

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(69,162,255,0.15),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(244,137,37,0.16),transparent_20%),radial-gradient(circle_at_60%_70%,rgba(72,236,169,0.15),transparent_25%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-80 w-[60vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-white/8 via-blue-400/10 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-12">
        <header className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
              DAILYWORK
              <span className="h-[1px] w-10 bg-slate-300/40" />
              HUB
            </p>
            <div className="space-y-3">
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                集中入口，协调
                <span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-emerald-200 bg-clip-text text-transparent">
                  日报
                </span>
                与
                <span className="bg-gradient-to-r from-orange-200 via-amber-100 to-rose-200 bg-clip-text text-transparent">
                  进度
                </span>
                。
              </h1>
              <p className="max-w-2xl text-lg text-slate-200/80">
                把一线更新、项目里程碑放在同一块操作面板，保持团队节奏一致。当前开放 2 个核心入口，后续模块可随时接入。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/reports"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-blue-500/30"
              >
                立即填写日报
                <span aria-hidden>↗</span>
              </Link>
              <Link
                href="/progress"
                className="inline-flex items-center gap-2 rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-slate-50 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
              >
                查看项目进度
              </Link>
            </div>
          </div>

          <div className="grid w-full max-w-xs gap-3 self-start rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-100 backdrop-blur lg:max-w-sm">
            <div className="flex items-center justify-between">
              <p className="text-slate-300">当前入口</p>
              <p className="text-lg font-semibold">2</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-slate-300">最近更新</p>
              <p className="text-lg font-semibold">日报与进度模块同步</p>
            </div>
            <div className="rounded-xl bg-gradient-to-r from-blue-400/20 via-cyan-300/20 to-emerald-300/20 p-3 text-xs text-slate-900 shadow-inner shadow-blue-500/20">
              <p className="font-semibold uppercase tracking-widest text-slate-950/70">Coming next</p>
              <p className="mt-1 text-slate-900">
                支持更多入口：质量巡检、物资追踪、风险复盘。
              </p>
            </div>
          </div>
        </header>

        <section className="mt-12 grid gap-6 md:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 transition duration-200 hover:-translate-y-1 hover:border-white/25 hover:shadow-slate-950/40"
            >
              <div
                className={`absolute inset-0 -z-10 bg-gradient-to-br ${module.tone} opacity-60 transition duration-200 group-hover:opacity-90`}
              />
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-50">
                  入口
                </span>
                <span className="text-xs text-slate-100/80">持续维护</span>
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-slate-950">{module.title}</h2>
              <p className="mt-2 text-sm text-slate-900/90">{module.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {module.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-white/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-900"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 transition group-hover:translate-x-0.5">
                {module.cta}
                <span aria-hidden className="text-base">
                  →
                </span>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-12 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-100 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-300" />
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
              扩展空间
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {['质量巡检', '物资进出', '风险复盘', 'AI 总结', '导出中心'].map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-50"
              >
                {item}
              </span>
            ))}
          </div>
          <p className="text-slate-200/80">
            未来的入口会延续同一视觉规范：清晰分区、带状态标识、可快速跳转到具体场景。需要新增模块时直接在此卡片组追加即可。
          </p>
        </section>
      </div>
    </main>
  )
}
