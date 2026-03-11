import { type Locale } from '@/lib/i18n'
import { localizeProgressList, localizeProgressTerm } from '@/lib/i18n/progressDictionary'
import { resolveRoadName } from '@/lib/i18n/roadDictionary'
import type { InspectionListItem } from '@/lib/progressTypes'
import type { SubmissionItem } from '@/types/documents'

export const MAX_SUBMISSION_ITEM_ROWS = 12

const formatPk = (value: number) => {
  if (!Number.isFinite(value)) return ''
  const km = Math.floor(value / 1000)
  const m = Math.round(value % 1000)
  return `PK${km}+${String(m).padStart(3, '0')}`
}

const formatPkRange = (startPk: number, endPk: number) => {
  const startText = formatPk(startPk)
  const endText = formatPk(endPk)
  return startText === endText ? startText : `${startText} → ${endText}`
}

const getRawLayers = (inspection: InspectionListItem) => {
  if (inspection.layers && inspection.layers.length) return inspection.layers
  const layer = (inspection as InspectionListItem & { layerName?: string | null }).layerName
  return layer ? [layer] : []
}

const getRawChecks = (inspection: InspectionListItem) => {
  if (inspection.checks && inspection.checks.length) return inspection.checks
  const check = (inspection as InspectionListItem & { checkName?: string | null }).checkName
  return check ? [check] : []
}

export const normalizeInspectionToken = (value: string) =>
  value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim()

export const splitInspectionTokens = (values: string[]) => {
  const result: string[] = []
  const seen = new Set<string>()
  values.forEach((value) => {
    const cleaned = normalizeInspectionToken(value)
    if (!cleaned) return
    const slashParts = cleaned.split(/\s+\/\s+/)
    slashParts.forEach((part) => {
      part
        .split(/[、，,\n]/)
        .map((item) => normalizeInspectionToken(item))
        .filter(Boolean)
        .forEach((token) => {
          const key = token.toLowerCase()
          if (seen.has(key)) return
          seen.add(key)
          result.push(token)
        })
    })
  })
  return result
}

export const sortInspectionTokens = (values: string[], locale: Locale = 'fr') =>
  [...values].sort((left, right) => left.localeCompare(right, locale, { sensitivity: 'base' }))

const normalizeIntervalSpec = (value?: string | null) => {
  if (typeof value !== 'string') return null
  const cleaned = normalizeInspectionToken(value).replace(/\s+/g, ' ')
  return cleaned || null
}

const appendSpecToPhaseLabel = (phaseLabel: string, intervalSpec?: string | null) => {
  const normalizedPhase = normalizeInspectionToken(phaseLabel)
  if (!normalizedPhase) return ''
  const spec = normalizeIntervalSpec(intervalSpec)
  if (!spec) return normalizedPhase
  const compactPhase = normalizedPhase.toLowerCase().replace(/\s+/g, ' ')
  const compactSpec = spec.toLowerCase().replace(/\s+/g, ' ')
  if (compactPhase.includes(compactSpec)) return normalizedPhase
  return `${normalizedPhase} ${spec}`
}

export const buildInspectionDescription = (inspection: InspectionListItem, locale: Locale = 'fr') => {
  const sideLabelMap: Record<string, string> = { LEFT: 'Gauche', RIGHT: 'Droite', BOTH: 'Deux côtés' }
  const sideLabel = sideLabelMap[inspection.side] ?? inspection.side
  const levelCrossingSideLabel = inspection.levelCrossingSide
    ? sideLabelMap[inspection.levelCrossingSide] ?? inspection.levelCrossingSide
    : null
  const combinedSide = levelCrossingSideLabel ? `${sideLabel} / Amorce:${levelCrossingSideLabel}` : sideLabel
  const rangeText = formatPkRange(inspection.startPk, inspection.endPk)
  const displayRoad = {
    slug: inspection.locationRoadSlug ?? inspection.roadSlug,
    name: inspection.locationRoadName ?? inspection.roadName,
  }
  const roadText = resolveRoadName(displayRoad, locale)
  const phaseText = appendSpecToPhaseLabel(
    localizeProgressTerm('phase', normalizeInspectionToken(inspection.phaseName), locale),
    inspection.intervalSpec,
  )
  const localisation = `${roadText} · ${phaseText} · ${combinedSide} · ${rangeText}`
  const rawLayers = sortInspectionTokens(splitInspectionTokens(getRawLayers(inspection)), locale)
  const rawChecks = sortInspectionTokens(splitInspectionTokens(getRawChecks(inspection)), locale)
  const layers = sortInspectionTokens(
    localizeProgressList('layer', rawLayers, locale, { phaseName: inspection.phaseName }),
    locale,
  )
  const checks = sortInspectionTokens(
    localizeProgressList('check', rawChecks, locale, { phaseName: inspection.phaseName }),
    locale,
  )
  const nature = [...layers, ...checks].filter(Boolean).join(' / ')
  return nature ? `${localisation}\n${nature}` : localisation
}

