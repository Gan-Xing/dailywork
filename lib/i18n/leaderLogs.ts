import type { Locale } from './index'

export type LeaderLogsCopy = {
  header: {
    title: string
    subtitle: string
    description: string
  }
  mode: {
    label: string
    team: string
    personal: string
    leaderLabel: string
    leaderPlaceholder: string
  }
  stats: {
    leaders: string
    filled: string
    pending: string
  }
  list: {
    badge: string
    empty: string
    pending: string
    filled: string
    photoOnly: string
    photoOnlyHint: string
    leaderLabel: string
    otherLeaders: string
    view: string
    updatedPrefix: string
    create: string
    edit: string
    readOnly: string
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
  form: {
    createTitle: string
    editTitle: string
    dateLabel: string
    leaderLabel: string
    contentLabel: string
    contentPlaceholder: string
    contentHint: string
    save: string
    cancel: string
  }
  formErrors: {
    dateRequired: string
    leaderRequired: string
    contentRequired: string
  }
  photos: {
    title: string
    hint: string
    empty: string
    error: string
    loading: string
    upload: string
    camera: string
    album: string
    drop: string
    dropHint: string
    open: string
    openFailed: string
    uploadFailed: string
    uploading: string
  }
  alerts: {
    title: string
    createDenied: string
    viewDenied: string
    close: string
  }
  accessHint: string
}

export const leaderLogsCopy: Record<Locale, LeaderLogsCopy> = {
  zh: {
    header: {
      title: '原始日志',
      subtitle: '施工负责人每日现场日志，可补录历史。',
      description: '日志仅一条/人/天，请在正文写明涉及班组。',
    },
    mode: {
      label: '视图模式',
      team: '全员',
      personal: '个人',
      leaderLabel: '负责人',
      leaderPlaceholder: '选择负责人',
    },
    stats: {
      leaders: '负责人',
      filled: '已填写',
      pending: '待填写',
    },
    list: {
      badge: '当日原始日志',
      empty: '该日期暂无日志记录。',
      pending: '待填写',
      filled: '已填写',
      photoOnly: '仅照片',
      photoOnlyHint: '仅上传了现场照片，暂无文字记录。',
      leaderLabel: '负责人',
      otherLeaders: '其他负责人',
      view: '查看',
      updatedPrefix: '更新于',
      create: '填写',
      edit: '编辑',
      readOnly: '仅本人可编辑',
    },
    calendar: {
      badge: '日期选择',
      prevLabel: '上个月',
      nextLabel: '下个月',
      filledLabel: '有日志',
      pendingLabel: '无日志',
      loading: '日历加载中...',
      error: '加载日历失败。',
      weekdays: ['日', '一', '二', '三', '四', '五', '六'],
    },
    recent: {
      badge: '最近更新',
      loading: '加载中...',
      error: '加载最近日志失败。',
      empty: '暂无更新记录。',
      view: '查看',
      updatedPrefix: '更新于',
    },
    form: {
      createTitle: '新建原始日志',
      editTitle: '编辑原始日志',
      dateLabel: '日期',
      leaderLabel: '负责人',
      contentLabel: '现场日志',
      contentPlaceholder: '输入原始现场日志内容...',
      contentHint: '请在正文写明涉及班组/作业面。',
      save: '保存日志',
      cancel: '取消',
    },
    formErrors: {
      dateRequired: '请选择日期',
      leaderRequired: '请选择负责人',
      contentRequired: '请输入日志内容',
    },
    photos: {
      title: '现场照片',
      hint: '照片默认归类为现场照片，并关联负责人 + 原始日志。',
      empty: '暂无现场照片。',
      error: '照片加载失败。',
      loading: '照片加载中...',
      upload: '上传照片',
      camera: '拍照',
      album: '从相册选择',
      drop: '拖拽上传',
      dropHint: '拖拽/点击',
      open: '查看',
      openFailed: '打开照片失败。',
      uploadFailed: '上传照片失败。',
      uploading: '上传中...',
    },
    alerts: {
      title: '权限提醒',
      createDenied: '缺少 report:edit 权限，无法创建或修改日志。',
      viewDenied: '缺少 report:view 权限，无法查看日志。',
      close: '知道了',
    },
    accessHint: '需要拥有 report:view 或 report:edit 权限才能查看原始日志。',
  },
  fr: {
    header: {
      title: 'Journal brut',
      subtitle: 'Saisie quotidienne du responsable chantier, y compris les jours précédents.',
      description: "Une seule entrée par responsable et par jour; indiquez les équipes dans le texte.",
    },
    mode: {
      label: 'Mode',
      team: 'Équipe',
      personal: 'Individuel',
      leaderLabel: 'Responsable',
      leaderPlaceholder: 'Choisir un responsable',
    },
    stats: {
      leaders: 'Responsables',
      filled: 'Renseigné',
      pending: 'À remplir',
    },
    list: {
      badge: 'Journal du jour',
      empty: 'Aucun journal pour cette date.',
      pending: 'À remplir',
      filled: 'Renseigné',
      photoOnly: 'Photos uniquement',
      photoOnlyHint: 'Photos présentes, aucun texte saisi.',
      leaderLabel: 'Responsable',
      otherLeaders: 'Autres responsables',
      view: 'Voir',
      updatedPrefix: 'Mis à jour',
      create: 'Saisir',
      edit: 'Modifier',
      readOnly: 'Modification réservée au responsable',
    },
    calendar: {
      badge: 'Sélection de date',
      prevLabel: 'Mois précédent',
      nextLabel: 'Mois suivant',
      filledLabel: 'Saisi',
      pendingLabel: 'Vide',
      loading: 'Chargement du calendrier...',
      error: 'Échec du chargement.',
      weekdays: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
    },
    recent: {
      badge: 'Mises à jour récentes',
      loading: 'Chargement...',
      error: 'Échec du chargement.',
      empty: 'Aucune mise à jour récente.',
      view: 'Voir',
      updatedPrefix: 'Mis à jour',
    },
    form: {
      createTitle: 'Créer un journal',
      editTitle: 'Modifier le journal',
      dateLabel: 'Date',
      leaderLabel: 'Responsable',
      contentLabel: 'Journal terrain',
      contentPlaceholder: 'Saisissez le texte brut du journal...',
      contentHint: "Indiquez les équipes/secteurs concernés dans le texte.",
      save: 'Enregistrer',
      cancel: 'Annuler',
    },
    formErrors: {
      dateRequired: 'Sélectionnez une date',
      leaderRequired: 'Sélectionnez un responsable',
      contentRequired: 'Saisissez le journal',
    },
    photos: {
      title: 'Photos terrain',
      hint: 'Catégorie: photos terrain, liées au responsable et au journal brut.',
      empty: 'Aucune photo.',
      error: 'Chargement des photos impossible.',
      loading: 'Chargement des photos...',
      upload: 'Ajouter',
      camera: 'Prendre une photo',
      album: 'Choisir depuis l’album',
      drop: 'Glisser-déposer',
      dropHint: 'Glisser / cliquer',
      open: 'Voir',
      openFailed: 'Ouverture de la photo impossible.',
      uploadFailed: 'Téléversement impossible.',
      uploading: 'Téléversement...',
    },
    alerts: {
      title: 'Alerte de droits',
      createDenied: "Le droit report:edit est requis pour créer ou modifier un journal.",
      viewDenied: "Le droit report:view est requis pour consulter les journaux.",
      close: 'Compris',
    },
    accessHint: "Contactez l'admin pour obtenir l'accès à la consultation/édition des journaux.",
  },
}

export const leaderLogBreadcrumbs: Record<Locale, { home: string; reports: string; logs: string }> = {
  zh: { home: '首页', reports: '日报管理', logs: '原始日志' },
  fr: { home: 'Accueil', reports: 'Rapports journaliers', logs: 'Journal brut' },
}

export const leaderLogDateLocales: Record<Locale, string> = {
  fr: 'fr-FR',
  zh: 'zh-CN',
}

export const getLeaderLogsCopy = (locale: Locale): LeaderLogsCopy => leaderLogsCopy[locale]
