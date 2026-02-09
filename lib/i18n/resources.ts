import type { Locale } from '@/lib/i18n'

const formatCopy = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ''))

export type ResourcesTabKey = 'overview' | 'machines' | 'machineLogs' | 'materials'

export type ResourcesCopy = {
  title: string
  subtitle: string
  breadcrumbs: {
    home: string
    resources: string
    machines: string
    machineLogs: string
    materials: string
  }
  tabs: Record<ResourcesTabKey, string>
  tabDescriptions: Record<ResourcesTabKey, string>
  access: {
    needAnyView: string
    needMachineView: string
    needMachineLogView: string
    needMaterialView: string
  }
  landing: {
    overviewTitle: string
    overviewDescription: string
    cards: {
      machines: {
        title: string
        description: string
        cta: string
      }
      machineLogs: {
        title: string
        description: string
        cta: string
      }
      materials: {
        title: string
        description: string
        cta: string
      }
    }
  }
  common: {
    all: string
    selected: (count: number) => string
    selectAll: string
    clear: string
    searchPlaceholder: string
    noOptions: string
    close: string
    loading: string
    loadFailed: string
    empty: string
    pagination: {
      summary: (total: number, page: number, totalPages: number) => string
      pageSizeLabel: string
      prev: string
      next: string
      goTo: string
    }
  }
  machines: {
    title: string
    subtitle: string
    actions: {
      import: string
      export: string
      downloadTemplate: string
      filters: string
      columns: string
      clearFilters: string
      search: string
      refresh: string
      view: string
    }
    notices: {
      importSuccess: (created: number, updated: number) => string
    }
    errors: {
      needMachineCreateOrUpdate: string
      importInvalidFile: string
      importNoData: string
      importMissingHeaders: string
      importFailed: string
    }
    filters: {
      title: string
      assetCategoryName: string
      assetStatusName: string
      manufacturer: string
      registrationMonth: string
    }
    columns: Record<
      | 'assetCategoryName'
      | 'assetNumber'
      | 'manufacturer'
      | 'assetName'
      | 'assetStatusName'
      | 'specModel'
      | 'registrationDate'
      | 'originalValue'
      | 'usedMonths'
      | 'currentValue'
      | 'depreciatedMonths'
      | 'remainingMonths'
      | 'usageStatus'
      | 'alias'
      | 'plateNumber'
      | 'photoLinks'
      | 'createdAt'
      | 'updatedAt'
      | 'actions',
      string
    >
  }
  machineLogs: {
    title: string
    subtitle: string
    actions: {
      save: string
      saving: string
      addFuelEvent: string
      removeFuelEvent: string
      addFuelTruck: string
      disableFuelTruck: string
      refresh: string
      groupByLabel: string
      showMine: string
      hideMine: string
    }
    labels: {
      date: string
      groupBy: {
        none: string
        category: string
        supervisor: string
        team: string
      }
      machine: string
      team: string
      supervisor: string
      project: string
      operator: string
      workContent: string
      fuelRemainingEnd: string
      dailyDepreciation: string
      prevFuelRemainingEnd: string
      fuelAddedTotal: string
      dailyFuelConsumed: string
      fuelEvents: string
      fuelSource: string
      fuelAmount: string
      fuelNote: string
      fuelInventory: string
      received: string
      dispensed: string
      expectedEnd: string
      delta: string
    }
    hints: {
      emptyOptional: string
      consumptionFormula: string
    }
    errors: {
      needMachineLogView: string
      needMachineLogCreateOrUpdate: string
      saveFailed: string
      loadFailed: string
    }
  }
  materials: {
    title: string
    subtitle: string
    comingSoon: string
  }
}

