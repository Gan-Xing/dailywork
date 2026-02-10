export type MachineColumnKey =
  | 'assetCategoryName'
  | 'assetNumber'
  | 'manufacturer'
  | 'assetName'
  | 'assetStatusName'
  | 'specModel'
  | 'equipmentTypeKey'
  | 'registrationDate'
  | 'originalValue'
  | 'usedMonths'
  | 'currentValue'
  | 'depreciatedMonths'
  | 'remainingMonths'
  | 'usageStatus'
  | 'alias'
  | 'plateNumber'
  | 'photoLinks'
  | 'createdAt'
  | 'updatedAt'
  | 'actions'

export type MachineSortOrder = 'asc' | 'desc'
export type MachineSortField = Exclude<MachineColumnKey, 'actions' | 'photoLinks'>

export const MACHINE_COLUMN_STORAGE_KEY = 'machine-visible-columns'
export const MACHINE_FILTER_STORAGE_KEY = 'machine-filters-v1'
export const MACHINE_SEARCH_STORAGE_KEY = 'machine-search-keyword'

export const EMPTY_MACHINE_FILTER_VALUE = '__empty__'

export const machineColumnOrder: MachineColumnKey[] = [
  'assetCategoryName',
  'assetNumber',
  'manufacturer',
  'assetName',
  'assetStatusName',
  'specModel',
  'equipmentTypeKey',
  'registrationDate',
  'originalValue',
  'usedMonths',
  'currentValue',
  'depreciatedMonths',
  'remainingMonths',
  'usageStatus',
  'alias',
  'plateNumber',
  'photoLinks',
  'createdAt',
  'updatedAt',
  'actions',
]

export const defaultVisibleMachineColumns: MachineColumnKey[] = [
  'assetNumber',
  'assetName',
  'assetCategoryName',
  'assetStatusName',
  'specModel',
  'equipmentTypeKey',
  'registrationDate',
  'originalValue',
  'currentValue',
  'remainingMonths',
  'actions',
]

export const defaultMachineSort: { field: MachineSortField; order: MachineSortOrder } = {
  field: 'assetNumber',
  order: 'asc',
}

export const defaultMachineSortStack: Array<{ field: MachineSortField; order: MachineSortOrder }> = [
  defaultMachineSort,
]

export const MACHINE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const

export const machineColumnGroups = [
  {
    key: 'base',
    columns: [
      'assetNumber',
      'assetName',
      'assetCategoryName',
      'manufacturer',
      'assetStatusName',
      'specModel',
      'equipmentTypeKey',
      'registrationDate',
    ],
  },
  {
    key: 'finance',
    columns: [
      'originalValue',
      'usedMonths',
      'currentValue',
      'depreciatedMonths',
      'remainingMonths',
    ],
  },
  {
    key: 'operations',
    columns: ['usageStatus', 'alias', 'plateNumber', 'photoLinks'],
  },
  {
    key: 'system',
    columns: ['createdAt', 'updatedAt'],
  },
] as const

export type MachineColumnGroupKey = (typeof machineColumnGroups)[number]['key']

export const MACHINE_REQUIRED_IMPORT_HEADERS = [
  '资产类别名称',
  '资产编号',
  '生产厂家',
  '资产名称',
  '资产状态名称',
  '规格型号',
  '登记日期',
  '资产原值',
  '使用月份',
] as const

export const MACHINE_OPTIONAL_IMPORT_HEADERS = [
  '设备类型',
  '资产现值',
  '已提月份',
  '剩余月份',
  '使用状态',
  '别名',
  '车牌',
  '照片链接',
] as const

export const MACHINE_TEMPLATE_HEADERS = [
  ...MACHINE_REQUIRED_IMPORT_HEADERS,
  ...MACHINE_OPTIONAL_IMPORT_HEADERS,
] as const

export type MachineRequiredImportHeader = (typeof MACHINE_REQUIRED_IMPORT_HEADERS)[number]
export type MachineOptionalImportHeader = (typeof MACHINE_OPTIONAL_IMPORT_HEADERS)[number]
export type MachineImportHeader =
  | MachineRequiredImportHeader
  | MachineOptionalImportHeader