export const normalizeLegacyInspectionDesignation = (designation?: string | null) => {
  const raw = (designation ?? '').trim()
  if (!raw || !raw.includes(' · ') || !raw.includes('PK')) return designation ?? ''

  const lines = raw.split('\n')
  const headParts = lines[0]?.split(' · ').map((part) => part.trim()) ?? []
  if (headParts.length < 4) return designation ?? ''

  const [roadPart, phasePart, sidePart, ...rangeParts] = headParts
  const rangePart = rangeParts.join(' · ').trim()
  const rangeMatch = rangePart.match(/^(PK\d+\+\d{3})(?:\s*→\s*(PK\d+\+\d{3}))?$/i)
  if (!rangeMatch) return designation ?? ''
  const normalizedRangeStart = rangeMatch[1].toUpperCase()
  const normalizedRangeEnd = rangeMatch[2]?.toUpperCase()
  const normalizedRangePart =
    normalizedRangeEnd && normalizedRangeEnd !== normalizedRangeStart
      ? `${normalizedRangeStart} → ${normalizedRangeEnd}`
      : normalizedRangeStart

  const normalizedPhase = localizeProgressTerm('phase', normalizeInspectionToken(phasePart), 'fr')
  const normalizedRoad = resolveRoadName({ name: roadPart }, 'fr')
  const sideMap: Record<string, string> = {
    LEFT: 'Gauche',
    RIGHT: 'Droite',
    BOTH: 'Deux côtés',
    Gauche: 'Gauche',
    Droite: 'Droite',
    'Deux côtés': 'Deux côtés',
    左侧: 'Gauche',
    右侧: 'Droite',
    双侧: 'Deux côtés',
  }
  const normalizedSide = sideMap[sidePart] ?? sidePart
  const normalizedHead = [normalizedRoad, normalizedPhase, normalizedSide, normalizedRangePart].join(' · ')
  const normalizedBody = lines
    .slice(1)
    .map((line) => {
      if (!line.trim()) return line
      return line
        .split(/\s+\/\s+/)
        .map((item) => {
          const token = normalizeInspectionToken(item)
          if (!token) return token
          const checkToken = localizeProgressTerm('check', token, 'fr', { phaseName: phasePart })
          if (checkToken !== token) return checkToken
          return localizeProgressTerm('layer', token, 'fr', { phaseName: phasePart })
        })
        .filter(Boolean)
        .join(' / ')
    })

  return [normalizedHead, ...normalizedBody].join('\n')
}

export const buildInspectionDesignationKey = (designation?: string | null) => {
  const normalized = normalizeLegacyInspectionDesignation(designation)
    .split(/\r?\n/)
    .map((line) => normalizeInspectionToken(line).replace(/\s+/g, ' '))
    .filter(Boolean)

  if (!normalized.length) return ''

  const [head, ...body] = normalized
  if (!head.includes(' · ') || !head.includes('PK')) {
    return ''
  }

  const bodyTokens = sortInspectionTokens(
    splitInspectionTokens(body)
      .map((token) => {
        const normalizedToken = normalizeInspectionToken(token)
        if (!normalizedToken) return normalizedToken
        const checkToken = localizeProgressTerm('check', normalizedToken, 'fr')
        if (checkToken !== normalizedToken) return checkToken
        return localizeProgressTerm('layer', normalizedToken, 'fr')
      })
      .map((token) => normalizeInspectionToken(token))
      .filter(Boolean),
    'fr',
  ).map((token) => token.toLowerCase())

  return bodyTokens.length ? `${head.toLowerCase()}\n${bodyTokens.join(' / ')}` : head.toLowerCase()
}

