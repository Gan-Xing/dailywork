import { useMemo, type ReactNode } from 'react'

import { memberCopy } from '@/lib/i18n/members'
import {
  memberTemplateColumns,
  type ColumnKey,
  type TemplateColumnKey,
} from '@/lib/members/constants'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type UseMemberColumnsParams = {
  t: MemberCopy
  canAssignRole: boolean
}

export function useMemberColumns({ t, canAssignRole }: UseMemberColumnsParams) {
  const columnOptions: { key: ColumnKey; label: ReactNode }[] = useMemo(() => {
    const baseOptions: { key: ColumnKey; label: ReactNode }[] = [
      { key: 'sequence', label: t.table.sequence },
      { key: 'name', label: t.table.name },
      { key: 'username', label: t.table.username },
      { key: 'gender', label: t.table.gender },
      { key: 'nationality', label: t.table.nationality },
      { key: 'phones', label: t.table.phones },
      { key: 'joinDate', label: t.table.joinDate },
      { key: 'birthDate', label: t.table.birthDate },
      { key: 'position', label: t.table.position },
      { key: 'employmentStatus', label: t.table.employmentStatus },
      { key: 'terminationDate', label: t.table.terminationDate },
      { key: 'terminationReason', label: t.table.terminationReason },
      { key: 'roles', label: t.table.roles },
      { key: 'team', label: t.table.team },
      { key: 'chineseSupervisor', label: t.table.chineseSupervisor },
      { key: 'contractNumber', label: t.table.contractNumber },
      { key: 'contractType', label: t.table.contractType },
      { key: 'salaryCategory', label: t.table.salaryCategory },
      { key: 'prime', label: t.table.prime },
      { key: 'baseSalary', label: t.table.baseSalary },
      { key: 'netMonthly', label: t.table.netMonthly },
      { key: 'maritalStatus', label: t.table.maritalStatus },
      { key: 'childrenCount', label: t.table.childrenCount },
      { key: 'cnpsNumber', label: t.table.cnpsNumber },
      { key: 'cnpsDeclarationCode', label: t.table.cnpsDeclarationCode },
      { key: 'provenance', label: t.table.provenance },
      { key: 'frenchName', label: t.table.frenchName },
      { key: 'idNumber', label: t.table.idNumber },
      { key: 'passportNumber', label: t.table.passportNumber },
      { key: 'educationAndMajor', label: t.table.educationAndMajor },
      { key: 'certifications', label: t.table.certifications },
      { key: 'domesticMobile', label: t.table.domesticMobile },
      { key: 'emergencyContactName', label: t.table.emergencyContactName },
      { key: 'emergencyContactPhone', label: t.table.emergencyContactPhone },
      { key: 'redBookValidYears', label: t.table.redBookValidYears },
      { key: 'cumulativeAbroadYears', label: t.table.cumulativeAbroadYears },
      { key: 'birthplace', label: t.table.birthplace },
      { key: 'residenceInChina', label: t.table.residenceInChina },
      { key: 'medicalHistory', label: t.table.medicalHistory },
      { key: 'healthStatus', label: t.table.healthStatus },
      { key: 'createdAt', label: t.table.createdAt },
      { key: 'updatedAt', label: t.table.updatedAt },
      { key: 'actions', label: t.table.actions },
    ]
    return canAssignRole ? baseOptions : baseOptions.filter((option) => option.key !== 'roles')
  }, [canAssignRole, t.table])

  const columnLabels = useMemo(
    () => ({
      sequence: t.table.sequence,
      name: t.table.name,
      username: t.table.username,
      gender: t.table.gender,
      nationality: t.table.nationality,
      phones: t.table.phones,
      joinDate: t.table.joinDate,
      birthDate: t.table.birthDate,
      position: t.table.position,
      employmentStatus: t.table.employmentStatus,
      terminationDate: t.table.terminationDate,
      terminationReason: t.table.terminationReason,
      roles: t.table.roles,
      team: t.table.team,
      chineseSupervisor: t.table.chineseSupervisor,
      contractNumber: t.table.contractNumber,
      contractType: t.table.contractType,
      salaryCategory: t.table.salaryCategory,
      prime: t.table.prime,
      baseSalary: t.table.baseSalary,
      netMonthly: t.table.netMonthly,
      maritalStatus: t.table.maritalStatus,
      childrenCount: t.table.childrenCount,
      cnpsNumber: t.table.cnpsNumber,
      cnpsDeclarationCode: t.table.cnpsDeclarationCode,
      provenance: t.table.provenance,
      frenchName: t.table.frenchName,
      idNumber: t.table.idNumber,
      passportNumber: t.table.passportNumber,
      educationAndMajor: t.table.educationAndMajor,
      certifications: t.table.certifications,
      domesticMobile: t.table.domesticMobile,
      emergencyContactName: t.table.emergencyContactName,
      emergencyContactPhone: t.table.emergencyContactPhone,
      redBookValidYears: t.table.redBookValidYears,
      cumulativeAbroadYears: t.table.cumulativeAbroadYears,
      birthplace: t.table.birthplace,
      residenceInChina: t.table.residenceInChina,
      medicalHistory: t.table.medicalHistory,
      healthStatus: t.table.healthStatus,
      createdAt: t.table.createdAt,
      updatedAt: t.table.updatedAt,
      actions: t.table.actions,
    }),
    [t.table],
  )

  const templateColumnLabels = useMemo<Record<TemplateColumnKey, string>>(
    () => ({
      name: t.form.name,
      username: t.form.username,
      password: t.form.password,
      gender: t.form.gender,
      nationality: t.form.nationality,
      phones: t.form.phones,
      joinDate: t.form.joinDate,
      birthDate: t.form.birthDate,
      position: t.form.position,
      employmentStatus: t.form.status,
      terminationDate: t.form.terminationDate,
      terminationReason: t.form.terminationReason,
      roles: t.form.roles,
      team: t.form.team,
      chineseSupervisor: t.form.chineseSupervisor,
      contractNumber: t.form.contractNumber,
      contractType: t.form.contractType,
      salaryCategory: t.form.salaryCategory,
      prime: t.form.prime,
      baseSalary: t.form.baseSalary,
      netMonthly: t.form.netMonthly,
      maritalStatus: t.form.maritalStatus,
      childrenCount: t.form.childrenCount,
      cnpsNumber: t.form.cnpsNumber,
      cnpsDeclarationCode: t.form.cnpsDeclarationCode,
      provenance: t.form.provenance,
      emergencyContact: t.form.emergencyContact,
      frenchName: t.form.frenchName,
      idNumber: t.form.idNumber,
      passportNumber: t.form.passportNumber,
      educationAndMajor: t.form.educationAndMajor,
      certifications: t.form.certifications,
      domesticMobile: t.form.domesticMobile,
      emergencyContactName: t.form.emergencyContactName,
      emergencyContactPhone: t.form.emergencyContactPhone,
      redBookValidYears: t.form.redBookValidYears,
      cumulativeAbroadYears: t.form.cumulativeAbroadYears,
      birthplace: t.form.birthplace,
      residenceInChina: t.form.residenceInChina,
      medicalHistory: t.form.medicalHistory,
      healthStatus: t.form.healthStatus,
    }),
    [t.form],
  )

  const templateColumns = useMemo(() => {
    if (canAssignRole) return memberTemplateColumns
    return memberTemplateColumns.filter((key) => key !== 'roles')
  }, [canAssignRole])

  return {
    columnOptions,
    columnLabels,
    templateColumnLabels,
    templateColumns,
  }
}
