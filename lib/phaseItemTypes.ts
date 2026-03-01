import type { IntervalSide, LevelCrossingSide, PhaseMeasure } from '@/lib/progressTypes'

export type PhaseIntervalSortField =
  | 'project'
  | 'road'
  | 'phase'
  | 'startPk'
  | 'endPk'
  | 'side'
  | 'quantity'
  | 'display'
  | 'completed'
  | 'updatedAt'

export type PhaseIntervalSortOrder = 'asc' | 'desc'

export type PhaseIntervalSortSpec = {
  field: PhaseIntervalSortField
  order: PhaseIntervalSortOrder
}

export type PhaseIntervalBindingStatus = 'BOUND' | 'UNBOUND'
export type PhaseIntervalQuantitySource = 'MANUAL' | 'AUTO'

export type PhaseIntervalManagementRow = {
  intervalId: number
  phaseId: number
  phaseName: string
  spec: string | null
  measure: PhaseMeasure
  roadId: number
  roadName: string
  roadSlug: string
  locationRoadId?: number | null
  locationRoadName?: string | null
  locationRoadSlug?: string | null
  levelCrossingSide?: LevelCrossingSide | null
  projectId: number | null
  projectName: string | null
  projectCode: string | null
  startPk: number
  endPk: number
  side: IntervalSide
  quantity: number
  rawQuantity: number
  quantityOverridden: boolean
  completedPercent: number
  hasBoundItems: boolean
  updatedAt: string
}

export type PhaseIntervalFilter = {
  projectKeys?: string[]
  roadIds?: number[]
  phases?: string[]
  startPks?: number[]
  endPks?: number[]
  sides?: IntervalSide[]
  displays?: PhaseMeasure[]
  completions?: string[]
  updatedDates?: string[]
  bindings?: PhaseIntervalBindingStatus[]
  quantitySources?: PhaseIntervalQuantitySource[]
}

export type PhaseIntervalManagementFacet = {
  projects: Array<{
    key: string
    projectId: number | null
    projectName: string | null
    projectCode: string | null
  }>
  roads: Array<{
    id: number
    name: string
    slug: string
  }>
  phases: string[]
  startPks: number[]
  endPks: number[]
  sides: IntervalSide[]
  displays: PhaseMeasure[]
  completions: string[]
  updatedDates: string[]
  bindings: PhaseIntervalBindingStatus[]
  quantitySources: PhaseIntervalQuantitySource[]
}

export type PhaseIntervalManagementListResponse = {
  items: PhaseIntervalManagementRow[]
  total: number
  unfilteredTotal: number
  page: number
  pageSize: number
  facets: PhaseIntervalManagementFacet
}

export type IntervalBoundPhaseItemDTO = {
  inputId: number
  intervalId: number
  intervalSpec: string | null
  phaseItemId: number
  phaseItemName: string
  phaseItemSpec: string | null
  manualQuantity: number | null
  computedQuantity: number | null
  effectiveQuantity: number | null
  unit: string | null
  boqItemId: number | null
  boqCode: string | null
  updatedAt: string
}

export type PhaseItemFormulaDTO = {
  expression: string
  inputSchema: unknown | null
  unitString: string | null
}

export type PhaseItemBoqBindingDTO = {
  boqItemId: number
  code: string
  designationZh: string
  designationFr: string
  unit: string | null
  unitPrice: number | null
}

export type PhaseItemDTO = {
  id: number
  name: string
  spec: string | null
  measure: PhaseMeasure
  unitString: string | null
  description: string | null
  unitPrice: number | null
  formula: PhaseItemFormulaDTO | null
  boqBinding: PhaseItemBoqBindingDTO | null
}

export type PhaseIntervalDTO = {
  id: number
  startPk: number
  endPk: number
  side: IntervalSide
  levelCrossingSide?: LevelCrossingSide | null
  spec: string | null
  billQuantity: number | null
}

export type PhaseItemInputDTO = {
  id: number
  phaseItemId: number
  intervalId: number
  values: Record<string, number>
  computedQuantity: number | null
  manualQuantity: number | null
  computedError?: string | null
}

export type RoadPhaseQuantityDetailDTO = {
  phase: {
    id: number
    name: string
    measure: PhaseMeasure
    definitionId: number
    definitionName: string
  }
  road: {
    id: number
    name: string
    slug: string
    projectId: number | null
    projectName: string | null
    projectCode: string | null
  }
  intervals: PhaseIntervalDTO[]
  phaseItems: PhaseItemDTO[]
  inputs: PhaseItemInputDTO[]
  boqItems: PhaseItemBoqBindingDTO[]
}
