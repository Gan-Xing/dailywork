import type { Locale } from './index'
import { formatCopy } from './index'

type ProgressCopy = {
  hero: {
    badge: string
    title: string
    description: string
    home: string
    reports: string
    loadError: string
  }
  admin: {
    badge: string
    title: string
    description: string
    editMode: string
    saving: string
  }
  form: {
    slugLabel: string
    slugPlaceholder: string
    slugTitle: string
    nameLabel: string
    namePlaceholder: string
    startLabel: string
    startPlaceholder: string
    endLabel: string
    endPlaceholder: string
    exitEdit: string
  }
  actions: {
    add: string
    save: string
    reset: string
  }
  errors: {
    noPermission: string
    saveFailed: string
    saveMissing: string
    deleteFailed: string
    loadFailed: string
  }
  list: {
    overview: string
    none: string
    count: string
    emptyHelp: string
  }
  card: {
    label: string
    start: string
    end: string
    slug: string
    edit: string
    delete: string
    workNote: string
    updated: string
  }
  detail: {
    badge: string
    slugLine: string
    back: string
    notFoundTitle: string
    notFoundBody: string
    backToBoard: string
    breadcrumbProgress: string
  }
  phase: PhaseCopy
}

type PhaseCopy = {
  title: string
  roadLengthLabel: string
  roadLengthUnknown: string
  addButton: string
  manageTip: string
  viewOnlyTip: string
  form: {
    editingBadge: string
    creatingBadge: string
    resetEdit: string
    resetNew: string
    designSummary: string
    templateLabel: string
    templateCustom: string
    nameLabel: string
    namePlaceholder: string
    measureLabel: string
    measureOptionLinear: string
    measureOptionPoint: string
    pointSidesLabel: string
    pointSidesHint: string
    designHintPrefix: string
    designHintPoint: string
    designHintLinear: string
    intervalTitle: string
    intervalAdd: string
    intervalStart: string
    intervalEnd: string
    intervalSide: string
    sideBoth: string
    sideLeft: string
    sideRight: string
    intervalDelete: string
    layersTitle: string
    layersAdd: string
    layersPlaceholder: string
    layersEmpty: string
    checksTitle: string
    checksAdd: string
    checksPlaceholder: string
    checksEmpty: string
    save: string
    saving: string
  }
  note: {
    measure: string
  }
  list: {
    title: string
    legend: string
    legendNote: string
    empty: string
  }
  card: {
    measurePoint: string
    measureLinear: string
    completed: string
    edit: string
    delete: string
    deleting: string
  }
  delete: {
    title: string
    confirm: string
    impactTitle: string
    impactList: string[]
    cancel: string
    confirm: string
    confirming: string
    close: string
  }
  status: {
    pending: string
    inProgress: string
    approved: string
    nonDesign: string
  }
  errors: {
    invalidRange: string
    saveFailed: string
    deleteFailed: string
    submitRangeInvalid: string
    submitLayerMissing: string
    submitCheckMissing: string
    submitTypeMissing: string
    submitAppointmentMissing: string
    submitFailed: string
  }
  success: {
    created: string
    updated: string
  }
  inspection: {
    title: string
    sideLabel: string
    sideBoth: string
    sideLeft: string
    sideRight: string
    startLabel: string
    startPlaceholder: string
    endLabel: string
    endPlaceholder: string
    appointmentLabel: string
    appointmentPlaceholder: string
    layersLabel: string
    layersEmpty: string
    checksLabel: string
    checksEmpty: string
    checkPlaceholder: string
    typesLabel: string
    typesHint: string
    remarkLabel: string
    remarkPlaceholder: string
    cancel: string
    submit: string
    submitting: string
    permissionMissing: string
    types: string[]
  }
  alerts: {
    noInspectPermission: string
    fetchInspectionFailed: string
  }
  pointBadge: {
    none: string
  }
}

