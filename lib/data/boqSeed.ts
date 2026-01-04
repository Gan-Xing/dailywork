export type BoqRowTone = 'section' | 'subsection' | 'item' | 'total'

export type BoqLocalizedText = {
  zh: string
  fr: string
}

export type BoqRow = {
  code: string
  designation: BoqLocalizedText
  unit?: string
  unitPrice?: string
  quantity?: string
  totalPrice?: string
  tone?: BoqRowTone
}

export type BoqProject = {
  id: string
  name: BoqLocalizedText
  headerLines: BoqLocalizedText[]
  rows: BoqRow[]
}

export const boqProjects: BoqProject[] = [
  {
    id: 'project-bondoukou-city',
    name: {
      zh: '邦杜库市政路',
      fr: 'Voiries de Bondoukou',
    },
    headerLines: [
      {
        zh: '5公里道路整治工程',
        fr: "TRAVAUX D'AMENAGEMENT DE 5 KM DE VOIRIES",
      },
      {
        zh: '邦杜库市政道路 5公里',
        fr: 'VOIRIES DE BONDOUKOU 5 KM',
      },
      {
        zh: '路面结构：',
        fr: 'Structure de chaussee :',
      },
      {
        zh: '5 BB +12 GNT+18 GN 3%',
        fr: '5 BB +12 GNT+18 GN 3%',
      },
    ],
    rows: [
      {
        code: '0',
        designation: {
          zh: '现场营建',
          fr: 'INSTALLATIONS DE CHANTIER',
        },
        tone: 'section',
      },
      {
        code: '001',
        designation: {
          zh: '现场营建及设备撤场',
          fr: 'Installation générale de chantier, repli du materiel.',
        },
        unit: 'Fft',
        unitPrice: '60,000,000',
        quantity: '1',
        totalPrice: '60,000,000',
        tone: 'item',
      },
      {
        code: 'T0',
        designation: {
          zh: '小计 000',
          fr: 'TOTAL POSTE 000',
        },
        totalPrice: '60,000,000',
        tone: 'total',
      },
      {
        code: '100',
        designation: {
          zh: '施工范围清理',
          fr: 'DEGAGEMENT DES EMPRISES',
        },
        tone: 'section',
      },
      {
        code: '101',
        designation: {
          zh: '清灌',
          fr: 'Débroussament',
        },
        tone: 'subsection',
      },
      {
        code: '101a',
        designation: {
          zh: '森林和热带草原地区',
          fr: 'en zone de forêt et de savane',
        },
        unit: 'm²',
        unitPrice: '250',
        quantity: '55,000',
        totalPrice: '13,750,000',
        tone: 'item',
      },
      {
        code: '101b',
        designation: {
          zh: '在沼泽地区',
          fr: 'en zone marécageuse',
        },
        unit: 'm²',
        unitPrice: '300',
        quantity: '2,750',
        totalPrice: '825,000',
        tone: 'item',
      },
      {
        code: '102',
        designation: {
          zh: '腐殖土剥离，厚度0.20m',
          fr: 'Décapage de la terre végétale sur EP. 0,20m',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '102a',
        designation: {
          zh: '森林和热带草原地区',
          fr: 'en zone de forêt et de savane',
        },
        unit: 'm²',
        unitPrice: '420',
        quantity: '66,000',
        totalPrice: '27,720,000',
        tone: 'item',
      },
      {
        code: '102b',
        designation: {
          zh: '在沼泽地区',
          fr: 'en zone marécageuse',
        },
        unit: 'm²',
        unitPrice: '500',
        quantity: '1,375',
        totalPrice: '687,500',
        tone: 'item',
      },
      {
        code: '103',
        designation: {
          zh: '树木砍伐、清根及外运',
          fr: 'Abattage, dessouchage et évacuation des arbres',
        },
        tone: 'subsection',
      },
      {
        code: '103a',
        designation: {
          zh: '周长大于1m且小于等于3m',
          fr: '- de circonférence strictement supérieure à 1 et inférieure ou égale à 3 m',
        },
        unit: 'u',
        unitPrice: '19,200',
        tone: 'item',
      },
      {
        code: '103b',
        designation: {
          zh: '周长大于3m',
          fr: '- de circonférence strictement supérieure à 3 m',
        },
        unit: 'u',
        unitPrice: '48,000',
        tone: 'item',
      },
      {
        code: '105',
        designation: {
          zh: '拆除各种混凝土、砖石或金属结构物',
          fr: "Démolition d'ouvrages divers en béton, en maçonnerie ou en métallique",
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '105a',
        designation: {
          zh: '砖石结构或轻微钢筋混凝土结构',
          fr: 'en maçonnerie ou en béton légèrement armé',
        },
        unit: 'm3',
        unitPrice: '7,000',
        quantity: '224',
        totalPrice: '1,568,000',
        tone: 'item',
      },
      {
        code: '105b',
        designation: {
          zh: '钢筋混凝土结构',
          fr: 'en béton armé',
        },
        unit: 'm3',
        unitPrice: '11,000',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '109',
        designation: {
          zh: '拆除和存放现有路缘石',
          fr: 'Dépose et mise en dépôt de bordures existantes',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '109a',
        designation: {
          zh: '拆除和存放现有T2路缘石',
          fr: 'Dépose et mise en dépôt de bordures T2 existantes',
        },
        unit: 'ml',
        unitPrice: '2,400',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '109b',
        designation: {
          zh: '拆除和存放现有T2CS2路缘石',
          fr: 'Dépose et mise en dépôt de bordures T2CS2 existantes',
        },
        unit: 'ml',
        unitPrice: '1,500',
        quantity: '266',
        totalPrice: '399,000',
        tone: 'item',
      },
      {
        code: '109c',
        designation: {
          zh: '拆除和存放现有边沟',
          fr: 'Dépose et mise en dépôt de caniveaux existantes',
        },
        unit: 'ml',
        unitPrice: '7,200',
        quantity: '394',
        totalPrice: '2,836,800',
        tone: 'item',
      },
      {
        code: 'T1',
        designation: {
          zh: '小计 100',
          fr: 'TOTAL POSTE 100',
        },
        totalPrice: '47,786,300',
        tone: 'total',
      },
      {
        code: '200',
        designation: {
          zh: '土方',
          fr: 'TERRASSEMENTS',
        },
        tone: 'section',
      },
      {
        code: '201',
        designation: {
          zh: '挖方存放',
          fr: 'Déblais mis en dépôt',
        },
        tone: 'subsection',
      },
      {
        code: '201a',
        designation: {
          zh: '软土地面',
          fr: 'en terrain meuble',
        },
        unit: 'm3',
        unitPrice: '4,000',
        quantity: '10,000',
        totalPrice: '40,000,000',
        tone: 'item',
      },
      {
        code: '201b',
        designation: {
          zh: '易碎岩石地面',
          fr: 'en terrain rocheux friable',
        },
        unit: 'm3',
        unitPrice: '20,000',
        quantity: '47',
        totalPrice: '940,000',
        tone: 'item',
      },
      {
        code: '201c',
        designation: {
          zh: '密实岩石地面',
          fr: 'en terrain rocheux compact',
        },
        unit: 'm3',
        unitPrice: '-',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '203',
        designation: {
          zh: '挖方土回填',
          fr: 'Remblais provenant des déblais',
        },
        unit: 'm3',
        unitPrice: '5,900',
        quantity: '2,500',
        totalPrice: '14,750,000',
        tone: 'item',
      },
      {
        code: '204',
        designation: {
          zh: '取土场回填（包括垫层）',
          fr: "Remblai provenant d'emprunt y compris la couche de forme",
        },
        unit: 'm3',
        unitPrice: '7,300',
        quantity: '21,250',
        totalPrice: '155,125,000',
        tone: 'item',
      },
      {
        code: '206',
        designation: {
          zh: '清理贫瘠土壤',
          fr: 'Purge de terre de mauvaise tenue',
        },
        unit: 'm3',
        unitPrice: '6,500',
        quantity: '2,600',
        totalPrice: '16,900,000',
        tone: 'item',
      },
      {
        code: '207',
        designation: {
          zh: '水力回填',
          fr: 'Remblais hydraulique',
        },
        unit: 'm3',
        unitPrice: '8,000',
        quantity: '1,300',
        totalPrice: '10,400,000',
        tone: 'item',
      },
      {
        code: '208',
        designation: {
          zh: '对现有路面进行20cm厚的开挖',
          fr: "Décaissement de chaussée existante sur 20 cm d'épaisseur",
        },
        unit: 'm²',
        unitPrice: '4,000',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '209',
        designation: {
          zh: '对上层路基进行平整和压实',
          fr: 'Mise en forme et compactage de la plateforme supérieure de terrassement',
        },
        unit: 'm²',
        unitPrice: '580',
        quantity: '55,000',
        totalPrice: '31,900,000',
        tone: 'item',
      },
      {
        code: '210',
        designation: {
          zh: '边坡草皮种植（包括15cm厚表层种植土）',
          fr: "Engazonnement des talus y compris apport de terre végétale d'épaisseur 15cm",
        },
        unit: 'm²',
        unitPrice: '1,500',
        quantity: '18,750',
        totalPrice: '28,125,000',
        tone: 'item',
      },
      {
        code: 'T2',
        designation: {
          zh: '小计 200',
          fr: 'TOTAL POSTE 200',
        },
        totalPrice: '298,140,000',
        tone: 'total',
      },
      {
        code: '300',
        designation: {
          zh: '路面铺装',
          fr: 'CHAUSSEE ET REVÊTEMENTS',
        },
        tone: 'section',
      },
      {
        code: '301',
        designation: {
          zh: '底基层天然精选材料的供应、运输和施工',
          fr:
            'Fourniture, transport  et mise en œuvre de matériaux naturels sélectionnés pour couche de fondation',
        },
        tone: 'subsection',
      },
      {
        code: '301a',
        designation: {
          zh: '底基层-天然砾石',
          fr: 'Couche de fondation en graveleux naturelle sélectionnée',
        },
        unit: 'm3',
        unitPrice: '7,300',
        quantity: '9,900',
        totalPrice: '72,270,000',
        tone: 'item',
      },
      {
        code: '302',
        designation: {
          zh: '基层天然精选材料的供应、运输和施工',
          fr:
            'Fourniture, transport  et mise en œuvre de matériaux naturels sélectionnés pour couche de base',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '302c',
        designation: {
          zh: '基层-未处理碎石0/31.5',
          fr: 'Couche de base en Grave Non Traitée 0/31.5',
        },
        unit: 'm3',
        unitPrice: '32,500',
        quantity: '6,600',
        totalPrice: '214,500,000',
        tone: 'item',
      },
      {
        code: '303',
        designation: {
          zh: '底基层-水稳土（3%水泥）',
          fr: 'Stabilisation au ciment de la couche de fondation a 3 % de ciment',
        },
        unit: 'kg',
        unitPrice: '250',
        quantity: '653,400',
        totalPrice: '163,350,000',
        tone: 'item',
      },
      {
        code: '304',
        designation: {
          zh: '透层稀释沥青0/1供应与运输（1.2kg/m2）',
          fr: 'Fourniture et transport du cut back 0/1 pour imprégnation  1,2 kg /m2',
        },
        unit: 'm²',
        unitPrice: '1,050',
        quantity: '55,000',
        totalPrice: '57,750,000',
        tone: 'item',
      },
      {
        code: '305',
        designation: {
          zh: '粘层施工（喷洒量450g/m2）',
          fr: "Mise en œuvre d'une couche d'accrochage à 450 g/m2",
        },
        unit: 'm²',
        unitPrice: '900',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '305b',
        designation: {
          zh: '粘层施工（喷洒量300g/m2）',
          fr: "Mise en œuvre d'une couche d'accrochage à 300 g/m2",
        },
        unit: 'm²',
        unitPrice: '700',
        quantity: '55,000',
        totalPrice: '38,500,000',
        tone: 'item',
      },
      {
        code: '307',
        designation: {
          zh: '路面层-沥青混凝土SG',
          fr: 'Béton bitumineux SG pour couche de roulement',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '307a',
        designation: {
          zh: '路肩厚度为3厘米',
          fr: ' - sur une épaisseur 3 cm pour les accotements',
        },
        unit: 'm²',
        unitPrice: '7,100',
        quantity: '16,500',
        totalPrice: '117,150,000',
        tone: 'item',
      },
      {
        code: '307c',
        designation: {
          zh: '路面厚度为5厘米',
          fr: ' - sur une épaisseur 5 cm pour la couche de roulement',
        },
        unit: 'm²',
        unitPrice: '10,800',
        quantity: '38,500',
        totalPrice: '415,800,000',
        tone: 'item',
      },
      {
        code: '309',
        designation: {
          zh: '人行道和中央分隔带的铺装（含GL底基层）',
          fr: 'Revêtement des trottoirs  et TPC en béton y compris couches de fondation en GL',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '309a',
        designation: {
          zh: '中央分隔带的铺砖（含砂垫层）',
          fr: 'Revêtement de TPC en pavé y compris lit de sable',
        },
        unit: 'm²',
        unitPrice: '16,000',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '309b',
        designation: {
          zh: '人行道的铺砖（含砂垫层）',
          fr: 'Revêtement des trottoirs en pavé y compris lit de sable',
        },
        unit: 'm²',
        unitPrice: '16,000',
        quantity: '3,125',
        totalPrice: '50,000,000',
        tone: 'item',
      },
      {
        code: 'T3',
        designation: {
          zh: '小计 300',
          fr: 'TOTAL POSTE 300',
        },
        totalPrice: '1,129,320,000',
        tone: 'total',
      },
      {
        code: '400',
        designation: {
          zh: '排水',
          fr: 'ASSAINISSEMENT',
        },
        tone: 'section',
      },
      {
        code: '401i',
        designation: {
          zh: '加高现有边沟',
          fr: 'Réhaussement de caniveaux existants',
        },
        unit: 'ml',
        unitPrice: '-',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '401j',
        designation: {
          zh: '钢筋混凝土矩形边沟',
          fr: 'Caniveau rectangulaire en béton armé',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '401j1',
        designation: {
          zh: '50 x 50边沟',
          fr: 'Caniveaux de section 50 x 50',
        },
        unit: 'ml',
        unitPrice: '43,000',
        quantity: '1,000',
        totalPrice: '43,000,000',
        tone: 'item',
      },
      {
        code: '401j4',
        designation: {
          zh: '60 x 60边沟',
          fr: 'Caniveaux de section 60 x 60',
        },
        unit: 'ml',
        unitPrice: '55,000',
        quantity: '2,500',
        totalPrice: '137,500,000',
        tone: 'item',
      },
      {
        code: '401j8',
        designation: {
          zh: '80 x 80边沟',
          fr: 'Caniveaux de section 80 x 80',
        },
        unit: 'ml',
        unitPrice: '77,000',
        quantity: '2,500',
        totalPrice: '192,500,000',
        tone: 'item',
      },
      {
        code: '401j10',
        designation: {
          zh: '100 x 100边沟',
          fr: 'Caniveaux de section 100 x 100',
        },
        unit: 'ml',
        unitPrice: '120,000',
        quantity: '1,000',
        totalPrice: '120,000,000',
        tone: 'item',
      },
      {
        code: '403c',
        designation: {
          zh: '建造检查井（含排水口、格栅和井盖）',
          fr: 'Construction de regards y compris les avaloirs, les grilles et les tampons',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '403c1',
        designation: {
          zh: '70 x 70检查井（含排水口、格栅和井盖）',
          fr: 'Construction de regards avaloirs 70x70, y compris les grilles et les tampons',
        },
        unit: 'U',
        unitPrice: '300,000',
        quantity: '8',
        totalPrice: '2,400,000',
        tone: 'item',
      },
      {
        code: '403e',
        designation: {
          zh: '混凝土箱涵的建设',
          fr: 'Construction de dalots en béton armé',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '403e1',
        designation: {
          zh: '0.50x0.50混凝土箱涵',
          fr: 'Dalot 0.50x0.50 en béton armé',
        },
        unit: 'ml',
        unitPrice: '90,000',
        quantity: '50',
        totalPrice: '4,500,000',
        tone: 'item',
      },
      {
        code: '403e2',
        designation: {
          zh: '0.60x0.60混凝土箱涵',
          fr: 'Dalot 0.60x0.60 en béton armé',
        },
        unit: 'ml',
        unitPrice: '105,000',
        quantity: '100',
        totalPrice: '10,500,000',
        tone: 'item',
      },
      {
        code: '403e4',
        designation: {
          zh: '0.80x0.80混凝土箱涵',
          fr: 'Dalot 0.80x0.80 en béton armé',
        },
        unit: 'ml',
        unitPrice: '170,000',
        quantity: '38',
        totalPrice: '6,460,000',
        tone: 'item',
      },
      {
        code: '403e5',
        designation: {
          zh: '1x1混凝土箱涵',
          fr: 'Dalot 1x1 en béton armé',
        },
        unit: 'ml',
        unitPrice: '250,000',
        quantity: '50',
        totalPrice: '12,500,000',
        tone: 'item',
      },
      {
        code: '404',
        designation: {
          zh: '保护和支撑',
          fr: 'Protections et Soutènements',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '404a',
        designation: {
          zh: '浆砌片石',
          fr: 'Perrés maçonnés',
        },
        unit: 'm²',
        unitPrice: '35,000',
        quantity: '112',
        totalPrice: '3,920,000',
        tone: 'item',
      },
      {
        code: '405',
        designation: {
          zh: '路缘石',
          fr: 'Bordures',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '405c',
        designation: {
          zh: 'P1人行道路缘石',
          fr: 'Bordures de trottoir type P1',
        },
        unit: 'ml',
        unitPrice: '8,000',
        quantity: '1,927',
        totalPrice: '15,416,000',
        tone: 'item',
      },
      {
        code: '405g',
        designation: {
          zh: 'A2CS2路缘石',
          fr: 'Bordures basses type A2CS2',
        },
        unit: 'ml',
        unitPrice: '14,500',
        quantity: '625',
        totalPrice: '9,062,500',
        tone: 'item',
      },
      {
        code: '405h',
        designation: {
          zh: 'T2CS2路缘石',
          fr: 'Bordures basses type T2CS2',
        },
        unit: 'ml',
        unitPrice: '17,500',
        quantity: '3,000',
        totalPrice: '52,500,000',
        tone: 'item',
      },
      {
        code: '405i',
        designation: {
          zh: 'T2路缘石',
          fr: 'Bordures basses type T2',
        },
        unit: 'ml',
        unitPrice: '10,900',
        quantity: '1,875',
        totalPrice: '20,437,500',
        tone: 'item',
      },
      {
        code: '406',
        designation: {
          zh: '结构物的底部挖掘',
          fr: 'Fouilles pour fondation des ouvrages',
        },
        tone: 'subsection',
      },
      {
        code: '406a',
        designation: {
          zh: '软土地面',
          fr: 'en terrain meuble',
        },
        unit: 'm3',
        unitPrice: '4,500',
        quantity: '290',
        totalPrice: '1,305,000',
        tone: 'item',
      },
      {
        code: '407',
        designation: {
          zh: '挖掘填方',
          fr: 'Remblais de fouilles',
        },
        unit: 'm3',
        unitPrice: '7,000',
        quantity: '174',
        totalPrice: '1,218,000',
        tone: 'item',
      },
      {
        code: '408',
        designation: {
          zh: '排水结构物模板',
          fr: 'Coffrages pour les ouvrages  te de drainage',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '408a',
        designation: {
          zh: '普通模板',
          fr: ' - coffrages plans ordinaires',
        },
        unit: 'm²',
        unitPrice: '7,000',
        quantity: '390',
        totalPrice: '2,730,000',
        tone: 'item',
      },
      {
        code: '408b',
        designation: {
          zh: '精装模板',
          fr: ' - coffrage pour parements soignés',
        },
        unit: 'm²',
        unitPrice: '10,000',
        quantity: '420',
        totalPrice: '4,200,000',
        tone: 'item',
      },
      {
        code: '409',
        designation: {
          zh: '结构物钢筋',
          fr: 'Aciers pour ouvrages',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '409a',
        designation: {
          zh: '高强度钢筋',
          fr: 'Aciers à haute adhérence',
        },
        unit: 'kg',
        unitPrice: '1,000',
        quantity: '14,250',
        totalPrice: '14,250,000',
        tone: 'item',
      },
      {
        code: '410',
        designation: {
          zh: '清洁混凝土C150，厚度10厘米',
          fr: 'Béton de propété C150 sur une épaisseur de 10 cm',
        },
        unit: 'm²',
        unitPrice: '8,500',
        quantity: '300',
        totalPrice: '2,550,000',
        tone: 'item',
      },
      {
        code: '411',
        designation: {
          zh: '水泥CPA 350，质量为Q 350的混凝土',
          fr: 'Béton de qualité Q 350 au CPA 350',
        },
        unit: 'm3',
        unitPrice: '115,000',
        quantity: '150',
        totalPrice: '17,250,000',
        tone: 'item',
      },
      {
        code: '412',
        designation: {
          zh: '埋墙的粉刷',
          fr: 'Badigeonnage des parements enterrés',
        },
        unit: 'm²',
        unitPrice: '2,200',
        quantity: '600',
        totalPrice: '1,320,000',
        tone: 'item',
      },
      {
        code: 'T4',
        designation: {
          zh: '小计 400',
          fr: 'TOTAL POSTE 400',
        },
        totalPrice: '675,519,000',
        tone: 'total',
      },
      {
        code: '500',
        designation: {
          zh: '安全和信号标识',
          fr: 'SECURITE ET SIGNALISATION',
        },
        tone: 'section',
      },
      {
        code: '503',
        designation: {
          zh: '宽度为0.12米的连续或断续白色标线（2U）',
          fr: 'Bande de peinture blanche continue ou discontinue de largeur 0,12 m (2U)',
        },
        tone: 'subsection',
      },
      {
        code: '503a',
        designation: {
          zh: '宽度为0.12米的中心虚线（2U）',
          fr: 'Bande axiale discontinue de largeur 0,12 m (2U)',
        },
        unit: 'ml',
        unitPrice: '700',
        quantity: '3,250',
        totalPrice: '2,275,000',
        tone: 'item',
      },
      {
        code: '503b',
        designation: {
          zh: '宽度为0.18米的连续或断续标线（3U）',
          fr: 'Bande continue ou discontinue de largeur 0,18 m (3U)',
        },
        unit: 'ml',
        unitPrice: '900',
        quantity: '8,151',
        totalPrice: '7,335,900',
        tone: 'item',
      },
      {
        code: '503c',
        designation: {
          zh: '宽度为0.12米的连续白线（2U）',
          fr: 'Bande blanche continue de largeur 0,12 m (2U)',
        },
        unit: 'ml',
        unitPrice: '700',
        quantity: '750',
        totalPrice: '525,000',
        tone: 'item',
      },
      {
        code: '504',
        designation: {
          zh: '特殊白色涂漆标记',
          fr: 'Marquages spéciaux en peinture blanche',
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '504a',
        designation: {
          zh: '宽度为0.50米的斑马线（人行横道）',
          fr: 'Passages cloutés de largeur 0,50 m',
        },
        unit: 'm²',
        unitPrice: '6,500',
        quantity: '250',
        totalPrice: '1,625,000',
        tone: 'item',
      },
      {
        code: '504b',
        designation: {
          zh: '停车线',
          fr: 'Ligne STOP',
        },
        unit: 'ml',
        unitPrice: '3,500',
        quantity: '400',
        totalPrice: '1,400,000',
        tone: 'item',
      },
      {
        code: '504c',
        designation: {
          zh: '方向箭头',
          fr: 'Flèches directionnelles',
        },
        unit: 'U',
        unitPrice: '-',
        quantity: '-',
        totalPrice: '-',
        tone: 'item',
      },
      {
        code: '505',
        designation: {
          zh: 'A型标牌',
          fr: 'Panneau de signalisation type A',
        },
        unit: 'U',
        unitPrice: '180,000',
        quantity: '10',
        totalPrice: '1,800,000',
        tone: 'item',
      },
      {
        code: '506',
        designation: {
          zh: 'B型、AB型标牌',
          fr: 'Panneau de signalisation de type B ou AB',
        },
        unit: 'U',
        unitPrice: '180,000',
        quantity: '10',
        totalPrice: '1,800,000',
        tone: 'item',
      },
      {
        code: '507',
        designation: {
          zh: 'C型标牌',
          fr: 'Panneau de signalisation de type C',
        },
        unit: 'U',
        unitPrice: '180,000',
        quantity: '3',
        totalPrice: '540,000',
        tone: 'item',
      },
      {
        code: '508',
        designation: {
          zh: 'D型、EB型标牌',
          fr: 'Panneau de signalisation de type D ou EB',
        },
        unit: 'U',
        unitPrice: '250,000',
        quantity: '3',
        totalPrice: '750,000',
        tone: 'item',
      },
      {
        code: 'T5',
        designation: {
          zh: '小计 500',
          fr: 'TOTAL POSTE 500',
        },
        totalPrice: '18,050,900',
        tone: 'total',
      },
      {
        code: '600',
        designation: {
          zh: '社会环境保护',
          fr: 'MESURES COMENSATRICES ENVIRONNEMENTALE ET SOCIALE',
        },
        tone: 'section',
      },
      {
        code: '605',
        designation: {
          zh: '开采区域的恢复工作',
          fr: "Remise en état des zones d'extraction",
        },
        totalPrice: '-',
        tone: 'subsection',
      },
      {
        code: '605a',
        designation: {
          zh: '取土场（红土）的恢复工作',
          fr: "Remise en état des zones d'emprunt (latérite)",
        },
        unit: 'm²',
        unitPrice: '500',
        quantity: '58,906',
        totalPrice: '29,453,000',
        tone: 'item',
      },
      {
        code: '605b',
        designation: {
          zh: '弃土场的表土稳定',
          fr: 'Stabilisation des zones de dépôt',
        },
        unit: 'm²',
        unitPrice: '500',
        quantity: '28,594',
        totalPrice: '14,297,000',
        tone: 'item',
      },
      {
        code: 'T6',
        designation: {
          zh: '小计 600',
          fr: 'TOTAL POSTE 600',
        },
        totalPrice: '43,750,000',
        tone: 'total',
      },
      {
        code: 'R',
        designation: {
          zh: '汇总',
          fr: 'RECAPITULATIF',
        },
        tone: 'section',
      },
      {
        code: '000',
        designation: {
          zh: '现场营建',
          fr: 'INSTALLATIONS DE CHANTIER',
        },
        totalPrice: '60,000,000',
        tone: 'subsection',
      },
      {
        code: '100',
        designation: {
          zh: '施工范围清理',
          fr: 'DEGAGEMENT DES EMPRISES',
        },
        totalPrice: '47,786,300',
        tone: 'subsection',
      },
      {
        code: '200',
        designation: {
          zh: '土方',
          fr: 'TERRASSEMENTS',
        },
        totalPrice: '298,140,000',
        tone: 'subsection',
      },
      {
        code: '300',
        designation: {
          zh: '路面铺装',
          fr: 'CHAUSSEE ET REVÊTEMENTS',
        },
        totalPrice: '1,129,320,000',
        tone: 'subsection',
      },
      {
        code: '400',
        designation: {
          zh: '排水',
          fr: 'ASSAINISSEMENT',
        },
        totalPrice: '675,519,000',
        tone: 'subsection',
      },
      {
        code: '500',
        designation: {
          zh: '安全和信号标识',
          fr: 'SECURITE ET SIGNALISATION',
        },
        totalPrice: '18,050,900',
        tone: 'subsection',
      },
      {
        code: '600',
        designation: {
          zh: '社会环境保护',
          fr: 'MESURES COMENSATRICES ENVIRONNEMENTALE ET SOCIALE',
        },
        totalPrice: '43,750,000',
        tone: 'subsection',
      },
      {
        code: 'TOTAL HTVA',
        designation: {
          zh: '不含税总计',
          fr: 'TOTAL GENERAL HTVA',
        },
        totalPrice: '2,272,566,200',
        tone: 'total',
      },
      {
        code: 'TVA',
        designation: {
          zh: '增值税 (18%)',
          fr: 'TVA (18%)',
        },
        totalPrice: '409,061,916',
        tone: 'subsection',
      },
      {
        code: 'TOTAL TTC',
        designation: {
          zh: '含税总计',
          fr: 'TOTAL GENERAL TTC',
        },
        totalPrice: '2,681,628,116',
        tone: 'total',
      },
    ],
  },
  {
    id: 'project-danda-city',
    name: {
      zh: '丹达市政路',
      fr: 'Voiries de Danda',
    },
    headerLines: [],
    rows: [],
  },
]
