import type { Locale } from './index'

export type LogExtractorCopy = {
  header: {
    title: string
    subtitle: string
    description: string
  }
  rules: {
    title: string
    items: string[]
  }
  panels: {
    inputs: {
      title: string
      description: string
    }
    prompt: {
      title: string
      description: string
    }
    output: {
      title: string
      description: string
    }
    extra: {
      title: string
      description: string
    }
    combined: {
      title: string
      description: string
    }
  }
  form: {
    dateLabel: string
    dateHint: string
    presetLabel: string
    customLabel: string
    lockLabel: string
    lockHint: string
    leaderLabel: string
    leaderPlaceholder: string
    noiseLabel: string
    noisePlaceholder: string
    noiseAdd: string
    rawLabel: string
    rawPlaceholder: string
    rawHint: string
  }
  actions: {
    extract: string
    clear: string
    copyPrompt: string
    copyOutput: string
  }
  output: {
    observations: string
    security: string
    environment: string
    general: string
    special: string
    works: string
    preparation: string
    earthwork: string
    pavement: string
    drainage: string
    safety: string
    geotech: string
    otherWork: string
    controls: string
    beTopo: string
    quarryControl: string
    subcontractControl: string
    controlOther: string
    survey: string
    quarry: string
    subcontract: string
    other: string
  }
  hints: {
    securityRequired: string
    emptyAllowed: string
    noiseEmpty: string
  }
  warnings: {
    dateMismatch: string
    dateNone: string
  }
  status: {
    promptCopied: string
    outputCopied: string
  }
}

