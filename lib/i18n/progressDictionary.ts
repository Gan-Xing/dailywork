import type { Locale } from './index'

type DictionaryKind = 'phase' | 'layer' | 'check' | 'type'
type LocalizeOptions = { phaseName?: string }

type Entry = { zh: string; fr: string }

const normalize = (value: string) => value.trim().toLowerCase()

const dictionaries: Record<DictionaryKind, Record<string, Entry>> = {
  phase: {
    [normalize('边沟')]: { zh: '边沟', fr: 'Caniveau' },
    [normalize('现浇边沟')]: { zh: '现浇边沟', fr: 'Caniveau coulé en place' },
    [normalize('路缘石')]: { zh: '路缘石', fr: 'Bordure' },
    [normalize('圆管涵')]: { zh: '圆管涵', fr: 'Buse circulaire' },
    [normalize('涵洞')]: { zh: '涵洞', fr: 'Dalot' },
    [normalize('盖板')]: { zh: '盖板', fr: 'Dallette' },
    [normalize('旧涵挖除')]: { zh: '旧涵挖除', fr: 'Demolision Dalot' },
    [normalize('旧边沟挖除')]: { zh: '旧边沟挖除', fr: 'Demolistion Caniveaux' },
    [normalize('原有涵洞')]: { zh: '原有涵洞', fr: 'Dalot Exitant' },
    [normalize('过道涵')]: { zh: '过道涵', fr: 'Dalot Traversee' },
    [normalize('底基层')]: { zh: '底基层', fr: 'Fondation' },
    [normalize('垫层')]: { zh: '垫层', fr: 'Couche de forme' },
    [normalize('Béton de propreté')]: { zh: '垫层', fr: 'Béton de propreté' },
    [normalize('路基垫层')]: { zh: '路基垫层', fr: 'Couche de Forme' },
    [normalize('Beton Proprete')]: { zh: '垫层', fr: 'Béton de propreté' },
    [normalize('Béton de propreté')]: { zh: '垫层', fr: 'Béton de propreté' },
    [normalize('土方')]: { zh: '土方', fr: 'Terrassement' },
    [normalize('基坑')]: { zh: '基坑', fr: 'Fouille' },
    [normalize('底板')]: { zh: '底板', fr: 'Radier' },
    [normalize('墙身')]: { zh: '墙身', fr: 'Voile' },
    [normalize('顶板')]: { zh: '顶板', fr: 'Tablier' },
  },
  layer: {
    [normalize('预制边沟')]: { zh: '预制边沟', fr: 'Caniveau préfabriqué' },
    [normalize('现浇边沟')]: { zh: '现浇边沟', fr: 'Caniveau coulé en place' },
    [normalize('预制路缘石')]: { zh: '预制路缘石', fr: 'Bordure préfabriquée' },
    [normalize('路缘石')]: { zh: '路缘石', fr: 'Bordure' },
    [normalize('预制圆管涵')]: { zh: '预制圆管涵', fr: 'Buse préfabriquée' },
    [normalize('圆管涵')]: { zh: '圆管涵', fr: 'Buse circulaire' },
    [normalize('旧涵挖除')]: { zh: '旧涵挖除', fr: 'Demolision Dalot' },
    [normalize('旧边沟挖除')]: { zh: '旧边沟挖除', fr: 'Demolistion Caniveaux' },
    [normalize('原有涵洞')]: { zh: '原有涵洞', fr: 'Dalot Exitant' },
    [normalize('边沟')]: { zh: '边沟', fr: 'Caniveau' },
    [normalize('原有边沟')]: { zh: '原有边沟', fr: 'Caniveau existant' },
    [normalize('过道涵')]: { zh: '过道涵', fr: 'Dalot Traversee' },
    [normalize('底基层')]: { zh: '底基层', fr: 'Fondation' },
    [normalize('垫层')]: { zh: '垫层', fr: 'Couche de forme' },
    [normalize('路基垫层')]: { zh: '路基垫层', fr: 'Couche de Forme' },
    [normalize('埋墙粉刷')]: { zh: '埋墙粉刷', fr: 'Badigeonnage' },
    [normalize('土方')]: { zh: '土方', fr: 'Terrassement' },
    [normalize('基坑')]: { zh: '基坑', fr: 'Fouille' },
    [normalize('底板')]: { zh: '底板', fr: 'Radier' },
    [normalize('墙身')]: { zh: '墙身', fr: 'Voile' },
    [normalize('顶板')]: { zh: '顶板', fr: 'Tablier' },
    [normalize('帽石')]: { zh: '帽石', fr: 'Guide Roue' },
    [normalize('Guide Roue')]: { zh: '帽石', fr: 'Guide Roue' },
    // French spellings users may pass through
    [normalize('Caniveux Exitant')]: { zh: '原有边沟', fr: 'Caniveau existant' },
    [normalize('第一层填土')]: { zh: '第一层填土', fr: 'Remblais 1ère couche' },
    [normalize('第二层填土')]: { zh: '第二层填土', fr: 'Remblais 2e couche' },
    [normalize('第三层填土')]: { zh: '第三层填土', fr: 'Remblais 3e couche' },
    [normalize('第四层填土')]: { zh: '第四层填土', fr: 'Remblais 4e couche' },
    [normalize('第五层填土')]: { zh: '第五层填土', fr: 'Remblais 5e couche' },
    [normalize('第六层填土')]: { zh: '第六层填土', fr: 'Remblais 6e couche' },
    [normalize('第七层填土')]: { zh: '第七层填土', fr: 'Remblais 7e couche' },
    [normalize('第八层填土')]: { zh: '第八层填土', fr: 'Remblais 8e couche' },
    [normalize('八字墙')]: { zh: '八字墙', fr: 'Aile' },
    [normalize('截水墙')]: { zh: '截水墙', fr: 'Bêche' },
    [normalize('Beche')]: { zh: '截水墙', fr: 'Bêche' },
    [normalize("chute d'eau")]: { zh: '跌水井', fr: "Chute d'eau" },
    [normalize('跌水井')]: { zh: '跌水井', fr: "Chute d'eau" },
  },
  check: {
    [normalize('钢筋绑扎验收')]: { zh: '钢筋绑扎验收', fr: 'Ferraillage' },
    [normalize('模版验收')]: { zh: '模版验收', fr: 'Réception coffrage' },
    [normalize('模版安装验收')]: { zh: '模板安装验收', fr: 'Coffrage' },
    [normalize('模板安装验收')]: { zh: '模板安装验收', fr: 'Coffrage' },
    [normalize('混凝土浇筑验收')]: { zh: '混凝土浇筑验收', fr: 'Réception bétonnage' },
    [normalize('放样与开挖')]: { zh: '放样与开挖', fr: 'Implantation et fouille' },
    [normalize('Implatation et fouille')]: { zh: '放样与开挖', fr: 'Implantation et fouille' },
    [normalize('Coffrage')]: { zh: '模板安装验收', fr: 'Coffrage' },
    [normalize('起终点桩号及清理完成验收')]: { zh: '起终点桩号及清理完成验收', fr: 'Réception des sections et nettoyage' },
    [normalize('Recption des Section et Netoyer')]: {
      zh: '起终点桩号及清理完成验收',
      fr: 'Réception des sections et nettoyage',
    },
    [normalize('尺寸及清理验收')]: { zh: '尺寸及清理验收', fr: 'Réception dimensions et nettoyage' },
    [normalize('压实度验收')]: { zh: '压实度验收', fr: 'Proctor' },
    [normalize('标高验收')]: { zh: '标高验收', fr: 'Nivellement' },
    [normalize('弯沉验收')]: { zh: '弯沉验收', fr: 'Déflexion' },
    [normalize('安装验收')]: { zh: '安装验收', fr: 'Réception de pose' },
    // French aliases for consistency
    [normalize('Reception Pose')]: { zh: '安装验收', fr: 'Réception de pose' },
    [normalize('Deflextion')]: { zh: '弯沉验收', fr: 'Déflexion' },
    [normalize('Nivelement')]: { zh: '标高验收', fr: 'Nivellement' },
    [normalize('埋墙粉刷验收')]: { zh: '埋墙粉刷验收', fr: 'Badigeonnage' },
    [normalize('badigeonnage')]: { zh: '埋墙粉刷验收', fr: 'Badigeonnage' },
  },
  type: {
    [normalize('现场验收')]: { zh: '现场验收', fr: 'GENIE CIVIL' },
    [normalize('测量验收')]: { zh: '测量验收', fr: 'TOPOGRAPHIQUE' },
    [normalize('试验验收')]: { zh: '试验验收', fr: 'GEOTECHNIQUE' },
    [normalize('其他')]: { zh: '其他', fr: 'Autre' },
    [normalize('GENIE CIVIL')]: { zh: '现场验收', fr: 'GENIE CIVIL' },
    [normalize('TOPOGRAPIQUE')]: { zh: '测量验收', fr: 'TOPOGRAPHIQUE' },
    [normalize('TOPOGRAPHIQUE')]: { zh: '测量验收', fr: 'TOPOGRAPHIQUE' },
    [normalize('GEOTECHNIQUE')]: { zh: '试验验收', fr: 'GEOTECHNIQUE' },
  },
}

