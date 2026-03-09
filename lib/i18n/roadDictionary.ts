import type { Locale, LocalizedString } from './index'

type RoadDictionaryEntry = {
  slug: string
  zh: string
  fr: string
}

const roadNameEntries: RoadDictionaryEntry[] = [
  {
    slug: 'bondoukou-university',
    zh: '邦杜库大学城路',
    fr: 'BdK Univ.',
  },
  {
    slug: 'tanda-traversee',
    zh: '丹达穿城路',
    fr: 'Tanda TC',
  },
  {
    slug: 'tanda-voie1',
    zh: '丹达1号路',
    fr: 'Tanda 1',
  },
  {
    slug: 'agnibilekrou-voie1',
    zh: '阿尼比莱克鲁1号路',
    fr: 'Agnibilékrou 1',
  },
  {
    slug: 'agnibilekrou-voie2a',
    zh: '阿尼比莱克鲁2A路',
    fr: 'Agnibilékrou 2A',
  },
  {
    slug: 'tanda-voie2',
    zh: '丹达2号路',
    fr: 'Tanda 2',
  },
  {
    slug: 'tanda-voie3a',
    zh: '丹达3A路',
    fr: 'Tanda 3A',
  },
  {
    slug: 'tanda-voie3bc',
    zh: '丹达3BC路',
    fr: 'Tanda 3BC',
  },
  {
    slug: 'tanda-voie5a',
    zh: '丹达5A路',
    fr: 'Tanda 5A',
  },
  {
    slug: 'tanda-voie5b',
    zh: '丹达5B路',
    fr: 'Tanda 5B',
  },
  {
    slug: 'tanda-voie5c',
    zh: '丹达5C路',
    fr: 'Tanda 5C',
  },
  {
    slug: 'tanda-voie7',
    zh: '丹达7号路',
    fr: 'Tanda 7',
  },
  {
    slug: 'level-crossing',
    zh: '平交路口',
    fr: 'Amorce',
  },
  {
    slug: 'prefabricated-structure',
    zh: '结构物预制',
    fr: 'Structure préfabriquée',
  },
]

const labelsBySlug: Record<string, LocalizedString> = {}
const labelsByZh: Record<string, LocalizedString> = {}

roadNameEntries.forEach((entry) => {
  if (process.env.NODE_ENV !== 'production') {
    if (!entry.zh.trim() || !entry.fr.trim()) {
      // eslint-disable-next-line no-console
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
