import type { LocalizedString } from './i18n'

export type WeatherPeriod = '7h30' | '12h30' | '17h30'

export const weatherPeriods: WeatherPeriod[] = ['7h30', '12h30', '17h30']

const localized = (fr: string, zh: string): LocalizedString => ({ fr, zh })

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

export interface WeatherCondition {
  id: string
  label: LocalizedString
}

export const weatherConditions: WeatherCondition[] = [
  { id: 'sunny', label: localized('E (Ensoleillé)', '晴 (Ensoleillé)') },
  { id: 'cloudy', label: localized('C (Couvert)', '阴 (Couvert)') },
  { id: 'foggy', label: localized('B (Brouillard)', '雾 (Brouillard)') },
  { id: 'rainy', label: localized('P (Pluie)', '雨 (Pluie)') },
]

interface EquipmentItem {
  id: string
  label: LocalizedString
}

const equipmentItem = (fr: string, zh: string): EquipmentItem => ({
  id: slugify(fr),
  label: localized(fr, zh),
})

export interface EquipmentCategory {
  id: string
  name: LocalizedString
  items: EquipmentItem[]
}

export const equipmentCatalog: EquipmentCategory[] = [
  {
    id: 'camion',
    name: localized('Camion', '卡车'),
    items: [
      equipmentItem('Camion benne 4x2', '4x2 自卸卡车'),
      equipmentItem('Camion benne 6x4', '6x4 自卸卡车'),
      equipmentItem('Camion benne 8x4', '8x4 自卸卡车'),
      equipmentItem('Camion semi-remorque', '半挂牵引车'),
      equipmentItem('Citerne à eau / Pulvérulent', '洒水 / 散装罐车'),
      equipmentItem('Entretien / Ravitailleur Go', '保养 / 燃油补给车'),
      equipmentItem('Plateau / Hyab', '平板车 / 随车吊'),
      equipmentItem('Rem. Plateau / Porte-chars / Porteur', '平板拖车 / 大件运输车'),
      equipmentItem('Rem.', '拖车'),
      equipmentItem('Répandeuse liant', '结合料撒布车'),
      equipmentItem('Epandeur ciment', '水泥撒布车'),
      equipmentItem('Toupie', '混凝土搅拌运输车'),
      equipmentItem('Tracteur routier', '公路牵引车'),
    ],
  },
  {
    id: 'compacteur',
    name: localized('Compacteur', '压实设备'),
    items: [
      equipmentItem('Double bille', '双钢轮压路机'),
      equipmentItem('Monobille', '单钢轮压路机'),
      equipmentItem('Pied de mouton', '羊足碾'),
      equipmentItem('Rouleaux à pneu', '轮胎压路机'),
      equipmentItem('à timon', '牵引式压实机'),
    ],
  },
  {
    id: 'engins',
    name: localized('Engins', '工程机械'),
    items: [
      equipmentItem('Bulldozers', '推土机'),
      equipmentItem('Chargeurs', '装载机'),
      equipmentItem('Tractopelle', '挖装机'),
      equipmentItem('Extrudeuse', '挤出机'),
      equipmentItem('Finisseur', '摊铺机'),
      equipmentItem('Foreuse', '钻机'),
      equipmentItem('Niveleuses', '平地机'),
      equipmentItem('Pelle à chenille et pneu', '履带 / 轮胎挖掘机'),
      equipmentItem('Recycleuse / Malaxeuse / Raboteuse', '再生 / 拌和 / 铣刨机'),
      equipmentItem('Tracteur agricole / Balayeuse', '拖拉机 / 清扫车'),
    ],
  },
  {
    id: 'industrie',
    name: localized('Industrie', '生产设施'),
    items: [
      equipmentItem('Centrale à béton', '混凝土拌合站'),
      equipmentItem('Concasseur / Reconstitution', '破碎 / 整形机组'),
      equipmentItem("Poste d'enrobage", '沥青拌和站'),
      equipmentItem('Fluxage / Emulsion', '改性 / 乳化装置'),
    ],
  },
  {
    id: 'levage',
    name: localized('Levage', '起重设备'),
    items: [
      equipmentItem('Elevateur à fourche + BOBCAT', '叉装机 / BOBCAT'),
      equipmentItem('Grue mobile', '汽车起重机'),
    ],
  },
  {
    id: 'logistique',
    name: localized('Logistique', '后勤车辆'),
    items: [
      equipmentItem('Bus / Camion personnel', '班车 / 人员运输车'),
      equipmentItem('Camionnette', '小型货车'),
      equipmentItem('Ambulance', '救护车'),
      equipmentItem('Véhicule léger', '轻型车辆'),
    ],
  },
  {
    id: 'accessoires',
    name: localized('Matériels et accessoires', '辅件与配套'),
    items: [
      equipmentItem('Autre matériel', '其他设备'),
      equipmentItem('BRH / Pinces demol / Caisson / Bras', '破碎锤 / 拆除钳 / 附臂'),
      equipmentItem('Compresseur', '空压机'),
      equipmentItem('TC / Stations / Centrifugeuses / Potabilisation', '水处理 / 离心装置'),
      equipmentItem('Cuve à gasoil / Bitume', '柴油 / 沥青储罐'),
      equipmentItem('Bétonnière', '小型搅拌机'),
      equipmentItem('Gravillonneur porté', '碎石撒布机'),
      equipmentItem('Bitucontainer / Brûleur', '沥青集装箱 / 燃烧器'),
      equipmentItem('Brûleur', '燃烧器'),
      equipmentItem('Elargisseur accotement', '路肩拓宽机'),
      equipmentItem('Groupe électrogène', '发电机组'),
      equipmentItem('Motopompe', '机动水泵'),
      equipmentItem('Poste de soudure', '焊接设备'),
      equipmentItem('Pesage - Pont bascule / Pèse essieux', '地磅 / 轴重秤'),
    ],
  },
]