const workflowTextDictionary: Record<string, Entry> = {
  [normalize('涵洞分项的层次/验收内容/验收类型绑定，按照基坑→垫层→底板/截水墙→墙身/八字墙/顶板/帽石的顺序设置依赖，避免越级报检。')]:
    {
      zh: '涵洞分项的层次/验收内容/验收类型绑定，按照基坑→垫层→底板/截水墙→墙身/八字墙/顶板/帽石的顺序设置依赖，避免越级报检。',
      fr: 'Chaînez couches/contrôles/types pour le dalot : Fouille → Béton de propreté → Radier/Bêche → Voile/Aile/Tablier/Chapeau, afin d’éviter les demandes hors séquence.',
    },
  [normalize('可左右分开或同时报检，需遵守前置工序与并行锁定规则。')]: {
    zh: '可左右分开或同时报检，需遵守前置工序与并行锁定规则。',
    fr: 'Contrôles gauche/droite séparés ou groupés, en respectant prérequis et verrous de parallélisme.',
  },
  [normalize('未完成不得进入垫层或后续任何报检。')]: {
    zh: '未完成不得进入垫层或后续任何报检。',
    fr: "Interdit d'avancer vers le béton de propreté ou tout contrôle suivant tant que non réalisé.",
  },
  [normalize('完成后才能创建底板/截水墙的报检单。')]: {
    zh: '完成后才能创建底板/截水墙的报检单。',
    fr: 'Créer les demandes du radier/bêche uniquement après validation.',
  },
  [normalize('顶板与帽石应成组报检，避免单独浇筑。')]: {
    zh: '顶板与帽石应成组报检，避免单独浇筑。',
    fr: 'Tablier et chapeau doivent être contrôlés ensemble, éviter un coulage isolé.',
  },
  [normalize('与顶板同节奏验收钢筋/模板/浇筑。')]: {
    zh: '与顶板同节奏验收钢筋/模板/浇筑。',
    fr: 'Contrôler ferraillage/coffrage/bétonnage au même rythme que le tablier.',
  },
  [normalize(
    '终验环节，需在放样/开挖、钢筋、模板、混凝土浇筑全部完成后进行，可选择需粉刷的子构件范围。',
  )]: {
    zh: '终验环节，需在放样/开挖、钢筋、模板、混凝土浇筑全部完成后进行，可选择需粉刷的子构件范围。',
    fr: 'Étape finale : après implantation/fouille, ferraillage, coffrage et bétonnage, choisir les sous-éléments à badigeonner.',
  },
  [normalize('适用于整体收口或局部粉刷，前提是所有前序层次的四类验收内容已完成。')]: {
    zh: '适用于整体收口或局部粉刷，前提是所有前序层次的四类验收内容已完成。',
    fr: 'Valable pour reprise globale ou partielle après validation des quatre contrôles des étapes précédentes.',
  },
}

