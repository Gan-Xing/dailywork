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
    completion: string
    boq: string
    manage: string
    measurement: string
    comparison: string
    variation: string
  }
  messages: {
    unauthorized: string
    projectLoadError: string
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
  completion: {
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
      completedQuantity: string
      completedValue: string
      percent: string
    }
    details: {
      title: string
      loading: string
      empty: string
      expand: string
      collapse: string
      manualBadge: string
      headers: {
        road: string
        interval: string
        side: string
        quantity: string
        unit: string
      }
    }
    messages: {
      loading: string
      projectLoading: string
      loadError: string
      empty: string
      noMatches: string
    }
  }
  comparison: {
    title: string
    description: string
    projectLabel: string
    projectPlaceholder: string
    actions: {
      searchLabel: string
      searchPlaceholder: string
      sourceLabel: string
      sourceAll: string
      sourceContract: string
      sourceNew: string
      clearSort: string
      sortHint: string
    }
    tableHeaders: {
      source: string
      code: string
      designation: string
      unit: string
      unitPrice: string
      completedQuantity: string
      completedValue: string
      measuredQuantity: string
      measuredValue: string
      unmeasuredQuantity: string
      unmeasuredValue: string
      overMeasuredValue: string
    }
    sourceLabels: {
      contract: string
      new: string
    }
    summaryRows: {
      totalHtva: string
      advance: string
      netHtva: string
      vat: string
      totalTtc: string
    }
    messages: {
      loading: string
      projectLoading: string
      loadError: string
      empty: string
      noMatches: string
    }
  }
  measurement: {
    title: string
    description: string
    periodLabel: string
    advanceLabel: string
    netHtvaLabel: string
    projectLabel: string
    projectPlaceholder: string
    columnSelector: {
      label: string
      selectedTemplate: string
      noneSelected: string
      selectAll: string
      restore: string
      clear: string
      baseGroup: string
      periodGroup: string
    }
    actions: {
      searchLabel: string
      searchPlaceholder: string
      detailLedger: string
      addPeriod: string
      save: string
      saving: string
    }
    tableHeaders: {
      code: string
      designation: string
      unit: string
      unitPrice: string
      quantity: string
      totalPrice: string
      totalMeasuredQuantity: string
      totalMeasuredValue: string
      periodQuantity: string
      periodAmount: string
    }
    messages: {
      loading: string
      projectLoading: string
      loadError: string
      empty: string
      noMatches: string
      saved: string
      saveError: string
      requiredQuantity: string
    }
  }
}

