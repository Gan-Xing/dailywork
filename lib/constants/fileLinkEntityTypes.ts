export const FILE_LINK_ENTITY_TYPES = [
  'user',
  'inspection',
  'submission',
  'actual-boq-item',
  'leader-log',
  'other',
] as const

export type FileLinkEntityType = (typeof FILE_LINK_ENTITY_TYPES)[number]
