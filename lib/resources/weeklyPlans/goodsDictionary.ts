import type { Locale } from '@/lib/i18n'

export const WEEKLY_PLAN_GOODS_KEYS = [
  'diesel',
  'cement',
  'bitumen',
  'angle_steel',
  'flat_steel',
  'steel_plate',
] as const

export type WeeklyPlanGoodsKey = (typeof WEEKLY_PLAN_GOODS_KEYS)[number]

type WeeklyPlanGoodsDefinition = {
  key: WeeklyPlanGoodsKey
  label: Record<Locale, string>
  aliases: string[]
}

const normalizeLookup = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
    .trim()

const weeklyPlanGoodsDefinitions: WeeklyPlanGoodsDefinition[] = [
  {
    key: 'diesel',
    label: { zh: '柴油', fr: 'Gasoil' },
    aliases: ['diesel', 'gasoil', '柴油', '柴油0号', '0#柴油', '柴油0#'],
  },
  {
    key: 'cement',
    label: { zh: '水泥', fr: 'Ciment' },
    aliases: ['cement', 'ciment', '水泥'],
  },
  {
    key: 'bitumen',
    label: { zh: '沥青', fr: 'Bitume' },
    aliases: ['bitumen', 'bitume', '沥青'],
  },
  {
    key: 'angle_steel',
    label: { zh: '角铁', fr: 'CORNIERES' },
    aliases: ['angle_steel', 'angle steel', 'corniere', 'cornieres', '角铁'],
  },
  {
    key: 'flat_steel',
    label: { zh: '扁铁', fr: 'Fer plat' },
    aliases: ['flat_steel', 'flat steel', 'fer plat', '扁铁'],
  },
  {
    key: 'steel_plate',
    label: { zh: '钢板', fr: "Tôle d'acier" },
    aliases: ['steel_plate', 'steel plate', 'tole dacier', "tôle d'acier", '钢板'],
  },
]

const goodsDefinitionByKey = new Map(
  weeklyPlanGoodsDefinitions.map((definition) => [definition.key, definition]),
)

const goodsKeyByAlias = new Map<string, WeeklyPlanGoodsKey>()

weeklyPlanGoodsDefinitions.forEach((definition) => {
  goodsKeyByAlias.set(normalizeLookup(definition.key), definition.key)
  goodsKeyByAlias.set(normalizeLookup(definition.label.zh), definition.key)
  goodsKeyByAlias.set(normalizeLookup(definition.label.fr), definition.key)
  definition.aliases.forEach((alias) => {
    goodsKeyByAlias.set(normalizeLookup(alias), definition.key)
  })
})

export const isWeeklyPlanGoodsKey = (value: string): value is WeeklyPlanGoodsKey =>
  goodsDefinitionByKey.has(value as WeeklyPlanGoodsKey)

export const parseWeeklyPlanGoodsKey = (
  value: string | null | undefined,
): WeeklyPlanGoodsKey | null => {
  const normalized = normalizeLookup(value)
  if (!normalized) return null
  if (isWeeklyPlanGoodsKey(normalized)) return normalized
  return goodsKeyByAlias.get(normalized) ?? null
}

export const getWeeklyPlanGoodsLabel = (locale: Locale, key: WeeklyPlanGoodsKey): string =>
  goodsDefinitionByKey.get(key)?.label[locale] ?? key

export const resolveWeeklyPlanGoodsLabel = (input: {
  locale: Locale
  goodsName?: string | null
  goodsNameKey?: string | null
}): string => {
  const resolvedKey =
    parseWeeklyPlanGoodsKey(input.goodsNameKey) ?? parseWeeklyPlanGoodsKey(input.goodsName)
  if (resolvedKey) return getWeeklyPlanGoodsLabel(input.locale, resolvedKey)

  const fallback = (input.goodsName ?? input.goodsNameKey ?? '').trim()
  return fallback
}

export const weeklyPlanGoodsDictionary = weeklyPlanGoodsDefinitions
