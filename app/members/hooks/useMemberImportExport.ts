import { useCallback, useMemo, useState } from 'react'

import { memberCopy, nationalityOptions, genderOptions, type EmploymentStatus } from '@/lib/i18n/members'
import {
  exportableColumnOrder,
  PHONE_PATTERN,
  REQUIRED_IMPORT_COLUMNS,
  type ImportError,
  type TemplateColumnKey,
  type ColumnKey,
} from '@/lib/members/constants'
import { normalizeTagsInput, parseBirthDateFromIdNumber } from '@/lib/members/utils'
import type { Member, Role } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UseMemberImportExportParams = {
  t: MemberCopy
  locale: keyof typeof memberCopy
  canCreateMember: boolean
  canViewMembers: boolean
  canAssignRole: boolean
  canDeleteMember: boolean
  rolesData: Role[]
  members: Member[]
  visibleColumns: ColumnKey[]
  columnLabels: Record<ColumnKey, string>
  templateColumns: TemplateColumnKey[]
  templateColumnLabels: Record<TemplateColumnKey, string>
  statusLabels: Record<EmploymentStatus, string>
  formatProfileText: (value?: string | null) => string
  formatProfileNumber: (value?: number | null) => string
  formatProfileList: (values?: string[] | null) => string
  formatSalary: (amount?: string | null, unit?: 'MONTH' | 'HOUR' | null, fallbackUnit?: 'MONTH' | 'HOUR' | null) => string
  findGenderLabel: (value: string | null) => string
  findNationalityLabel: (value: string | null) => string
  resolveRoleName: (role: { id: number; name: string }) => string
  loadData: () => Promise<void>
  setActionError: (value: string | null) => void
  setActionNotice: (value: string | null) => void
  skipChangeHistory?: boolean
}

