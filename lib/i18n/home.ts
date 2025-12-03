import type { Locale } from './index'

export type HomeModule = {
  title: string
  href: string
  tone: string
  description: string
  tags: string[]
  cta: string
}

export type HomeCopy = {
  hero: {
    intro: string
    reports: string
    connector: string
    progress: string
    suffix: string
    description: string
    primaryCta: string
    secondaryCta: string
  }
  moduleBadge: string
  moduleStatus: string
  modules: HomeModule[]
  stats: {
    entriesLabel: string
    entriesValue: string
    recentLabel: string
    recentValue: string
    upcomingTitle: string
    upcomingBody: string
  }
  extension: {
    label: string
    items: string[]
    description: string
  }
  moduleDialog: {
    title: string
    description: string
    close: string
  }
  changePassword: {
    trigger: string
    title: string
    current: string
    next: string
    confirm: string
    mismatch: string
    updateFailed: string
    updateSuccess: string
    submitting: string
    save: string
    hint: string
  }
  auth: {
    login: string
    loggingIn: string
    logout: string
    loggingOut: string
    title: string
    username: string
    password: string
    hint: string
    loggedInPrefix: string
    needLogin: string
    noPermission: string
    loginSuccess: string
    loginFail: string
    loginRequired: string
    close: string
  }
}