const isCulvertPhase = (phaseName?: string) => {
  if (!phaseName) return false
  const key = normalize(phaseName)
  return key === normalize('涵洞') || key === normalize('过道涵') || key === normalize('dalot')
}

const localizeValue = (kind: DictionaryKind, value: string, locale: Locale, options?: LocalizeOptions): string => {
  const key = normalize(value)
  // Contextual layer translation: culvert/overpass bedding vs roadbed
  if (kind === 'layer' && key === normalize('垫层') && isCulvertPhase(options?.phaseName)) {
    return locale === 'fr' ? 'Béton de propreté' : '垫层'
  }
  const entry = dictionaries[kind][key]
  if (!entry) return value
  if (locale === 'fr') return entry.fr
  return entry.zh
}

export const localizeProgressTerm = (kind: DictionaryKind, value: string, locale: Locale, options?: LocalizeOptions) =>
  localizeValue(kind, value, locale, options)

export const localizeProgressList = (
  kind: DictionaryKind,
  values: string[],
  locale: Locale,
  options?: LocalizeOptions,
) => values.map((item) => localizeValue(kind, item, locale, options))

export const progressDictionary = dictionaries

export const localizeProgressText = (value: string, locale: Locale) => {
  if (!value) return value
  const entry = workflowTextDictionary[normalize(value)]
  if (!entry) return value
  return locale === 'fr' ? entry.fr : entry.zh
}

export const progressTextDictionary = workflowTextDictionary
