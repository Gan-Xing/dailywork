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

  let signature = await prisma.userSignature.findFirst({
    where: { userId: user.id, isActive: true },
    include: { file: true },
  })
  if (!signature) {
    signature = await prisma.userSignature.findFirst({
      where: { userId: user.id },
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
    userId: user.id,
  }
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