export interface EquipmentEntry {
  id: string
  categoryId: string
  label: LocalizedString
}

export const equipmentEntries: EquipmentEntry[] = equipmentCatalog.flatMap((category) =>
  category.items.map((item) => ({
    id: `${category.id}-${item.id}`,
    categoryId: category.id,
    label: item.label,
  })),
)

export interface MaterialItem {
  id: string
  label: LocalizedString
  unit: string
}

export const materialItems: MaterialItem[] = [
  { id: 'gasoil', label: localized('Gasoil', '柴油'), unit: 'l' },
  { id: 'essence', label: localized('Essence', '汽油'), unit: 'l' },
  { id: 'bitume', label: localized('Bitumes', '沥青'), unit: 't' },
  { id: 'ciment', label: localized('Ciment', '水泥'), unit: 't' },
  { id: 'fer', label: localized('Fer à béton', '钢筋'), unit: 't' },
  { id: 'gnt', label: localized('GNT 0/31,5', '级配碎石 0/31.5'), unit: 'm³' },
  { id: 'sable', label: localized('Sable', '砂'), unit: 't' },
  { id: 'gravillons', label: localized('Gravillons', '碎石'), unit: 't' },
  { id: 'explosifs', label: localized('Explosifs', '炸药'), unit: 't' },
]

interface PersonnelRoleDefinition {
  id: string
  label: LocalizedString
}

export interface PersonnelGroup {
  id: string
  title: LocalizedString
  roles: PersonnelRoleDefinition[]
}

const makeRole = (fr: string, zh: string): PersonnelRoleDefinition => ({
  id: slugify(fr),
  label: localized(fr, zh),
})

export const personnelGroups: PersonnelGroup[] = [
  {
    id: 'management-support',
    title: localized('Gestion & support', '管理与支持'),
    roles: [
      makeRole('Directeur de Projet', '项目总监'),
      makeRole('Directeurs Technique', '技术总监'),
      makeRole('Directeurs de Travaux', '施工总监'),
      makeRole('Resp. Admin. et Compt', '行政及财务负责人'),
      makeRole('Ingénieur planning + Ingénieur travaux', '计划/施工工程师'),
      makeRole('Cond. de travaux', '施工主管'),
      makeRole('Resp. Contrôle qualité', '质量负责人'),
      makeRole('Resp. Topo / BE', '测量/技术部负责人'),
      makeRole('Resp. Laboratoire', '试验室负责人'),
      makeRole('Resp. Carrière / Industries', '采石场/工厂负责人'),
      makeRole('Resp. Atelier', '维修车间负责人'),
      makeRole('Resp HSE', 'HSE 负责人'),
      makeRole('Agent Administratif', '行政专员'),
      makeRole('Médecins + Ambulanciers', '医生与救护员'),
      makeRole('Equipe HSE (Resp Adjt + aides)', 'HSE 团队（副手+助理）'),
      makeRole('Equipe qualité (Resp Adjt + Relais qualité)', '质量团队（副手+专员）'),
      makeRole('Chef de Chantier', '现场经理'),
    ],
  },
  {
    id: 'field-subcontractors',
    title: localized('Terrain & sous-traitance', '现场与外协'),
    roles: [
      makeRole("Chef d'Equipe", '班组长'),
      makeRole('Pointeurs / Pointeaux', '考勤员'),
      makeRole("Conducteurs d'engins", '机操手'),
      makeRole('Chauffeurs de camion', '卡车司机'),
      makeRole('Chauffeurs de voiture', '小车司机'),
      makeRole('Ouvriers + manœuvres', '工人及普工'),
      makeRole('Mécaniciens', '机械师'),
      makeRole('Equipe labo (Adjt + opérateur + aides)', '试验队（副手+操作+辅助）'),
      makeRole('Equipe topo (Adjt + opérateur + aides)', '测量队（副手+操作+辅助）'),
      makeRole('Cuisiniers / serveurs / femmes de ménage', '炊事/服务/保洁'),
      makeRole('Soutraitants', '分包单位'),
      makeRole('Surêté', '安全警卫'),
      makeRole('Equipe Sureté', '安保团队'),
    ],
  },
]

