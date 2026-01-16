export const FILE_LINK_ENTITY_TYPES = [
  'user',
  'inspection',
  'submission',
  'actual-boq-item',
  'other',
] as const

export type FileLinkEntityType = (typeof FILE_LINK_ENTITY_TYPES)[number]