export const homeCopy: Record<Locale, HomeCopy> = {
  zh: {
    hero: {
      intro: '集中入口，协调',
      reports: '日报',
      connector: '与',
      progress: '进度',
      suffix: '。',
      description:
        '把一线更新、项目里程碑放在同一块操作面板，保持团队节奏一致。当前开放 5 个核心入口（含成员管理、产值计量与财务记账），后续模块可随时接入。',
      primaryCta: '立即填写日报',
      secondaryCta: '查看项目进度'
    },
    moduleBadge: '入口',
    moduleStatus: '持续维护',
    modules: [
      {
        title: '日报系统',
        href: '/reports',
        tone: 'from-blue-400/80 via-cyan-300/80 to-emerald-300/60',
        description: '快速进入日报录入与日历视图，保持现场信息连续更新。',
        tags: ['创建/编辑', '月历视图', '最近更新'],
        cta: '进入日报'
      },
      {
        title: '项目进度',
        href: '/progress',
        tone: 'from-orange-300/80 via-amber-200/80 to-rose-300/80',
        description: '汇总工期节点、关键风险与甘特视图，规划对齐更直观。',
        tags: ['里程碑', '风险跟踪', '甘特预览'],
        cta: '查看进度'
      },
      {
        title: '成员管理',
        href: '/members',
        tone: 'from-teal-300/80 via-sky-300/80 to-indigo-300/70',
        description:
          '集中维护成员信息、角色与权限，支持导入导出与审计记录，中法双语可切换。',
        tags: ['成员信息', '角色/权限', '导入导出'],
        cta: '进入成员管理'
      },
      {
        title: '财务记账',
        href: '/finance',
        tone: 'from-emerald-300/80 via-teal-300/80 to-blue-400/70',
        description: '按项目录入财务流水，支持序号自动生成、分类与税费字段，方便后续统计。',
        tags: ['项目选择', '分类/支付方式', '含税金额'],
        cta: '进入财务'
      },
      {
        title: '产值计量',
        href: '/value',
        tone: 'from-indigo-300/80 via-purple-300/80 to-fuchsia-300/80',
        description: '按分项统计设计/完成量与单价，实时跟踪产值进度与完成率。',
        tags: ['单价/产值', '完成率', '工程汇总'],
        cta: '查看产值详情'
      }
    ],
    stats: {
      entriesLabel: '当前入口',
      entriesValue: '5',
      recentLabel: '最近更新',
      recentValue: '新增成员管理与产值计量入口，日报/进度/财务持续维护',
      upcomingTitle: '即将推出',
      upcomingBody: '支持更多入口：质量巡检、物资追踪、风险复盘。'
    },
    extension: {
      label: '扩展空间',
      items: ['质量巡检', '物资进出', '风险复盘', 'AI 总结', '导出中心'],
      description:
        '未来的入口会延续同一视觉规范：清晰分区、带状态标识、可快速跳转到具体场景。需要新增模块时直接在此卡片组追加即可。'
    },
    moduleDialog: {
      title: '暂无访问权限',
      description: '需要开通权限后才能访问该模块，请联系管理员或切换账号。',
      close: '好的'
    },
    changePassword: {
      trigger: '修改密码',
      title: '修改密码',
      current: '当前密码',
      next: '新密码',
      confirm: '确认新密码',
      mismatch: '两次输入的新密码不一致',
      updateFailed: '修改失败',
      updateSuccess: '密码已更新，请妥善保存',
      submitting: '提交中...',
      save: '保存密码',
      hint: '最短 6 位，修改后会保持登录状态'
    },
    auth: {
      login: '登录',
      loggingIn: '登录中...',
      logout: '退出登录',
      loggingOut: '正在退出...',
      title: '登录',
      username: '用户名',
      password: '密码',
      hint: '如无账号，请联系管理员开通。',
      loggedInPrefix: '已登录',
      needLogin: '需登录',
      noPermission: '权限不足',
      loginSuccess: '登录成功，权限已更新',
      loginFail: '登录失败',
      loginRequired: '请先登录后再访问该模块',
      close: '关闭'
    }
  },
  fr: {
    hero: {
      intro: 'Un hub unique pour coordonner les',
      reports: 'rapports journaliers',
      connector: 'et le',
      progress: "suivi d'avancement",
      suffix: '.',
      description:
        'Regroupez les mises à jour terrain et les jalons projet sur le même tableau de bord. Cinq accès clés (dont la gestion des membres, le calcul des valeurs et la comptabilité) sont prêts, les suivants se brancheront facilement.',
      primaryCta: 'Remplir un rapport',
      secondaryCta: "Voir l'avancement"
    },
    moduleBadge: 'Entrée',
    moduleStatus: 'Maintenance continue',
    modules: [
      {
        title: 'Rapport quotidien',
        href: '/reports',
        tone: 'from-blue-400/80 via-cyan-300/80 to-emerald-300/60',
        description:
          'Accès direct à la saisie, au calendrier et aux derniers rapports pour garder le terrain synchronisé.',
        tags: ['Créer/éditer', 'Vue calendrier', 'Dernières mises à jour'],
        cta: 'Ouvrir le rapport'
      },
      {
        title: 'Avancement du projet',
        href: '/progress',
        tone: 'from-orange-300/80 via-amber-200/80 to-rose-300/80',
        description: 'Rassembler jalons, risques clés et aperçu Gantt pour un alignement clair.',
        tags: ['Jalons', 'Suivi des risques', 'Vue Gantt'],
        cta: "Consulter l'avancement"
      },
      {
        title: 'Gestion des membres',
        href: '/members',
        tone: 'from-teal-300/80 via-sky-300/80 to-indigo-300/70',
        description:
          'Centraliser les fiches, rôles et permissions avec import/export et audit, en chinois et français.',
        tags: ['Profils', 'Rôles/Permissions', 'Import/Export'],
        cta: 'Ouvrir membres'
      },
      {
        title: 'Comptabilité',
        href: '/finance',
        tone: 'from-emerald-300/80 via-teal-300/80 to-blue-400/70',
        description:
          'Saisir les écritures par projet avec numéro auto, catégorie, mode de paiement et TVA pour préparer les états financiers.',
        tags: ['Projet', 'Catégorie/paiement', 'Montant TTC'],
        cta: 'Ouvrir la compta'
      },
      {
        title: 'Calcul des valeurs',
        href: '/value',
        tone: 'from-indigo-300/80 via-purple-300/80 to-fuchsia-300/80',
        description:
          'Regroupe quantités prévues/réalisées et prix unitaires par sous-ouvrage pour suivre la valeur validée.',
        tags: ['Prix unitaires', 'Valeurs réalisées', 'Progression'],
        cta: 'Voir les valeurs'
      }
    ],
    stats: {
      entriesLabel: 'Entrées actives',
      entriesValue: '5',
      recentLabel: 'Mise à jour',
      recentValue: 'Entrées membres et valeurs ajoutées, rapport/avancement/compta synchronisés',
      upcomingTitle: 'Prochainement',
      upcomingBody: 'Inspection qualité, flux matériaux, revues de risques.'
    },
    extension: {
      label: "Espace d'extension",
      items: [
        'Inspection qualité',
        'Flux de matériaux',
        'Revue des risques',
        'Synthèse IA',
        "Centre d'export"
      ],
      description:
        'Les futurs modules suivront la même grille visuelle : zones claires, statut visible et navigation rapide vers chaque scénario. Ajoutez simplement une carte ici quand un nouveau module arrive.'
    },
    moduleDialog: {
      title: 'Accès requis',
      description:
        "Vous n'avez pas les droits pour ce module. Contactez un administrateur ou changez de compte.",
      close: 'Compris'
    },
    changePassword: {
      trigger: 'Modifier le mot de passe',
      title: 'Modifier le mot de passe',
      current: 'Mot de passe actuel',
      next: 'Nouveau mot de passe',
      confirm: 'Confirmer le nouveau mot de passe',
      mismatch: 'Les deux nouveaux mots de passe ne correspondent pas',
      updateFailed: 'Échec de mise à jour',
      updateSuccess: 'Mot de passe mis à jour, gardez-le en sécurité',
      submitting: 'Enregistrement...',
      save: 'Enregistrer le mot de passe',
      hint: 'Minimum 6 caractères, vous resterez connecté après modification'
    },
    auth: {
      login: 'Connexion',
      loggingIn: 'Connexion...',
      logout: 'Déconnexion',
      loggingOut: 'Déconnexion...',
      title: 'Connexion',
      username: 'Identifiant',
      password: 'Mot de passe',
      hint: 'Si vous n’avez pas de compte, contactez un administrateur.',
      loggedInPrefix: 'Connecté',
      needLogin: 'Connexion requise',
      noPermission: 'Droit insuffisant',
      loginSuccess: 'Connecté, droits mis à jour',
      loginFail: 'Échec de connexion',
      loginRequired: 'Connectez-vous pour accéder à ce module',
      close: 'Fermer'
    }
  }
}

export const getHomeCopy = (locale: Locale): HomeCopy => homeCopy[locale]
