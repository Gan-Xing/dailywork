export type Locale = 'fr' | 'zh'

export type LocalizedString = Record<Locale, string>

interface SummaryCardCopy {
  label: string
  unit: string
  helperTemplate: string
}

interface SectionWithDescription {
  title: string
  description: string
}

interface MetadataSectionCopy extends SectionWithDescription {
  fields: {
    month: string
    year: string
    date: string
  }
}

interface ScheduleSectionCopy extends SectionWithDescription {
  fields: {
    horaires: string
    stoppage: string
    stoppagePlaceholder: string
  }
}

interface WeatherTableCopy {
  period: string
  condition: string
  rainfall: string
  selectPlaceholder: string
}

interface EquipmentTableCopy {
  designation: string
  total: string
  marche: string
  panne: string
  arret: string
  grandTotal: string
}

interface MaterialsTableCopy {
  designation: string
  unitPrefix: string
  columns: {
    previous: string
    entry: string
    exit: string
    current: string
  }
}

interface PersonnelTableCopy {
  role: string
  present: string
  absent: string
  total: string
  expatriate: string
}

interface CopyShape {
  common: {
    languageToggleLabel: string
    previewButtonLabel: string
    previewCloseLabel: string
    previewTitle: string
  }
  header: {
    logosTitle: string
    siteLabel: string
    siteDescription: string
  }
  summary: {
    equipment: SummaryCardCopy
    materials: SummaryCardCopy
    personnel: SummaryCardCopy
  }
  sections: {
    metadata: MetadataSectionCopy
    schedule: ScheduleSectionCopy
    weather: SectionWithDescription
    equipment: SectionWithDescription
    materials: SectionWithDescription
    personnel: SectionWithDescription
    observations: SectionWithDescription
    works: SectionWithDescription
    additional: SectionWithDescription
  }
  tables: {
    weather: WeatherTableCopy
    equipment: EquipmentTableCopy
    materials: MaterialsTableCopy
    personnel: PersonnelTableCopy
  }
}

