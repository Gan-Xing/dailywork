import type { PhaseMeasure } from '@/lib/progressTypes'

export type PhasePriceMap = Record<number, number | null>

const DEFAULT_PRICES: Record<PhaseMeasure, number> = {
  LINEAR: 360,
  POINT: 1500,
}

export function resolvePhaseUnitPrice(
  definitionId: number | undefined,
  measure: PhaseMeasure,
  overrides?: PhasePriceMap,
) {
  if (definitionId && overrides) {
    const manual = overrides[definitionId]
    if (typeof manual === 'number') {
      return manual
    }
  }
  return DEFAULT_PRICES[measure]
}

export function getPhaseUnitPrice(
  definitionId: number | undefined,
  measure: PhaseMeasure,
  overrides?: PhasePriceMap,
) {
  return resolvePhaseUnitPrice(definitionId, measure, overrides)
}
