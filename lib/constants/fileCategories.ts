export const FILE_CATEGORIES = [
  'signature',
  'inspection-receipt',
  'inspection-acceptance',
  'attendance-sheet',
  'letter-receipt',
  'face-photo',
  'site-photo',
  'attachment',
  'other',
] as const

export type FileCategory = (typeof FILE_CATEGORIES)[number]

export const PHOTO_CATEGORIES = ['signature', 'face-photo', 'site-photo'] as const

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]
