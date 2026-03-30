import { prisma } from '@/lib/prisma'
import { createPresignedUrl } from '@/lib/server/r2'

const SIGNATURE_URL_TTL = 300
const INSPECTION_DIRECTOR_USERNAME = 'duqin'
const INSPECTION_QUALITY_USERNAME = 'ganxing'

type SignatureUrl = {
  url: string
  storageKey: string
  userId: number
}

const getSignatureUrlForUserId = async (userId: number): Promise<SignatureUrl | null> => {
  let signature = await prisma.userSignature.findFirst({
    where: { userId, isActive: true },
    include: { file: true },
  })
  if (!signature) {
    signature = await prisma.userSignature.findFirst({
      where: { userId },
      include: { file: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    })
  }
  if (!signature) return null

  return {
    url: createPresignedUrl({
      method: 'GET',
      storageKey: signature.file.storageKey,
      expiresInSeconds: SIGNATURE_URL_TTL,
    }),
    storageKey: signature.file.storageKey,
    userId,
  }
}

const getActiveSignatureUrlByUsername = async (username: string): Promise<SignatureUrl | null> => {
  const user = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: 'insensitive',
      },
    },
    select: { id: true },
  })
  if (!user) return null

  return getSignatureUrlForUserId(user.id)
}

export const getInspectionSignatureUrls = async () => {
  const [director, quality] = await Promise.all([
    getActiveSignatureUrlByUsername(INSPECTION_DIRECTOR_USERNAME),
    getActiveSignatureUrlByUsername(INSPECTION_QUALITY_USERNAME),
  ])

  return {
    director: director?.url ?? null,
    quality: quality?.url ?? null,
  }
}

export const getActiveSignatureUrlByUserId = async (
  userId: number | null | undefined,
): Promise<string | null> => {
  if (!userId || !Number.isInteger(userId) || userId <= 0) return null
  const signature = await getSignatureUrlForUserId(userId)
  return signature?.url ?? null
}

export const getWeeklyPlanSignatureUrls = async (input: {
  approverUserId?: number | null
  editorUserId?: number | null
}) => {
  const [approver, editor] = await Promise.all([
    getActiveSignatureUrlByUserId(input.approverUserId),
    getActiveSignatureUrlByUserId(input.editorUserId),
  ])

  return {
    approver,
    editor,
  }
}
