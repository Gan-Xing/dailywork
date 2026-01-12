'use client'

import { LetterEditor } from '../LetterEditor'

type ProjectOption = { id: number; name: string }

type Props = {
  projects: ProjectOption[]
  canEdit: boolean
  canDelete: boolean
}

export function NewLetterPageClient({ projects, canEdit, canDelete }: Props) {
  return (
    <div className="space-y-6">
      <LetterEditor projects={projects} canEdit={canEdit} canDelete={canDelete} />
    </div>
  )
}
