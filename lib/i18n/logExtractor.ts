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
    logs: {
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
    preview: {
      title: string
      description: string
    }
  }
  logs: {
    dateLabel: string
    searchPlaceholder: string
    selectAll: string
    clearSelection: string
    selectedLabel: string
    totalLabel: string
    loading: string
    empty: string
    noContent: string
    photoLabel: string
    expand: string
    collapse: string
  }
  prompt: {
    placeholder: string
    hint: string
    readonlyHint: string
    saving: string
    saved: string
  }
  actions: {
    extract: string
    extracting: string
    extractFailed: string
    extractSuccess: string
    preview: string
    previewing: string
    previewFailed: string
    previewSuccess: string
    apply: string
    applying: string
    applyFailed: string
    applySuccess: string
    selectLogWarning: string
    previewWarning: string
    applyWarning: string
    permissionDenied: string
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
    quarry: string
    subcontract: string
    other: string
  }
  accessHint: string
}

export const logExtractorCopy: Record<Locale, LogExtractorCopy> = {
  zh: {
    header: {
      title: '日志抽取',
      subtitle: '从原始日志生成日报字段',
      description: '左侧显示所选日期的全部负责人原始日志，右侧编辑 prompt 并抽取结构化结果。',
    },
    rules: {
      title: '抽取规则',
      items: [
        '仅处理所选日期的日志内容，其他日期自动忽略。',
        '安保缺失必须填 RAS，其他字段可留空。',
        '冲突内容以最新抽取结果为准，重复内容自动合并去重。',
      ],
    },
    panels: {
      logs: {
        title: '原始日志',
        description: '按负责人查看所选日期的原始日志，支持多选抽取。',
      },
      prompt: {
        title: '抽取提示词',
        description: '支持在线编辑，自动保存到数据库。',
      },
      output: {
        title: '抽取结果',
        description: '可校对并生成合并预览后写入日报。',
      },
      preview: {
        title: '合并预览',
        description: '已按规则去重并以最新内容为准，确认后可写入日报。',
      },
    },
    logs: {
      dateLabel: '日期',
      searchPlaceholder: '搜索负责人或日志内容…',
      selectAll: '全选日志',
      clearSelection: '清空选择',
      selectedLabel: '已选',
      totalLabel: '总日志',
      loading: '日志加载中…',
      empty: '该日期暂无负责人日志。',
      noContent: '无正文内容',
      photoLabel: '照片',
      expand: '展开',
      collapse: '收起',
    },
    prompt: {
      placeholder: '输入用于抽取的提示词…',
      hint: '提示词会自动保存，适合持续微调。',
      readonlyHint: '缺少编辑权限，当前为只读模式。',
      saving: '保存中…',
      saved: '已保存',
    },
    actions: {
      extract: 'AI 抽取',
      extracting: '抽取中…',
      extractFailed: '抽取失败，请稍后重试。',
      extractSuccess: '抽取完成，可继续校对。',
      preview: '生成预览',
      previewing: '生成中…',
      previewFailed: '预览生成失败。',
      previewSuccess: '预览已生成。',
      apply: '写入日报',
      applying: '写入中…',
      applyFailed: '写入失败，请稍后重试。',
      applySuccess: '已写入日报。',
      selectLogWarning: '请先选择需要抽取的日志。',
      previewWarning: '请先确保抽取结果有内容。',
      applyWarning: '请先生成合并预览再写入。',
      permissionDenied: '缺少 report:edit 权限，无法预览或写入。',
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
      beTopo: '技术/测量',
      quarry: '采石场',
      subcontract: '分包工程',
      other: '其他事项',
    },
    accessHint: '需要拥有 report:view 或 report:edit 权限才能使用日志抽取。',
  },
  fr: {
    header: {
      title: 'Extraction',
      subtitle: 'Extraction des champs du rapport',
      description: "Journal brut à gauche, prompt et résultats à droite.",
    },
    rules: {
      title: 'Règles',
      items: [
        'Uniquement la date sélectionnée; les autres dates sont ignorées.',
        'Sûreté vide = RAS; autres champs peuvent rester vides.',
        'Conflits résolus par le contenu le plus récent, doublons supprimés.',
      ],
    },
    panels: {
      logs: {
        title: 'Journaux bruts',
        description: 'Journaux des responsables pour la date sélectionnée.',
      },
      prompt: {
        title: 'Prompt',
        description: 'Modifiable, sauvegarde automatique.',
      },
      output: {
        title: 'Résultats',
        description: 'Relire puis générer un aperçu avant écriture.',
      },
      preview: {
        title: 'Aperçu fusionné',
        description: 'Fusionné et dédoublonné, prêt à écrire.',
      },
    },
    logs: {
      dateLabel: 'Date',
      searchPlaceholder: 'Rechercher…',
      selectAll: 'Tout sélectionner',
      clearSelection: 'Vider',
      selectedLabel: 'Sélection',
      totalLabel: 'Total',
      loading: 'Chargement…',
      empty: 'Aucun journal pour cette date.',
      noContent: 'Sans contenu',
      photoLabel: 'Photos',
      expand: 'Déplier',
      collapse: 'Replier',
    },
    prompt: {
      placeholder: 'Saisissez le prompt…',
      hint: 'Sauvegarde automatique.',
      readonlyHint: 'Lecture seule (pas de droit d’édition).',
      saving: 'Sauvegarde…',
      saved: 'Sauvegardé',
    },
    actions: {
      extract: 'Extraire',
      extracting: 'Extraction…',
      extractFailed: 'Échec de l\'extraction.',
      extractSuccess: 'Extraction terminée.',
      preview: 'Prévisualiser',
      previewing: 'Préparation…',
      previewFailed: 'Échec de la prévisualisation.',
      previewSuccess: 'Aperçu prêt.',
      apply: 'Écrire',
      applying: 'Écriture…',
      applyFailed: 'Échec de l\'écriture.',
      applySuccess: 'Rapport mis à jour.',
      selectLogWarning: 'Sélectionnez des journaux.',
      previewWarning: 'Ajoutez du contenu avant aperçu.',
      applyWarning: 'Générez un aperçu avant écriture.',
      permissionDenied: 'Droit report:edit requis.',
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
      beTopo: '技术/测量',
      quarry: '采石场',
      subcontract: '分包工程',
      other: '其他事项',
    },
    accessHint: "Droits report:view ou report:edit requis.",
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
