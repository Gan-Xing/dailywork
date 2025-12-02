import { PhaseEditor } from './PhaseEditor'
import { ProgressDetailHeader } from '../ProgressDetailHeader'
import { ProgressNotFound } from '../ProgressNotFound'
import { AccessDenied } from '@/components/AccessDenied'
import type { CheckDefinitionDTO, LayerDefinitionDTO, PhaseDefinitionDTO, RoadSectionDTO } from '@/lib/progressTypes'
import { getProgressCopy } from '@/lib/i18n/progress'
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
  const canView =
    !sessionUser || sessionUser?.permissions.includes('progress:view') || false
  const canManage = sessionUser?.permissions.includes('progress:edit') || false
  const canInspect = sessionUser?.permissions.includes('inspection:create') || false
  const canViewInspection = sessionUser?.permissions.includes('inspection:view') || false

  if (!canView) {
    const t = getProgressCopy('zh')
    return (
      <AccessDenied
        permissions={['progress:view']}
        hint={t.access.progressDetailHint}
      />
    )
  }

  if (!road) {
    return <ProgressNotFound />
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
          <ProgressDetailHeader road={road} />
        </header>

        <div className="mt-8">
          <PhaseEditor
            road={road}
            initialPhases={phases}
            phaseDefinitions={phaseDefinitions as PhaseDefinitionDTO[]}
            layerOptions={layerOptions as LayerDefinitionDTO[]}
            checkOptions={checkOptions as CheckDefinitionDTO[]}
            canManage={canManage}
            canInspect={canInspect}
            canViewInspection={canViewInspection}
          />
        </div>
      </div>
    </main>
  )
}
