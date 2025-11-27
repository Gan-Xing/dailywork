import type { LocalizedString } from './i18n'

export interface RoadSectionPayload {
  slug: string
  name: string
  startPk: string
  endPk: string
}

export interface RoadSectionDTO extends RoadSectionPayload {
  id: number
  labels: LocalizedString
  createdAt: string
  updatedAt: string
}

export interface RoadSectionWithPhasesDTO extends RoadSectionDTO {
  phases: PhaseDTO[]
}

export interface RoadPhaseProgressDTO {
  phaseId: number
  phaseName: string
  phaseMeasure: PhaseMeasure
  designLength: number
  completedLength: number
  completedPercent: number
  updatedAt: string
}

export interface RoadSectionProgressDTO extends RoadSectionDTO {
  phases: RoadPhaseProgressDTO[]
}

export type InspectionStatus = 'PENDING' | 'IN_PROGRESS' | 'APPROVED'
export interface InspectionFilter {
  roadSlug?: string
  phaseId?: number
  status?: InspectionStatus[]
  side?: IntervalSide
  type?: string
  keyword?: string
  startDate?: string
  endDate?: string
  sortField?: 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface InspectionListItem {
  id: number
  roadId: number
  roadName: string
  roadSlug: string
  phaseId: number
  phaseName: string
  side: IntervalSide
  startPk: number
  endPk: number
  layers: string[]
  checks: string[]
  types: string[]
  status: InspectionStatus
  remark?: string
  createdBy?: { id: number; username: string } | null
  createdAt: string
  updatedAt: string
}

export interface InspectionListResponse {
  items: InspectionListItem[]
  total: number
  page: number
  pageSize: number
}

export type PhaseMeasure = 'LINEAR' | 'POINT'
export type IntervalSide = 'BOTH' | 'LEFT' | 'RIGHT'

export interface PhaseIntervalPayload {
  startPk: number
  endPk: number
  side: IntervalSide
}

export interface PhasePayload {
  phaseDefinitionId?: number
  name: string
  measure: PhaseMeasure
  intervals: PhaseIntervalPayload[]
  layerIds?: number[]
  checkIds?: number[]
  newLayers?: string[]
  newChecks?: string[]
}

export interface PhaseDTO extends PhasePayload {
  id: number
  designLength: number
  resolvedLayers: string[]
  resolvedChecks: string[]
  definitionName: string
  definitionId: number
  definitionLayerIds: number[]
  definitionCheckIds: number[]
  layerIds: number[]
  checkIds: number[]
  createdAt: string
  updatedAt: string
}

export interface PhaseDefinitionDTO {
  id: number
  name: string
  measure: PhaseMeasure
  defaultLayers: string[]
  defaultChecks: string[]
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LayerDefinitionDTO {
  id: number
  name: string
  isActive: boolean
}

export interface CheckDefinitionDTO {
  id: number
  name: string
  isActive: boolean
}

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
