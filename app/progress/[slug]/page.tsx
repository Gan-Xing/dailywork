import { PhaseEditor } from './PhaseEditor'
import { ProgressDetailHeader } from '../ProgressDetailHeader'
import { ProgressNotFound } from '../ProgressNotFound'
import { AccessDenied } from '@/components/AccessDenied'
import type { PhaseDefinitionDTO, RoadSectionDTO } from '@/lib/progressTypes'
import type { WorkflowBinding } from '@/lib/progressWorkflow'
import { getProgressCopy } from '@/lib/i18n/progress'
import { getSessionUser } from '@/lib/server/authSession'
import { listPhaseDefinitions, listPhases } from '@/lib/server/progressStore'
import { getRoadBySlug } from '@/lib/server/roadStore'
import { getWorkflowByPhaseDefinitionId } from '@/lib/server/workflowStore'

export const dynamic = 'force-dynamic'

export default async function RoadDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const road = (await getRoadBySlug(slug)) as RoadSectionDTO | null
  const sessionUser = await getSessionUser()
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

  const [phases, phaseDefinitions] = await Promise.all([listPhases(road.id), listPhaseDefinitions()])
  const workflows = (
    await Promise.all(
      phaseDefinitions.map((definition) => getWorkflowByPhaseDefinitionId(definition.id)),
    )
  ).filter(Boolean) as WorkflowBinding[]

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ProgressDetailHeader road={road} />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <PhaseEditor
          road={road}
          initialPhases={phases}
          phaseDefinitions={phaseDefinitions as PhaseDefinitionDTO[]}
          workflows={workflows}
          canManage={canManage}
          canInspect={canInspect}
          canViewInspection={canViewInspection}
        />
      </div>
    </main>
  )
}
