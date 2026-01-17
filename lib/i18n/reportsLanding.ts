import type { Locale } from './index'

export type ReportsLandingCopy = {
  create: {
    badge: string
    title: string
    description: string
    createButton: string
    viewButton: string
    prototype: string
    hintFilled: string
    hintEmpty: string
  }
  calendar: {
    badge: string
    prevLabel: string
    nextLabel: string
    filledLabel: string
    pendingLabel: string
    loading: string
    error: string
    weekdays: string[]
  }
  recent: {
    badge: string
    loading: string
    error: string
    empty: string
    view: string
    updatedPrefix: string
  }
  exportSection: {
    badge: string
    title: string
    description: string
    hint: string
    selectAll: string
    clearSelection: string
    exportButton: string
    exporting: string
    selectedCount: string
    missingSelection: string
    exportFailed: string
    empty: string
    loading: string
    error: string
    dateLabel: string
    updatedLabel: string
    actionLabel: string
    view: string
  }
  alerts: {
    title: string
    createDenied: string
    viewDenied: string
    close: string
  }
  accessHint: string
}

export const reportsLandingCopy: Record<Locale, ReportsLandingCopy> = {
  zh: {
    create: {
      badge: '创建日报',
      title: '选择日期，开始录入',
      description: '请选择尚未填报的日期，完成后内容会被保存并在首页高亮。',
      createButton: '创建并前往填报',
      viewButton: '查看该日报',
      prototype: '查看原型图',
      hintFilled: '该日期已经完成，可以查看或继续修改。',
      hintEmpty: '该日期尚无日报，可直接创建。'
    },
    calendar: {
      badge: '历史记录',
      prevLabel: '上个月',
      nextLabel: '下个月',
      filledLabel: '已填',
      pendingLabel: '待填',
      loading: '日历加载中...',
      error: '加载历史记录失败。',
      weekdays: ['日', '一', '二', '三', '四', '五', '六']
    },
    recent: {
      badge: '最近更新',
      loading: '加载中...',
      error: '加载最新日报失败。',
      empty: '还没有任何日报，先创建一条吧。',
      view: '查看',
      updatedPrefix: '最近更新：'
    },
    exportSection: {
      badge: 'PDF 导出',
      title: '批量导出日报',
      description: '仅可导出已填写的日报，支持多选合并为一个 PDF。',
      hint: '仅显示已填写的日报。',
      selectAll: '全选本月',
      clearSelection: '清空选择',
      exportButton: '导出 PDF',
      exporting: '正在导出...',
      selectedCount: '已选 {count} 条',
      missingSelection: '请先选择要导出的日报。',
      exportFailed: '导出日报失败，请稍后重试。',
      empty: '当前月份没有可导出的日报。',
      loading: '加载可导出日报...',
      error: '加载可导出日报失败。',
      dateLabel: '日期',
      updatedLabel: '最近更新',
      actionLabel: '操作',
      view: '查看'
    },
    alerts: {
      title: '权限提醒',
      createDenied: '缺少 report:edit 权限，无法创建或修改日报。',
      viewDenied: '缺少 report:view 权限，无法查看日报。',
      close: '知道了'
    },
    accessHint: '需要拥有 report:view 或 report:edit 权限才能创建或查看日报。'
  },
  fr: {
    create: {
      badge: 'Créer un rapport',
      title: 'Choisissez la date et commencez la saisie',
      description:
        "Sélectionnez une journée non renseignée; une fois enregistrée, elle sera mise en avant sur l'accueil.",
      createButton: 'Créer et ouvrir',
      viewButton: 'Ouvrir ce rapport',
      prototype: 'Voir la maquette',
      hintFilled: 'Cette date est déjà renseignée; vous pouvez la consulter ou la modifier.',
      hintEmpty: 'Aucun rapport pour cette date, vous pouvez le créer.'
    },
    calendar: {
      badge: 'Historique',
      prevLabel: 'Mois précédent',
      nextLabel: 'Mois suivant',
      filledLabel: 'Déclaré',
      pendingLabel: 'À remplir',
      loading: 'Chargement du calendrier...',
      error: "Impossible de charger l'historique.",
      weekdays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
    },
    recent: {
      badge: 'Mises à jour récentes',
      loading: 'Chargement...',
      error: 'Échec du chargement des derniers rapports.',
      empty: 'Aucun rapport pour le moment, créez le premier.',
      view: 'Voir',
      updatedPrefix: 'Dernière mise à jour : '
    },
    exportSection: {
      badge: 'Export PDF',
      title: 'Exporter les rapports',
      description: 'Seuls les rapports remplis sont exportables. Sélection multiple combinée en un PDF.',
      hint: 'Affiche uniquement les rapports remplis.',
      selectAll: 'Tout sélectionner',
      clearSelection: 'Effacer la sélection',
      exportButton: 'Exporter en PDF',
      exporting: 'Export en cours...',
      selectedCount: '{count} sélectionné(s)',
      missingSelection: 'Sélectionnez au moins un rapport à exporter.',
      exportFailed: "Échec de l'export PDF, veuillez réessayer.",
      empty: 'Aucun rapport exportable pour ce mois.',
      loading: 'Chargement des rapports exportables...',
      error: "Impossible de charger les rapports exportables.",
      dateLabel: 'Date',
      updatedLabel: 'Dernière mise à jour',
      actionLabel: 'Action',
      view: 'Voir'
    },
    alerts: {
      title: 'Alerte de droits',
      createDenied: "Le droit report:edit est requis pour créer ou modifier un rapport.",
      viewDenied: "Le droit report:view est requis pour consulter les rapports.",
      close: 'Compris'
    },
    accessHint: "Contactez l'admin pour obtenir l'accès à la consultation/édition des rapports."
  }
}

export const reportLandingBreadcrumbs: Record<Locale, { home: string; reports: string }> = {
  zh: {
    home: '首页',
    reports: '日报管理'
  },
  fr: {
    home: 'Accueil',
    reports: 'Rapports journaliers'
  }
}

export const reportDateLocales: Record<Locale, string> = {
  fr: 'fr-FR',
  zh: 'zh-CN'
}

export const getReportsLandingCopy = (locale: Locale): ReportsLandingCopy =>
  reportsLandingCopy[locale]
