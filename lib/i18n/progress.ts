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
    },
  },
}

export const getProgressCopy = (locale: Locale) => progressCopy[locale]

export const formatProgressCopy = (
  template: string,
  values: Record<string, string | number>,
): string => formatCopy(template, values)
