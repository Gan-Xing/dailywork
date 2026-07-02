import { ROAD_SLUGS, resolveRoadLabels, type RoadSlug } from '@/lib/i18n/roadDictionary'

type RoadAliasEntry = {
  raw: string
  slug: RoadSlug
}

export type ResolvedTandaAttachmentRoad = {
  raw: string
  normalizedRaw: string
  slug: RoadSlug
  zh: string
  fr: string
}

const rawRoadAliases: RoadAliasEntry[] = [
  { raw: 'VOIE 1', slug: ROAD_SLUGS.TANDA_VOIE_1 },
  { raw: 'Voie 1', slug: ROAD_SLUGS.TANDA_VOIE_1 },
  { raw: 'Voie1', slug: ROAD_SLUGS.TANDA_VOIE_1 },
  { raw: 'VOIE1', slug: ROAD_SLUGS.TANDA_VOIE_1 },

  { raw: 'VOIE 2', slug: ROAD_SLUGS.TANDA_VOIE_2 },
  { raw: 'Voie 2', slug: ROAD_SLUGS.TANDA_VOIE_2 },
  { raw: 'Prolongement voie 2', slug: ROAD_SLUGS.TANDA_VOIE_2 },

  { raw: 'VOIE 3A', slug: ROAD_SLUGS.TANDA_VOIE_3A },
  { raw: 'Voie 3A', slug: ROAD_SLUGS.TANDA_VOIE_3A },

  { raw: 'VOIE 3BC', slug: ROAD_SLUGS.TANDA_VOIE_3BC },
  { raw: 'VOIE 3B-C', slug: ROAD_SLUGS.TANDA_VOIE_3BC },
  { raw: 'Voie 3BC', slug: ROAD_SLUGS.TANDA_VOIE_3BC },
  { raw: 'Voie 3B-C', slug: ROAD_SLUGS.TANDA_VOIE_3BC },
  { raw: 'Voie 3-B C', slug: ROAD_SLUGS.TANDA_VOIE_3BC },
  { raw: 'Voie 3b-3c', slug: ROAD_SLUGS.TANDA_VOIE_3BC },
  { raw: 'Voie 3b-c', slug: ROAD_SLUGS.TANDA_VOIE_3BC },

  { raw: 'VOIE 5A', slug: ROAD_SLUGS.TANDA_VOIE_5A },
  { raw: 'Voie 5A', slug: ROAD_SLUGS.TANDA_VOIE_5A },
  { raw: 'Voie 5 A', slug: ROAD_SLUGS.TANDA_VOIE_5A },

  { raw: 'VOIE 5B', slug: ROAD_SLUGS.TANDA_VOIE_5B },
  { raw: 'Voie 5B', slug: ROAD_SLUGS.TANDA_VOIE_5B },
  { raw: 'Voie 5 B', slug: ROAD_SLUGS.TANDA_VOIE_5B },

  { raw: 'VOIE 5C', slug: ROAD_SLUGS.TANDA_VOIE_5C },
  { raw: 'Voie 5C', slug: ROAD_SLUGS.TANDA_VOIE_5C },
  { raw: 'Voie 5 C', slug: ROAD_SLUGS.TANDA_VOIE_5C },

  { raw: 'VOIE 7', slug: ROAD_SLUGS.TANDA_VOIE_7 },
  { raw: 'Voie 7', slug: ROAD_SLUGS.TANDA_VOIE_7 },

  { raw: 'LA TRAVERSEE', slug: ROAD_SLUGS.TANDA_TRAVERSEE },
  { raw: 'TRAVERSEE', slug: ROAD_SLUGS.TANDA_TRAVERSEE },
  { raw: 'Traversée', slug: ROAD_SLUGS.TANDA_TRAVERSEE },
  { raw: 'La traversée', slug: ROAD_SLUGS.TANDA_TRAVERSEE },
  { raw: 'Voie de la traversée', slug: ROAD_SLUGS.TANDA_TRAVERSEE },
]

export const normalizeTandaAttachmentRoadLabel = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')

const compactRoadLabel = (value: string) => normalizeTandaAttachmentRoadLabel(value).replace(/\s/g, '')

const roadAliasMap = new Map<string, RoadSlug>()

rawRoadAliases.forEach((entry) => {
  roadAliasMap.set(normalizeTandaAttachmentRoadLabel(entry.raw), entry.slug)
  roadAliasMap.set(compactRoadLabel(entry.raw), entry.slug)
})

export const resolveTandaAttachmentRoad = (
  value: string | null | undefined,
): ResolvedTandaAttachmentRoad | null => {
  if (!value?.trim()) return null

  const normalizedRaw = normalizeTandaAttachmentRoadLabel(value)
  const slug = roadAliasMap.get(normalizedRaw) ?? roadAliasMap.get(compactRoadLabel(value))
  if (!slug) return null

  const labels = resolveRoadLabels({ slug })
  return {
    raw: value,
    normalizedRaw,
    slug,
    zh: labels.zh,
    fr: labels.fr,
  }
}

