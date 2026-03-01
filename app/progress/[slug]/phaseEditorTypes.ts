import type { AlertTone } from '@/components/AlertDialog'
import type {
  InspectionStatus,
  IntervalSide,
  LevelCrossingSide,
  PhaseDTO,
  PhaseDefinitionDTO,
  PhaseMeasure,
  RoadSectionDTO,
} from '@/lib/progressTypes'
import type { WorkflowBinding, WorkflowLayerTemplate } from '@/lib/progressWorkflow'

export interface PhaseEditorProps {
  road: RoadSectionDTO
  initialPhases: PhaseDTO[]
  phaseDefinitions: PhaseDefinitionDTO[]
  workflows: WorkflowBinding[]
  locationRoadOptions?: RoadSectionDTO[]
  canManage: boolean
  canInspect: boolean
  canViewInspection: boolean
}

export type Status = 'pending' | 'scheduled' | 'submitted' | 'inProgress' | 'approved' | 'nonDesign'

export type InspectionSlice = {
  phaseId: number
  intervalId?: number | null
  side: IntervalSide
  startPk: number
  endPk: number
  locationRoadId?: number | null
  levelCrossingSide?: LevelCrossingSide | null
  status: InspectionStatus
  updatedAt: number
}

export type LatestPointInspection = {
  phaseId: number
  intervalId?: number | null
  phaseName?: string | null
  layerId?: string | null
  layerName?: string | null
  checkId?: string | null
  checkName?: string | null
  side: IntervalSide
  levelCrossingSide?: LevelCrossingSide | null
  startPk: number
  endPk: number
  locationRoadId?: number | null
  status: InspectionStatus
  updatedAt: number
}

export interface Segment {
  intervalId?: number | null
  start: number
  end: number
  status: Status
  layers?: string[]
  spec?: string | null
  billQuantity?: number | null
  locationRoadId?: number | null
  levelCrossingSide?: LevelCrossingSide | null
  workflow?: WorkflowBinding
  workflowLayers?: WorkflowLayerTemplate[]
  workflowTypeOptions?: string[]
  pointHasSides: boolean
}

export interface Side {
  label: string
  segments: Segment[]
}

export interface LinearSide {
  label: string
  segments: Segment[]
  designTotal: number
}

export interface LinearView {
  left: LinearSide
  right: LinearSide
  total: number
}

export interface PointView {
  min: number
  max: number
  points: {
    intervalId?: number
    startPk: number
    endPk: number
    side: IntervalSide
    spec?: string | null
    billQuantity?: number | null
    locationRoadId?: number | null
    levelCrossingSide?: LevelCrossingSide | null
    layers?: string[]
  }[]
}

export interface SelectedSegment {
  phase: string
  phaseId: number
  intervalId?: number | null
  measure: PhaseMeasure
  layers: string[]
  checks: string[]
  side: IntervalSide
  sideLabel: string
  start: number
  end: number
  spec?: string | null
  billQuantity?: number | null
  locationRoadId?: number | null
  levelCrossingSide?: LevelCrossingSide | null
  workflow?: WorkflowBinding
  workflowLayers?: WorkflowLayerTemplate[]
  workflowTypeOptions?: string[]
  pointHasSides: boolean
}

export type AlertDialogState = {
  title: string
  description?: string
  tone?: AlertTone
  actionLabel?: string
  cancelLabel?: string
  onAction?: () => void
  onCancel?: () => void
}

export type SideBooking = {
  left: boolean
  right: boolean
  both: boolean
  lockedSide: IntervalSide | null
}

export type InspectionSubmitBatch = {
  phaseId: number
  intervalId?: number | null
  side: IntervalSide
  startPk: number
  endPk: number
  layers: string[]
  checks: string[]
  types: string[]
  remark?: string
  appointmentDate?: string
}

export type InspectionEntrySubmitPayload = {
  roadId: number
  locationRoadId?: number | null
  levelCrossingSide?: LevelCrossingSide | null
  phaseId: number
  intervalId?: number | null
  side: IntervalSide
  startPk: number
  endPk: number
  layerName: string
  checkName: string
  types: string[]
  remark?: string
  appointmentDate?: string
  status: InspectionStatus
  submissionNumber?: number | null
}

export type WorkflowStatusMaps = {
  checkStatus: Map<string, InspectionStatus>
  checkStatusBySide: Map<string, { LEFT?: InspectionStatus; RIGHT?: InspectionStatus }>
}
