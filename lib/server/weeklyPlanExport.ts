import type { Locale } from '@/lib/i18n'
import { resolveWeeklyPlanGoodsLabel } from '@/lib/resources/weeklyPlans/goodsDictionary'
import {
  combinePlateNumbers,
  formatDateInput,
  formatMaterialModel,
} from '@/app/resources/weekly-plans/materialsConfig'

type ExportProject = {
  id: number
  name: string
  code: string | null
}

type ExportProjectEntry = {
  projectId?: number
  project: ExportProject
}

type ExportPlan = {
  title: string
  month: number
  session: number
  weekStartDate: Date | string | null
  weekEndDate: Date | string | null
  project: ExportProject
  projects: ExportProjectEntry[]
}

type ExportItem = {
  deliveryDate: string | null
  supplier: string | null
  goodsName: string | null
  goodsNameKey: string | null
  model: unknown
  unit: string | null
  plannedQty: unknown
  transporter: string | null
  headPlateNumber: string | null
  tailPlateNumber: string | null
  phone: string | null
}

type ExportProjectMeta = {
  prefix?: string
  frTitle: string
  frProjectName: string
  zhPlanName: string
}

export type WeeklyPlanExportContext = {
  project: ExportProject
  meta: ExportProjectMeta
  allProjects: ExportProject[]
  hasBondoukouCity: boolean
}

export type WeeklyPlanExportRow = {
  number: number
  nomLeTemps: string
  supplier: string
  goodsNameFr: string
  model: string
  unit: string
  plannedQty: string | number
  transporter: string
  contact: string
  phone: string
}

const BDK_PROJECT_CODE = 'project-bondoukou-city'

const containsCjk = (value: string) => /[\u3400-\u9fff]/.test(value)

const humanizeIdentifier = (value: string) =>
  value
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

const projectMetaByCode: Record<string, ExportProjectMeta> = {
  'project-bondoukou-city': {
    prefix: 'BDK',
    frTitle: 'Projet de Construction de Route Bondoukou',
    frProjectName: 'Voiries de Bondoukou',
    zhPlanName: '邦杜库市政路项目',
  },
  'project-bondoukou-border': {
    frTitle: 'Projet frontalier de Bondoukou',
    frProjectName: 'Route frontalière de Bondoukou',
    zhPlanName: '邦杜库边境路项目',
  },
  'project-bondoukou-supply': {
    frTitle: "Projet d'approvisionnement de Bondoukou",
    frProjectName: "Projet d'approvisionnement de Bondoukou",
    zhPlanName: '邦杜库供料项目',
  },
  'project-tanda-city': {
    frTitle: 'Projet de Construction de Route Tanda',
    frProjectName: 'Voiries de Tanda',
    zhPlanName: '丹达市政路项目',
  },
  'project-anibilekrou-city': {
    frTitle: "Projet de Construction de Route Agnibilékrou",
    frProjectName: "Voiries d'Agnibilékrou",
    zhPlanName: '阿尼比莱克鲁市政路项目',
  },
}

const buildFallbackProjectMeta = (project: ExportProject): ExportProjectMeta => {
  const fallbackName = project.name.trim()
  const fallbackFrProjectName =
    project.code && projectMetaByCode[project.code]?.frProjectName
      ? projectMetaByCode[project.code].frProjectName
      : !containsCjk(fallbackName)
        ? fallbackName
        : project.code
          ? humanizeIdentifier(project.code)
          : fallbackName

  return {
    frTitle: fallbackFrProjectName,
    frProjectName: fallbackFrProjectName,
    zhPlanName: fallbackName,
  }
}

const getProjectList = (plan: ExportPlan): ExportProject[] => {
  if (plan.projects.length > 0) {
    return plan.projects.map((entry) => entry.project)
  }
  return [plan.project]
}

const coerceNumberLike = (value: unknown): string | number => {
  if (value == null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? value : ''
  const text = String(value).trim()
  if (!text) return ''
  const numeric = Number(text)
  if (!Number.isNaN(numeric) && String(numeric) === text) {
    return numeric
  }
  return text
}

const getPlanYear = (plan: ExportPlan): string => {
  const formattedStart = formatDateInput(plan.weekStartDate)
  if (formattedStart) return formattedStart.slice(0, 4)
  const formattedEnd = formatDateInput(plan.weekEndDate)
  if (formattedEnd) return formattedEnd.slice(0, 4)
  return ''
}

export const resolveWeeklyPlanExportContext = (plan: ExportPlan): WeeklyPlanExportContext => {
  const allProjects = getProjectList(plan)
  const bondoukouCityProject =
    allProjects.find((project) => project.code === BDK_PROJECT_CODE) ?? null
  const selectedProject = bondoukouCityProject ?? allProjects[0] ?? plan.project
  const meta = projectMetaByCode[selectedProject.code ?? ''] ?? buildFallbackProjectMeta(selectedProject)

  return {
    project: selectedProject,
    meta,
    allProjects,
    hasBondoukouCity: Boolean(bondoukouCityProject),
  }
}

export const buildWeeklyPlanFrTitle = (context: WeeklyPlanExportContext): string =>
  context.meta.frTitle

export const buildWeeklyPlanFrDetailTitle = (plan: ExportPlan): string =>
  `DETAIL DU PLANNING DE LIVRAISON HEBDOMADAIRE ${plan.title}`

export const buildWeeklyPlanZhTitle = (
  plan: Pick<ExportPlan, 'month' | 'session' | 'title' | 'weekStartDate' | 'weekEndDate'>,
  context: WeeklyPlanExportContext,
): string => {
  const year = getPlanYear({ ...plan, project: context.project, projects: [] })
  const periodText =
    year && plan.month && plan.session
      ? `${year}年${plan.month}月第${plan.session}周`
      : plan.title

  return `${context.meta.zhPlanName}大宗物资周计划明细表（${periodText}）`
}

export const buildWeeklyPlanNomLeTemps = (
  deliveryDate: string | null | undefined,
  context: WeeklyPlanExportContext,
): string => {
  const formatted = formatDateInput(deliveryDate)
  if (!formatted) return ''
  if (context.hasBondoukouCity && context.meta.prefix) {
    return `${context.meta.prefix}/${formatted.replaceAll('-', '')}`
  }
  return formatted
}

export const buildWeeklyPlanExportRows = (
  items: ExportItem[],
  context: WeeklyPlanExportContext,
): WeeklyPlanExportRow[] =>
  items.map((item, index) => ({
    number: index + 1,
    nomLeTemps: buildWeeklyPlanNomLeTemps(item.deliveryDate, context),
    supplier: item.supplier?.trim() ?? '',
    goodsNameFr: resolveWeeklyPlanGoodsLabel({
      locale: 'fr',
      goodsName: item.goodsName,
      goodsNameKey: item.goodsNameKey,
    }),
    model: formatMaterialModel(item.goodsName, item.model),
    unit: item.unit?.trim() ?? '',
    plannedQty: coerceNumberLike(item.plannedQty),
    transporter: item.transporter?.trim() ?? '',
    contact: combinePlateNumbers(item.headPlateNumber, item.tailPlateNumber),
    phone: item.phone?.trim() ?? '',
  }))

export const getWeeklyPlanProjectName = (
  context: WeeklyPlanExportContext,
  locale: Locale,
): string => (locale === 'fr' ? context.meta.frProjectName : context.meta.zhPlanName)