const progressCopy: Record<Locale, ProgressCopy> = {
  zh: {
    hero: {
      badge: '进度',
      title: '道路进度看板',
      description:
        '路段由管理员统一创建（名称 + 起点 + 终点），后续分项工程、报检与验收都会挂载在这些路段之下。当前页面先完成路段的增删改维护。',
      home: '返回首页',
      reports: '去填写日报',
      loadError: '加载路段列表失败：{message}。仍可尝试直接新增，保存后会刷新列表。',
    },
    admin: {
      badge: 'Admin',
      title: '路段管理',
      description: '仅管理员可维护路段清单，分项工程稍后在详情内补充。',
      editMode: '编辑模式 · ID {id}',
      saving: '正在保存...',
    },
    form: {
      slugLabel: '路由',
      slugPlaceholder: '如：bondoukou-university',
      slugTitle: '仅允许小写字母、数字和连字符',
      nameLabel: '名称',
      namePlaceholder: '如：大学城路',
      startLabel: '起点',
      startPlaceholder: '例：PK0+000 / 交叉口 A',
      endLabel: '终点',
      endPlaceholder: '例：PK1+940 / 桥头',
      exitEdit: '退出编辑',
    },
    actions: {
      add: '添加路段',
      save: '保存修改',
      reset: '重置表单',
    },
    errors: {
      noPermission: '暂无路段管理权限',
      saveFailed: '保存失败，请重试',
      saveMissing: '保存成功，但未收到返回数据',
      deleteFailed: '删除失败，请重试',
      loadFailed: '无法加载路段，请返回列表。',
    },
    list: {
      overview: '路段总览',
      none: '尚未添加',
      count: '共 {count} 条',
      emptyHelp: '暂无路段，先在上方填写“名称 + 起点 + 终点”添加第一条。',
    },
    card: {
      label: '路段',
      start: '起点',
      end: '终点',
      slug: '路由',
      edit: '编辑',
      delete: '删除',
      workNote:
        '分项工程：待进入路段详情后配置。当前仅管理员维护路段范围，后续验收数据会自动驱动进度色带。',
      updated: '最近更新：',
    },
    detail: {
      badge: '路段详情',
      slugLine: '路由：{slug} · 起点：{start} · 终点：{end}',
      back: '返回列表',
      notFoundTitle: '路段不存在',
      notFoundBody: '未找到对应路段，请返回列表。',
      backToBoard: '返回进度看板',
      breadcrumbProgress: '进度管理',
    },
    phase: {
      title: '分项工程',
      roadLengthLabel: '道路长度（估算）：{length} m',
      roadLengthUnknown: '未填写',
      addButton: '新增分项',
      manageTip: '新增/编辑分项会在弹窗中完成，便于手机端查看。',
      viewOnlyTip: '当前账号缺少编辑权限，仅可查看已有分项。',
      form: {
        editingBadge: '编辑分项 · ID {id}',
        creatingBadge: '新增分项',
        resetEdit: '退出编辑',
        resetNew: '重置表单',
        designSummary: '道路长度（估算）：{length} m · 设计量自动计算：{design}',
        templateLabel: '分项模板',
        templateCustom: '自定义/新建',
        nameLabel: '名称',
        namePlaceholder: '如：土方',
        measureLabel: '显示方式',
        measureOptionLinear: '延米（按起终点展示进度）',
        measureOptionPoint: '单体（按点位/条目展示）',
        pointSidesLabel: '单体按左右侧展示',
        pointSidesHint: '适用于左右侧分别报检的单体；默认单行展示。',
        designHintPrefix: '设计量自动计算：',
        designHintPoint: '{design} 个（按条目数）',
        designHintLinear: '{design} m（双侧区间按左右叠加）',
        intervalTitle: '起点-终点列表（起点=终点可表示一个点）',
        intervalAdd: '添加区间',
        intervalStart: '起点',
        intervalEnd: '终点',
        intervalSide: '侧别',
        sideBoth: '双侧',
        sideLeft: '左侧',
        sideRight: '右侧',
        intervalDelete: '删除',
        layersTitle: '层次（当前分项使用的候选）',
        layersAdd: '添加',
        layersPlaceholder: '选择或新增层次，如：第一层上土',
        layersEmpty: '暂无已选层次，输入后点击添加，或从上方候选中选择。',
        checksTitle: '验收内容（当前分项使用的候选）',
        checksAdd: '添加',
        checksPlaceholder: '如：压实度/平整度',
        checksEmpty: '暂无已选验收内容，输入后点击添加，或从上方候选中选择。',
        save: '保存分项',
        saving: '正在保存...',
      },
      note: {
        measure: '说明：显示方式决定进度展示形态；设计量自动按区间或单体数量统计，延米类双侧会叠加左右长度。',
      },
      list: {
        title: '已有分项',
        legend: '已有分项（白色=未验收，可点击预约报检）',
        legendNote: '灰=非设计 白=未验收',
        empty: '暂无分项，添加后将显示在此处。',
      },
      card: {
        measurePoint: '单体 · 设计量 {value} 个',
        measureLinear: '延米 · 设计量 {value} m',
        completed: '已完成 {percent}%',
        edit: '编辑分项',
        delete: '删除分项',
        deleting: '删除中...',
      },
      delete: {
        title: '删除分项',
        confirm: '确定删除「{name}」？',
        impactTitle: '删除后会产生以下影响：',
        impactList: [
          '• 关联的区间与报检记录一并移除，无法恢复。',
          '• 仅影响当前分项，不改动其他分项。',
          '• 请确认已导出或备份必要数据。',
        ],
        cancel: '取消',
        confirm: '确认删除',
        confirming: '正在删除...',
        close: '关闭删除确认',
      },
      status: {
        pending: '未验收',
        inProgress: '验收中',
        approved: '已验收',
        nonDesign: '非设计',
      },
      errors: {
        invalidRange: '请填写有效的起点/终点',
        saveFailed: '保存失败',
        deleteFailed: '删除失败',
        submitRangeInvalid: '请输入有效的起点和终点',
        submitLayerMissing: '请选择至少一个层次',
        submitCheckMissing: '请选择至少一个验收内容',
        submitTypeMissing: '请选择至少一个验收类型',
        submitAppointmentMissing: '请选择预约日期',
        submitFailed: '提交失败',
      },
      success: {
        created: '分项「{name}」已创建',
        updated: '分项「{name}」已更新',
      },
      inspection: {
        title: '预约报检',
        sideLabel: '侧别',
        sideBoth: '双侧',
        sideLeft: '左侧',
        sideRight: '右侧',
        startLabel: '起点',
        startPlaceholder: '输入起点 PK',
        endLabel: '终点',
        endPlaceholder: '输入终点 PK',
        appointmentLabel: '预约报检日期',
        appointmentPlaceholder: '选择日期',
        layersLabel: '层次（多选）',
        layersEmpty: '暂无层次，请先在分项维护中添加。',
        checksLabel: '验收内容（多选，可临时添加）',
        checksEmpty: '暂无验收内容，请在分项维护中添加或临时新增。',
        checkPlaceholder: '临时新增验收内容',
        typesLabel: '验收类型（多选）',
        typesHint: '提示：若区间与侧别与上方段落一致，可直接提交；否则请修改起讫点或侧别。',
        remarkLabel: '备注（多行）',
        remarkPlaceholder: '可填写施工说明、注意事项等',
        cancel: '取消',
        submit: '提交报检',
        submitting: '提交中...',
        permissionMissing: '缺少报检权限',
        types: ['现场验收', '测量验收', '试验验收', '其他'],
      },
      alerts: {
        noInspectPermission: '缺少报检权限',
        fetchInspectionFailed: '拉取报检记录失败',
      },
      pointBadge: {
        none: '未报检',
      },
    },
  },
  fr: {
    hero: {
      badge: 'Avancement',
      title: 'Tableau des routes',
      description:
        'Les tronçons sont créés par les admins (nom + PK début/fin). Les phases, demandes de contrôle et validations se grefferont dessus. Cette page sert d’abord à gérer la liste.',
      home: "Retour à l'accueil",
      reports: 'Ouvrir un rapport',
      loadError:
        'Impossible de charger la liste des routes : {message}. Vous pouvez quand même en créer une, la liste se rafraîchira ensuite.',
    },
    admin: {
      badge: 'Admin',
      title: 'Gestion des tronçons',
      description: "Seuls les admins peuvent maintenir la liste; les phases seront ajoutées ensuite dans le détail.",
      editMode: 'Mode édition · ID {id}',
      saving: 'Enregistrement...',
    },
    form: {
      slugLabel: 'Slug',
      slugPlaceholder: 'ex : bondoukou-university',
      slugTitle: 'Uniquement lettres, chiffres et tirets en minuscules',
      nameLabel: 'Nom',
      namePlaceholder: 'ex : Route du campus',
      startLabel: 'PK début',
      startPlaceholder: 'ex : PK0+000 / carrefour A',
      endLabel: 'PK fin',
      endPlaceholder: 'ex : PK1+940 / tête de pont',
      exitEdit: "Quitter l'édition",
    },
    actions: {
      add: 'Ajouter un tronçon',
      save: 'Enregistrer',
      reset: 'Réinitialiser le formulaire',
    },
    errors: {
      noPermission: 'Pas de droit pour gérer les tronçons',
      saveFailed: "Échec de l'enregistrement, réessayez",
      saveMissing: 'Enregistré, mais aucune donnée retournée',
      deleteFailed: "Échec de la suppression, réessayez",
      loadFailed: 'Route introuvable, retour à la liste.',
    },
    list: {
      overview: 'Vue d’ensemble',
      none: 'Aucun tronçon',
      count: '{count} tronçons',
      emptyHelp:
        'Aucune route pour le moment. Ajoutez-en une avec Nom + PK début/fin depuis le formulaire ci-dessus.',
    },
    card: {
      label: 'Tronçon',
      start: 'Début',
      end: 'Fin',
      slug: 'Slug',
      edit: 'Éditer',
      delete: 'Supprimer',
      workNote:
        'Les phases se configurent dans le détail. Les validations mettront à jour automatiquement les bandes de progression.',
      updated: 'Dernière mise à jour : ',
    },
    detail: {
      badge: 'Détail route',
      slugLine: 'Slug : {slug} · PK début : {start} · PK fin : {end}',
      back: 'Retour à la liste',
      notFoundTitle: 'Route introuvable',
      notFoundBody: 'Aucune route correspondante. Retournez à la liste.',
      backToBoard: 'Retour au tableau',
      breadcrumbProgress: "Suivi d'avancement",
    },
    phase: {
      title: 'Phases',
      roadLengthLabel: 'Longueur estimée : {length} m',
      roadLengthUnknown: 'non renseigné',
      addButton: 'Ajouter une phase',
      manageTip: 'Création/édition via une fenêtre modale, pratique sur mobile.',
      viewOnlyTip: 'Compte sans droit édition : lecture seule.',
      form: {
        editingBadge: 'Éditer la phase · ID {id}',
        creatingBadge: 'Nouvelle phase',
        resetEdit: "Quitter l'édition",
        resetNew: 'Réinitialiser',
        designSummary: 'Longueur estimée : {length} m · Quantité auto : {design}',
        templateLabel: 'Modèle de phase',
        templateCustom: 'Personnalisé / Nouveau',
        nameLabel: 'Nom',
        namePlaceholder: 'ex : Terrassement',
        measureLabel: "Mode d'affichage",
        measureOptionLinear: 'Linéaire (par tronçon)',
        measureOptionPoint: 'Ponctuel (par point/entrée)',
        pointSidesLabel: 'Afficher les points par côté',
        pointSidesHint: 'Utile si les points sont contrôlés gauche/droite séparément; sinon vue unique.',
        designHintPrefix: 'Quantité auto :',
        designHintPoint: '{design} unités (comptées par point)',
        designHintLinear: '{design} m (double si double face)',
        intervalTitle: 'Liste des intervalles (début=fin pour un point)',
        intervalAdd: 'Ajouter un intervalle',
        intervalStart: 'Début',
        intervalEnd: 'Fin',
        intervalSide: 'Côté',
        sideBoth: 'Deux côtés',
        sideLeft: 'Gauche',
        sideRight: 'Droite',
        intervalDelete: 'Supprimer',
        layersTitle: 'Couches (candidats pour cette phase)',
        layersAdd: 'Ajouter',
        layersPlaceholder: 'Saisir ou ajouter une couche, ex : couche supérieure',
        layersEmpty: 'Aucune couche sélectionnée. Ajoutez ou choisissez ci-dessus.',
        checksTitle: 'Contenus de contrôle (candidats)',
        checksAdd: 'Ajouter',
        checksPlaceholder: 'ex : densité / planéité',
        checksEmpty: 'Aucun contenu sélectionné. Ajoutez ou choisissez ci-dessus.',
        save: 'Enregistrer la phase',
        saving: 'Enregistrement...',
      },
      note: {
        measure:
          "Le mode d'affichage pilote la visualisation ; la quantité est calculée par intervalle ou point. En linéaire, le double côté double la longueur.",
      },
      list: {
        title: 'Phases existantes',
        legend: 'Phases existantes (blanc = à contrôler, cliquable)',
        legendNote: 'Gris = hors design · Blanc = à contrôler',
        empty: 'Aucune phase pour le moment.',
      },
      card: {
        measurePoint: 'Ponctuel · Qté {value}',
        measureLinear: 'Linéaire · Qté {value} m',
        completed: 'Achevé {percent}%',
        edit: 'Éditer',
        delete: 'Supprimer',
        deleting: 'Suppression...',
      },
      delete: {
        title: 'Supprimer la phase',
        confirm: 'Supprimer « {name} » ?',
        impactTitle: 'Conséquences :',
        impactList: [
          '• Intervalles et demandes de contrôle associés seront supprimés (irréversible).',
          '• N’affecte que cette phase, les autres restent inchangées.',
          '• Assurez-vous d’avoir exporté ou sauvegardé les données nécessaires.',
        ],
        cancel: 'Annuler',
        confirm: 'Confirmer',
        confirming: 'Suppression...',
        close: 'Fermer',
      },
      status: {
        pending: 'À contrôler',
        inProgress: 'En cours',
        approved: 'Validé',
        nonDesign: 'Hors design',
      },
      errors: {
        invalidRange: 'Renseignez un début/fin valides',
        saveFailed: "Échec de l'enregistrement",
        deleteFailed: 'Échec de la suppression',
        submitRangeInvalid: 'Début/fin invalides',
        submitLayerMissing: 'Sélectionnez au moins une couche',
        submitCheckMissing: 'Sélectionnez au moins un contrôle',
        submitTypeMissing: 'Sélectionnez au moins un type',
        submitAppointmentMissing: 'Choisissez une date de rendez-vous',
        submitFailed: "Échec de l'envoi",
      },
      success: {
        created: 'Phase « {name} » créée',
        updated: 'Phase « {name} » mise à jour',
      },
      inspection: {
        title: 'Demande de contrôle',
        sideLabel: 'Côté',
        sideBoth: 'Deux côtés',
        sideLeft: 'Gauche',
        sideRight: 'Droite',
        startLabel: 'Début',
        startPlaceholder: 'Saisir PK début',
        endLabel: 'Fin',
        endPlaceholder: 'Saisir PK fin',
        appointmentLabel: 'Date de rendez-vous',
        appointmentPlaceholder: 'Choisir une date',
        layersLabel: 'Couches (multi)',
        layersEmpty: 'Aucune couche, ajoutez-les dans la phase.',
        checksLabel: 'Contrôles (multi, ajout libre)',
        checksEmpty: 'Aucun contrôle, ajoutez ou saisissez temporairement.',
        checkPlaceholder: 'Ajouter un contrôle temporaire',
        typesLabel: 'Type de contrôle (multi)',
        typesHint: "Si l'intervalle/côté correspond ci-dessus, envoyez directement ; sinon ajustez.",
        remarkLabel: 'Remarques (multi-lignes)',
        remarkPlaceholder: 'Ajoutez des précisions, consignes, etc.',
        cancel: 'Annuler',
        submit: 'Envoyer',
        submitting: 'Envoi...',
        permissionMissing: 'Droit de contrôle requis',
        types: ['Contrôle terrain', 'Contrôle mesure', 'Contrôle labo', 'Autre'],
      },
      alerts: {
        noInspectPermission: 'Droit de contrôle manquant',
        fetchInspectionFailed: 'Impossible de charger les contrôles',
      },
      pointBadge: {
        none: 'Non contrôlé',
      },
    },
  },
}

export const getProgressCopy = (locale: Locale) => progressCopy[locale]

export const formatProgressCopy = (
  template: string,
  values: Record<string, string | number>,
): string => formatCopy(template, values)
