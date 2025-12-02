import type { Locale } from './index'

export type ProductionValueCopy = {
  card: {
    badge: string
    title: string
    description: string
    cta: string
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
}

export const productionValueCopy: Record<Locale, ProductionValueCopy> = {
  zh: {
    card: {
      badge: '产值计量',
      title: '产值计量',
      description:
        '汇总各分项的设计/完成量与单价，梳理产值进度。权限足够即可查看最新数据。',
      cta: '查看产值详情'
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
        unauthorized: '需“进度查看”权限才能查看产值计量',
        error: '产值数据加载失败，请稍后重试',
        priceLoading: '正在加载价格配置…',
        priceLoadError: '价格配置加载失败，请稍后重试'
      }
    }
  },
  fr: {
    card: {
      badge: 'Production',
      title: 'Calcul des valeurs',
      description:
        'Regroupe les quantités prévues, réalisées et les prix unitaires par sous-ouvrage pour alimenter la comptabilité.',
      cta: 'Voir les valeurs'
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
        unauthorized: 'Permission « progress:view » requise pour consulter les valeurs',
        error: 'Impossible de charger les valeurs, réessayez plus tard',
        priceLoading: 'Chargement des prix unitaires…',
        priceLoadError: 'Impossible de charger les prix unitaires, réessayez plus tard'
      }
    }
  }
}

export type PriceManagerCopy = {
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

export const priceManagerCopy: Record<Locale, PriceManagerCopy> = {
  zh: {
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
      delete: '删除'
    },
    messages: {
      loading: '正在加载分项价格…',
      empty: '暂无分项定义',
      unauthorized: '需“进度查看”权限才能管理分项价格',
      error: '分项价格加载失败，请稍后重试',
      saved: '已保存',
      updateError: '更新失败，请检查输入',
      nameRequired: '名称不能为空',
      deleted: '已删除',
      deleteConfirm: '确定要删除该分项名称及其价格吗？'
    }
  },
  fr: {
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
      delete: 'Supprimer'
    },
    messages: {
      loading: 'Chargement des prix…',
      empty: 'Aucun sous-ouvrage défini',
      unauthorized: 'Permission « progress:view » requise pour gérer les prix',
      error: 'Impossible de charger les prix',
      saved: 'Enregistré',
      updateError: 'Échec de la mise à jour, vérifiez la saisie',
      nameRequired: 'Le nom est requis',
      deleted: 'Supprimé',
      deleteConfirm: 'Confirmez-vous la suppression de ce poste ?'
    }
  }
}
