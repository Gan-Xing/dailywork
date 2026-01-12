'use client'

import type { LetterDetail } from '../LetterEditor'
import { LetterEditor } from '../LetterEditor'

type ProjectOption = { id: number; name: string }

type Props = {
  initialLetter: LetterDetail
  projects: ProjectOption[]
  canEdit: boolean
  canDelete: boolean
}

export function LetterDetailClient({ initialLetter, projects, canEdit, canDelete }: Props) {
  return (
    <div className="space-y-6">
      <LetterEditor
        initialLetter={initialLetter}
        projects={projects}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    </div>
  )
}
