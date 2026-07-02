import type { Locale, LocalizedString } from './index'

type RoadDictionaryEntry = {
  slug: RoadSlug
  zh: string
  fr: string
}

export const ROAD_SLUGS = {
  BONDOUKOU_UNIVERSITY: 'bondoukou-university',
  TANDA_TRAVERSEE: 'tanda-traversee',
  TANDA_VOIE_1: 'tanda-voie1',
  TANDA_VOIE_2: 'tanda-voie2',
  TANDA_VOIE_3A: 'tanda-voie3a',
  TANDA_VOIE_3BC: 'tanda-voie3bc',
  TANDA_VOIE_5A: 'tanda-voie5a',
  TANDA_VOIE_5B: 'tanda-voie5b',
  TANDA_VOIE_5C: 'tanda-voie5c',
  TANDA_VOIE_7: 'tanda-voie7',
  AGNIBILEKROU_VOIE_1: 'agnibilekrou-voie1',
  AGNIBILEKROU_VOIE_2A: 'agnibilekrou-voie2a',
  LEVEL_CROSSING: 'level-crossing',
  PREFABRICATED_STRUCTURE: 'prefabricated-structure',
} as const

export type RoadSlug = (typeof ROAD_SLUGS)[keyof typeof ROAD_SLUGS]

export const TANDA_ROAD_SLUGS = [
  ROAD_SLUGS.TANDA_TRAVERSEE,
  ROAD_SLUGS.TANDA_VOIE_1,
  ROAD_SLUGS.TANDA_VOIE_2,
  ROAD_SLUGS.TANDA_VOIE_3A,
  ROAD_SLUGS.TANDA_VOIE_3BC,
  ROAD_SLUGS.TANDA_VOIE_5A,
  ROAD_SLUGS.TANDA_VOIE_5B,
  ROAD_SLUGS.TANDA_VOIE_5C,
  ROAD_SLUGS.TANDA_VOIE_7,
] as const

const roadNameEntries: RoadDictionaryEntry[] = [
  {
    slug: ROAD_SLUGS.BONDOUKOU_UNIVERSITY,
    zh: '邦杜库大学城路',
    fr: 'BdK Univ.',
  },
  {
    slug: ROAD_SLUGS.TANDA_TRAVERSEE,
    zh: '丹达穿城路',
    fr: 'Tanda TC',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_1,
    zh: '丹达1号路',
    fr: 'Tanda 1',
  },
  {
    slug: ROAD_SLUGS.AGNIBILEKROU_VOIE_1,
    zh: '阿尼比莱克鲁1号路',
    fr: 'Agnibilékrou 1',
  },
  {
    slug: ROAD_SLUGS.AGNIBILEKROU_VOIE_2A,
    zh: '阿尼比莱克鲁2A路',
    fr: 'Agnibilékrou 2A',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_2,
    zh: '丹达2号路',
    fr: 'Tanda 2',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_3A,
    zh: '丹达3A路',
    fr: 'Tanda 3A',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_3BC,
    zh: '丹达3BC路',
    fr: 'Tanda 3BC',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_5A,
    zh: '丹达5A路',
    fr: 'Tanda 5A',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_5B,
    zh: '丹达5B路',
    fr: 'Tanda 5B',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_5C,
    zh: '丹达5C路',
    fr: 'Tanda 5C',
  },
  {
    slug: ROAD_SLUGS.TANDA_VOIE_7,
    zh: '丹达7号路',
    fr: 'Tanda 7',
  },
  {
    slug: ROAD_SLUGS.LEVEL_CROSSING,
    zh: '平交路口',
    fr: 'Amorce',
  },
  {
    slug: ROAD_SLUGS.PREFABRICATED_STRUCTURE,
    zh: '结构物预制',
    fr: 'Structure préfabriquée',
  },
]

const labelsBySlug: Record<string, LocalizedString> = {}
const labelsByZh: Record<string, LocalizedString> = {}

roadNameEntries.forEach((entry) => {
  if (process.env.NODE_ENV !== 'production') {
    if (!entry.zh.trim() || !entry.fr.trim()) {

      console.warn(`Road dictionary entry missing translation for ${entry.slug}`)
    }
  }
  const labels: LocalizedString = { fr: entry.fr, zh: entry.zh }
  labelsBySlug[entry.slug] = labels
  labelsByZh[entry.zh] = labels
})

const normalize = (value?: string) => (value ? value.trim() : '')

const deriveIndexedRoadLabels = (
  normalizedName: string,
  pattern: RegExp,
  frPrefix: string,
): LocalizedString | null => {
  const match = normalizedName.match(pattern)
  if (!match) return null

  const suffix = match[1].trim().replace(/号$/, '')
  if (!suffix) return null

  return {
    zh: normalizedName,
    fr: `${frPrefix} ${suffix}`,
  }
}

const deriveRoadLabels = (name?: string): LocalizedString | null => {
  const normalizedName = normalize(name)
  if (!normalizedName) return null

  const bondoukouLabels = deriveIndexedRoadLabels(normalizedName, /^邦杜库(.+)路$/, 'Bondoukou')
  if (bondoukouLabels) return bondoukouLabels

  const agnibilekrouLabels = deriveIndexedRoadLabels(
    normalizedName,
    /^阿尼比莱克鲁(.+)路$/,
    'Agnibilékrou',
  )
  if (agnibilekrouLabels) return agnibilekrouLabels

  return null
}

export const resolveRoadLabels = (input: {
  slug?: string
  name?: string
  labels?: LocalizedString
}): LocalizedString => {
  const slugLabel = input.slug ? labelsBySlug[input.slug] : undefined
  if (input.labels) {
    const providedZh = normalize(input.labels.zh)
    const providedFr = normalize(input.labels.fr)
    if (slugLabel) {
      return {
        zh: providedZh || slugLabel.zh,
        fr: providedFr && providedFr !== providedZh ? providedFr : slugLabel.fr,
      }
    }
    if (providedZh || providedFr) {
      const normalizedName = normalize(input.name)
      const candidateZh = providedZh || normalizedName || providedFr
      const candidateFr = providedFr && providedFr !== providedZh ? providedFr : ''
      if (candidateFr) {
        return {
          zh: candidateZh || candidateFr,
          fr: candidateFr,
        }
      }
      if (candidateZh) {
        return { zh: candidateZh, fr: candidateZh }
      }
    }
  }

  if (slugLabel) return slugLabel

  const nameLabel = input.name ? labelsByZh[normalize(input.name)] : undefined
  if (nameLabel) return nameLabel

  const derivedLabel = deriveRoadLabels(input.name)
  if (derivedLabel) return derivedLabel

  const fallback = normalize(input.name) || normalize(input.slug)
  return { fr: fallback, zh: fallback }
}

export const resolveRoadName = (
  input: { slug?: string; name?: string; labels?: LocalizedString },
  locale: Locale,
): string => {
  const labels = resolveRoadLabels(input)
  return labels[locale] || labels.zh || labels.fr
}

export const roadDictionary = roadNameEntries
