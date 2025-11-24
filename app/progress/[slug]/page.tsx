import Link from 'next/link'

import { PhaseEditor } from './PhaseEditor'
import type { CheckDefinitionDTO, LayerDefinitionDTO, PhaseDefinitionDTO, RoadSectionDTO } from '@/lib/progressTypes'
import { getSessionUser } from '@/lib/server/authSession'
import { listCheckDefinitions, listLayerDefinitions, listPhaseDefinitions, listPhases } from '@/lib/server/progressStore'
import { getRoadBySlug } from '@/lib/server/roadStore'

export const dynamic = 'force-dynamic'

interface Params {
  params: {
    slug: string
  }
}

export default async function RoadDetailPage({ params }: Params) {
  const road = (await getRoadBySlug(params.slug)) as RoadSectionDTO | null
  const sessionUser = getSessionUser()
  const canManage = sessionUser?.permissions.includes('road:manage') ?? false

  if (!road) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50">
        <div className="mx-auto max-w-4xl px-6 py-14 sm:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-200">
            <h1 className="text-2xl font-semibold text-slate-50">路段不存在</h1>
            <p className="mt-2 text-slate-300">未找到对应路段，请返回列表。</p>
            <Link
              href="/progress"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-400/25 transition hover:-translate-y-0.5"
            >
              返回进度看板
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const [phases, phaseDefinitions, layerOptions, checkOptions] = await Promise.all([
    listPhases(road.id),
    listPhaseDefinitions(),
    listLayerDefinitions(),
    listCheckDefinitions(),
  ])

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-5xl px-6 py-14 sm:px-8">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-100">
            Road Detail
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-slate-50">{road.name}</h1>
          <p className="text-sm text-slate-200/80">
            路由：{road.slug} · 起点：{road.startPk} · 终点：{road.endPk}
          </p>
          <div className="flex gap-3">
            <Link
              href="/progress"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-slate-50 transition hover:border-white/40 hover:bg-white/10"
            >
              返回列表
            </Link>
          </div>
        </header>

        <div className="mt-8">
          <PhaseEditor
            road={road}
            initialPhases={phases}
            phaseDefinitions={phaseDefinitions as PhaseDefinitionDTO[]}
            layerOptions={layerOptions as LayerDefinitionDTO[]}
            checkOptions={checkOptions as CheckDefinitionDTO[]}
            canManage={canManage}
          />
        </div>
      </div>
    </main>
  )
}
