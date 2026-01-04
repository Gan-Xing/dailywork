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
      boq: '工程量清单'
    },
    page: {
      title: '产值计量',
      description: '按分项工程统计设计量、单价与已完成产值，为财务核算提供参考。',
      managePricesCta: '管理分项价格',
      unitLabel: '西非法郎（XOF）',
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
        viewSummary: '仅汇总'
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
      boq: 'Devis quantitatif'
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
        viewSummary: 'Synthèse'
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
    unitPrice: string
    action: string
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
      prices: '价格管理'
    },
    title: '价格管理',
    description: '为每个分项定义绑定真实西非法郎单价，作为产值计算的基准。',
    note: '所有价格以西非法郎（XOF）计。',
    backCta: '返回产值表',
    tableHeaders: {
      name: '分项名称',
      spec: '规格',
      description: '计价说明',
      unitPrice: '单价（XOF）',
      action: '操作'
    },
    group: {
      defaultPriceLabel: '默认单价',
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
      loading: '正在加载分项价格…',
      empty: '暂无分项定义',
      unauthorized: '需产值查看/维护权限才能管理分项价格',
      error: '分项价格加载失败，请稍后重试',
      saved: '已保存',
      updateError: '更新失败，请检查输入',
      nameRequired: '名称不能为空',
      deleted: '已删除',
      deleteConfirm: '确定要删除该分项名称及其价格吗？'
    }
  },
  fr: {
    breadcrumbs: {
      home: 'Accueil',
      value: 'Valeurs',
      prices: 'Gestion des prix'
    },
    title: 'Gestion des prix',
    description: 'Attribuez un prix unitaire en franc CFA à chaque sous-ouvrage pour alimenter le calcul des valeurs.',
    note: 'Tous les montants sont en franc CFA (XOF).',
    backCta: 'Retour aux valeurs',
    tableHeaders: {
      name: 'Nom',
      spec: 'Spécification',
      description: 'Description',
      unitPrice: 'Prix unitaire (XOF)',
      action: 'Action'
    },
    group: {
      defaultPriceLabel: 'Prix par défaut',
      newItemTitle: 'Ajouter un prix',
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
      loading: 'Chargement des prix…',
      empty: 'Aucun sous-ouvrage défini',
      unauthorized: 'Permission « value:view » (ou équivalente) requise pour gérer les prix',
      error: 'Impossible de charger les prix',
      saved: 'Enregistré',
      updateError: 'Échec de la mise à jour, vérifiez la saisie',
      nameRequired: 'Le nom est requis',
      deleted: 'Supprimé',
      deleteConfirm: 'Confirmez-vous la suppression de ce poste ?'
    }
  }
}