export const logExtractorCopy: Record<Locale, LogExtractorCopy> = {
  zh: {
    header: {
      title: '日志抽取',
      subtitle: '从原始日志抽取日报字段',
      description: '仅输出指定字段，其他内容一律忽略。结果只写入所选日期。',
    },
    rules: {
      title: '抽取约束',
      items: [
        '仅使用所选日期内容，其他日期全部忽略。',
        '“安保”缺失必须填 RAS，其余字段可空。',
        '施工内容空白表示无作业，禁止填充无关信息。',
        '输出只保留中文版本，先严谨后润色。',
      ],
    },
    panels: {
      inputs: {
        title: '原始日志与规则',
        description: '粘贴原始日志，补充负责人习惯与噪声过滤词。',
      },
      prompt: {
        title: '抽取提示词（可复制）',
        description: '复制后可直接交给模型生成结构化日报。',
      },
      output: {
        title: '日报结构化输出（可校对）',
        description: '只包含允许字段，可在此微调内容。',
      },
      extra: {
        title: '补充字段',
        description: '技术/测量、采石场、分包工程、其他事项。',
      },
      combined: {
        title: '合并输出',
        description: '最终可直接粘贴到日报的中文模板。',
      },
    },
    form: {
      dateLabel: '日期',
      dateHint: '锁定日期后只抽取对应内容。',
      presetLabel: '最近日期',
      customLabel: '自定义日期',
      lockLabel: '日期锁定',
      lockHint: '检测到其他日期将只提示，不写入输出。',
      leaderLabel: '负责人习惯',
      leaderPlaceholder: '例如：LZ=路基；“PK”常指工点位置…',
      noiseLabel: '噪声过滤词',
      noisePlaceholder: '输入词语并回车添加',
      noiseAdd: '添加',
      rawLabel: '原始日志',
      rawPlaceholder: '粘贴原始日志内容（支持多负责人、混合格式）…',
      rawHint: '支持混合格式；系统会优先抽取与所选日期一致的记录。',
    },
    actions: {
      extract: '一键抽取',
      clear: '清空',
      copyPrompt: '复制提示词',
      copyOutput: '复制输出',
    },
    output: {
      observations: '安全与环境观察',
      security: '安保',
      environment: '环境',
      general: '总体观察',
      special: '特殊事件',
      works: '施工内容',
      preparation: '前期准备',
      earthwork: '土方工程',
      pavement: '路面工程',
      drainage: '排水与涵洞',
      safety: '安保与交安',
      geotech: '岩土/试验',
      otherWork: '其他',
      controls: 'Contrôles',
      beTopo: 'BE/Topo',
      quarryControl: '采石场',
      subcontractControl: '分包',
      controlOther: 'Observations / Divers',
      survey: '技术/测量',
      quarry: '采石场',
      subcontract: '分包工程',
      other: '其他事项',
    },
    hints: {
      securityRequired: '缺失必须填 “RAS”。',
      emptyAllowed: '无内容可留空。',
      noiseEmpty: '暂无过滤词。',
    },
    warnings: {
      dateMismatch: '检测到其他日期：{dates}（已忽略）',
      dateNone: '未检测到日期标记，请确认日志是否包含日期。',
    },
    status: {
      promptCopied: '提示词已复制',
      outputCopied: '输出已复制',
    },
  },
  fr: {
    header: {
      title: 'Extraction',
      subtitle: 'Extraire les champs du rapport',
      description: 'Ne sortir que les champs autorisés. Tout le reste est ignoré.',
    },
    rules: {
      title: 'Contraintes',
      items: [
        'Uniquement la date choisie; toutes les autres dates sont ignorées.',
        'La sûreté vide doit être “RAS”; les autres champs peuvent rester vides.',
        'Les travaux vides signifient aucune activité; pas de remplissage inutile.',
        'Sortie en chinois uniquement avant relecture.',
      ],
    },
    panels: {
      inputs: {
        title: 'Journal brut & règles',
        description: 'Collez les journaux bruts et précisez les habitudes.',
      },
      prompt: {
        title: 'Prompt prêt à copier',
        description: 'Copiez pour lancer l’extraction structurée.',
      },
      output: {
        title: 'Sortie structurée (à relire)',
        description: 'Uniquement les champs autorisés.',
      },
      extra: {
        title: 'Champs complémentaires',
        description: '技术/测量、采石场、分包工程、其他事项。',
      },
      combined: {
        title: 'Sortie combinée',
        description: 'Format final en chinois prêt à coller.',
      },
    },
    form: {
      dateLabel: 'Date',
      dateHint: 'La sortie est verrouillée sur la date choisie.',
      presetLabel: 'Dates récentes',
      customLabel: 'Date personnalisée',
      lockLabel: 'Verrouillage',
      lockHint: 'Les autres dates sont signalées mais ignorées.',
      leaderLabel: 'Habitudes du responsable',
      leaderPlaceholder: 'Ex.: LZ=terrassement, “PK” = position…',
      noiseLabel: 'Mots à filtrer',
      noisePlaceholder: 'Saisissez un mot puis Entrée',
      noiseAdd: 'Ajouter',
      rawLabel: 'Journal brut',
      rawPlaceholder: 'Collez le journal brut (plusieurs responsables acceptés)…',
      rawHint: 'Formats mixtes acceptés; extraction limitée à la date choisie.',
    },
    actions: {
      extract: 'Extraire',
      clear: 'Effacer',
      copyPrompt: 'Copier le prompt',
      copyOutput: 'Copier la sortie',
    },
    output: {
      observations: '安全与环境观察',
      security: '安保',
      environment: '环境',
      general: '总体观察',
      special: '特殊事件',
      works: '施工内容',
      preparation: '前期准备',
      earthwork: '土方工程',
      pavement: '路面工程',
      drainage: '排水与涵洞',
      safety: '安保与交安',
      geotech: '岩土/试验',
      otherWork: '其他',
      controls: 'Contrôles',
      beTopo: 'BE/Topo',
      quarryControl: '采石场',
      subcontractControl: '分包',
      controlOther: 'Observations / Divers',
      survey: '技术/测量',
      quarry: '采石场',
      subcontract: '分包工程',
      other: '其他事项',
    },
    hints: {
      securityRequired: 'Si vide, utiliser “RAS”.',
      emptyAllowed: 'Champ vide = aucune activité.',
      noiseEmpty: 'Aucun mot filtré.',
    },
    warnings: {
      dateMismatch: 'Autres dates détectées : {dates} (ignorées)',
      dateNone: 'Aucune date détectée dans le journal.',
    },
    status: {
      promptCopied: 'Prompt copié',
      outputCopied: 'Sortie copiée',
    },
  },
}

export const logExtractorDateLocales: Record<Locale, string> = {
  zh: 'zh-CN',
  fr: 'fr-FR',
}

export const logExtractorBreadcrumbs: Record<Locale, { home: string; reports: string; extractor: string }> = {
  zh: {
    home: '首页',
    reports: '日报管理',
    extractor: '日志抽取',
  },
  fr: {
    home: 'Accueil',
    reports: 'Rapports journaliers',
    extractor: 'Extraction',
  },
}

export const getLogExtractorCopy = (locale: Locale): LogExtractorCopy => logExtractorCopy[locale]
