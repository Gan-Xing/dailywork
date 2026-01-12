import type { PhaseMeasure } from '../progressTypes'
import type { Locale } from './index'

export type ProductionValueCopy = {
  breadcrumbs: {
    home: string
    value: string
  }
  card: {
    badge: string
    title: string
    description: string
    cta: string
  }
  tabs: {
    production: string
    boq: string
    manage: string
  }
  page: {
    title: string
    description: string
    managePricesCta: string
    unitLabel: string
    tableHeaders: {
      phase: string
      spec: string
      designAmount: string
      unitPrice: string
      designValue: string
      completedAmount: string
      completedValue: string
      percent: string
    }
    messages: {
      loading: string
      empty: string
      unauthorized: string
      error: string
      priceLoading: string
      priceLoadError: string
    }
  }
  boq: {
    title: string
    description: string
    projectLabel: string
    projectPlaceholder: string
    actions: {
      searchLabel: string
      searchPlaceholder: string
      viewLabel: string
      viewAll: string
      viewSummary: string
      manageCta: string
    }
    tableHeaders: {
      code: string
      designation: string
      unit: string
      unitPrice: string
      quantity: string
      totalPrice: string
    }
    messages: {
      loading: string
      projectLoading: string
      loadError: string
      empty: string
      noHeader: string
      noMatches: string
    }
  }
}

export const productionValueCopy: Record<Locale, ProductionValueCopy> = {
  zh: {
    breadcrumbs: {
      home: '首页',
      value: '产值计量'
    },
    card: {
      badge: '产值计量',
      title: '产值计量',
      description:
        '汇总各分项的设计/完成量与单价，梳理产值进度。权限足够即可查看最新数据。',
      cta: '查看产值详情'
    },
    tabs: {
      production: '产值计量',
      boq: '工程量清单',
      manage: '分项管理'
    },
    page: {
      title: '产值计量',
      description: '',
      managePricesCta: '分项管理',
      unitLabel: '',
      tableHeaders: {
        phase: '分项工程',
        spec: '规格',
        designAmount: '设计量',
        unitPrice: '对应价格',
        designValue: '设计量总金额',
        completedAmount: '目前已完成工程量',
        completedValue: '已完成产值',
        percent: '完成百分比'
      },
      messages: {
        loading: '正在加载产值数据…',
        empty: '暂无产值数据',
        unauthorized: '需“产值查看”权限才能查看产值计量',
        error: '产值数据加载失败，请稍后重试',
        priceLoading: '正在加载价格配置…',
        priceLoadError: '价格配置加载失败，请稍后重试'
      }
    },
    boq: {
      title: '工程量清单',
      description: '按项目录入工程量清单，为后续计量与账单制作打基础。',
      projectLabel: '项目',
      projectPlaceholder: '选择项目',
      actions: {
        searchLabel: '检索',
        searchPlaceholder: '输入编号或名称…',
        viewLabel: '视图',
        viewAll: '全部',
        viewSummary: '仅汇总',
        manageCta: '实际工程量清单'
      },
      tableHeaders: {
        code: '编号',
        designation: '工程内容',
        unit: '单位',
        unitPrice: '单价（F CFA）',
        quantity: '数量',
        totalPrice: '合价（F CFA）'
      },
      messages: {
        loading: '正在加载工程量清单…',
        projectLoading: '正在加载项目列表…',
        loadError: '工程量清单加载失败，请稍后重试',
        empty: '该项目暂无工程量清单记录',
        noHeader: '暂无表头信息',
        noMatches: '未找到匹配的工程量清单记录'
      }
    }
  },
  fr: {
    breadcrumbs: {
      home: 'Accueil',
      value: 'Valeurs'
    },
    card: {
      badge: 'Production',
      title: 'Calcul des valeurs',
      description:
        'Regroupe les quantités prévues, réalisées et les prix unitaires par sous-ouvrage pour alimenter la comptabilité.',
      cta: 'Voir les valeurs'
    },
    tabs: {
      production: 'Valeurs',
      boq: 'Devis quantitatif',
      manage: 'Postes'
    },
    page: {
      title: 'Calcul des valeurs',
      description: 'Suivi des quantités, prix unitaires et montants validés pour chaque sous-ouvrage.',
      managePricesCta: 'Gérer les prix unitaires',
      unitLabel: 'Franc CFA (XOF)',
      tableHeaders: {
        phase: 'Sous-ouvrage',
        spec: 'Spécification',
        designAmount: 'Quantité prévue',
        unitPrice: 'Prix unitaire',
        designValue: 'Montant prévu',
        completedAmount: 'Quantité réalisée',
        completedValue: 'Montant réalisé',
        percent: 'Taux d’achèvement'
      },
      messages: {
        loading: 'Chargement des valeurs…',
        empty: 'Aucune donnée de valeur disponible',
        unauthorized: 'Permission « value:view » requise pour consulter les valeurs',
        error: 'Impossible de charger les valeurs, réessayez plus tard',
        priceLoading: 'Chargement des prix unitaires…',
        priceLoadError: 'Impossible de charger les prix unitaires, réessayez plus tard'
      }
    },
    boq: {
      title: 'Devis quantitatif',
      description:
        'Saisie du devis quantitatif par projet pour préparer les métrés et les factures.',
      projectLabel: 'Projet',
      projectPlaceholder: 'Sélectionner un projet',
      actions: {
        searchLabel: 'Recherche',
        searchPlaceholder: 'Rechercher par code ou désignation…',
        viewLabel: 'Vue',
        viewAll: 'Tout',
        viewSummary: 'Synthèse',
        manageCta: 'Devis réel'
      },
      tableHeaders: {
        code: 'N° Prix',
        designation: 'Designation des Travaux',
        unit: 'Unité',
        unitPrice: 'Prix unitaire (F CFA)',
        quantity: 'Quantité',
        totalPrice: 'Prix total (F CFA)'
      },
      messages: {
        loading: 'Chargement du devis quantitatif…',
        projectLoading: 'Chargement des projets…',
        loadError: 'Impossible de charger le devis quantitatif, réessayez plus tard.',
        empty: 'Aucun devis quantitatif pour ce projet.',
        noHeader: 'En-tête indisponible pour ce projet.',
        noMatches: 'Aucun élément ne correspond à la recherche.'
      }
    }
  }
}