export interface PersonnelRole {
  id: string
  label: LocalizedString
  groupId: string
}

export const personnelRoles: PersonnelRole[] = personnelGroups.flatMap((group) =>
  group.roles.map((role) => ({
    id: `${group.id}-${role.id}`,
    label: role.label,
    groupId: group.id,
  })),
)

export interface ObservationBlock {
  id: 'surete' | 'environnement' | 'constatations' | 'evenements'
  label: LocalizedString
  helper: LocalizedString
}

export const observationBlocks: readonly ObservationBlock[] = [
  {
    id: 'surete',
    label: localized('Sûreté', '安保'),
    helper: localized('Patrouilles, contrôle d’accès, incidents; noter “RAS” si rien.', '巡查、门禁、巡逻等安全情况，缺失请填 “RAS”。'),
  },
  {
    id: 'environnement',
    label: localized('Environnement', '环境'),
    helper: localized('Protection de l’environnement, poussières, bruit, actions correctives.', '环境保护、扬尘、噪音、水土保持与整改计划。'),
  },
  {
    id: 'constatations',
    label: localized('Constatations', '总体观察'),
    helper: localized('Observations générales, écarts planning, alertes qualité.', '现场总体观察、进度异常、质量隐患。'),
  },
  {
    id: 'evenements',
    label: localized('Evènements particuliers', '特殊事件'),
    helper: localized('Accidents, routes fermées, visites majeures avec heure et responsable.', '事故、封路、重要来访，含时间与负责人。'),
  },
]

export type ObservationKey = (typeof observationBlocks)[number]['id']

export interface WorkBlockDefinition {
  id: string
  label: LocalizedString
}

export const worksExecutedBlocks = [
  { id: 'preparation', label: localized('Préparation', '前期准备') },
  { id: 'terrassement', label: localized('Terrassement', '土方工程') },
  { id: 'chaussee', label: localized('Chaussee', '路面工程') },
  { id: 'assainissement', label: localized('Assainissement', '排水与涵洞') },
  {
    id: 'securite-signalisation',
    label: localized('Sécurité et Signalisation', '安保与交安'),
  },
  {
    id: 'geotechnique',
    label: localized('Géotechnique / Essais de laboratoire', '岩土/试验'),
  },
  { id: 'divers', label: localized('Divers', '其他') },
] as const satisfies readonly WorkBlockDefinition[]

export type WorkBlock = (typeof worksExecutedBlocks)[number]['id']

export interface AdditionalNarrativeSection {
  id: 'beTopo' | 'carriere' | 'sousTraites' | 'divers'
  label: LocalizedString
  helper: LocalizedString
}

export const additionalNarrativeSections = [
  {
    id: 'beTopo',
    label: localized('BE / Topographie', '技术/测量'),
    helper: localized('Implantations, levés, profils et livrables BE.', '放样、复测、断面测量等成果。'),
  },
  {
    id: 'carriere',
    label: localized('Carrière', '采石场'),
    helper: localized('Production des bases matériaux et principaux risques.', '采石场、取料基地生产与风险。'),
  },
  {
    id: 'sousTraites',
    label: localized('Travaux sous-traités', '分包工程'),
    helper: localized('Avancement des sous-traitants et coordination.', '分包任务、完成量与协调事项。'),
  },
  {
    id: 'divers',
    label: localized('Observations / Divers', '其他事项'),
    helper: localized('Informations additionnelles ou consignes temporaires.', '其他补充信息或临时指令。'),
  },
] as const satisfies readonly AdditionalNarrativeSection[]

export type AdditionalSectionKey = (typeof additionalNarrativeSections)[number]['id']
