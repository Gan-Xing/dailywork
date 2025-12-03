import type { Locale, LocalizedString } from './index'

export type ParticipantEntity = {
  id: string
  label: LocalizedString
  logo: { src: string; width: number; height: number }
}

export const participantEntities: readonly ParticipantEntity[] = [
  {
    id: 'meer',
    label: {
      fr: "MINISTERE DE L'EQUIPEMENT ET DE L'ENTRETIEN ROUTIER (MEER)",
      zh: '科特迪瓦设备与道路维护部 (MEER)'
    },
    logo: { src: '/meer.png', width: 160, height: 80 }
  },
  {
    id: 'delegue',
    label: {
      fr: "Maître d'ouvrage délégué",
      zh: '业主代表'
    },
    logo: { src: '/ageroute.png', width: 160, height: 80 }
  },
  {
    id: 'moe',
    label: {
      fr: "Maître d'œuvre",
      zh: '监理/设计单位'
    },
    logo: { src: '/bnetd_logo.svg', width: 160, height: 80 }
  },
  {
    id: 'entrepreneur',
    label: {
      fr: 'Entrepreneur',
      zh: '承包商'
    },
    logo: { src: '/logo_porteo_btp.svg', width: 160, height: 80 }
  }
] as const

export const [primaryEntity, ...secondaryEntities] = participantEntities

export type DropdownOption = {
  value: string
  label: LocalizedString
}

export const monthOptions: readonly DropdownOption[] = [
  { value: '01', label: { fr: 'Janvier', zh: '1月' } },
  { value: '02', label: { fr: 'Février', zh: '2月' } },
  { value: '03', label: { fr: 'Mars', zh: '3月' } },
  { value: '04', label: { fr: 'Avril', zh: '4月' } },
  { value: '05', label: { fr: 'Mai', zh: '5月' } },
  { value: '06', label: { fr: 'Juin', zh: '6月' } },
  { value: '07', label: { fr: 'Juillet', zh: '7月' } },
  { value: '08', label: { fr: 'Août', zh: '8月' } },
  { value: '09', label: { fr: 'Septembre', zh: '9月' } },
  { value: '10', label: { fr: 'Octobre', zh: '10月' } },
  { value: '11', label: { fr: 'Novembre', zh: '11月' } },
  { value: '12', label: { fr: 'Décembre', zh: '12月' } }
] as const

export const yearOptions: readonly DropdownOption[] = [
  { value: '2025', label: { fr: '2025', zh: '2025年' } },
  { value: '2026', label: { fr: '2026', zh: '2026年' } }
] as const

export type ReportEditorCopy = {
  selectPlaceholder: string
  homeLabel: string
  reportDateLabel: string
  saveLabel: string
  savingLabel: string
  breadcrumbs: {
    home: string
    reports: string
  }
}

export const reportEditorCopy: Record<Locale, ReportEditorCopy> = {
  zh: {
    selectPlaceholder: '请选择',
    homeLabel: '返回首页',
    reportDateLabel: '日报日期',
    saveLabel: '确认保存',
    savingLabel: '保存中...',
    breadcrumbs: {
      home: '首页',
      reports: '日报管理'
    }
  },
  fr: {
    selectPlaceholder: 'Sélectionner',
    homeLabel: "Retour à l'accueil",
    reportDateLabel: 'Date du rapport',
    saveLabel: "Confirmer l'enregistrement",
    savingLabel: 'Enregistrement...',
    breadcrumbs: {
      home: 'Accueil',
      reports: 'Rapports journaliers'
    }
  }
}

export const getReportEditorCopy = (locale: Locale): ReportEditorCopy => reportEditorCopy[locale]