export const getResourcesCopy = (locale: Locale): ResourcesCopy => {
  if (locale === 'fr') {
    return {
      title: 'Gestion engins & matériaux',
      subtitle: 'Machines et matériaux, avec import Excel et traçabilité des mouvements.',
      breadcrumbs: {
        home: 'Accueil',
        resources: 'Engins & matériaux',
        machines: 'Machines',
        machineLogs: 'Journal machines',
        materials: 'Matériaux',
      },
      tabs: {
        overview: 'Aperçu',
        machines: 'Machines',
        machineLogs: 'Journal',
        materials: 'Matériaux',
      },
      tabDescriptions: {
        overview: 'Entrées unifiées et accès rapides.',
        machines: 'Registre des machines (import Excel, filtres, export).',
        machineLogs: 'Journal quotidien (ravitaillement, affectations, amortissement).',
        materials: 'Catalogue et mouvements (bientôt disponible).',
      },
      access: {
        needAnyView: "Autorisation requise: machine:view, machine-log:view ou material:view.",
        needMachineView: "Autorisation requise: machine:view.",
        needMachineLogView: "Autorisation requise: machine-log:view.",
        needMaterialView: "Autorisation requise: material:view.",
      },
      landing: {
        overviewTitle: 'Engins & matériaux',
        overviewDescription: 'Un point d’entrée unique pour gérer machines et matériaux.',
        cards: {
          machines: {
            title: 'Registre des machines',
            description: 'Importez le tableau financier et suivez les valeurs et amortissements.',
            cta: 'Ouvrir',
          },
          machineLogs: {
            title: 'Journal machines',
            description: 'Renseignez quotidiennement équipe, responsable, projet et ravitaillement.',
            cta: 'Ouvrir le journal',
          },
          materials: {
            title: 'Registre des matériaux',
            description: 'Démarrez avec les matériaux en vrac et enregistrez entrées/sorties.',
            cta: 'Ouvrir',
          },
        },
      },
      common: {
        all: 'Tous',
        selected: (count) => formatCopy('{count} sélectionné(s)', { count }),
        selectAll: 'Tout',
        clear: 'Effacer',
        searchPlaceholder: 'Rechercher…',
        noOptions: 'Aucune option',
        close: 'Fermer',
        loading: 'Chargement…',
        loadFailed: 'Échec du chargement',
        empty: 'Aucune donnée',
        pagination: {
          summary: (total, page, totalPages) =>
            formatCopy('{total} élément(s) · Page {page}/{totalPages}', { total, page, totalPages }),
          pageSizeLabel: 'Taille',
          prev: 'Préc.',
          next: 'Suiv.',
          goTo: 'Aller à',
        },
      },
      machines: {
        title: 'Machines',
        subtitle: 'Registre financier des machines (import Excel).',
        actions: {
          import: 'Importer Excel',
          export: 'Exporter Excel',
          downloadTemplate: 'Télécharger le modèle',
          filters: 'Filtres',
          columns: 'Colonnes',
          clearFilters: 'Réinitialiser',
          search: 'Rechercher',
          refresh: 'Rafraîchir',
          view: 'Voir',
        },
        notices: {
          importSuccess: (created, updated) =>
            formatCopy('Import terminé: {created} créé(s), {updated} mis à jour.', {
              created,
              updated,
            }),
        },
        errors: {
          needMachineCreateOrUpdate: "Droit requis: machine:create ou machine:update.",
          importInvalidFile: 'Fichier non reconnu, veuillez fournir un CSV ou Excel.',
          importNoData: 'Aucune donnée dans le fichier.',
          importMissingHeaders: 'En-têtes requis manquants.',
          importFailed: "Échec de l'import.",
        },
        filters: {
          title: 'Filtres',
          assetCategoryName: 'Catégorie',
          assetStatusName: 'Statut (finance)',
          manufacturer: 'Fabricant',
          registrationMonth: 'Mois (enregistrement)',
        },
        columns: {
          assetCategoryName: 'Catégorie',
          assetNumber: 'N° actif',
          manufacturer: 'Fabricant',
          assetName: 'Nom',
          assetStatusName: 'Statut (finance)',
          specModel: 'Modèle',
          registrationDate: "Date d'enregistrement",
          originalValue: 'Valeur initiale',
          usedMonths: 'Mois utilisés',
          currentValue: 'Valeur actuelle',
          depreciatedMonths: 'Mois amortis',
          remainingMonths: 'Mois restants',
          usageStatus: 'Statut (usage)',
          alias: 'Alias',
          plateNumber: "N° d'immatriculation",
          photoLinks: 'Photos',
          createdAt: 'Créé le',
          updatedAt: 'Mis à jour le',
          actions: 'Actions',
        },
      },
      machineLogs: {
        title: 'Journal machines',
        subtitle: 'Journal quotidien (ravitaillement, équipe, responsable, projet).',
        actions: {
          save: 'Enregistrer',
          saving: 'Enregistrement…',
          addFuelEvent: 'Ajouter ravitaillement',
          removeFuelEvent: 'Supprimer',
          addFuelTruck: 'Ajouter camion',
          disableFuelTruck: 'Désactiver',
          refresh: 'Rafraîchir',
          groupByLabel: 'Grouper',
          showMine: 'Mes machines',
          hideMine: 'Toutes',
        },
        labels: {
          date: 'Date',
          groupBy: {
            none: 'Aucun',
            category: 'Catégorie',
            supervisor: 'Responsable',
            team: 'Équipe',
          },
          machine: 'Machine',
          team: 'Équipe',
          supervisor: 'Responsable chinois',
          project: 'Projet',
          operator: 'Opérateur',
          workContent: 'Travaux',
          fuelRemainingEnd: 'Reste fin de journée',
          dailyDepreciation: 'Amortissement (jour)',
          prevFuelRemainingEnd: 'Reste (J-1)',
          fuelAddedTotal: 'Ajout du jour',
          dailyFuelConsumed: 'Consommation',
          fuelEvents: 'Ravitaillements',
          fuelSource: 'Source',
          fuelAmount: 'Quantité',
          fuelNote: 'Note',
          fuelInventory: 'Stock diesel',
          received: 'Entrée',
          dispensed: 'Sortie',
          expectedEnd: 'Théorique fin',
          delta: 'Écart',
        },
        hints: {
          emptyOptional: 'Optionnel',
          consumptionFormula: 'Formule: J-1 + Ajout - Reste',
        },
        errors: {
          needMachineLogView: "Autorisation requise: machine-log:view.",
          needMachineLogCreateOrUpdate: "Autorisation requise: machine-log:create ou machine-log:update.",
          saveFailed: "Échec de l'enregistrement.",
          loadFailed: 'Échec du chargement',
        },
      },
      materials: {
        title: 'Matériaux',
        subtitle: 'Catalogue et mouvements (entrées/sorties).',
        comingSoon: 'À venir: catalogue des matériaux et journal des mouvements.',
      },
    }
  }

  return {
    title: '机物管理',
    subtitle: '机械与物资统一入口，支持 Excel 导入与台账管理。',
    breadcrumbs: {
      home: '首页',
      resources: '机物管理',
      machines: '机械台账',
      machineLogs: '机械日志',
      materials: '物资台账',
    },
    tabs: {
      overview: '总览',
      machines: '机械台账',
      machineLogs: '机械日志',
      materials: '物资台账',
    },
    tabDescriptions: {
      overview: '统一入口与快速跳转。',
      machines: '机械台账（Excel 导入、筛选、导出）。',
      machineLogs: '机械日志（每日运行/加油/库存/折旧）。',
      materials: '大宗材料与出入库（建设中）。',
    },
    access: {
      needAnyView: '需要权限：machine:view 或 machine-log:view 或 material:view。',
      needMachineView: '需要权限：machine:view。',
      needMachineLogView: '需要权限：machine-log:view。',
      needMaterialView: '需要权限：material:view。',
    },
    landing: {
      overviewTitle: '机物管理',
      overviewDescription: '把机械与物资集中管理，逐步沉淀台账与流水。',
      cards: {
        machines: {
          title: '机械台账',
          description: '导入财务提供的资产台账字段，形成可筛选、可导出的机械列表。',
          cta: '进入机械台账',
        },
        machineLogs: {
          title: '机械日志',
          description: '按天录入队伍/负责人/项目/工作内容与加油流水，自动计算油耗。',
          cta: '进入机械日志',
        },
        materials: {
          title: '物资台账',
          description: '从柴油/汽油/水泥/钢筋/沥青/润滑油等大宗材料开始整理。',
          cta: '进入物资台账',
        },
      },
    },
    common: {
      all: '全部',
      selected: (count) => formatCopy('已选 {count}', { count }),
      selectAll: '全选',
      clear: '清空',
      searchPlaceholder: '搜索…',
      noOptions: '暂无选项',
      close: '关闭',
      loading: '加载中…',
      loadFailed: '加载失败',
      empty: '暂无数据',
      pagination: {
        summary: (total, page, totalPages) =>
          formatCopy('共 {total} 条 · 第 {page}/{totalPages} 页', { total, page, totalPages }),
        pageSizeLabel: '每页',
        prev: '上一页',
        next: '下一页',
        goTo: '跳转页码',
      },
    },
    machines: {
      title: '机械台账',
      subtitle: '财务字段台账（Excel 导入）',
      actions: {
        import: '导入 Excel',
        export: '导出 Excel',
        downloadTemplate: '下载模板',
        filters: '筛选',
        columns: '列',
        clearFilters: '重置筛选',
        search: '搜索',
        refresh: '刷新',
        view: '查看',
      },
      notices: {
        importSuccess: (created, updated) =>
          formatCopy('导入完成：新增 {created} 条，更新 {updated} 条。', {
            created,
            updated,
          }),
      },
      errors: {
        needMachineCreateOrUpdate: '需要权限：machine:create 或 machine:update。',
        importInvalidFile: '无法识别文件，请上传 CSV 或 Excel 文件。',
        importNoData: '文件内无数据。',
        importMissingHeaders: '缺少必填表头（请使用模板）。',
        importFailed: '导入失败。',
      },
      filters: {
        title: '筛选',
        assetCategoryName: '资产类别名称',
        assetStatusName: '资产状态名称',
        manufacturer: '生产厂家',
        registrationMonth: '登记月份',
      },
      columns: {
        assetCategoryName: '资产类别名称',
        assetNumber: '资产编号',
        manufacturer: '生产厂家',
        assetName: '资产名称',
        assetStatusName: '资产状态名称',
        specModel: '规格型号',
        registrationDate: '登记日期',
        originalValue: '资产原值',
        usedMonths: '使用月份',
        currentValue: '资产现值',
        depreciatedMonths: '已提月份',
        remainingMonths: '剩余月份',
        usageStatus: '使用状态',
        alias: '别名',
        plateNumber: '车牌',
        photoLinks: '照片链接',
        createdAt: '创建时间',
        updatedAt: '更新时间',
        actions: '操作',
      },
    },
    machineLogs: {
      title: '机械日志',
      subtitle: '每日运行/加油/库存/折旧记录',
      actions: {
        save: '保存',
        saving: '保存中…',
        addFuelEvent: '新增加油记录',
        removeFuelEvent: '删除',
        addFuelTruck: '添加加油车',
        disableFuelTruck: '停用',
        refresh: '刷新',
        groupByLabel: '分组',
        showMine: '只看我的机械',
        hideMine: '查看全部机械',
      },
      labels: {
        date: '日期',
        groupBy: {
          none: '不分组',
          category: '按资产类别',
          supervisor: '按中方负责人',
          team: '按队伍',
        },
        machine: '机械',
        team: '队伍/班组',
        supervisor: '中方负责人',
        project: '项目',
        operator: '绑定人员',
        workContent: '工作内容',
        fuelRemainingEnd: '当日剩余油量（收盘）',
        dailyDepreciation: '每日折旧数额',
        prevFuelRemainingEnd: '上一日剩余',
        fuelAddedTotal: '当日加油量',
        dailyFuelConsumed: '当日油耗',
        fuelEvents: '加油流水',
        fuelSource: '加油来源',
        fuelAmount: '加油量',
        fuelNote: '备注',
        fuelInventory: '柴油库存（油罐/加油车）',
        received: '当日入库/补给',
        dispensed: '当日出库（加油汇总）',
        expectedEnd: '理论剩余（上日+入库-出库）',
        delta: '差额',
      },
      hints: {
        emptyOptional: '可空，不填不影响保存。',
        consumptionFormula: '油耗公式：上一日剩余 + 当日加油 - 当日剩余',
      },
      errors: {
        needMachineLogView: '需要权限：machine-log:view。',
        needMachineLogCreateOrUpdate: '需要权限：machine-log:create 或 machine-log:update。',
        saveFailed: '保存失败。',
        loadFailed: '加载失败',
      },
    },
    materials: {
      title: '物资台账',
      subtitle: '大宗材料与出入库台账',
      comingSoon: '建设中：将提供大宗材料字典与出入库流水。',
    },
  }
}
