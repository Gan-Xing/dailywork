export type FileLink = {
  id: number
  entityType: string
  entityId: string
  purpose: string | null
  label: string | null
}

export type FileRow = {
  id: number
  category: string
  originalName: string
  mimeType: string
  size: number
  storageKey: string
  createdAt: string
  createdBy: string
  createdById: number | null
  ownerUser: string
  ownerUserId: number | null
  links: FileLink[]
  linkCount: number
  signatureCount: number
}

export type FilesQuery = {
  search?: string
  category?: string | string[]
  entityType?: string
  entityId?: string
  createdFrom?: string
  createdTo?: string
  page?: string
  pageSize?: string
}
