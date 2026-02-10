import type { Locale } from '@/lib/i18n'
import type { MachineAsset } from '@/types/machines'

export const MACHINE_EQUIPMENT_TYPE_KEYS = [
  'compaction',
  'bulldozer',
  'loader',
  'grader',
  'excavator',
  'backhoe',
  'drilling',
  'earthmoving',
  'paving',
  'dump_truck',
  'hauling',
  'service_truck',
  'plant',
  'lifting',
  'handling',
  'logistics',
  'power',
  'pumping',
  'welding',
  'survey',
  'lab',
  'other',
  'unclassified',
] as const

export type MachineEquipmentTypeKey = (typeof MACHINE_EQUIPMENT_TYPE_KEYS)[number]

export const MACHINE_EQUIPMENT_TYPE_UNCLASSIFIED: MachineEquipmentTypeKey = 'unclassified'

type MachineEquipmentTypeDefinition = {
  key: MachineEquipmentTypeKey
  label: Record<Locale, string>
}

export const machineEquipmentTypes: MachineEquipmentTypeDefinition[] = [
  { key: 'compaction', label: { zh: '压实设备', fr: 'Compactage' } },
  { key: 'bulldozer', label: { zh: '推土机', fr: 'Bulldozers' } },
  { key: 'loader', label: { zh: '装载机', fr: 'Chargeuses' } },
  { key: 'grader', label: { zh: '平地机', fr: 'Niveleuses' } },
  { key: 'excavator', label: { zh: '挖掘机', fr: 'Pelles' } },
  { key: 'backhoe', label: { zh: '两头忙', fr: 'Tractopelles' } },
  { key: 'drilling', label: { zh: '钻机/打桩', fr: 'Forage / Pieux' } },
  { key: 'earthmoving', label: { zh: '土方设备', fr: 'Terrassement' } },
  { key: 'paving', label: { zh: '路面施工', fr: 'Chaussée / Enrobés' } },
  { key: 'dump_truck', label: { zh: '自卸运输', fr: 'Camions bennes' } },
  { key: 'hauling', label: { zh: '牵引与大件', fr: 'Porte-chars / Remorques' } },
  { key: 'service_truck', label: { zh: '罐车与服务车', fr: 'Citernes & Services' } },
  { key: 'plant', label: { zh: '工业/站点设备', fr: 'Installations / Industrie' } },
  { key: 'lifting', label: { zh: '起重设备', fr: 'Levage' } },
  { key: 'handling', label: { zh: '装卸搬运', fr: 'Manutention' } },
  { key: 'logistics', label: { zh: '后勤车辆', fr: 'Logistique' } },
  { key: 'power', label: { zh: '动力设备', fr: 'Énergie' } },
  { key: 'pumping', label: { zh: '泵送与排水', fr: 'Pompage' } },
  { key: 'welding', label: { zh: '焊接与维修', fr: 'Soudure & Atelier' } },
  { key: 'survey', label: { zh: '测量设备', fr: 'Topographie' } },
  { key: 'lab', label: { zh: '试验设备', fr: 'Laboratoire' } },
  { key: 'other', label: { zh: '其他', fr: 'Autres' } },
  { key: 'unclassified', label: { zh: '未分类', fr: 'Non classé' } },
]

const normalizeText = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

const equipmentTypeByKey = new Map(machineEquipmentTypes.map((def) => [def.key, def]))
const equipmentTypeByLabel = new Map<string, MachineEquipmentTypeKey>()

const normalizeLookup = (value: string) =>
  normalizeText(value)
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
    .trim()

machineEquipmentTypes.forEach((def) => {
  equipmentTypeByLabel.set(normalizeLookup(def.label.zh), def.key)
  equipmentTypeByLabel.set(normalizeLookup(def.label.fr), def.key)
})

export const isMachineEquipmentTypeKey = (value: string): value is MachineEquipmentTypeKey => {
  return equipmentTypeByKey.has(value as MachineEquipmentTypeKey)
}

