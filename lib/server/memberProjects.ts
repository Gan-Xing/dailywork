import type { Prisma } from '@prisma/client'

export type ProjectAssignmentInput = {
  userId: number
  projectId: number | null
  startDate: Date
  fallbackStartDate?: Date | null
}

export const applyProjectAssignment = async (
  tx: Prisma.TransactionClient,
  { userId, projectId, startDate, fallbackStartDate = null }: ProjectAssignmentInput,
) => {
  const current = await tx.userProjectAssignment.findFirst({
    where: { userId, endDate: null },
    orderBy: [{ startDate: 'desc' }, { id: 'desc' }],
    select: { id: true, projectId: true },
  })

  if (current && current.projectId === projectId) {
    return { changed: false }
  }

  const effectiveStartDate = current ? startDate : (fallbackStartDate ?? startDate)

  if (current) {
    await tx.userProjectAssignment.update({
      where: { id: current.id },
      data: { endDate: effectiveStartDate },
    })
  }

  if (projectId) {
    await tx.userProjectAssignment.create({
      data: {
        userId,
        projectId,
        startDate: effectiveStartDate,
      },
    })
  }

  return { changed: true }
}