export function useMemberImportExport({
  t,
  locale,
  canCreateMember,
  canViewMembers,
  canAssignRole,
  canDeleteMember,
  rolesData,
  members,
  visibleColumns,
  columnLabels,
  templateColumns,
  templateColumnLabels,
  statusLabels,
  formatProfileText,
  formatProfileNumber,
  formatProfileList,
  formatSalary,
  findGenderLabel,
  findNationalityLabel,
  resolveRoleName,
  loadData,
  setActionError,
  setActionNotice,
  skipChangeHistory,
}: UseMemberImportExportParams) {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)

  const importHeaderMap = useMemo(() => {
    const map = new Map<string, TemplateColumnKey>()
    const normalize = (value: string) => value.trim().toLowerCase()
    const add = (label: string, key: TemplateColumnKey) => {
      if (label) map.set(normalize(label), key)
    }
    const register = (copy: (typeof memberCopy)[keyof typeof memberCopy]) => {
      add(copy.form.name, 'name')
      add(copy.form.username, 'username')
      add(copy.form.password, 'password')
      add(copy.form.gender, 'gender')
      add(copy.form.nationality, 'nationality')
      add(copy.form.phones, 'phones')
      add(copy.form.tags, 'tags')
      add(copy.form.joinDate, 'joinDate')
      add(copy.form.birthDate, 'birthDate')
      add(copy.form.position, 'position')
      add(copy.form.status, 'employmentStatus')
      add(copy.form.terminationDate, 'terminationDate')
      add(copy.form.terminationReason, 'terminationReason')
      add(copy.form.roles, 'roles')
      add(copy.form.project, 'project')
      add(copy.form.team, 'team')
      add(copy.form.chineseSupervisor, 'chineseSupervisor')
      add(copy.form.contractNumber, 'contractNumber')
      add(copy.form.contractType, 'contractType')
      add(copy.form.contractStartDate, 'contractStartDate')
      add(copy.form.contractEndDate, 'contractEndDate')
      add(copy.form.salaryCategory, 'salaryCategory')
      add(copy.form.prime, 'prime')
      add(copy.form.baseSalary, 'baseSalary')
      add(copy.form.netMonthly, 'netMonthly')
      add(copy.form.maritalStatus, 'maritalStatus')
      add(copy.form.childrenCount, 'childrenCount')
      add(copy.form.cnpsNumber, 'cnpsNumber')
      add(copy.form.cnpsDeclarationCode, 'cnpsDeclarationCode')
      add(copy.form.provenance, 'provenance')
      add(copy.form.emergencyContact, 'emergencyContact')
      add(copy.form.frenchName, 'frenchName')
      add(copy.form.idNumber, 'idNumber')
      add(copy.form.passportNumber, 'passportNumber')
      add(copy.form.educationAndMajor, 'educationAndMajor')
      add(copy.form.certifications, 'certifications')
      add(copy.form.domesticMobile, 'domesticMobile')
      add(copy.form.emergencyContactName, 'emergencyContactName')
      add(copy.form.emergencyContactPhone, 'emergencyContactPhone')
      add(copy.form.redBookValidYears, 'redBookValidYears')
      add(copy.form.cumulativeAbroadYears, 'cumulativeAbroadYears')
      add(copy.form.birthplace, 'birthplace')
      add(copy.form.residenceInChina, 'residenceInChina')
      add(copy.form.medicalHistory, 'medicalHistory')
      add(copy.form.healthStatus, 'healthStatus')
    }
    register(memberCopy.zh)
    register(memberCopy.fr)
    return map
  }, [])

  const nationalityLookup = useMemo(() => {
    const map = new Map<string, string>()
    const normalize = (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[’']/g, "'")
        .replace(/\s+/g, ' ')
    nationalityOptions.forEach((option) => {
      map.set(normalize(option.key), option.key)
      map.set(normalize(option.label.zh), option.key)
      map.set(normalize(option.label.fr), option.key)
    })
    return map
  }, [])

  const genderLookup = useMemo(() => {
    const map = new Map<string, string>()
    const normalize = (value: string) => value.trim().toLowerCase()
    genderOptions.forEach((option) => {
      map.set(normalize(option.value), option.value)
      map.set(normalize(option.label.zh), option.value)
      map.set(normalize(option.label.fr), option.value)
    })
    map.set('male', '男')
    map.set('female', '女')
    map.set('m', '男')
    map.set('f', '女')
    return map
  }, [])

  const statusLookup = useMemo(() => {
    const map = new Map<string, EmploymentStatus>()
    const normalize = (value: string) => value.trim().toLowerCase()
    map.set('active', 'ACTIVE')
    map.set('on_leave', 'ON_LEAVE')
    map.set('on leave', 'ON_LEAVE')
    map.set('terminated', 'TERMINATED')
    map.set(normalize(memberCopy.zh.status.ACTIVE), 'ACTIVE')
    map.set(normalize(memberCopy.zh.status.ON_LEAVE), 'ON_LEAVE')
    map.set(normalize(memberCopy.zh.status.TERMINATED), 'TERMINATED')
    map.set(normalize(memberCopy.fr.status.ACTIVE), 'ACTIVE')
    map.set(normalize(memberCopy.fr.status.ON_LEAVE), 'ON_LEAVE')
    map.set(normalize(memberCopy.fr.status.TERMINATED), 'TERMINATED')
    return map
  }, [])

  const formatImportError = useCallback(
    (error: ImportError) => {
      let message = t.errors.importFailed
      switch (error.code) {
        case 'missing_name':
          message = t.errors.nameRequired
          break
        case 'missing_username':
          message = t.errors.usernameRequired
          break
        case 'missing_password':
          message = t.errors.passwordRequired
          break
        case 'duplicate_username':
          message = t.errors.importDuplicateUsername
          break
        case 'duplicate_identity':
          message = t.errors.importDuplicateIdentity
          break
        case 'username_exists':
          message = t.errors.importUsernameExists
          break
        case 'invalid_gender':
          message = t.errors.importInvalidGender
          break
        case 'invalid_phone':
          message = t.errors.importInvalidPhone
          break
        case 'invalid_contract_type':
          message = t.errors.importInvalidContractType
          break
        case 'invalid_base_salary_unit':
          message = t.errors.importInvalidBaseSalaryUnit
          break
        case 'invalid_status':
          message = t.errors.importInvalidStatus
          break
        case 'invalid_join_date':
          message = t.errors.importInvalidJoinDate
          break
        case 'missing_birth_date':
          message = t.errors.importMissingBirthDate
          break
        case 'invalid_birth_date':
          message = t.errors.importInvalidBirthDate
          break
        case 'missing_termination_date':
          message = t.errors.terminationDateRequired
          break
        case 'invalid_termination_date':
          message = t.errors.terminationDateInvalid
          break
        case 'missing_termination_reason':
          message = t.errors.terminationReasonRequired
          break
        case 'invalid_project':
          message = t.errors.importInvalidProject
          break
        case 'duplicate_contract_number':
          message = t.errors.importDuplicateContractNumber
          break
        case 'contract_number_exists':
          message = t.errors.importContractNumberExists
          break
        case 'role_not_found':
          message = t.errors.importRoleNotFound(error.value ?? '')
          break
        case 'invalid_chinese_supervisor':
          message = t.errors.importInvalidChineseSupervisor
          break
        case 'missing_team_supervisor':
          message = t.errors.importMissingTeamSupervisor
          break
        default:
          message = t.errors.importFailed
      }
      return t.feedback.importRowError(error.row, message)
    },
    [t],
  )

  const handleImportFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      if (!canCreateMember) {
        setActionError(t.errors.needMemberCreate)
        setActionNotice(null)
        return
      }
      setImporting(true)
      setActionError(null)
      setActionNotice(null)
      try {
        const XLSX = await import('xlsx')
        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        const sheetName = workbook.SheetNames[0]
        const worksheet = sheetName ? workbook.Sheets[sheetName] : null
        if (!worksheet) {
          throw new Error(t.errors.importInvalidFile)
        }
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          blankrows: false,
          defval: '',
        }) as unknown[][]
        if (!rows.length) {
          throw new Error(t.errors.importNoData)
        }
        const headerRow =
          rows[0]?.map((cell) => String(cell ?? '').replace(/^\uFEFF/, '').trim()) ?? []
        const headerKeys = headerRow.map((label) => {
          if (!label) return null
          return importHeaderMap.get(label.toLowerCase()) ?? null
        })
        const usedKeys = headerKeys.filter(Boolean) as TemplateColumnKey[]
        const missingRequired = REQUIRED_IMPORT_COLUMNS.filter((key) => !usedKeys.includes(key))
        if (missingRequired.length > 0) {
          throw new Error(t.errors.importMissingHeaders)
        }
        const errors: ImportError[] = []
        const prepared: Array<{
          row: number
          username?: string
          password?: string
          name?: string
          gender?: string | null
          nationality?: string | null
          phones: string[]
          tags?: string[] | null
          joinDate?: string | null
          birthDate?: string | null
          terminationDate?: string | null
          terminationReason?: string | null
          position?: string | null
          employmentStatus?: EmploymentStatus | null
          roleIds?: number[]
          team?: string | null
          contractNumber?: string | null
          contractType?: string | null
          contractStartDate?: string | null
          contractEndDate?: string | null
          salaryCategory?: string | null
          prime?: string | null
          baseSalary?: string | null
          netMonthly?: string | null
          maritalStatus?: string | null
          childrenCount?: number | string | null
          chineseSupervisor?: string | null
          cnpsNumber?: string | null
          cnpsDeclarationCode?: string | null
          provenance?: string | null
          emergencyContact?: string | null
          frenchName?: string | null
          idNumber?: string | null
          passportNumber?: string | null
          educationAndMajor?: string | null
          certifications?: string[] | string | null
          domesticMobile?: string | null
          emergencyContactName?: string | null
          emergencyContactPhone?: string | null
          redBookValidYears?: number | string | null
          cumulativeAbroadYears?: number | string | null
          birthplace?: string | null
          residenceInChina?: string | null
          medicalHistory?: string | null
          healthStatus?: string | null
        }> = []
        const seenUsernames = new Set<string>()

        const normalizeDate = (value: unknown) => {
          if (!value) return null
          if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10)
          }
          if (typeof value === 'number') {
            const parsed = XLSX.SSF.parse_date_code(value)
            if (parsed) {
              const month = String(parsed.m).padStart(2, '0')
              const day = String(parsed.d).padStart(2, '0')
              return `${parsed.y}-${month}-${day}`
            }
          }
          const text = String(value).trim()
          if (!text) return null
          const match = text.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/)
          if (match) {
            const [, year, month, day] = match
            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          }
          return null
        }

        const normalizePhones = (value: unknown) => {
          if (value == null) return []
          const text = String(value).trim()
          if (!text) return []
          return text
            .split(/[\/,，;]+/)
            .map((item) => item.trim())
            .filter(Boolean)
        }

        const normalizeList = (value: unknown) => {
          if (value == null) return []
          const text = String(value).trim()
          if (!text) return []
          return text
            .split(/[\/,，;\n]+/)
            .map((item) => item.trim())
            .filter(Boolean)
        }

        const normalizeNumber = (value: unknown) => {
          if (value == null) return null
          const text = String(value).trim()
          if (!text) return null
          const parsed = Number.parseInt(text, 10)
          return Number.isFinite(parsed) ? parsed : null
        }

        rows.slice(1).forEach((rowValues, index) => {
          const isEmpty = rowValues.every((cell) => !String(cell ?? '').trim())
          if (isEmpty) return
          const rowNumber = index + 2
          let hasJoinDateValue = false
          let hasBirthDateValue = false
          let hasTerminationDateValue = false
          const record: {
            row: number
            username?: string
            password?: string
            name?: string
            gender?: string | null
            nationality?: string | null
            phones: string[]
            tags?: string[] | null
            joinDate?: string | null
            birthDate?: string | null
            terminationDate?: string | null
            terminationReason?: string | null
            position?: string | null
            employmentStatus?: EmploymentStatus | null
            roleIds?: number[]
            project?: string | null
            team?: string | null
            contractNumber?: string | null
            contractType?: string | null
            contractStartDate?: string | null
            contractEndDate?: string | null
            salaryCategory?: string | null
            prime?: string | null
            baseSalary?: string | null
            netMonthly?: string | null
            maritalStatus?: string | null
            childrenCount?: number | string | null
            chineseSupervisor?: string | null
            cnpsNumber?: string | null
            cnpsDeclarationCode?: string | null
            provenance?: string | null
            emergencyContact?: string | null
            frenchName?: string | null
            idNumber?: string | null
            passportNumber?: string | null
            educationAndMajor?: string | null
            certifications?: string[] | string | null
            domesticMobile?: string | null
            emergencyContactName?: string | null
            emergencyContactPhone?: string | null
            redBookValidYears?: number | string | null
            cumulativeAbroadYears?: number | string | null
            birthplace?: string | null
            residenceInChina?: string | null
            medicalHistory?: string | null
            healthStatus?: string | null
          } = {
            row: rowNumber,
            phones: [],
          }
          headerKeys.forEach((key, columnIndex) => {
            if (!key) return
            const rawValue = rowValues[columnIndex]
            switch (key) {
              case 'name':
                record.name = String(rawValue ?? '').trim()
                break
              case 'username': {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  record.username = text
                }
                break
              }
              case 'password': {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  record.password = text
                }
                break
              }
              case 'gender': {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  record.gender = genderLookup.get(text.toLowerCase()) ?? text
                }
                break
              }
              case 'nationality': {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  const normalized = text
                    .toLowerCase()
                    .replace(/[’']/g, "'")
                    .replace(/\s+/g, ' ')
                  record.nationality = nationalityLookup.get(normalized) ?? text
                }
                break
              }
              case 'phones':
                record.phones = normalizePhones(rawValue)
                break
              case 'tags':
                record.tags = normalizeTagsInput(
                  Array.isArray(rawValue) ? rawValue : String(rawValue ?? ''),
                )
                break
              case 'joinDate':
                if (String(rawValue ?? '').trim()) {
                  hasJoinDateValue = true
                }
                record.joinDate = normalizeDate(rawValue)
                break
              case 'birthDate':
                if (String(rawValue ?? '').trim()) {
                  hasBirthDateValue = true
                }
                record.birthDate = normalizeDate(rawValue)
                break
              case 'position':
                record.position = String(rawValue ?? '').trim()
                break
              case 'employmentStatus': {
                const text = String(rawValue ?? '').trim()
                if (text) {
                  record.employmentStatus = statusLookup.get(text.toLowerCase()) ?? (text as EmploymentStatus)
                }
                break
              }
              case 'terminationDate':
                if (String(rawValue ?? '').trim()) {
                  hasTerminationDateValue = true
                }
                record.terminationDate = normalizeDate(rawValue)
                break
              case 'terminationReason':
                record.terminationReason = String(rawValue ?? '').trim()
                break
              case 'roles': {
                if (!canAssignRole) break
                const text = String(rawValue ?? '').trim()
                if (text) {
                  const names = text
                    .split(/[\/,，;]+/)
                    .map((item) => item.trim())
                    .filter(Boolean)
                  if (names.length) {
                    const roleIds = names.map((name) => rolesData.find((role) => role.name === name)?.id)
                    const missingRole = roleIds.find((id) => !id)
                    if (missingRole) {
                      errors.push({ row: rowNumber, code: 'role_not_found', value: text })
                    } else {
                      record.roleIds = roleIds.filter(Boolean) as number[]
                    }
                  }
                }
                break
              }
              case 'project':
                record.project = String(rawValue ?? '').trim()
                break
              case 'team':
                record.team = String(rawValue ?? '').trim()
                break
              case 'contractNumber':
                record.contractNumber = String(rawValue ?? '').trim()
                break
              case 'contractType':
                record.contractType = String(rawValue ?? '').trim()
                break
              case 'contractStartDate':
                record.contractStartDate = normalizeDate(rawValue)
                break
              case 'contractEndDate':
                record.contractEndDate = normalizeDate(rawValue)
                break
              case 'salaryCategory':
                record.salaryCategory = String(rawValue ?? '').trim()
                break
              case 'prime':
                record.prime = String(rawValue ?? '').trim()
                break
              case 'baseSalary':
                record.baseSalary = String(rawValue ?? '').trim()
                break
              case 'netMonthly':
                record.netMonthly = String(rawValue ?? '').trim()
                break
              case 'maritalStatus':
                record.maritalStatus = String(rawValue ?? '').trim()
                break
              case 'childrenCount':
                record.childrenCount = String(rawValue ?? '').trim()
                break
              case 'chineseSupervisor':
                record.chineseSupervisor = String(rawValue ?? '').trim()
                break
              case 'cnpsNumber':
                record.cnpsNumber = String(rawValue ?? '').trim()
                break
              case 'cnpsDeclarationCode':
                record.cnpsDeclarationCode = String(rawValue ?? '').trim()
                break
            case 'provenance':
              record.provenance = String(rawValue ?? '').trim()
              break
              case 'emergencyContact':
                record.emergencyContact = String(rawValue ?? '').trim()
                break
              case 'frenchName':
                record.frenchName = String(rawValue ?? '').trim()
                break
              case 'idNumber':
                record.idNumber = String(rawValue ?? '').trim()
                break
              case 'passportNumber':
                record.passportNumber = String(rawValue ?? '').trim()
                break
              case 'educationAndMajor':
                record.educationAndMajor = String(rawValue ?? '').trim()
                break
              case 'certifications':
                record.certifications = normalizeList(rawValue)
                break
              case 'domesticMobile':
                record.domesticMobile = String(rawValue ?? '').trim()
                break
              case 'emergencyContactName':
                record.emergencyContactName = String(rawValue ?? '').trim()
                break
              case 'emergencyContactPhone':
                record.emergencyContactPhone = String(rawValue ?? '').trim()
                break
              case 'redBookValidYears':
                record.redBookValidYears = normalizeNumber(rawValue)
                break
              case 'cumulativeAbroadYears':
                record.cumulativeAbroadYears = normalizeNumber(rawValue)
                break
              case 'birthplace':
                record.birthplace = String(rawValue ?? '').trim()
                break
              case 'residenceInChina':
                record.residenceInChina = String(rawValue ?? '').trim()
                break
              case 'medicalHistory':
                record.medicalHistory = String(rawValue ?? '').trim()
                break
              case 'healthStatus':
                record.healthStatus = String(rawValue ?? '').trim()
                break
              default:
                break
            }
          })

          let hasRowError = false
          if (!record.name) {
            errors.push({ row: rowNumber, code: 'missing_name' })
            hasRowError = true
          }
          const normalizedUsername = record.username ? record.username.trim().toLowerCase() : ''
          record.username = normalizedUsername || undefined
          if (normalizedUsername) {
            if (seenUsernames.has(normalizedUsername)) {
              errors.push({ row: rowNumber, code: 'duplicate_username' })
              hasRowError = true
            } else {
              seenUsernames.add(normalizedUsername)
            }
          }
          if (record.gender && !['男', '女'].includes(record.gender)) {
            errors.push({ row: rowNumber, code: 'invalid_gender', value: record.gender })
            hasRowError = true
          }
          const invalidPhone = record.phones.find((phone) => !PHONE_PATTERN.test(phone))
          if (invalidPhone) {
            errors.push({ row: rowNumber, code: 'invalid_phone', value: invalidPhone })
            hasRowError = true
          }
          if (record.employmentStatus && !['ACTIVE', 'ON_LEAVE', 'TERMINATED'].includes(record.employmentStatus)) {
            errors.push({ row: rowNumber, code: 'invalid_status', value: record.employmentStatus })
            hasRowError = true
          }
          if (hasJoinDateValue && !record.joinDate) {
            errors.push({ row: rowNumber, code: 'invalid_join_date' })
            hasRowError = true
          }
          if (hasBirthDateValue && !record.birthDate) {
            errors.push({ row: rowNumber, code: 'invalid_birth_date' })
            hasRowError = true
          }
          if (hasTerminationDateValue && !record.terminationDate) {
            errors.push({ row: rowNumber, code: 'invalid_termination_date' })
            hasRowError = true
          }
          if (!record.birthDate && !hasBirthDateValue && record.nationality === 'china') {
            const derivedBirthDate = parseBirthDateFromIdNumber(record.idNumber ?? '')
            if (derivedBirthDate) {
              record.birthDate = derivedBirthDate
            }
          }
          if (!record.birthDate && !hasBirthDateValue) {
            errors.push({ row: rowNumber, code: 'missing_birth_date' })
            hasRowError = true
          }
          if (record.employmentStatus === 'TERMINATED') {
            if (!record.terminationDate) {
              errors.push({ row: rowNumber, code: 'missing_termination_date' })
              hasRowError = true
            }
            if (!record.terminationReason) {
              errors.push({ row: rowNumber, code: 'missing_termination_reason' })
              hasRowError = true
            }
          }
          if (!hasRowError) {
            prepared.push(record)
          }
        })

        if (errors.length > 0) {
          setActionError(errors.map(formatImportError).join('\n'))
          if (prepared.length === 0) {
            return
          }
          const errorRowsCount = new Set(errors.map((item) => item.row)).size
          const shouldContinue = window.confirm(
            t.feedback.importSkipConfirm(prepared.length, errorRowsCount),
          )
          if (!shouldContinue) {
            return
          }
        }
        if (prepared.length === 0) {
          throw new Error(t.errors.importNoData)
        }
        const res = await fetch('/api/members/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            members: prepared,
            ignoreErrors: errors.length > 0,
            skipChangeHistory: Boolean(skipChangeHistory && canDeleteMember),
          }),
        })
        const payload = (await res.json().catch(() => ({}))) as {
          imported?: number
          error?: string
          errors?: ImportError[]
        }
        if (!res.ok) {
          if (payload.errors?.length) {
            setActionError(payload.errors.map(formatImportError).join('\n'))
            return
          }
          throw new Error(payload.error ?? t.errors.importFailed)
        }
        const combinedErrors = [...errors, ...(payload.errors ?? [])]
        if (combinedErrors.length > 0) {
          setActionError(combinedErrors.map(formatImportError).join('\n'))
          setActionNotice(
            t.feedback.importPartialSuccess(
              payload.imported ?? prepared.length,
              new Set(combinedErrors.map((item) => item.row)).size,
            ),
          )
        } else {
          setActionNotice(t.feedback.importSuccess(payload.imported ?? prepared.length))
        }
        await loadData()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : t.errors.importFailed)
      } finally {
        setImporting(false)
      }
    },
    [
      canCreateMember,
      canAssignRole,
      canDeleteMember,
      rolesData,
      importHeaderMap,
      nationalityLookup,
      genderLookup,
      statusLookup,
      formatImportError,
      loadData,
      setActionError,
      setActionNotice,
      skipChangeHistory,
      t,
    ],
  )

  const handleExportMembers = useCallback(async () => {
    if (!canViewMembers) {
      setActionError(t.access.needMemberView)
      return
    }
    if (exporting) return
    const selectedColumns = exportableColumnOrder.filter(
      (key) => visibleColumns.includes(key) && (key !== 'roles' || canAssignRole),
    )
    if (selectedColumns.length === 0) {
      setActionError(t.errors.exportMissingColumns)
      return
    }
    if (members.length === 0) {
      setActionError(t.errors.exportNoData)
      return
    }
    setExporting(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const headerRow = selectedColumns.map((key) => columnLabels[key])
      const dataRows = members.map((member, index) =>
        selectedColumns.map((key) => {
          const chineseProfile = member.nationality === 'china' ? member.chineseProfile : null
          const expatProfile = member.nationality === 'china' ? null : member.expatProfile
          switch (key) {
            case 'sequence':
              return index + 1
            case 'name':
              return member.name?.length ? member.name : t.labels.empty
            case 'username':
              return member.username
            case 'gender':
              return findGenderLabel(member.gender)
            case 'nationality':
              return findNationalityLabel(member.nationality)
            case 'phones':
              return member.phones?.length ? member.phones.join(' / ') : t.labels.empty
            case 'joinDate':
              return member.joinDate ? new Date(member.joinDate).toLocaleDateString(locale) : t.labels.empty
            case 'birthDate':
              return member.birthDate ? new Date(member.birthDate).toLocaleDateString(locale) : t.labels.empty
            case 'position':
              return member.position || t.labels.empty
            case 'employmentStatus':
              return statusLabels[member.employmentStatus] ?? member.employmentStatus
            case 'terminationDate':
              return member.terminationDate
                ? new Date(member.terminationDate).toLocaleDateString(locale)
                : t.labels.empty
            case 'terminationReason':
              return member.terminationReason?.length ? member.terminationReason : t.labels.empty
            case 'roles':
              return member.roles.length
                ? member.roles.map(resolveRoleName).filter(Boolean).join(' / ')
                : t.labels.empty
            case 'tags':
              return formatProfileList(member.tags)
            case 'project':
              return formatProfileText(member.project?.name ?? null)
            case 'team':
              return formatProfileText(expatProfile?.team)
            case 'chineseSupervisor':
              return expatProfile?.chineseSupervisor?.username ?? t.labels.empty
            case 'contractNumber':
              return formatProfileText(expatProfile?.contractNumber)
            case 'contractType':
              return formatProfileText(expatProfile?.contractType)
            case 'contractStartDate':
              return expatProfile?.contractStartDate
                ? new Date(expatProfile.contractStartDate).toLocaleDateString(locale)
                : t.labels.empty
            case 'contractEndDate':
              return expatProfile?.contractEndDate
                ? new Date(expatProfile.contractEndDate).toLocaleDateString(locale)
                : t.labels.empty
            case 'salaryCategory':
              return formatProfileText(expatProfile?.salaryCategory)
            case 'prime':
              return formatProfileText(expatProfile?.prime)
            case 'baseSalary':
              return formatSalary(expatProfile?.baseSalaryAmount, expatProfile?.baseSalaryUnit)
            case 'netMonthly':
              return formatSalary(expatProfile?.netMonthlyAmount, expatProfile?.netMonthlyUnit, 'MONTH')
            case 'maritalStatus':
              return formatProfileText(expatProfile?.maritalStatus)
            case 'childrenCount':
              return formatProfileNumber(expatProfile?.childrenCount ?? null)
            case 'cnpsNumber':
              return formatProfileText(expatProfile?.cnpsNumber)
            case 'cnpsDeclarationCode':
              return formatProfileText(expatProfile?.cnpsDeclarationCode)
            case 'provenance':
              return formatProfileText(expatProfile?.provenance)
            case 'frenchName':
              return formatProfileText(chineseProfile?.frenchName)
            case 'idNumber':
              return formatProfileText(chineseProfile?.idNumber)
            case 'passportNumber':
              return formatProfileText(chineseProfile?.passportNumber)
            case 'educationAndMajor':
              return formatProfileText(chineseProfile?.educationAndMajor)
            case 'certifications':
              return formatProfileList(chineseProfile?.certifications)
            case 'domesticMobile':
              return formatProfileText(chineseProfile?.domesticMobile)
            case 'emergencyContactName':
              return formatProfileText(
                chineseProfile?.emergencyContactName ?? expatProfile?.emergencyContactName,
              )
            case 'emergencyContactPhone':
              return formatProfileText(
                chineseProfile?.emergencyContactPhone ?? expatProfile?.emergencyContactPhone,
              )
            case 'redBookValidYears':
              return formatProfileNumber(chineseProfile?.redBookValidYears)
            case 'cumulativeAbroadYears':
              return formatProfileNumber(chineseProfile?.cumulativeAbroadYears)
            case 'birthplace':
              return formatProfileText(chineseProfile?.birthplace)
            case 'residenceInChina':
              return formatProfileText(chineseProfile?.residenceInChina)
            case 'medicalHistory':
              return formatProfileText(chineseProfile?.medicalHistory)
            case 'healthStatus':
              return formatProfileText(chineseProfile?.healthStatus)
            case 'createdAt':
              return new Date(member.createdAt).toLocaleString(locale)
            case 'updatedAt':
              return new Date(member.updatedAt).toLocaleString(locale)
            default:
              return ''
          }
        }),
      )
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, t.tabs.members)
      const filename = `members-export-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.errors.exportFailed)
    } finally {
      setExporting(false)
    }
  }, [
    canViewMembers,
    exporting,
    visibleColumns,
    canAssignRole,
    members,
    columnLabels,
    statusLabels,
    locale,
    formatProfileText,
    formatProfileNumber,
    formatProfileList,
    formatSalary,
    findGenderLabel,
    findNationalityLabel,
    resolveRoleName,
    t,
    setActionError,
    setActionNotice,
  ])

  const handleDownloadTemplate = useCallback(async () => {
    if (templateDownloading) return
    setTemplateDownloading(true)
    setActionError(null)
    setActionNotice(null)
    try {
      const XLSX = await import('xlsx')
      const headerRow = templateColumns.map((key) => templateColumnLabels[key])
      const worksheet = XLSX.utils.aoa_to_sheet([headerRow])
      const instructionsRows = [
        [t.template.columnsHeader, t.template.notesHeader],
        ...templateColumns.map((key) => [templateColumnLabels[key], t.template.notes[key]]),
      ]
      const instructionsSheet = XLSX.utils.aoa_to_sheet(instructionsRows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, t.tabs.members)
      XLSX.utils.book_append_sheet(workbook, instructionsSheet, t.template.instructionsSheet)
      const filename = `members-import-template-${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(workbook, filename, { bookType: 'xlsx' })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t.errors.templateDownloadFailed)
    } finally {
      setTemplateDownloading(false)
    }
  }, [templateDownloading, templateColumns, templateColumnLabels, t, setActionError, setActionNotice])

  return {
    importing,
    exporting,
    templateDownloading,
    handleImportFileChange,
    handleExportMembers,
    handleDownloadTemplate,
  }
}
