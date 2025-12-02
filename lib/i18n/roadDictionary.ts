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

export const resolveRoadLabels = (input: {
  slug?: string
  name?: string
  labels?: LocalizedString
}): LocalizedString => {
  if (input.labels) {
    return input.labels
  }

  const slugLabel = input.slug ? labelsBySlug[input.slug] : undefined
  if (slugLabel) return slugLabel

  const nameLabel = input.name ? labelsByZh[normalize(input.name)] : undefined
  if (nameLabel) return nameLabel

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
