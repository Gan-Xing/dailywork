import type { MachineAsset } from '@/types/machines'

export type FuelSourceType = 'TANK' | 'TRUCK'

export type FuelSource = {
  id: number
  type: FuelSourceType
  code: string
  name: string
  machineId: number | null
  isActive: boolean
  machine?: {
    id: number
    assetNumber: string
    assetName: string | null
    alias: string | null
    plateNumber: string | null
  } | null
  createdAt: string
  updatedAt: string
}

export type MachineFuelEvent = {
  id: number
  dailyLogId: number
  fuelSourceId: number
  amount: number
  note: string | null
  createdAt: string
}

export type MachineDailyLog = {
  id: number
  machineId: number
  logDate: string
  usageStatus: string | null
  team: string | null
  teamKey: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  projectId: number | null
  operatorId: number | null
  operatorName: string | null
  workContent: string | null
  fuelRemainingEnd: number | null
  dailyDepreciation: number | null
  meta?: unknown
  fuelEvents: MachineFuelEvent[]
  createdAt: string
  updatedAt: string
}

export type MachineLogCard = {
  machine: MachineAsset
  log: MachineDailyLog | null
  prevFuelRemainingEnd: number | null
  fuelAddedTotal: number
  fuelConsumed: number | null
}

export type ProjectOption = {
  id: number
  name: string
  code: string | null
  isActive: boolean
}

export type UserOption = {
  id: number
  username: string
  name: string | null
  nationality: string | null
  label: string
}

export type TeamSupervisorOption = {
  id: number
  team: string
  teamZh: string | null
  teamKey: string
  supervisorId: number
  supervisorLabel: string
  project: ProjectOption | null
}

export type MachineLogsPageData = {
  date: string
  machines: MachineAsset[]
  logs: MachineDailyLog[]
  prevFuelByMachineId: Record<string, number | null>
  fuelSources: FuelSource[]
  options: {
    teamSupervisors: TeamSupervisorOption[]
    supervisors: UserOption[]
    operators: UserOption[]
    projects: ProjectOption[]
  }
}

export type MachineLogGroupBy = 'none' | 'category' | 'supervisor' | 'team' | 'equipmentType'

export type MachineLogEffectiveBinding = {
  sourceDate: string | null
  isFromToday: boolean
  team: string | null
  teamKey: string | null
  chineseSupervisorId: number | null
  chineseSupervisorName: string | null
  projectId: number | null
  operatorId: number | null
  operatorName: string | null
}

export type MachineLogGroupSummary = {
  groupBy: MachineLogGroupBy
  groupKey: string
  groupLabel: string
  machineCount: number
  filledCount: number
  missingCount: number
  fuelAddedTotal: number
  fuelConsumedTotal: number | null
  dailyDepreciationTotal: number
  issues: {
    negativeFuelConsumedCount: number
    missingFuelRemainingEndCount: number
  }
}

export type MachineLogsSummaryPageData = {
  date: string
  locale: 'fr' | 'zh'
  groupBy: MachineLogGroupBy
  mine: boolean
  projectId: number | null
  groups: MachineLogGroupSummary[]
  options: {
    projects: ProjectOption[]
  }
}

export type MachineLogsGroupPageData = {
  date: string
  locale: 'fr' | 'zh'
  groupBy: MachineLogGroupBy
  groupKey: string
  groupLabel: string
  mine: boolean
  projectId: number | null
  summary: MachineLogGroupSummary
  machines: MachineAsset[]
  logs: MachineDailyLog[]
  prevFuelByMachineId: Record<string, number | null>
  effectiveByMachineId: Record<string, MachineLogEffectiveBinding>
  fuelSources: FuelSource[]
  options: MachineLogsPageData['options']
}

export type FuelSourceDailyRow = {
  fuelSource: FuelSource
  received: number | null
  remainingEnd: number | null
  prevRemainingEnd: number | null
  dispensed: number
  expectedEnd: number | null
  delta: number | null
}

export type FuelSourceDailyPageData = {
  date: string
  rows: FuelSourceDailyRow[]
}