const uiCopy: Record<Locale, CopyShape> = {
  fr: {
    common: {
      languageToggleLabel: 'Langue',
      previewButtonLabel: 'Prévisualiser',
      previewCloseLabel: 'Fermer',
      previewTitle: 'Aperçu du rapport',
    },
    header: {
      logosTitle: 'Logos et entités',
      siteLabel: 'Nom du chantier',
      siteDescription:
        "TRAVAUX DE RENFORCEMENT DE LA ROUTE BONDOUKOU - BOUNA Y COMPRIS L'AMENAGEMENT DES TRAVERSEES DE BOUNA, BONDOUKOU ET AGNIBILEKROU (MARCHE 2024 - 0 - 11 - 00 - 2 - 0560/-330)",
    },
    summary: {
      equipment: {
        label: 'Lignes matériel',
        unit: 'entrées',
        helperTemplate: '{total} équipements déclarés · {marche} en marche',
      },
      materials: {
        label: 'Champs matériaux',
        unit: 'types',
        helperTemplate: 'Les unités suivent le schema et supportent les décimales',
      },
      personnel: {
        label: 'Profils',
        unit: 'postes',
        helperTemplate: 'Présents {present} · Absents {absent}',
      },
    },
    sections: {
      metadata: {
        title: 'En-tête du journal',
        description: "Sélectionnez l'année, le mois et la date comme sur l'en-tête Excel.",
        fields: {
          month: 'Journal de chantier du mois de',
          year: 'Année',
          date: 'Date',
        },
      },
      schedule: {
        title: 'Horaires du chantier',
        description:
          "L'horaire standard est déjà rempli; consignez uniquement les arrêts et leurs causes.",
        fields: {
          horaires: 'Horaires',
          stoppage: 'Arrêt & cause',
          stoppagePlaceholder:
            'Indiquez les périodes d’arrêt et leur cause lorsqu’il y en a; sinon laissez vide.',
        },
      },
      weather: {
        title: 'Conditions météo',
        description: 'Créneaux fixes 7h30 / 12h30 / 17h30 avec état du ciel et pluviométrie.',
      },
      equipment: {
        title: 'Matériel sur le chantier',
        description:
          'Saisissez les 52 familles une seule fois; les totaux se mettent à jour automatiquement.',
      },
      materials: {
        title: 'Approvisionnement en matériaux',
        description: 'Suivez stock précédent, entrées, sorties et nouveau stock pour chaque matériau.',
      },
      personnel: {
        title: 'Personnel sur le chantier',
        description: 'Consolidez présents/absents par fonction et suivez les effectifs expatriés.',
      },
      observations: {
        title: 'Observations sûreté & environnement',
        description:
          'Séparez les commentaires sûreté, environnement, observations générales et événements.',
      },
      works: {
        title: 'Travaux exécutés',
        description: 'Décrivez les productions, zones concernées, ressources et difficultés par lot.',
      },
      additional: {
        title: 'Contrôles',
        description:
          'Bloc réservé au maître d’œuvre : détailler BE/Topo, Carrière, Sous-traitance et observations.',
      },
    },
    tables: {
      weather: {
        period: 'Période',
        condition: 'Condition météorologique',
        rainfall: 'Pluviométrie (mm)',
        selectPlaceholder: 'Sélectionner',
      },
      equipment: {
        designation: 'Désignation',
        total: 'Total',
        marche: 'Marche',
        panne: 'Panne',
        arret: 'Arrêt',
        grandTotal: 'TOTAL',
      },
      materials: {
        designation: 'Désignation',
        unitPrefix: 'Unité',
        columns: {
          previous: 'Stock préc.',
          entry: 'Entrée',
          exit: 'Sortie',
          current: 'Nouveau stock',
        },
      },
      personnel: {
        role: 'Fonction',
        present: 'Présent',
        absent: 'Absent',
        total: 'TOTAL',
        expatriate: 'Dont expatriés',
      },
    },
  },
  zh: {
    common: {
      languageToggleLabel: '语言',
      previewButtonLabel: '预览原型',
      previewCloseLabel: '关闭预览',
      previewTitle: '日报预览',
    },
    header: {
      logosTitle: '标识与参建单位',
      siteLabel: '工地名称',
      siteDescription:
        '邦杜库—布纳公路加固工程（含布纳、邦杜库、阿尼比莱克鲁穿越段，合同 2024-0-11-00-2-0560/-330）',
    },
    summary: {
      equipment: {
        label: '设备条目',
        unit: '项',
        helperTemplate: '共录入 {total} 台，运行 {marche} 台',
      },
      materials: {
        label: '材料字段',
        unit: '类',
        helperTemplate: '库存支持小数，默认单位沿用 schema',
      },
      personnel: {
        label: '岗位数量',
        unit: '个',
        helperTemplate: '在岗 {present} · 缺勤 {absent}',
      },
    },
    sections: {
      metadata: {
        title: '日志标题信息',
        description: '按照原 Excel 页眉选择所属年份、月份与具体日期。',
        fields: {
          month: '施工日志月份',
          year: '年份',
          date: '日期',
        },
      },
      schedule: {
        title: '工地工时',
        description: '默认作业时间无需修改，如遇停工请记录原因与时段。',
        fields: {
          horaires: '作业时段',
          stoppage: '停工与原因',
          stoppagePlaceholder: '若当日存在停工，请说明具体时段与原因；可留空。',
        },
      },
      weather: {
        title: '气象条件',
        description: '7h30 / 12h30 / 17h30 固定时段，选择天气并记录降雨量。',
      },
      equipment: {
        title: '工地设备',
        description: '52 种设备一次录入，底部自动求和，后续可对接存档或 Server Action。',
      },
      materials: {
        title: '材料供应',
        description: '跟踪上期库存、入库、出库与当前库存。单位沿用 schema。',
      },
      personnel: {
        title: '在场人员',
        description: '统一记录管理层与作业层到岗/缺勤，并额外统计外派人员。',
      },
      observations: {
        title: '安全与环境观察',
        description: '安全、环境、总体观察及特殊事件分区填写，便于后续润色。',
      },
      works: {
        title: '施工内容',
        description: '按工序分块记录产量、工点、资源及问题，空白表示无作业。',
      },
      additional: {
        title: 'Contrôles',
        description: '供监理填写：分别记录 BE/Topo、采石场、分包以及 Observations / Divers。',
      },
    },
    tables: {
      weather: {
        period: '时间段',
        condition: '天气状况',
        rainfall: '降雨量 (mm)',
        selectPlaceholder: '请选择',
      },
      equipment: {
        designation: '设备名称',
        total: '总数',
        marche: '运行',
        panne: '故障',
        arret: '停机',
        grandTotal: '汇总',
      },
      materials: {
        designation: '材料名称',
        unitPrefix: '单位',
        columns: {
          previous: '上期库存',
          entry: '入库',
          exit: '出库',
          current: '当前库存',
        },
      },
      personnel: {
        role: '岗位',
        present: '在岗',
        absent: '缺勤',
        total: '合计',
        expatriate: '其中外派',
      },
    },
  },
}

export type UICopy = (typeof uiCopy)[Locale]

export const locales: Locale[] = ['fr', 'zh']

export const localeLabels: Record<Locale, string> = {
  fr: 'FR',
  zh: '中文',
}

export const getCopy = (locale: Locale): UICopy => uiCopy[locale]

export const formatCopy = (
  template: string,
  values: Record<string, string | number>,
): string => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))