export const productionValueCopy: Record<Locale, ProductionValueCopy> = {
  zh: {
    breadcrumbs: {
      home: '首页',
      value: '产值界面'
    },
    card: {
      badge: '产值界面',
      title: '产值界面',
      description: '基于实际工程量清单汇总已完成产值与占比。',
      cta: '查看产值界面'
    },
    tabs: {
      completion: '产值界面',
      boq: '工程量清单',
      manage: '分项管理',
      measurement: '计量',
      comparison: '计量对比',
      variation: '现场变更计量'
    },
    messages: {
      unauthorized: '需“产值查看”权限才能查看产值界面',
      projectLoadError: '项目列表加载失败，请稍后重试'
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
    },
    completion: {
      title: '产值界面',
      description: '基于实际工程量清单汇总已完成产值与占比。',
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
        totalPrice: '合价（F CFA）',
        completedQuantity: '实际完成工程量',
        completedValue: '完成产值',
        percent: '完成产值占比'
      },
      details: {
        title: '设计量明细',
        loading: '正在加载明细…',
        empty: '暂无明细',
        expand: '展开明细',
        collapse: '收起明细',
        manualBadge: '手动',
        headers: {
          road: '路段',
          interval: '区间',
          side: '位置',
          quantity: '设计量',
          unit: '单位'
        }
      },
      messages: {
        loading: '正在加载产值清单…',
        projectLoading: '正在加载项目列表…',
        loadError: '产值清单加载失败，请稍后重试',
        empty: '该项目暂无实际工程量清单记录',
        noMatches: '未找到匹配的产值记录'
      }
    },
    comparison: {
      title: '计量对比',
      description: '对比已完成产值与累计计量，识别已完成但未计量的分项工程量与产值。',
      projectLabel: '项目',
      projectPlaceholder: '选择项目',
      actions: {
        searchLabel: '检索',
        searchPlaceholder: '输入编号或名称…',
        sourceLabel: '来源',
        sourceAll: '全部',
        sourceContract: '原合同',
        sourceNew: '新增分项',
        clearSort: '清空排序',
        sortHint: '点击表头可叠加排序（最多 4 列）',
      },
      tableHeaders: {
        source: '来源',
        code: '编号',
        designation: '工程内容',
        unit: '单位',
        unitPrice: '单价（F CFA）',
        completedQuantity: '完成工程量',
        completedValue: '完成产值',
        measuredQuantity: '累计计量工程量',
        measuredValue: '累计计量金额',
        unmeasuredQuantity: '未计量已完成量',
        unmeasuredValue: '未计量已完成产值',
        overMeasuredValue: '超额计量',
      },
      sourceLabels: {
        contract: '原合同',
        new: '新增分项',
      },
      summaryRows: {
        totalHtva: '不含税总计',
        advance: '预付款',
        netHtva: '不含税实收',
        vat: '增值税',
        totalTtc: '含税总计',
      },
      messages: {
        loading: '正在加载对比数据…',
        projectLoading: '正在加载项目列表…',
        loadError: '对比数据加载失败，请稍后重试',
        empty: '该项目暂无可对比的分项记录',
        noMatches: '未找到匹配的对比记录',
      },
    },
    measurement: {
      title: '计量页面',
      description: '基于实际工程量清单录入分期计量工程量与金额。',
      periodLabel: '第{value}期',
      advanceLabel: '预付款',
      netHtvaLabel: '不含税实收',
      projectLabel: '项目',
      projectPlaceholder: '选择项目',
      columnSelector: {
        label: '显示列',
        selectedTemplate: '已选 {count} 列',
        noneSelected: '未选择列',
        selectAll: '全选',
        restore: '恢复默认',
        clear: '清空',
        baseGroup: '基础列',
        periodGroup: '期次列'
      },
      actions: {
        searchLabel: '检索',
        searchPlaceholder: '输入编号或名称…',
        detailLedger: '计量明细',
        addPeriod: '新增期次',
        save: '保存计量',
        saving: '保存中…'
      },
      tableHeaders: {
        code: '编号',
        designation: '工程内容',
        unit: '单位',
        unitPrice: '单价（F CFA）',
        quantity: '数量',
        totalPrice: '合价（F CFA）',
        totalMeasuredQuantity: '总计量工程量',
        totalMeasuredValue: '总计量产值',
        periodQuantity: '计量工程量',
        periodAmount: '计量金额'
      },
      messages: {
        loading: '正在加载计量数据…',
        projectLoading: '正在加载项目列表…',
        loadError: '计量数据加载失败，请稍后重试',
        empty: '该项目暂无实际工程量清单记录',
        noMatches: '未找到匹配的计量记录',
        saved: '计量已保存',
        saveError: '计量保存失败，请检查输入',
        requiredQuantity: '请填写计量工程量'
      }
    }
  },
  fr: {
    breadcrumbs: {
      home: 'Accueil',
      value: 'Valeurs réalisées'
    },
    card: {
      badge: 'Valeurs réalisées',
      title: 'Valeurs réalisées',
      description: 'Tableau des quantités réalisées basé sur le devis réel.',
      cta: 'Voir les valeurs réalisées'
    },
    tabs: {
      completion: 'Valeurs réalisées',
      boq: 'Devis quantitatif',
      manage: 'Postes',
      measurement: 'Métrés',
      comparison: 'Comparaison',
      variation: 'Variations terrain'
    },
    messages: {
      unauthorized: 'Permission « value:view » requise pour consulter les valeurs réalisées',
      projectLoadError: 'Impossible de charger les projets, réessayez plus tard.'
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
    },
    completion: {
      title: 'Valeurs réalisées',
      description: 'Tableau des quantités réalisées basé sur le devis réel.',
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
        designation: 'Désignation',
        unit: 'Unité',
        unitPrice: 'Prix unitaire (F CFA)',
        quantity: 'Quantité',
        totalPrice: 'Prix total (F CFA)',
        completedQuantity: 'Quantité réalisée',
        completedValue: 'Montant réalisé',
        percent: 'Part réalisée'
      },
      details: {
        title: 'Détails des quantités',
        loading: 'Chargement des détails…',
        empty: 'Aucun détail',
        expand: 'Afficher les détails',
        collapse: 'Masquer les détails',
        manualBadge: 'Manuel',
        headers: {
          road: 'Section',
          interval: 'Intervalle',
          side: 'Côté',
          quantity: 'Quantité',
          unit: 'Unité'
        }
      },
      messages: {
        loading: 'Chargement des valeurs réalisées…',
        projectLoading: 'Chargement des projets…',
        loadError: 'Impossible de charger les valeurs réalisées',
        empty: 'Aucune ligne de devis réel pour ce projet',
        noMatches: 'Aucune ligne correspondante'
      }
    },
    comparison: {
      title: 'Comparaison',
      description:
        'Comparer les valeurs réalisées et les métrés cumulés pour identifier les travaux réalisés non encore métrés.',
      projectLabel: 'Projet',
      projectPlaceholder: 'Sélectionner un projet',
      actions: {
        searchLabel: 'Recherche',
        searchPlaceholder: 'Rechercher par code ou désignation…',
        sourceLabel: 'Origine',
        sourceAll: 'Tout',
        sourceContract: 'Contrat',
        sourceNew: 'Nouveau poste',
        clearSort: 'Effacer tri',
        sortHint: "Tri multicritère via les en-têtes (max. 4 colonnes)",
      },
      tableHeaders: {
        source: 'Origine',
        code: 'N° Prix',
        designation: 'Désignation',
        unit: 'Unité',
        unitPrice: 'Prix unitaire (F CFA)',
        completedQuantity: 'Qté réalisée',
        completedValue: 'Montant réalisé',
        measuredQuantity: 'Qté métré cumulée',
        measuredValue: 'Montant métré cumulé',
        unmeasuredQuantity: 'Qté réalisée non métré',
        unmeasuredValue: 'Montant non métré',
        overMeasuredValue: 'Sur-métré',
      },
      sourceLabels: {
        contract: 'Contrat',
        new: 'Nouveau poste',
      },
      summaryRows: {
        totalHtva: 'Total HTVA',
        advance: 'Avance',
        netHtva: 'Net HTVA',
        vat: 'TVA',
        totalTtc: 'Total TTC',
      },
      messages: {
        loading: 'Chargement des données de comparaison…',
        projectLoading: 'Chargement des projets…',
        loadError: 'Impossible de charger les données de comparaison',
        empty: 'Aucun poste comparable pour ce projet',
        noMatches: 'Aucune ligne correspondante',
      },
    },
    measurement: {
      title: 'Métrés',
      description: 'Saisie des quantités et montants par période sur le devis réel.',
      periodLabel: 'Période {value}',
      advanceLabel: 'Avance',
      netHtvaLabel: 'Net HTVA',
      projectLabel: 'Projet',
      projectPlaceholder: 'Sélectionner un projet',
      columnSelector: {
        label: 'Colonnes',
        selectedTemplate: '{count} colonnes',
        noneSelected: 'Aucune colonne',
        selectAll: 'Tout sélectionner',
        restore: 'Par défaut',
        clear: 'Tout effacer',
        baseGroup: 'Colonnes de base',
        periodGroup: 'Colonnes par période'
      },
      actions: {
        searchLabel: 'Recherche',
        searchPlaceholder: 'Rechercher par code ou désignation…',
        detailLedger: 'Détail métré',
        addPeriod: 'Ajouter une période',
        save: 'Enregistrer',
        saving: 'Enregistrement…'
      },
      tableHeaders: {
        code: 'N° Prix',
        designation: 'Désignation',
        unit: 'Unité',
        unitPrice: 'Prix unitaire (F CFA)',
        quantity: 'Quantité',
        totalPrice: 'Prix total (F CFA)',
        totalMeasuredQuantity: 'Qté cumulée',
        totalMeasuredValue: 'Montant cumulé',
        periodQuantity: 'Qté mesurée',
        periodAmount: 'Montant'
      },
      messages: {
        loading: 'Chargement des métrés…',
        projectLoading: 'Chargement des projets…',
        loadError: 'Impossible de charger les métrés',
        empty: 'Aucun devis réel pour ce projet',
        noMatches: 'Aucune ligne correspondante',
        saved: 'Métrés enregistrés',
        saveError: 'Échec de l’enregistrement',
        requiredQuantity: 'Veuillez saisir la quantité'
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
    deleteTargetLabel: string
    deleteSoftHint: string
    deleteBlockedSummary: string
    deleteBlockedByBoq: string
    deleteBlockedByFormula: string
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
      value: '产值界面',
      prices: '分项管理'
    },
    title: '分项管理',
    description: '',
    note: '',
    backCta: '返回产值界面',
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
      deleteConfirm: '确定要删除该分项名称吗？',
      deleteTargetLabel: '分项名称',
      deleteSoftHint: '删除为停用（软删除），不会物理删除历史数据。',
      deleteBlockedSummary: '当前分项名称存在关键关联，无法删除。请先解除以下关联：',
      deleteBlockedByBoq: '已绑定 {count} 个清单条目',
      deleteBlockedByFormula: '已配置公式'
    }
  },
  fr: {
    breadcrumbs: {
      home: 'Accueil',
      value: 'Valeurs réalisées',
      prices: 'Gestion des postes'
    },
    title: 'Gestion des postes',
    description: '',
    note: '',
    backCta: 'Retour aux valeurs réalisées',
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
      deleteConfirm: 'Confirmez-vous la suppression de ce poste ?',
      deleteTargetLabel: 'Poste',
      deleteSoftHint: 'La suppression désactive ce poste (suppression logique) et conserve les données historiques.',
      deleteBlockedSummary: 'Ce poste ne peut pas être supprimé tant que les liaisons/configurations suivantes existent :',
      deleteBlockedByBoq: '{count} liaison(s) au bordereau',
      deleteBlockedByFormula: 'Formule configurée'
    }
  }
}
