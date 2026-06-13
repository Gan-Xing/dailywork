import type { Locale } from '@/lib/i18n'

export const WEEKLY_PLAN_GOODS_KEYS = [
  'diesel',
  'cement',
  'bitumen',
  'engine_oil',
  'hydraulic_oil',
  'grease',
  'gear_oil',
  'brake_fluid',
  'coolant',
  'binding_wire',
  'rebar',
  'angle_steel',
  'flat_steel',
  'steel_plate',
  'sand',
  'gravel_5_15',
  'gravel_15_25',
  'water_reducer',
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
    key: 'engine_oil',
    label: { zh: '机油', fr: 'Huile moteur' },
    aliases: ['engine oil', 'huile moteur', '机油', '润滑油', '发动机油'],
  },
  {
    key: 'hydraulic_oil',
    label: { zh: '液压油', fr: 'Huile hydraulique' },
    aliases: ['hydraulic oil', 'huile hydraulique', '液压油'],
  },
  {
    key: 'grease',
    label: { zh: '黄油', fr: 'Graisse' },
    aliases: ['grease', 'lubricating grease', 'graisse', 'graisse lubrifiante', '黄油', '润滑脂'],
  },
  {
    key: 'gear_oil',
    label: { zh: '齿轮油', fr: 'Huile de transmission' },
    aliases: ['gear oil', 'huile pour engrenages', 'huile de transmission', '齿轮油', '传动油'],
  },
  {
    key: 'brake_fluid',
    label: { zh: '刹车油', fr: 'Liquide de frein' },
    aliases: ['brake fluid', 'liquide de frein', '刹车油', '制动液'],
  },
  {
    key: 'coolant',
    label: { zh: '冷却液', fr: 'Liquide de refroidissement' },
    aliases: ['coolant', 'liquide de refroidissement', 'antigel', '冷却液', '防冻液'],
  },
  {
    key: 'binding_wire',
    label: { zh: '钢扎丝', fr: 'Fil de fer recuit à ligaturer' },
    aliases: [
      'binding wire',
      'tie wire',
      'steel tying wire',
      'black annealed tie wire',
      'fil de fer recuit',
      'fil de fer recuit à ligaturer',
      'fil a ligaturer',
      'fil à ligaturer',
      "fil d'attache",
      'fil d attache',
      'fil recuit',
      '钢扎丝',
      '扎丝',
      '绑丝',
    ],
  },
  {
    key: 'rebar',
    label: { zh: '钢筋', fr: "Acier d'armature" },
    aliases: [
      'rebar',
      'reinforcing steel',
      'reinforcement steel',
      'steel bar',
      'rebar steel',
      'acier darmature',
      "acier d'armature",
      'armature',
      '钢筋',
      '螺纹钢',
      '盘螺',
      '圆钢',
    ],
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
  {
    key: 'sand',
    label: { zh: '砂', fr: 'Sable' },
    aliases: ['sand', 'sable', '砂', '细砂', '中砂'],
  },
  {
    key: 'gravel_5_15',
    label: { zh: '5-15碎石', fr: 'Gravier 5/15' },
    aliases: ['gravel515', 'gravier515', '5-15碎石', '515碎石', '碎石5-15', '5/15 gravier', 'gravier 5/15'],
  },
  {
    key: 'gravel_15_25',
    label: { zh: '15-25碎石', fr: 'Gravier 15/25' },
    aliases: [
      'gravel1525',
      'gravier1525',
      '15-25碎石',
      '1525碎石',
      '碎石15-25',
      '15/25 gravier',
      'gravier 15/25',
    ],
  },
  {
    key: 'water_reducer',
    label: { zh: '减水剂', fr: "Réducteur d'eau" },
    aliases: [
      'water reducer',
      'water_reducer',
      'reducteur deau',
      "réducteur d'eau",
      '减水剂',
      '外加剂',
      '速凝剂',
      'adjuvant',
    ],
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
