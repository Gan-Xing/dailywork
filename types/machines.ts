export type MachineAsset = {
  id: number
  assetCategoryName: string | null
  assetNumber: string
  manufacturer: string | null
  assetName: string | null
  assetStatusName: string | null
  specModel: string | null
  equipmentTypeKey: string | null
  registrationDate: string | null
  originalValue: number | null
  usedMonths: number | null
  currentValue: number | null
  depreciatedMonths: number | null
  remainingMonths: number | null
  usageStatus: string | null
  alias: string | null
  plateNumber: string | null
  photoLinks: string[]
  uploadedPhotoCount: number
  photoCount: number
  meta?: unknown
  createdAt: string
  updatedAt: string
}

export type MachineImportRow = {
  row: number
  assetCategoryName?: string | null
  assetNumber?: string | null
  manufacturer?: string | null
  assetName?: string | null
  assetStatusName?: string | null
  specModel?: string | null
  equipmentTypeKey?: string | null
  registrationDate?: string | null
  originalValue?: number | null
  usedMonths?: number | null
  currentValue?: number | null
  depreciatedMonths?: number | null
  remainingMonths?: number | null
  usageStatus?: string | null
  alias?: string | null
  plateNumber?: string | null
  photoLinks?: string[] | null
}

export type MachineBulkPatch = {
  usageStatus?: string | null
  alias?: string | null
  plateNumber?: string | null
  assetCategoryName?: string | null
  manufacturer?: string | null
  assetName?: string | null
  assetStatusName?: string | null
  specModel?: string | null
  registrationDate?: string | null
  originalValue?: string | null
  usedMonths?: string | null
}
