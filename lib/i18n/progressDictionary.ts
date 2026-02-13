import type { Locale } from './index'

type DictionaryKind = 'phase' | 'layer' | 'check' | 'type'
type LocalizeOptions = { phaseName?: string }

type Entry = { zh: string; fr: string }

const normalize = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const compactNormalize = (value: string) =>
  normalize(value).replace(/[\s()（）[\]{}.,;:·•\-_/\\→]+/g, '')

const dictionaries: Record<DictionaryKind, Record<string, Entry>> = {
  phase: {
    [normalize('边沟')]: { zh: '边沟', fr: 'Caniveau' },
    [normalize('现浇边沟')]: { zh: '现浇边沟', fr: 'Caniveau coulé en place' },
    [normalize('路缘石')]: { zh: '路缘石', fr: 'Bordure' },
    [normalize('圆管涵')]: { zh: '圆管涵', fr: 'Buse circulaire' },
    [normalize('涵洞')]: { zh: '涵洞', fr: 'Dalot' },
    [normalize('盖板')]: { zh: '盖板', fr: 'Dallette' },
    [normalize('旧涵挖除')]: { zh: '旧涵挖除', fr: 'Démolition de dalot' },
    [normalize('旧边沟挖除')]: { zh: '旧边沟挖除', fr: 'Démolition de caniveau' },
    [normalize('原有涵洞')]: { zh: '原有涵洞', fr: 'Dalot existant' },
    [normalize('过道涵')]: { zh: '过道涵', fr: 'Dalot traversée' },
    [normalize('底基层')]: { zh: '底基层', fr: 'Fondation' },
    [normalize('基层')]: { zh: '基层', fr: 'Couche de base' },
    // French aliases (so French UI values can be canonicalized back to zh)
    [normalize('Couche de base')]: { zh: '基层', fr: 'Couche de base' },
    [normalize('GNT基层')]: { zh: 'GNT基层', fr: 'Couche de base en GNT (Grave Non Traitée)' },
    [normalize('Couche de base en GNT (Grave Non Traitée)')]: { zh: 'GNT基层', fr: 'Couche de base en GNT (Grave Non Traitée)' },
    [normalize('垫层')]: { zh: '垫层', fr: 'Couche de forme' },
    [normalize('Béton de propreté')]: { zh: '垫层', fr: 'Béton de propreté' },
    [normalize('路基垫层')]: { zh: '路基垫层', fr: 'Couche de Forme' },
    [normalize('Beton Proprete')]: { zh: '垫层', fr: 'Béton de propreté' },
    [normalize('Béton de propreté')]: { zh: '垫层', fr: 'Béton de propreté' },
    [normalize('土方')]: { zh: '土方', fr: 'Terrassement' },
    [normalize('清表')]: { zh: '清表', fr: 'Décapage' },
    [normalize('Décapage')]: { zh: '清表', fr: 'Décapage' },
    [normalize('清灌')]: { zh: '清灌', fr: 'Débroussaillage' },
    [normalize('Débroussaillage')]: { zh: '清灌', fr: 'Débroussaillage' },
    [normalize('基坑')]: { zh: '基坑', fr: 'Fouille' },
    [normalize('底板')]: { zh: '底板', fr: 'Radier' },
    [normalize('墙身')]: { zh: '墙身', fr: 'Voile' },
    [normalize('顶板')]: { zh: '顶板', fr: 'Tablier' },
    // Added missing bilingual terms from template/instance audit
    [normalize('标牌')]: { zh: '标牌', fr: 'Signalisation verticale' },
    [normalize('Signalisation verticale')]: { zh: '标牌', fr: 'Signalisation verticale' },
    [normalize('标线')]: { zh: '标线', fr: 'Signalisation horizontale' },
    [normalize('Signalisation horizontale')]: { zh: '标线', fr: 'Signalisation horizontale' },
    [normalize('伐树')]: { zh: '伐树', fr: "Abattage d'arbres" },
    [normalize("Abattage d'arbres")]: { zh: '伐树', fr: "Abattage d'arbres" },
    [normalize('沥青面层')]: { zh: '沥青面层', fr: 'Couche de roulement en enrobé bitumineux' },
    [normalize('Couche de roulement en enrobé bitumineux')]: {
      zh: '沥青面层',
      fr: 'Couche de roulement en enrobé bitumineux',
    },
    [normalize('临建')]: { zh: '临建', fr: 'Installations temporaires' },
    [normalize('Installations temporaires')]: { zh: '临建', fr: 'Installations temporaires' },
    [normalize('透层')]: { zh: '透层', fr: "Couche d'imprégnation" },
    [normalize("Couche d'imprégnation")]: { zh: '透层', fr: "Couche d'imprégnation" },
    [normalize('土场恢复')]: { zh: '土场恢复', fr: "Réhabilitation de la zone d'emprunt" },
    [normalize("Réhabilitation de la zone d'emprunt")]: { zh: '土场恢复', fr: "Réhabilitation de la zone d'emprunt" },
    [normalize('粘层')]: { zh: '粘层', fr: "Couche d'accrochage" },
    [normalize("Couche d'accrochage")]: { zh: '粘层', fr: "Couche d'accrochage" },
    [normalize('旧路缘石拆除')]: { zh: '旧路缘石拆除', fr: 'Dépose des anciennes bordures' },
    [normalize('Dépose des anciennes bordures')]: { zh: '旧路缘石拆除', fr: 'Dépose des anciennes bordures' },
  },
  layer: {
    [normalize('预制边沟')]: { zh: '预制边沟', fr: 'Caniveau préfabriqué' },
    [normalize('现浇边沟')]: { zh: '现浇边沟', fr: 'Caniveau coulé en place' },
    [normalize('预制路缘石')]: { zh: '预制路缘石', fr: 'Bordure préfabriquée' },
    [normalize('路缘石')]: { zh: '路缘石', fr: 'Bordure' },
    [normalize('预制圆管涵')]: { zh: '预制圆管涵', fr: 'Buse préfabriquée' },
    [normalize('圆管涵')]: { zh: '圆管涵', fr: 'Buse circulaire' },
    [normalize('旧涵挖除')]: { zh: '旧涵挖除', fr: 'Demolision Dalot' },
    [normalize('旧边沟挖除')]: { zh: '旧边沟挖除', fr: 'Démolition de caniveau' },
    [normalize('原有涵洞')]: { zh: '原有涵洞', fr: 'Dalot existant' },
    [normalize('边沟')]: { zh: '边沟', fr: 'Caniveau' },
    [normalize('原有边沟')]: { zh: '原有边沟', fr: 'Caniveau existant' },
    [normalize('过道涵')]: { zh: '过道涵', fr: 'Dalot traversée' },
    [normalize('底基层')]: { zh: '底基层', fr: 'Fondation' },
    [normalize('基层')]: { zh: '基层', fr: 'Couche de base' },
    // French aliases (so French UI values can be canonicalized back to zh)
    [normalize('Couche de base')]: { zh: '基层', fr: 'Couche de base' },
    [normalize('GNT基层')]: { zh: 'GNT基层', fr: 'Couche de base en GNT (Grave Non Traitée)' },
    [normalize('Couche de base en GNT (Grave Non Traitée)')]: { zh: 'GNT基层', fr: 'Couche de base en GNT (Grave Non Traitée)' },
    [normalize('垫层')]: { zh: '垫层', fr: 'Couche de forme' },
    [normalize('路基垫层')]: { zh: '路基垫层', fr: 'Couche de Forme' },
    [normalize('埋墙粉刷')]: { zh: '埋墙粉刷', fr: 'Badigeonnage' },
    [normalize('土方')]: { zh: '土方', fr: 'Terrassement' },
    [normalize('清表')]: { zh: '清表', fr: 'Décapage' },
    [normalize('Décapage')]: { zh: '清表', fr: 'Décapage' },
    [normalize('清灌')]: { zh: '清灌', fr: 'Débroussaillage' },
    [normalize('Débroussaillage')]: { zh: '清灌', fr: 'Débroussaillage' },
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
    [normalize('盖板')]: { zh: '盖板', fr: 'Dallette' },
    // Added missing bilingual terms from template/instance audit
    [normalize('标牌')]: { zh: '标牌', fr: 'Signalisation verticale' },
    [normalize('Signalisation verticale')]: { zh: '标牌', fr: 'Signalisation verticale' },
    [normalize('标线')]: { zh: '标线', fr: 'Signalisation horizontale' },
    [normalize('Signalisation horizontale')]: { zh: '标线', fr: 'Signalisation horizontale' },
    [normalize('伐树')]: { zh: '伐树', fr: "Abattage d'arbres" },
    [normalize("Abattage d'arbres")]: { zh: '伐树', fr: "Abattage d'arbres" },
    [normalize('环境恢复')]: { zh: '环境恢复', fr: 'Remise en état environnementale' },
    [normalize('Remise en état environnementale')]: { zh: '环境恢复', fr: 'Remise en état environnementale' },
    [normalize('沥青面层')]: { zh: '沥青面层', fr: 'Couche de roulement en enrobé bitumineux' },
    [normalize('Couche de roulement en enrobé bitumineux')]: {
      zh: '沥青面层',
      fr: 'Couche de roulement en enrobé bitumineux',
    },
    [normalize('临建验收')]: { zh: '临建验收', fr: 'Réception des installations temporaires' },
    [normalize('Réception des installations temporaires')]: {
      zh: '临建验收',
      fr: 'Réception des installations temporaires',
    },
    [normalize('临时办公')]: { zh: '临时办公', fr: 'Bureau temporaire' },
    [normalize('Bureau temporaire')]: { zh: '临时办公', fr: 'Bureau temporaire' },
    [normalize('临时建筑')]: { zh: '临时建筑', fr: 'Construction temporaire' },
    [normalize('Construction temporaire')]: { zh: '临时建筑', fr: 'Construction temporaire' },
    [normalize('临时用电')]: { zh: '临时用电', fr: 'Alimentation électrique provisoire' },
    [normalize('Alimentation électrique provisoire')]: { zh: '临时用电', fr: 'Alimentation électrique provisoire' },
    [normalize('临时用水')]: { zh: '临时用水', fr: 'Alimentation en eau provisoire' },
    [normalize('Alimentation en eau provisoire')]: { zh: '临时用水', fr: 'Alimentation en eau provisoire' },
    [normalize('透层')]: { zh: '透层', fr: "Couche d'imprégnation" },
    [normalize("Couche d'imprégnation")]: { zh: '透层', fr: "Couche d'imprégnation" },
    [normalize('土场平整')]: { zh: '土场平整', fr: "Nivellement de la zone d'emprunt" },
    [normalize("Nivellement de la zone d'emprunt")]: { zh: '土场平整', fr: "Nivellement de la zone d'emprunt" },
    [normalize('新层次')]: { zh: '新层次', fr: 'Nouvelle couche' },
    [normalize('Nouvelle couche')]: { zh: '新层次', fr: 'Nouvelle couche' },
    [normalize('原有路缘石')]: { zh: '原有路缘石', fr: 'Bordure existante' },
    [normalize('Bordure existante')]: { zh: '原有路缘石', fr: 'Bordure existante' },
    [normalize('粘层')]: { zh: '粘层', fr: "Couche d'accrochage" },
    [normalize("Couche d'accrochage")]: { zh: '粘层', fr: "Couche d'accrochage" },
  },
  check: {
    [normalize('钢筋绑扎验收')]: { zh: '钢筋绑扎验收', fr: 'Ferraillage' },
    [normalize('Ferraillage')]: { zh: '钢筋绑扎验收', fr: 'Ferraillage' },
    [normalize('模版验收')]: { zh: '模板安装验收', fr: 'Réception coffrage' },
    [normalize('Réception coffrage')]: { zh: '模板安装验收', fr: 'Réception coffrage' },
    [normalize('模版安装验收')]: { zh: '模板安装验收', fr: 'Coffrage' },
    [normalize('模板安装验收')]: { zh: '模板安装验收', fr: 'Coffrage' },
    [normalize('混凝土浇筑验收')]: { zh: '混凝土浇筑验收', fr: 'Réception bétonnage' },
    [normalize('Réception bétonnage')]: { zh: '混凝土浇筑验收', fr: 'Réception bétonnage' },
    [normalize('放样与开挖')]: { zh: '放样与开挖', fr: 'Implantation et fouille' },
    [normalize('Implatation et fouille')]: { zh: '放样与开挖', fr: 'Implantation et fouille' },
    [normalize('Implantation et fouille')]: { zh: '放样与开挖', fr: 'Implantation et fouille' },
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
    [normalize('Réception de pose')]: { zh: '安装验收', fr: 'Réception de pose' },
    // French aliases for consistency
    [normalize('Reception Pose')]: { zh: '安装验收', fr: 'Réception de pose' },
    [normalize('Deflextion')]: { zh: '弯沉验收', fr: 'Déflexion' },
    [normalize('Déflexion')]: { zh: '弯沉验收', fr: 'Déflexion' },
    [normalize('Nivelement')]: { zh: '标高验收', fr: 'Nivellement' },
    [normalize('Nivellement')]: { zh: '标高验收', fr: 'Nivellement' },
    [normalize('埋墙粉刷验收')]: { zh: '埋墙粉刷验收', fr: 'Badigeonnage' },
    [normalize('badigeonnage')]: { zh: '埋墙粉刷', fr: 'Badigeonnage' },
    [normalize('badigeonnage des murs enterrés')]: { zh: '埋墙粉刷', fr: 'Badigeonnage' },
    [normalize('埋墙粉刷')]: { zh: '埋墙粉刷', fr: 'Badigeonnage' },
    [normalize('CBR')]: { zh: 'CBR', fr: 'CBR' },
    [normalize('现场干密度')]: { zh: '现场干密度', fr: 'Densité sèche in situ' },
    [normalize('Densité sèche in situ')]: { zh: '现场干密度', fr: 'Densité sèche in situ' },
    [normalize('颗粒级配')]: { zh: '颗粒级配', fr: 'Granulométrie' },
    [normalize('Granulométrie')]: { zh: '颗粒级配', fr: 'Granulométrie' },
    [normalize('砂当量')]: { zh: '砂当量', fr: 'Équivalent de sable' },
    [normalize('Équivalent de sable')]: { zh: '砂当量', fr: 'Équivalent de sable' },
    [normalize('清表面积验收')]: { zh: '清表面积验收', fr: 'Réception de la surface de décapage' },
    [normalize('Réception de la surface de décapage')]: {
      zh: '清表面积验收',
      fr: 'Réception de la surface de décapage',
    },
    [normalize('清灌面积验收')]: { zh: '清灌面积验收', fr: 'Réception de la surface de débroussaillage' },
    [normalize('Réception de la surface de débroussaillage')]: {
      zh: '清灌面积验收',
      fr: 'Réception de la surface de débroussaillage',
    },
    // Added missing bilingual terms from template/instance audit
    [normalize('安全防护与便道修复')]: {
      zh: '安全防护与便道修复',
      fr: 'Protection de sécurité et remise en état de la déviation',
    },
    [normalize('Protection de sécurité et remise en état de la déviation')]: {
      zh: '安全防护与便道修复',
      fr: 'Protection de sécurité et remise en état de la déviation',
    },
    [normalize('办公用品验收')]: { zh: '办公用品验收', fr: 'Réception des fournitures de bureau' },
    [normalize('Réception des fournitures de bureau')]: {
      zh: '办公用品验收',
      fr: 'Réception des fournitures de bureau',
    },
    [normalize('表土回铺')]: { zh: '表土回铺', fr: 'Remise en place de la terre végétale' },
    [normalize('Remise en place de la terre végétale')]: {
      zh: '表土回铺',
      fr: 'Remise en place de la terre végétale',
    },
    [normalize('材料与外观质量验收')]: {
      zh: '材料与外观质量验收',
      fr: "Réception des matériaux et de la qualité d'aspect",
    },
    [normalize("Réception des matériaux et de la qualité d'aspect")]: {
      zh: '材料与外观质量验收',
      fr: "Réception des matériaux et de la qualité d'aspect",
    },
    [normalize('场地清理与冲沟回填')]: {
      zh: '场地清理与冲沟回填',
      fr: 'Nettoyage du site et remblaiement des ravines',
    },
    [normalize('Nettoyage du site et remblaiement des ravines')]: {
      zh: '场地清理与冲沟回填',
      fr: 'Nettoyage du site et remblaiement des ravines',
    },
    [normalize('底部深翻松土')]: { zh: '底部深翻松土', fr: 'Décompactage profond du fond' },
    [normalize('Décompactage profond du fond')]: { zh: '底部深翻松土', fr: 'Décompactage profond du fond' },
    [normalize('伐树及清理')]: { zh: '伐树及清理', fr: 'Abattage et nettoyage' },
    [normalize('Abattage et nettoyage')]: { zh: '伐树及清理', fr: 'Abattage et nettoyage' },
    [normalize('几何尺寸验收')]: { zh: '几何尺寸验收', fr: 'Réception des dimensions géométriques' },
    [normalize('Réception des dimensions géométriques')]: {
      zh: '几何尺寸验收',
      fr: 'Réception des dimensions géométriques',
    },
    [normalize('几何尺寸与线性验收')]: {
      zh: '几何尺寸与线性验收',
      fr: 'Réception des dimensions géométriques et de la linéarité',
    },
    [normalize('Réception des dimensions géométriques et de la linéarité')]: {
      zh: '几何尺寸与线性验收',
      fr: 'Réception des dimensions géométriques et de la linéarité',
    },
    [normalize('几何定位验收')]: { zh: '几何定位验收', fr: "Réception de l'implantation géométrique" },
    [normalize("Réception de l'implantation géométrique")]: {
      zh: '几何定位验收',
      fr: "Réception de l'implantation géométrique",
    },
    [normalize('居住验收')]: { zh: '居住验收', fr: "Réception des installations d'hébergement" },
    [normalize("Réception des installations d'hébergement")]: {
      zh: '居住验收',
      fr: "Réception des installations d'hébergement",
    },
    [normalize('平整度验收')]: { zh: '平整度验收', fr: 'Réception de la planéité' },
    [normalize('Réception de la planéité')]: { zh: '平整度验收', fr: 'Réception de la planéité' },
    [normalize('通电验收')]: { zh: '通电验收', fr: 'Réception de la mise sous tension' },
    [normalize('Réception de la mise sous tension')]: { zh: '通电验收', fr: 'Réception de la mise sous tension' },
    [normalize('通水验收')]: { zh: '通水验收', fr: 'Réception de la mise en eau' },
    [normalize('Réception de la mise en eau')]: { zh: '通水验收', fr: 'Réception de la mise en eau' },
    [normalize('涂料用量')]: { zh: '涂料用量', fr: 'Consommation de peinture' },
    [normalize('Consommation de peinture')]: { zh: '涂料用量', fr: 'Consommation de peinture' },
    [normalize('托盘实验验收')]: { zh: '托盘实验验收', fr: "Réception de l'essai à la plaque" },
    [normalize("Réception de l'essai à la plaque")]: { zh: '托盘实验验收', fr: "Réception de l'essai à la plaque" },
    [normalize('新增验收内容')]: { zh: '新增验收内容', fr: 'Nouveau contenu de contrôle' },
    [normalize('Nouveau contenu de contrôle')]: { zh: '新增验收内容', fr: 'Nouveau contenu de contrôle' },
    [normalize('植被恢复')]: { zh: '植被恢复', fr: 'Restauration de la végétation' },
    [normalize('Restauration de la végétation')]: { zh: '植被恢复', fr: 'Restauration de la végétation' },
    [normalize('钻芯取样验收')]: { zh: '钻芯取样验收', fr: 'Réception des carottages' },
    [normalize('Réception des carottages')]: { zh: '钻芯取样验收', fr: 'Réception des carottages' },
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
    [normalize('Autre')]: { zh: '其他', fr: 'Autre' },
  },
}

