import Link from 'next/link'

type RoadStatus = '施工中' | '未开工' | '取消'

type PhaseStatus = '未启动' | '进行中' | '验收中' | '已完成'

interface Phase {
  name: string
  status: PhaseStatus
  progress: number
}

interface Road {
  name: string
  city: string
  status: RoadStatus
  progress: number
  phases: Phase[]
  note?: string
  href?: string
}

// Mock 数据：根据用户描述预填状态，后续可由接口替换
const roads: Road[] = [
  {
    name: '大学城路',
    city: 'Bondoukou / 邦杜库',
    status: '施工中',
    progress: 42,
    note: '已有图纸并开工，优先推进路基与垫层。',
    href: '/progress/bondoukou-university',
    phases: [
      { name: '土方', status: '进行中', progress: 65 },
      { name: '垫层', status: '验收中', progress: 40 },
      { name: '底基层', status: '未启动', progress: 0 },
      { name: '基层', status: '未启动', progress: 0 },
      { name: '面层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '邦杜库1号路',
    city: 'Bondoukou / 邦杜库',
    status: '未开工',
    progress: 0,
    phases: [
      { name: '土方', status: '未启动', progress: 0 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '邦杜库2号路',
    city: 'Bondoukou / 邦杜库',
    status: '未开工',
    progress: 0,
    phases: [
      { name: '土方', status: '未启动', progress: 0 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '邦杜库3号路',
    city: 'Bondoukou / 邦杜库',
    status: '未开工',
    progress: 0,
    phases: [
      { name: '土方', status: '未启动', progress: 0 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '邦杜库4号路',
    city: 'Bondoukou / 邦杜库',
    status: '未开工',
    progress: 0,
    phases: [
      { name: '土方', status: '未启动', progress: 0 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '邦杜库5号路',
    city: 'Bondoukou / 邦杜库',
    status: '未开工',
    progress: 0,
    phases: [
      { name: '土方', status: '未启动', progress: 0 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '穿城路',
    city: 'Tanda / 丹达',
    status: '施工中',
    progress: 30,
    note: '主线放样完毕，路基填方推进中。',
    phases: [
      { name: '土方', status: '进行中', progress: 55 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '丹达1号路',
    city: 'Tanda / 丹达',
    status: '施工中',
    progress: 18,
    phases: [
      { name: '土方', status: '进行中', progress: 35 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '丹达2号路',
    city: 'Tanda / 丹达',
    status: '施工中',
    progress: 12,
    phases: [
      { name: '土方', status: '进行中', progress: 25 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '丹达3号路',
    city: 'Tanda / 丹达',
    status: '施工中',
    progress: 10,
    phases: [
      { name: '土方', status: '进行中', progress: 20 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '丹达5号路',
    city: 'Tanda / 丹达',
    status: '施工中',
    progress: 8,
    phases: [
      { name: '土方', status: '进行中', progress: 15 },
      { name: '垫层', status: '未启动', progress: 0 },
      { name: '底基层', status: '未启动', progress: 0 },
    ],
  },
  {
    name: '丹达4号路（取消）',
    city: 'Tanda / 丹达',
    status: '取消',
    progress: 0,
    note: '项目方确认取消，不再排产。',
    phases: [],
  },
]

const statusTone: Record<RoadStatus, string> = {
  施工中: 'bg-emerald-300 text-slate-900',
  未开工: 'bg-white/60 text-slate-900',
  取消: 'bg-slate-500 text-white',
}

const phaseTone: Record<PhaseStatus, string> = {
  未启动: 'bg-white/10 text-slate-200',
  进行中: 'bg-blue-200 text-slate-900',
  验收中: 'bg-amber-200 text-slate-900',
  已完成: 'bg-emerald-300 text-slate-900',
}

export default function ProgressPage() {
  const startedCount = roads.filter((road) => road.status === '施工中').length
  const pendingCount = roads.filter((road) => road.status === '未开工').length
  const canceledCount = roads.filter((road) => road.status === '取消').length

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-5xl px-6 py-14 sm:px-8">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            Project Progress
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">道路进度看板</h1>
          <p className="max-w-2xl text-sm text-slate-200/80">
            市政路项目（Bondoukou / Tanda）各条道路的线性工程进度示意，当前为 Mock 数据；后续可替换为真实报检/验收统计。
          </p>
          <div className="flex gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
            >
              返回首页
            </Link>
            <Link
              href="/reports"
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
            >
              去填写日报
            </Link>
          </div>
        </header>

        <section className="mt-10 grid gap-3 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-emerald-300/20 p-4 text-slate-900 shadow-inner shadow-emerald-400/20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-900/70">施工中</p>
            <p className="mt-2 text-3xl font-semibold">{startedCount}</p>
            <p className="text-xs text-slate-900/70">已有图纸并开工的道路</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-slate-50 shadow-inner shadow-slate-900/20">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">未开工</p>
            <p className="mt-2 text-3xl font-semibold">{pendingCount}</p>
            <p className="text-xs text-slate-200/80">等待图纸或指令</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-500/30 p-4 text-slate-50 shadow-inner shadow-slate-900/30">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">取消</p>
            <p className="mt-2 text-3xl font-semibold">{canceledCount}</p>
            <p className="text-xs text-slate-200/80">已确认取消的道路</p>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            路段总览
            <span className="h-px w-12 bg-white/30" />
            Mock 数据
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {roads.map((road) => {
              const card = (
                <div
                  className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30 transition duration-150 hover:-translate-y-0.5 hover:border-white/25"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-slate-200/70">{road.city}</p>
                      <h2 className="text-xl font-semibold text-slate-50">{road.name}</h2>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone[road.status]}`}
                    >
                      {road.status}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-slate-200">
                      <p>整体进度</p>
                      <p>{road.progress}%</p>
                    </div>
                    <div className="mt-2 h-2.5 rounded-full bg-white/10">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-emerald-300 via-blue-300 to-cyan-200"
                        style={{ width: `${road.progress}%` }}
                      />
                    </div>
                  </div>
                  {road.note ? <p className="mt-3 text-xs text-slate-200/80">{road.note}</p> : null}
                  {road.phases.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-200/80">分项工程</p>
                        {road.href ? (
                          <span className="text-[11px] text-emerald-200/90">点击卡片查看详情</span>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {road.phases.map((phase) => (
                          <span
                            key={phase.name}
                            className={`rounded-full px-3 py-1 text-[11px] font-semibold ${phaseTone[phase.status]}`}
                          >
                            {phase.name} · {phase.progress}%
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-xs text-slate-200/70">暂无分项（已取消）。</p>
                  )}
                </div>
              )

              return road.href ? (
                <Link key={road.name} href={road.href} className="block">
                  {card}
                </Link>
              ) : (
                <div key={road.name}>{card}</div>
              )
            })}
          </div>
        </section>

        <section className="mt-10 grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-100 backdrop-blur">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            下一步
            <span className="h-px w-12 bg-white/30" />
            报检串联
          </div>
          <ul className="space-y-2 text-slate-200/90">
            <li>• 将上述 Mock 替换为报检/验收实时数据，自动驱动进度条颜色。</li>
            <li>• 点击分项或左右侧分段，弹出报检弹窗（与日报模块打通）。</li>
            <li>• 补充点状结构物（涵洞等）位置及 Layer × Step 矩阵。</li>
          </ul>
          <Link
            href="/reports"
            className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
          >
            去日报提交报检
            <span aria-hidden>↗</span>
          </Link>
        </section>
      </div>
    </main>
  )
}
