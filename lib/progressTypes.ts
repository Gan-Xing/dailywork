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
  commonLayers?: string[]
  commonChecks?: string[]
}

export interface PhaseDTO extends PhasePayload {
  id: number
  designLength: number
  commonLayers: string[]
  commonChecks: string[]
  createdAt: string
  updatedAt: string
}

export type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED'
export interface InspectionPayload {
  phaseId: number
  startPk: number
  endPk: number
  side: IntervalSide
  layers: string[]
  checks: string[]
  types: string[]
  remark?: string
}

export interface InspectionDTO extends InspectionPayload {
  id: number
  roadId: number
  status: InspectionStatus
  createdAt: string
  updatedAt: string
  createdBy: { id: number; username: string } | null
}
