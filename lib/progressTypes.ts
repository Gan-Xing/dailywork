export interface RoadSectionPayload {
  slug: string
  name: string
  startPk: string
  endPk: string
}

export interface RoadSectionDTO extends RoadSectionPayload {
  id: number
  createdAt: string
  updatedAt: string
}

export type PhaseMeasure = 'LINEAR' | 'POINT'
export type IntervalSide = 'BOTH' | 'LEFT' | 'RIGHT'

export interface PhaseIntervalPayload {
  startPk: number
  endPk: number
  side: IntervalSide
}

export interface PhasePayload {
  name: string
  measure: PhaseMeasure
  intervals: PhaseIntervalPayload[]
}

export interface PhaseDTO extends PhasePayload {
  id: number
  designLength: number
  createdAt: string
  updatedAt: string
}