export const isEmptySubmissionItem = (item?: Partial<SubmissionItem> | null) => {
  if (!item) return true
  const designation = normalizeInspectionToken(item.designation ?? '')
  const observation = normalizeInspectionToken(item.observation ?? '')
  return !designation && !observation
}

export const sanitizeSubmissionItems = (items: Array<Partial<SubmissionItem> | null | undefined>) =>
  items
    .filter((item): item is Partial<SubmissionItem> => Boolean(item))
    .map((item) => ({
      designation: normalizeLegacyInspectionDesignation(item.designation),
      quantity:
        typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : undefined,
      observation: normalizeInspectionToken(item.observation ?? '') || undefined,
    }))
    .filter((item) => !isEmptySubmissionItem(item))

export const dedupeSubmissionItems = (items: SubmissionItem[]) => {
  const seenInspectionKeys = new Set<string>()

  return items
    .map((item) => ({
      ...item,
      designation: normalizeLegacyInspectionDesignation(item.designation),
    }))
    .filter((item) => {
      const designationKey = buildInspectionDesignationKey(item.designation)
      const observation = normalizeInspectionToken(item.observation ?? '')
      const quantity = item.quantity ?? 1
      const isGeneratedInspectionItem = Boolean(designationKey) && !observation && quantity === 1

      if (!isGeneratedInspectionItem) return true
      if (seenInspectionKeys.has(designationKey)) return false

      seenInspectionKeys.add(designationKey)
      return true
    })
}

export type SubmissionAutoItem = SubmissionItem & {
  sourceInspectionIds: number[]
}

export const buildSubmissionAutoItemsFromInspections = (
  selectedInspections: InspectionListItem[],
  existingItems: SubmissionItem[] = [],
): SubmissionAutoItem[] => {
  const existingDesignationKeys = new Set(
    existingItems.map((item) => buildInspectionDesignationKey(item.designation)).filter(Boolean),
  )

  const grouped = new Map<
    string,
    {
      sample: InspectionListItem
      checks: Set<string>
      layers: Set<string>
      inspectionIds: Set<number>
    }
  >()

  selectedInspections.forEach((inspection) => {
    const rawLayers = getRawLayers(inspection)
    const layerKey = rawLayers.length ? rawLayers[0].trim().toLowerCase() : ''
    const locationKey = inspection.locationRoadId ?? inspection.roadId
    const key = [
      inspection.roadId,
      locationKey,
      inspection.phaseId,
      inspection.intervalId ?? 'null',
      inspection.side,
      inspection.levelCrossingSide ?? 'null',
      inspection.startPk,
      inspection.endPk,
      layerKey,
    ].join('|')

    const existing = grouped.get(key)
    if (existing) {
      getRawChecks(inspection).forEach((check) => existing.checks.add(check))
      rawLayers.forEach((layer) => existing.layers.add(layer))
      existing.inspectionIds.add(inspection.id)
      return
    }

    grouped.set(key, {
      sample: inspection,
      checks: new Set(getRawChecks(inspection)),
      layers: new Set(rawLayers),
      inspectionIds: new Set([inspection.id]),
    })
  })

  return Array.from(grouped.values())
    .map((group): SubmissionAutoItem | null => {
      const merged: InspectionListItem = {
        ...group.sample,
        layers: Array.from(group.layers),
        checks: Array.from(group.checks),
      }
      const designation = buildInspectionDescription(merged).trim()
      if (!designation) return null
      if (existingDesignationKeys.has(buildInspectionDesignationKey(designation))) return null
      return {
        designation,
        quantity: 1,
        observation: '',
        sourceInspectionIds: Array.from(group.inspectionIds).sort((left, right) => left - right),
      } satisfies SubmissionAutoItem
    })
    .filter((item): item is SubmissionAutoItem => Boolean(item))
}

export const chunkSubmissionItems = <T>(items: T[], size = MAX_SUBMISSION_ITEM_ROWS): T[][] => {
  if (!items.length) return []
  const chunkSize = Math.max(1, Math.floor(size))
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }
  return chunks
}