const createUniqueEntries = (kind: DictionaryKind): Entry[] => {
  const seen = new Set<string>()
  const result: Entry[] = []
  Object.values(dictionaries[kind]).forEach((entry) => {
    const key = `${entry.zh}__${entry.fr}`
    if (seen.has(key)) return
    seen.add(key)
    result.push(entry)
  })
  return result.sort((a, b) => Math.max(b.zh.length, b.fr.length) - Math.max(a.zh.length, a.fr.length))
}

const uniqueEntriesByKind: Record<DictionaryKind, Entry[]> = {
  phase: createUniqueEntries('phase'),
  layer: createUniqueEntries('layer'),
  check: createUniqueEntries('check'),
  type: createUniqueEntries('type'),
}

const compactDictionaryByKind: Record<DictionaryKind, Record<string, Entry>> = {
  phase: {},
  layer: {},
  check: {},
  type: {},
}

const dictionaryKinds: DictionaryKind[] = ['phase', 'layer', 'check', 'type']

dictionaryKinds.forEach((kind) => {
  uniqueEntriesByKind[kind].forEach((entry) => {
    const zhCompact = compactNormalize(entry.zh)
    const frCompact = compactNormalize(entry.fr)
    if (zhCompact && !compactDictionaryByKind[kind][zhCompact]) {
      compactDictionaryByKind[kind][zhCompact] = entry
    }
    if (frCompact && !compactDictionaryByKind[kind][frCompact]) {
      compactDictionaryByKind[kind][frCompact] = entry
    }
  })
})

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