export const parseMachineEquipmentTypeKey = (value: unknown): MachineEquipmentTypeKey | null => {
  const text = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
  if (!text) return null
  if (isMachineEquipmentTypeKey(text)) return text
  const normalized = normalizeLookup(text)
  if (!normalized) return null
  return equipmentTypeByLabel.get(normalized) ?? null
}

export const getMachineEquipmentTypeLabel = (
  locale: Locale,
  key: MachineEquipmentTypeKey,
): string => {
  return equipmentTypeByKey.get(key)?.label[locale] ?? key
}

const containsAny = (haystack: string, needles: string[]) => needles.some((needle) => haystack.includes(needle))

export const inferMachineEquipmentTypeKey = (
  machine: Pick<MachineAsset, 'assetCategoryName' | 'assetName' | 'specModel' | 'alias'>,
): MachineEquipmentTypeKey | null => {
  const raw = [machine.assetCategoryName, machine.assetName, machine.specModel, machine.alias]
    .filter(Boolean)
    .join(' ')
  const text = normalizeText(raw)
  if (!text) return null

  if (
    containsAny(text, [
      'compacteur',
      'rouleau',
      'rouleaux',
      'monobille',
      'double bille',
      'pied de mouton',
      '压路机',
      '羊足',
      '胶轮',
      '轮胎',
    ])
  ) {
    return 'compaction'
  }

  if (
    containsAny(text, [
      'benne',
      'dump',
      'tipper',
      '自卸',
      '8x4',
      '6x4',
      '4x2',
      'camion benne',
    ])
  ) {
    return 'dump_truck'
  }

  if (
    containsAny(text, [
      'citerne',
      'citernes',
      'tank',
      'tanker',
      'fuel',
      'diesel',
      'gasoil',
      'essence',
      'arroseuse',
      'eau',
      'atelier mobile',
      'ravitail',
      '加油车',
      '油罐',
      '罐车',
      '洒水',
      '水车',
      '服务车',
      '维修车',
    ])
  ) {
    return 'service_truck'
  }

  if (
    containsAny(text, [
      'porte-char',
      'porte char',
      'porte chars',
      'remorque',
      'semi-remorque',
      'semi remorque',
      'lowbed',
      'low bed',
      'trailer',
      'plateau',
      '牵引',
      '拖车',
      '挂车',
      '板车',
    ])
  ) {
    return 'hauling'
  }

  if (containsAny(text, ['bulldozer', 'dozer', '推土'])) {
    return 'bulldozer'
  }

  if (containsAny(text, ['niveleuse', 'grader', '平地'])) {
    return 'grader'
  }

  if (containsAny(text, ['chargeur', 'chargeuse', 'wheel loader', 'loader', '装载'])) {
    return 'loader'
  }

  if (containsAny(text, ['tractopelle', 'backhoe', '两头忙', '挖掘装载'])) {
    return 'backhoe'
  }

  if (containsAny(text, ['foreuse', 'drill', '钻机', 'pieux', 'pile', '打桩', '桩'])) {
    return 'drilling'
  }

  if (containsAny(text, ['pelle', 'excav', 'excavator', '挖掘'])) {
    return 'excavator'
  }

  if (containsAny(text, ['terrassement', 'earthmoving', '土方'])) {
    return 'earthmoving'
  }

  if (
    containsAny(text, [
      'finisseur',
      'paver',
      '摊铺',
      'recycleuse',
      'malaxeuse',
      'raboteuse',
      'milling',
      '再生',
      '拌和',
      '铣刨',
      'repandeuse',
      'epandeur',
      'spreader',
      '撒布',
    ])
  ) {
    return 'paving'
  }

  if (
    containsAny(text, [
      'centrale',
      "poste d'enrobage",
      'concasseur',
      'reconstitution',
      'emulsion',
      'fluxage',
      '拌合站',
      '破碎',
      '乳化',
      '改性',
    ])
  ) {
    return 'plant'
  }

  if (containsAny(text, ['grue', 'crane', '起重'])) {
    return 'lifting'
  }

  if (containsAny(text, ['elevateur', 'fork', '叉车', 'bobcat', 'skid'])) {
    return 'handling'
  }

  if (
    containsAny(text, [
      'bus',
      'camion personnel',
      'camionnette',
      'ambulance',
      'vehicule',
      'voiture',
      'light vehicle',
      '后勤',
    ])
  ) {
    return 'logistics'
  }

  if (containsAny(text, ['groupe electrogene', 'generator', '发电', 'compresseur', 'air compressor', '空压'])) {
    return 'power'
  }

  if (containsAny(text, ['motopompe', 'pump', '水泵'])) {
    return 'pumping'
  }

  if (containsAny(text, ['poste de soudure', 'weld', '焊'])) {
    return 'welding'
  }

  if (
    containsAny(text, [
      'rtk',
      'topo',
      'survey',
      'gnss',
      'gps',
      'total station',
      'station total',
      'theodolite',
      'theodolit',
      'niveau',
      'laser',
      'prism',
      'prisme',
      '全站',
      '水准',
      '测量',
    ])
  ) {
    return 'survey'
  }

  if (
    containsAny(text, [
      'labo',
      'laboratoire',
      'cbr',
      'proctor',
      'press',
      'presse',
      'etuve',
      'oven',
      'balance',
      'tamis',
      'sieve',
      '试验',
      '马歇尔',
      'marshall',
    ])
  ) {
    return 'lab'
  }

  const category = normalizeText(machine.assetCategoryName)
  if (category) {
    if (category.includes('compact')) return 'compaction'
    if (category.includes('bulldozer') || category.includes('dozer') || category.includes('推土')) return 'bulldozer'
    if (category.includes('chargeur') || category.includes('loader') || category.includes('装载')) return 'loader'
    if (category.includes('niveleuse') || category.includes('grader') || category.includes('平地')) return 'grader'
    if (category.includes('tractopelle') || category.includes('backhoe') || category.includes('两头忙')) return 'backhoe'
    if (category.includes('foreuse') || category.includes('drill') || category.includes('钻机')) return 'drilling'
    if (category.includes('pelle') || category.includes('excav') || category.includes('挖掘')) return 'excavator'
    if (category.includes('terrasse')) return 'earthmoving'
    if (category.includes('benne') || category.includes('dump') || category.includes('自卸')) return 'dump_truck'
    if (category.includes('remorque') || category.includes('porte-char') || category.includes('porte char') || category.includes('拖车')) return 'hauling'
    if (category.includes('citerne') || category.includes('fuel') || category.includes('diesel') || category.includes('加油') || category.includes('油罐')) return 'service_truck'
    if (category.includes('topo') || category.includes('survey') || category.includes('测量')) return 'survey'
    if (category.includes('labo') || category.includes('laboratoire') || category.includes('试验')) return 'lab'
    if (category.includes('industrie')) return 'plant'
    if (category.includes('levage')) return 'lifting'
    if (category.includes('logistique')) return 'logistics'
  }

  return null
}

export const resolveMachineEquipmentTypeKey = (
  machine: Pick<MachineAsset, 'equipmentTypeKey' | 'assetCategoryName' | 'assetName' | 'specModel' | 'alias'>,
): { key: MachineEquipmentTypeKey; source: 'manual' | 'inferred' | 'unclassified' } => {
  const manual = (machine.equipmentTypeKey ?? '').trim()
  if (manual && isMachineEquipmentTypeKey(manual)) {
    return { key: manual, source: 'manual' }
  }

  const inferred = inferMachineEquipmentTypeKey(machine)
  if (inferred) return { key: inferred, source: 'inferred' }

  return { key: MACHINE_EQUIPMENT_TYPE_UNCLASSIFIED, source: 'unclassified' }
}