export type PriceManagerCopy = {
  breadcrumbs: {
    home: string
    value: string
    prices: string
  }
  title: string
  description: string
  note: string
  backCta: string
  tableHeaders: {
    name: string
    spec: string
    description: string
    boqItem: string
    action: string
  }
  card: {
    detailToggle: string
    backToList: string
    backToNames: string
  }
  bindingDropdown: {
    allLabel: string
    selectedLabel: string
    selectAll: string
    clear: string
    searchPlaceholder: string
    noOptions: string
  }
  itemConfig: {
    formulaTitle: string
    formulaActive: string
    formulaEmpty: string
    formulaExpressionLabel: string
    formulaExpressionPlaceholder: string
    formulaUnitLabel: string
    formulaUnitPlaceholder: string
    formulaFieldsLabel: string
    formulaFieldsEmpty: string
    formulaFieldKey: string
    formulaFieldLabel: string
    formulaFieldUnit: string
    formulaFieldHint: string
    formulaBuiltins: string
    addField: string
    removeField: string
    saveFormula: string
    nameTitle: string
    nameHint: string
    nameLabel: string
    namePlaceholder: string
    saveName: string
    bindingTitle: string
    bindingHint: string
    saveBinding: string
    bindingSummaryTitle: string
    bindingSummaryEmpty: string
  }
  group: {
    defaultPriceLabel: string
    newItemTitle: string
    newItemNamePlaceholder: string
    newItemSpecPlaceholder: string
    newItemDescriptionPlaceholder: string
    newItemUnitPlaceholder: string
  }
  actions: {
    save: string
    delete: string
    cancel: string
  }
  messages: {
    loading: string
    empty: string
    unauthorized: string
    error: string
    saved: string
    updateError: string
    nameRequired: string
    deleted: string
    deleteConfirm: string
  }
}

export const measureLabels: Record<Locale, Record<PhaseMeasure, string>> = {
  zh: {
    LINEAR: '线性',
    POINT: '点'
  },
  fr: {
    LINEAR: 'Linéaire',
    POINT: 'Ponctuel'
  }
}

