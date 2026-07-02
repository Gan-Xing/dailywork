export const TANDA_ATTACHMENT_SIDE_CODES = {
  LEFT: 'CG',
  RIGHT: 'CD',
  CENTER: 'X',
} as const

export const TANDA_ATTACHMENT_SIDES = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  CENTER: 'CENTER',
} as const

export type TandaAttachmentSide =
  (typeof TANDA_ATTACHMENT_SIDES)[keyof typeof TANDA_ATTACHMENT_SIDES]

export type ResolvedTandaAttachmentSide = {
  raw: string
  normalizedRaw: string
  side: TandaAttachmentSide
  code: (typeof TANDA_ATTACHMENT_SIDE_CODES)[keyof typeof TANDA_ATTACHMENT_SIDE_CODES]
  zh: string
  fr: string
  note?: string
}

const sideDefinitions: Record<TandaAttachmentSide, Omit<ResolvedTandaAttachmentSide, 'raw' | 'normalizedRaw'>> = {
  LEFT: {
    side: TANDA_ATTACHMENT_SIDES.LEFT,
    code: TANDA_ATTACHMENT_SIDE_CODES.LEFT,
    zh: '左侧',
    fr: 'Côté gauche',
  },
  RIGHT: {
    side: TANDA_ATTACHMENT_SIDES.RIGHT,
    code: TANDA_ATTACHMENT_SIDE_CODES.RIGHT,
    zh: '右侧',
    fr: 'Côté droit',
  },
  CENTER: {
    side: TANDA_ATTACHMENT_SIDES.CENTER,
    code: TANDA_ATTACHMENT_SIDE_CODES.CENTER,
    zh: '中间',
    fr: 'Centre',
    note: 'X 固定表示中间，只表达侧别，不表达道路。',
  },
}

const sideAliasMap: Record<string, TandaAttachmentSide> = {
  CG: TANDA_ATTACHMENT_SIDES.LEFT,
  GAUCHE: TANDA_ATTACHMENT_SIDES.LEFT,
  LEFT: TANDA_ATTACHMENT_SIDES.LEFT,
  L: TANDA_ATTACHMENT_SIDES.LEFT,
  左: TANDA_ATTACHMENT_SIDES.LEFT,
  左侧: TANDA_ATTACHMENT_SIDES.LEFT,

  CD: TANDA_ATTACHMENT_SIDES.RIGHT,
  DROITE: TANDA_ATTACHMENT_SIDES.RIGHT,
  RIGHT: TANDA_ATTACHMENT_SIDES.RIGHT,
  R: TANDA_ATTACHMENT_SIDES.RIGHT,
  右: TANDA_ATTACHMENT_SIDES.RIGHT,
  右侧: TANDA_ATTACHMENT_SIDES.RIGHT,

  X: TANDA_ATTACHMENT_SIDES.CENTER,
  CENTER: TANDA_ATTACHMENT_SIDES.CENTER,
  CENTRE: TANDA_ATTACHMENT_SIDES.CENTER,
  AXE: TANDA_ATTACHMENT_SIDES.CENTER,
  中: TANDA_ATTACHMENT_SIDES.CENTER,
  中间: TANDA_ATTACHMENT_SIDES.CENTER,
  中线: TANDA_ATTACHMENT_SIDES.CENTER,
}

export const normalizeTandaAttachmentSideLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\u4e00-\u9fa5]+/g, '')
    .trim()

export const resolveTandaAttachmentSide = (
  value: string | null | undefined,
): ResolvedTandaAttachmentSide | null => {
  if (!value?.trim()) return null

  const normalizedRaw = normalizeTandaAttachmentSideLabel(value)
  const side = sideAliasMap[normalizedRaw]
  if (!side) return null

  return {
    raw: value,
    normalizedRaw,
    ...sideDefinitions[side],
  }
}
