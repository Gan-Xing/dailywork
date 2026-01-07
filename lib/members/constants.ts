import type { PermissionStatus } from '@/types/members'

export type ColumnKey =
  | 'sequence'
  | 'name'
  | 'username'
  | 'gender'
  | 'nationality'
  | 'phones'
  | 'joinDate'
  | 'birthDate'
  | 'position'
  | 'employmentStatus'
  | 'terminationDate'
  | 'terminationReason'
  | 'roles'
  | 'project'
  | 'team'
  | 'chineseSupervisor'
  | 'contractNumber'
  | 'contractType'
  | 'contractStartDate'
  | 'contractEndDate'
  | 'salaryCategory'
  | 'prime'
  | 'baseSalary'
  | 'netMonthly'
  | 'maritalStatus'
  | 'childrenCount'
  | 'cnpsNumber'
  | 'cnpsDeclarationCode'
  | 'provenance'
  | 'frenchName'
  | 'idNumber'
  | 'passportNumber'
  | 'educationAndMajor'
  | 'certifications'
  | 'domesticMobile'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'redBookValidYears'
  | 'cumulativeAbroadYears'
  | 'birthplace'
  | 'residenceInChina'
  | 'medicalHistory'
  | 'healthStatus'
  | 'createdAt'
  | 'updatedAt'
  | 'tags'
  | 'actions'

export type SortOrder = 'asc' | 'desc'
export type SortField = Exclude<ColumnKey, 'sequence' | 'actions'>

export type TemplateColumnKey =
  | 'name'
  | 'username'
  | 'password'
  | 'gender'
  | 'nationality'
  | 'phones'
  | 'joinDate'
  | 'birthDate'
  | 'position'
  | 'employmentStatus'
  | 'terminationDate'
  | 'terminationReason'
  | 'roles'
  | 'project'
  | 'team'
  | 'chineseSupervisor'
  | 'contractNumber'
  | 'contractType'
  | 'contractStartDate'
  | 'contractEndDate'
  | 'salaryCategory'
  | 'prime'
  | 'baseSalary'
  | 'netMonthly'
  | 'maritalStatus'
  | 'childrenCount'
  | 'cnpsNumber'
  | 'cnpsDeclarationCode'
  | 'provenance'
  | 'emergencyContact'
  | 'frenchName'
  | 'idNumber'
  | 'passportNumber'
  | 'educationAndMajor'
  | 'certifications'
  | 'domesticMobile'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'redBookValidYears'
  | 'cumulativeAbroadYears'
  | 'birthplace'
  | 'residenceInChina'
  | 'medicalHistory'
  | 'healthStatus'
  | 'tags'

export type ImportErrorCode =
  | 'missing_name'
  | 'missing_username'
  | 'missing_password'
  | 'duplicate_username'
  | 'duplicate_identity'
  | 'username_exists'
  | 'invalid_gender'
  | 'invalid_phone'
  | 'invalid_contract_type'
  | 'invalid_base_salary_unit'
  | 'invalid_status'
  | 'invalid_join_date'
  | 'missing_birth_date'
  | 'invalid_birth_date'
  | 'missing_termination_date'
  | 'invalid_termination_date'
  | 'missing_termination_reason'
  | 'invalid_project'
  | 'invalid_chinese_supervisor'
  | 'missing_team_supervisor'
  | 'duplicate_contract_number'
  | 'contract_number_exists'
  | 'role_not_found'

export type ImportError = { row: number; code: ImportErrorCode; value?: string }

export const MEMBER_COLUMN_STORAGE_KEY = 'member-visible-columns'
export const MEMBER_FILTER_STORAGE_KEY = 'member-filters-v2'
export const MEMBER_SEARCH_STORAGE_KEY = 'member-search-keyword'
export const defaultVisibleColumns: ColumnKey[] = [
  'sequence',
  'name',
  'phones',
  'position',
  'project',
  'team',
  'contractNumber',
  'contractStartDate',
  'contractEndDate',
  'tags',
  'actions',
]
export const memberColumnOrder: ColumnKey[] = [
  'sequence',
  'name',
  'username',
  'gender',
  'nationality',
  'phones',
  'joinDate',
  'birthDate',
  'position',
  'employmentStatus',
  'terminationDate',
  'terminationReason',
  'roles',
  'tags',
  'project',
  'team',
  'chineseSupervisor',
  'contractNumber',
  'contractType',
  'contractStartDate',
  'contractEndDate',
  'salaryCategory',
  'prime',
  'baseSalary',
  'netMonthly',
  'maritalStatus',
  'childrenCount',
  'cnpsNumber',
  'cnpsDeclarationCode',
  'provenance',
  'frenchName',
  'idNumber',
  'passportNumber',
  'educationAndMajor',
  'certifications',
  'domesticMobile',
  'emergencyContactName',
  'emergencyContactPhone',
  'redBookValidYears',
  'cumulativeAbroadYears',
  'birthplace',
  'residenceInChina',
  'medicalHistory',
  'healthStatus',
  'createdAt',
  'updatedAt',
  'actions',
]
export const exportableColumnOrder = memberColumnOrder.filter((key) => key !== 'actions')
export const defaultSortStack: Array<{ field: SortField; order: SortOrder }> = [
  { field: 'createdAt', order: 'desc' },
]
export const memberTemplateColumns: TemplateColumnKey[] = [
  'name',
  'username',
  'password',
  'gender',
  'nationality',
  'phones',
  'tags',
  'joinDate',
  'birthDate',
  'position',
  'employmentStatus',
  'terminationDate',
  'terminationReason',
  'roles',
  'project',
  'team',
  'chineseSupervisor',
  'contractNumber',
  'contractType',
  'contractStartDate',
  'contractEndDate',
  'salaryCategory',
  'prime',
  'baseSalary',
  'netMonthly',
  'maritalStatus',
  'childrenCount',
  'cnpsNumber',
  'cnpsDeclarationCode',
  'provenance',
  'emergencyContact',
  'frenchName',
  'idNumber',
  'passportNumber',
  'educationAndMajor',
  'certifications',
  'domesticMobile',
  'emergencyContactName',
  'emergencyContactPhone',
  'redBookValidYears',
  'cumulativeAbroadYears',
  'birthplace',
  'residenceInChina',
  'medicalHistory',
  'healthStatus',
]
const chineseOnlyTemplateColumns = new Set<TemplateColumnKey>([
  'frenchName',
  'idNumber',
  'passportNumber',
  'educationAndMajor',
  'certifications',
  'domesticMobile',
  'redBookValidYears',
  'cumulativeAbroadYears',
  'birthplace',
  'residenceInChina',
  'medicalHistory',
  'healthStatus',
])
export const memberTemplateColumnsExpat = memberTemplateColumns.filter(
  (key) => !chineseOnlyTemplateColumns.has(key),
)
export const REQUIRED_IMPORT_COLUMNS: TemplateColumnKey[] = ['name', 'birthDate']
export const PHONE_PATTERN = /^[+\d][\d\s-]{4,}$/
export const EMPTY_FILTER_VALUE = '__EMPTY__'
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100, 500]
export const PERMISSION_STATUS_OPTIONS: PermissionStatus[] = ['ACTIVE', 'ARCHIVED']
