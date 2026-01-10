import type { IntervalSide, PhaseMeasure } from '@/lib/progressTypes'

export type RoadPhaseManagementRow = {
  phaseId: number
  phaseName: string
  definitionName: string
  measure: PhaseMeasure
  roadId: number
  roadName: string
  roadSlug: string
  projectId: number | null
  projectName: string | null
  projectCode: string | null
  intervalCount: number
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