export const priceManagerCopy: Record<Locale, PriceManagerCopy> = {
  zh: {
    breadcrumbs: {
      home: '首页',
      value: '产值计量',
      prices: '分项管理'
    },
    title: '分项管理',
    description: '',
    note: '',
    backCta: '返回产值表',
    tableHeaders: {
      name: '分项名称',
      spec: '规格',
      description: '计价说明',
      boqItem: '清单绑定',
      action: '操作'
    },
    card: {
      detailToggle: '详情',
      backToList: '返回列表',
      backToNames: '返回分项名称'
    },
    bindingDropdown: {
      allLabel: '未绑定',
      selectedLabel: '已选 {count} 项',
      selectAll: '全选',
      clear: '清空',
      searchPlaceholder: '搜索清单…',
      noOptions: '暂无清单'
    },
    itemConfig: {
      formulaTitle: '公式设置',
      formulaActive: '已配置公式',
      formulaEmpty: '尚未配置公式',
      formulaExpressionLabel: '公式表达式',
      formulaExpressionPlaceholder: '例如：length * width * thickness',
      formulaUnitLabel: '输出单位',
      formulaUnitPlaceholder: '例如：m³',
      formulaFieldsLabel: '输入字段',
      formulaFieldsEmpty: '暂无输入字段',
      formulaFieldKey: '字段 Key',
      formulaFieldLabel: '字段名称',
      formulaFieldUnit: '单位',
      formulaFieldHint: '提示（可选）',
      formulaBuiltins: '可直接使用 length（优先手动延米）、rawLength（PK差）等内置变量。',
      addField: '新增字段',
      removeField: '移除字段',
      saveFormula: '保存公式',
      nameTitle: '分项名称',
      nameHint: '修改后会同步到分项管理列表。',
      nameLabel: '分项名称',
      namePlaceholder: '输入分项名称',
      saveName: '保存名称',
      bindingTitle: '清单绑定',
      bindingHint: '同一项目只能绑定一个清单条目。',
      saveBinding: '保存绑定',
      bindingSummaryTitle: '清单明细',
      bindingSummaryEmpty: '暂无绑定条目'
    },
    group: {
      defaultPriceLabel: '默认规格',
      newItemTitle: '新增分项名称',
      newItemNamePlaceholder: '输入名称（如“涵洞混凝土”）',
      newItemSpecPlaceholder: '可选规格（如“箱涵”）',
      newItemDescriptionPlaceholder: '计价依据/组成（可选）',
      newItemUnitPlaceholder: '单位（如“m³”）'
    },
    actions: {
      save: '保存',
      delete: '删除',
      cancel: '取消'
    },
    messages: {
      loading: '正在加载分项管理数据…',
      empty: '暂无分项定义',
      unauthorized: '需产值查看/维护权限才能管理分项',
      error: '分项管理加载失败，请稍后重试',
      saved: '已保存',
      updateError: '更新失败，请检查输入',
      nameRequired: '名称不能为空',
      deleted: '已删除',
      deleteConfirm: '确定要删除该分项名称吗？'
    }
  },
  fr: {
    breadcrumbs: {
      home: 'Accueil',
      value: 'Valeurs',
      prices: 'Gestion des postes'
    },
    title: 'Gestion des postes',
    description: '',
    note: '',
    backCta: 'Retour aux valeurs',
    tableHeaders: {
      name: 'Nom',
      spec: 'Spécification',
      description: 'Description',
      boqItem: 'Bordereau lié',
      action: 'Action'
    },
    card: {
      detailToggle: 'Détails',
      backToList: 'Retour',
      backToNames: 'Retour'
    },
    bindingDropdown: {
      allLabel: 'Aucun',
      selectedLabel: '{count} sélectionné(s)',
      selectAll: 'Tout sélectionner',
      clear: 'Effacer',
      searchPlaceholder: 'Rechercher un bordereau…',
      noOptions: 'Aucun bordereau'
    },
    itemConfig: {
      formulaTitle: 'Formule',
      formulaActive: 'Formule configurée',
      formulaEmpty: 'Formule non configurée',
      formulaExpressionLabel: 'Expression',
      formulaExpressionPlaceholder: 'Ex. length * width * thickness',
      formulaUnitLabel: 'Unité de sortie',
      formulaUnitPlaceholder: 'Ex. m³',
      formulaFieldsLabel: 'Champs',
      formulaFieldsEmpty: 'Aucun champ',
      formulaFieldKey: 'Clé',
      formulaFieldLabel: 'Libellé',
      formulaFieldUnit: 'Unité',
      formulaFieldHint: 'Indice',
      formulaBuiltins: 'Variables intégrées : length (priorité à la longueur manuelle), rawLength (écart PK), etc.',
      addField: 'Ajouter',
      removeField: 'Supprimer',
      saveFormula: 'Enregistrer la formule',
      nameTitle: 'Nom du poste',
      nameHint: 'Les changements se répercuteront sur la liste.',
      nameLabel: 'Nom du poste',
      namePlaceholder: 'Saisir le nom du poste',
      saveName: 'Enregistrer le nom',
      bindingTitle: 'Liaison bordereau',
      bindingHint: 'Un seul bordereau par projet.',
      saveBinding: 'Enregistrer la liaison',
      bindingSummaryTitle: 'Détail du bordereau',
      bindingSummaryEmpty: 'Aucun élément lié'
    },
    group: {
      defaultPriceLabel: 'Spécification par défaut',
      newItemTitle: 'Ajouter un poste',
      newItemNamePlaceholder: 'Nom du poste (ex. Béton du regard)',
      newItemSpecPlaceholder: 'Spécification (ex. Voûte)',
      newItemDescriptionPlaceholder: 'Base de calcul / composants',
      newItemUnitPlaceholder: 'Unité (ex. m³)'
    },
    actions: {
      save: 'Enregistrer',
      delete: 'Supprimer',
      cancel: 'Annuler'
    },
    messages: {
      loading: 'Chargement des postes…',
      empty: 'Aucun sous-ouvrage défini',
      unauthorized: 'Permission « value:view » (ou équivalente) requise pour gérer les postes',
      error: 'Impossible de charger les postes',
      saved: 'Enregistré',
      updateError: 'Échec de la mise à jour, vérifiez la saisie',
      nameRequired: 'Le nom est requis',
      deleted: 'Supprimé',
      deleteConfirm: 'Confirmez-vous la suppression de ce poste ?'
    }
  }
}
