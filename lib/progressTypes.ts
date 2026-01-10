import type { LocalizedString } from './i18n'

export interface RoadSectionPayload {
  slug: string
  name: string
  startPk: string
  endPk: string
  projectId?: number | null
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
  phaseDefinitionId: number
  phaseMeasure: PhaseMeasure
  designLength: number
  completedLength: number
  completedPercent: number
  intervals: PhaseIntervalProgress[]
  inspections: { startPk: number; endPk: number; side: IntervalSide }[]
  updatedAt: string
}

export interface RoadSectionProgressDTO extends RoadSectionDTO {
  phases: RoadPhaseProgressDTO[]
}

export interface RoadPhaseProgressSummaryDTO {
  phaseId: number
  phaseName: string
  phaseMeasure: PhaseMeasure
  designLength: number
  completedLength: number
  completedPercent: number
  updatedAt: string
}

export interface RoadSectionProgressSummaryDTO extends RoadSectionDTO {
  phases: RoadPhaseProgressSummaryDTO[]
}

export type InspectionStatus = 'PENDING' | 'SCHEDULED' | 'SUBMITTED' | 'IN_PROGRESS' | 'APPROVED'
export type NamedLayer = { id: number; name: string }
export interface InspectionFilter {
  roadSlug?: string
  phaseId?: number
  phaseDefinitionId?: number
  status?: InspectionStatus[]
  side?: IntervalSide
  types?: string[]
  check?: string
  keyword?: string
  startDate?: string
  endDate?: string
  sortField?: 'appointmentDate' | 'road' | 'phase' | 'side' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  pageSize?: number
  groupByLayer?: boolean
}

export interface InspectionListItem {
  id: number
  roadId: number
  roadName: string
  roadSlug: string
  phaseId: number
  phaseName: string
  documentId?: number | null
  submissionId?: number | null
  submissionNumber?: number | null
  documentCode?: string | null
  submissionCode?: string | null
  side: IntervalSide
  startPk: number
  endPk: number
  layers: string[]
  checks: string[]
  types: string[]
  submissionOrder?: number | null
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
export interface SubmissionDTO {
  id: number
  code: string
  files: unknown[]
  remark?: string | null
  createdAt: string
  updatedAt: string
}

export interface InspectionEntryPayload {
  submissionId?: number | null // alias of documentId for backward compatibility
  submissionNumber?: number | null
  documentId?: number | null
  roadId: number
  phaseId: number
  side: IntervalSide
  startPk: number
  endPk: number
  layerId?: number | null
  layerName: string
  checkId?: number | null
  checkName: string
  types: string[]
  status?: InspectionStatus
  appointmentDate?: string
  remark?: string
  submissionOrder?: number | null
  submittedAt?: string
}

export interface InspectionEntryDTO extends InspectionEntryPayload {
  id: number
  submissionId?: number | null
  submissionCode?: string | null
  submissionNumber?: number | null
  documentCode?: string | null
  roadName: string
  roadSlug: string
  phaseName: string
  submittedBy?: { id: number; username: string } | null
  createdBy?: { id: number; username: string } | null
  createdAt: string
  updatedAt: string
  updatedBy?: { id: number; username: string } | null
}

export interface InspectionEntryFilter {
  ids?: number[]
  roadSlug?: string
  roadSlugs?: string[]
  documentId?: number
  documentIds?: number[]
  submissionNumber?: number
  submissionNumbers?: number[]
  phaseId?: number
  phaseDefinitionId?: number
  phaseDefinitionIds?: number[]
  status?: InspectionStatus[]
  side?: IntervalSide
  layerNames?: string[]
  types?: string[]
  checkId?: number
  checkName?: string
  checkNames?: string[]
  keyword?: string
  startDate?: string
  endDate?: string
  startPkFrom?: number
  startPkTo?: number
  sortField?:
    | 'appointmentDate'
    | 'road'
    | 'phase'
    | 'side'
    | 'range'
    | 'layers'
    | 'checks'
    | 'submissionOrder'
    | 'status'
    | 'submittedAt'
    | 'submittedBy'
    | 'createdBy'
    | 'createdAt'
    | 'updatedBy'
    | 'updatedAt'
    | 'remark'
  sortOrder?: 'asc' | 'desc'
  sort?: Array<{
    field:
      | 'appointmentDate'
      | 'road'
      | 'phase'
      | 'side'
      | 'range'
      | 'layers'
      | 'checks'
      | 'submissionOrder'
      | 'status'
      | 'submittedAt'
      | 'submittedBy'
      | 'createdBy'
      | 'createdAt'
      | 'updatedBy'
      | 'updatedAt'
      | 'remark'
    order: 'asc' | 'desc'
  }>
  page?: number
  pageSize?: number
}

export interface InspectionEntryListResponse {
  items: InspectionEntryDTO[]
  total: number
  page: number
  pageSize: number
}

export interface PhaseIntervalPayload {
  startPk: number
  endPk: number
  side: IntervalSide
  spec?: string | null
  layers?: string[]
  layerIds?: number[]
  billQuantity?: number | null
}

export interface PhaseIntervalProgress {
  startPk: number
  endPk: number
  side: IntervalSide
  spec: string | null
  layers?: string[]
  layerIds: number[]
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
  allowedLayers: NamedLayer[]
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
  defaultLayerObjects: NamedLayer[]
  defaultChecks: string[]
  isActive: boolean
  unitPrice: number | null
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
  status?: InspectionStatus
  submissionId?: number | null
  submissionNumber?: number | null
  documentId?: number | null
  submissionOrder?: number | null
  remark?: string
  appointmentDate?: string
  submittedAt?: string
}

export interface InspectionBulkPayload {
  phaseId?: number
  startPk?: number
  endPk?: number
  side?: IntervalSide
  layers?: string[]
  checks?: string[]
  types?: string[]
  status?: InspectionStatus
  submissionId?: number | null
  submissionNumber?: number | null
  documentId?: number | null
  submissionOrder?: number | null
  remark?: string
  appointmentDate?: string
  submittedAt?: string
}

export interface InspectionDTO extends InspectionPayload {
  id: number
  roadId: number
  status: InspectionStatus
  submissionId?: number | null
  submissionNumber?: number | null
  submissionCode?: string | null
  submissionOrder?: number | null
  appointmentDate?: string
  submittedAt: string
  submittedBy?: { id: number; username: string } | null
  createdAt: string
  updatedAt: string
  createdBy: { id: number; username: string } | null
  updatedBy?: { id: number; username: string } | null
}

export interface AggregatedPhaseProgress {
  id: string
  name: string
  measure: PhaseMeasure
  totalDesignLength: number
  totalCompletedLength: number
  completedPercent: number
  latestUpdatedAt: number
  roadNames: string[]
  spec?: string | null
  phaseDefinitionId?: number
}
