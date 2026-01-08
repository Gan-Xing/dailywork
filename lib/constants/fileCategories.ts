export const FILE_CATEGORIES = [
  'signature',
  'inspection-receipt',
  'inspection-acceptance',
  'attendance-sheet',
  'letter-receipt',
  'face-photo',
  'attachment',
  'other',
] as const

export type FileCategory = (typeof FILE_CATEGORIES)[number]