const lookupEntry = (kind: DictionaryKind, value: string) => {
  const key = normalize(value)
  const direct = dictionaries[kind][key]
  if (direct) return direct
  const compactKey = compactNormalize(value)
  if (!compactKey) return undefined
  return compactDictionaryByKind[kind][compactKey]
}

const localizeEmbeddedValue = (kind: DictionaryKind, value: string, locale: Locale) => {
  let result = value
  let changed = false
  uniqueEntriesByKind[kind].forEach((entry) => {
    const target = locale === 'fr' ? entry.fr : entry.zh
    const sourceCandidates = [entry.zh, entry.fr]
    sourceCandidates.forEach((source) => {
      if (!source || source === target) return
      if (!result.includes(source)) return
      result = result.split(source).join(target)
      changed = true
    })
  })
  return changed ? result : value
}

const localizeValue = (kind: DictionaryKind, value: string, locale: Locale, options?: LocalizeOptions): string => {
  if (!value) return value
  const key = normalize(value)
  // Contextual layer translation: culvert/overpass bedding vs roadbed
  if (
    kind === 'layer' &&
    (key === normalize('垫层') || compactNormalize(value) === compactNormalize('垫层')) &&
    isCulvertPhase(options?.phaseName)
  ) {
    return locale === 'fr' ? 'Béton de propreté' : '垫层'
  }
  const entry = lookupEntry(kind, value)
  if (entry) {
    if (locale === 'fr') return entry.fr
    return entry.zh
  }
  const embedded = localizeEmbeddedValue(kind, value, locale)
  if (embedded !== value) return embedded
  return value
}

export const localizeProgressTerm = (kind: DictionaryKind, value: string, locale: Locale, options?: LocalizeOptions) =>
  localizeValue(kind, value, locale, options)

export const localizeProgressList = (
  kind: DictionaryKind,
  values: string[],
  locale: Locale,
  options?: LocalizeOptions,
) => values.map((item) => localizeValue(kind, item, locale, options))

const canonicalizeValue = (kind: DictionaryKind, value: string) => {
  const entry = lookupEntry(kind, value)
  return entry ? entry.zh : value.trim()
}

export const canonicalizeProgressList = (kind: DictionaryKind, values: string[]) => {
  const seen = new Set<string>()
  const result: string[] = []
  values.forEach((value) => {
    if (!value) return
    const canonical = canonicalizeValue(kind, value)
    const normalized = normalize(canonical)
    if (seen.has(normalized)) return
    seen.add(normalized)
    result.push(canonical)
  })
  return result
}

export const progressDictionary = dictionaries

export const localizeProgressText = (value: string, locale: Locale) => {
  if (!value) return value
  const entry = workflowTextDictionary[normalize(value)]
  if (!entry) return value
  return locale === 'fr' ? entry.fr : entry.zh
}

export const progressTextDictionary = workflowTextDictionary
