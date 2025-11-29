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

export type InspectionStatus = 'PENDING' | 'SCHEDULED' | 'SUBMITTED' | 'IN_PROGRESS' | 'APPROVED'
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
  appointmentDate?: string
  submittedAt: string
  submittedBy?: { id: number; username: string } | null
  createdBy?: { id: number; username: string } | null
  createdAt: string
  updatedAt: string
  updatedBy?: { id: number; username: string } | null
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
  spec?: string | null
  billQuantity?: number | null
}

export interface PhasePayload {
  phaseDefinitionId?: number
  name: string
  measure: PhaseMeasure
  pointHasSides?: boolean
  intervals: PhaseIntervalPayload[]
  layerIds?: number[]
  checkIds?: number[]
  newLayers?: string[]
  newChecks?: string[]
}

export interface PhaseDTO extends PhasePayload {
  id: number
  pointHasSides: boolean
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
  pointHasSides: boolean
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
  appointmentDate?: string
}

export interface InspectionDTO extends InspectionPayload {
  id: number
  roadId: number
  status: InspectionStatus
  appointmentDate?: string
  submittedAt: string
  submittedBy?: { id: number; username: string } | null
  createdAt: string
  updatedAt: string
  createdBy: { id: number; username: string } | null
  updatedBy?: { id: number; username: string } | null
}
