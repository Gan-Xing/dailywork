import type { Locale } from './index'

export type WeeklyRollupsCopy = {
  list: {
    title: string
    subtitle: string
    loading: string
    error: string
    empty: string
    open: string
    reportPeriodLabel: string
    updatedLabel: string
    sizeLabel: string
    projectLabel: string
    untitled: string
  }
  detail: {
    title: string
    subtitle: string
    loading: string
    error: string
    notFound: string
    back: string
    reportPeriodLabel: string
    updatedLabel: string
    sizeLabel: string
    projectLabel: string
    weekLabel: string
    htmlTitle: string
  }
  accessHint: string
}

export const weeklyRollupsCopy: Record<Locale, WeeklyRollupsCopy> = {
  zh: {
    list: {
      title: '周报汇总',
      subtitle: '浏览已归档的负责人周完成产值汇总 HTML 页面',
      loading: '周报汇总加载中...',
      error: '加载周报汇总失败，请稍后重试。',
      empty: '暂未导入任何周报汇总页面。',
      open: '查看周报',
      reportPeriodLabel: '统计周期',
      updatedLabel: '最近更新',
      sizeLabel: '文件大小',
      projectLabel: '项目范围',
      untitled: '未命名周报',
    },
    detail: {
      title: '周报详情',
      subtitle: '在线预览归档的周报 HTML',
      loading: '周报详情加载中...',
      error: '加载周报详情失败，请稍后重试。',
      notFound: '未找到对应的周报汇总页面。',
      back: '返回周报汇总',
      reportPeriodLabel: '统计周期',
      updatedLabel: '最近更新',
      sizeLabel: '文件大小',
      projectLabel: '项目范围',
      weekLabel: '周次',
      htmlTitle: '周报 HTML 预览',
    },
    accessHint: '需要拥有 report:view 或 report:edit 权限才能查看周报汇总。',
  },
  fr: {
    list: {
      title: 'Synthese hebdomadaire',
      subtitle: 'Consulter les pages HTML archivees des productions hebdomadaires par responsable',
      loading: 'Chargement des syntheses hebdomadaires...',
      error: 'Impossible de charger les syntheses hebdomadaires.',
      empty: 'Aucune page hebdomadaire importee pour le moment.',
      open: 'Ouvrir',
      reportPeriodLabel: 'Periode',
      updatedLabel: 'Mise a jour',
      sizeLabel: 'Taille',
      projectLabel: 'Projets',
      untitled: 'Synthese sans titre',
    },
    detail: {
      title: 'Detail hebdomadaire',
      subtitle: 'Previsualisation en ligne du HTML archive',
      loading: 'Chargement du detail...',
      error: 'Impossible de charger le detail hebdomadaire.',
      notFound: 'Aucune page correspondante trouvee.',
      back: 'Retour aux syntheses',
      reportPeriodLabel: 'Periode',
      updatedLabel: 'Mise a jour',
      sizeLabel: 'Taille',
      projectLabel: 'Projets',
      weekLabel: 'Semaine',
      htmlTitle: 'Apercu HTML',
    },
    accessHint: "Le droit report:view ou report:edit est requis pour consulter les syntheses hebdomadaires.",
  },
}

export const getWeeklyRollupsCopy = (locale: Locale) => weeklyRollupsCopy[locale]
