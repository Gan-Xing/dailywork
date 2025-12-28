import type { Locale } from '@/lib/i18n'
import { genderOptions, memberCopy, nationalityOptions } from '@/lib/i18n/members'
import type { ColumnKey, SortField } from '@/lib/members/constants'
import { formatSupervisorLabel, normalizeText, toSalaryFilterValue } from '@/lib/members/utils'
import type { Member, MemberBulkPatch, Role } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type MembersTableProps = {
  members: Member[]
  page: number
  pageSize: number
  locale: Locale
  t: MemberCopy
  isVisible: (key: ColumnKey) => boolean
  handleSort: (field: SortField) => void
  sortIndicator: (field: SortField) => string
  rolesData: Role[]
  canUpdateMember: boolean
  canDeleteMember: boolean
  submitting: boolean
  bulkEditMode: boolean
  bulkDrafts: Record<number, MemberBulkPatch>
  bulkEditableColumns: ColumnKey[]
  teamOptions: string[]
  chineseSupervisorOptions: { value: string; label: string }[]
  onBulkFieldChange: (memberId: number, path: string, value: string | null | undefined) => void
  onViewMember: (member: Member) => void
  onEditMember: (member: Member) => void
  onDeleteMember: (member: Member) => void
  statusLabels: Record<string, string>
  formatProfileText: (value?: string | null) => string
  formatProfileNumber: (value?: number | null) => string
  formatProfileList: (values?: string[] | null) => string
  formatSalary: (amount?: string | null, unit?: 'MONTH' | 'HOUR' | null, fallbackUnit?: 'MONTH' | 'HOUR' | null) => string
  findGenderLabel: (value: string | null) => string
  findNationalityLabel: (value: string | null) => string
}

export function MembersTable({
  members,
  page,
  pageSize,
  locale,
  t,
  isVisible,
  handleSort,
  sortIndicator,
  rolesData,
  canUpdateMember,
  canDeleteMember,
  submitting,
  bulkEditMode,
  bulkDrafts,
  bulkEditableColumns,
  teamOptions,
  chineseSupervisorOptions,
  onBulkFieldChange,
  onViewMember,
  onEditMember,
  onDeleteMember,
  statusLabels,
  formatProfileText,
  formatProfileNumber,
  formatProfileList,
  formatSalary,
  findGenderLabel,
  findNationalityLabel,
}: MembersTableProps) {
  const isEditable = (key: ColumnKey) => bulkEditMode && bulkEditableColumns.includes(key)

  const resolveDraftValue = (memberId: number, path: string) => {
    const draft = bulkDrafts[memberId]
    if (!draft) return undefined
    const segments = path.split('.')
    if (segments.length === 1) {
      return draft[segments[0] as keyof MemberBulkPatch] as string | null | undefined
    }
    const nested = draft[segments[0] as keyof MemberBulkPatch]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return (nested as Record<string, unknown>)[segments[1]] as string | null | undefined
    }
    return undefined
  }

  const resolveInputValue = (draftValue: string | null | undefined, currentValue: string) => {
    if (draftValue === null) return ''
    if (draftValue === undefined) return currentValue
    return draftValue
  }

  const handleBulkChange = (
    memberId: number,
    path: string,
    value: string,
    currentValue: string,
  ) => {
    const normalizedNext = normalizeText(value)
    const normalizedCurrent = normalizeText(currentValue)
    if (!normalizedNext || normalizedNext === normalizedCurrent) {
      onBulkFieldChange(memberId, path, undefined)
      return
    }
    onBulkFieldChange(memberId, path, value)
  }

  const renderBulkInput = ({
    memberId,
    path,
    currentValue,
    type = 'text',
    inputMode,
    placeholder,
    listId,
    disabled,
  }: {
    memberId: number
    path: string
    currentValue: string
    type?: 'text' | 'number' | 'date'
    inputMode?: 'text' | 'decimal' | 'numeric'
    placeholder?: string
    listId?: string
    disabled?: boolean
  }) => {
    if (disabled) {
      return <span className="text-slate-400">{normalizeText(currentValue) || t.labels.empty}</span>
    }
    const draftValue = resolveDraftValue(memberId, path)
    const isCleared = draftValue === null
    const value = resolveInputValue(draftValue, currentValue)
    return (
      <div className="flex items-center gap-2">
        <input
          type={type}
          inputMode={inputMode}
          list={listId}
          value={value}
          onChange={(event) =>
            handleBulkChange(memberId, path, event.target.value, currentValue)
          }
          placeholder={isCleared ? t.labels.cleared : placeholder}
          className={`w-full rounded-lg border px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
            isCleared ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
          }`}
        />
        <button
          type="button"
          onClick={() => onBulkFieldChange(memberId, path, null)}
          className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
        >
          {t.actions.clearValue}
        </button>
      </div>
    )
  }

  const renderBulkSelect = ({
    memberId,
    path,
    currentValue,
    options,
    disabled,
    allowClear = true,
  }: {
    memberId: number
    path: string
    currentValue: string
    options: Array<{ value: string; label: string }>
    disabled?: boolean
    allowClear?: boolean
  }) => {
    if (disabled) {
      const label = options.find((option) => option.value === currentValue)?.label
      return <span className="text-slate-400">{label ?? t.labels.empty}</span>
    }
    const draftValue = resolveDraftValue(memberId, path)
    const isCleared = draftValue === null
    const value = resolveInputValue(draftValue, currentValue)
    return (
      <div className="flex items-center gap-2">
        <select
          value={value}
          onChange={(event) => handleBulkChange(memberId, path, event.target.value, currentValue)}
          className={`w-full rounded-lg border px-2 py-1 text-xs text-slate-700 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 ${
            isCleared ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
          }`}
        >
          {allowClear ? <option value="">{t.labels.empty}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {allowClear ? (
          <button
            type="button"
            onClick={() => onBulkFieldChange(memberId, path, null)}
            className="rounded-full border border-slate-200 px-2.5 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            {t.actions.clearValue}
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <>
      {teamOptions.length > 0 ? (
        <datalist id="bulk-team-options">
          {teamOptions.map((team) => (
            <option key={team} value={team} />
          ))}
        </datalist>
      ) : null}
      <table className="w-full table-auto text-left text-base text-slate-900">
      <thead className="bg-slate-50 text-sm uppercase tracking-wide text-slate-600">
        <tr>
          {isVisible('sequence') ? (
            <th className="px-3 py-3 text-center whitespace-nowrap">{t.table.sequence}</th>
          ) : null}
          {isVisible('name') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('name')}
            >
              {t.table.name} {sortIndicator('name')}
            </th>
          ) : null}
          {isVisible('username') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('username')}
            >
              {t.table.username} {sortIndicator('username')}
            </th>
          ) : null}
          {isVisible('gender') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('gender')}
            >
              {t.table.gender} {sortIndicator('gender')}
            </th>
          ) : null}
          {isVisible('nationality') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('nationality')}
            >
              {t.table.nationality} {sortIndicator('nationality')}
            </th>
          ) : null}
          {isVisible('phones') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('phones')}
            >
              {t.table.phones} {sortIndicator('phones')}
            </th>
          ) : null}
          {isVisible('joinDate') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('joinDate')}
            >
              {t.table.joinDate} {sortIndicator('joinDate')}
            </th>
          ) : null}
          {isVisible('birthDate') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('birthDate')}
            >
              {t.table.birthDate} {sortIndicator('birthDate')}
            </th>
          ) : null}
          {isVisible('position') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('position')}
            >
              {t.table.position} {sortIndicator('position')}
            </th>
          ) : null}
          {isVisible('employmentStatus') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('employmentStatus')}
            >
              {t.table.employmentStatus} {sortIndicator('employmentStatus')}
            </th>
          ) : null}
          {isVisible('terminationDate') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('terminationDate')}
            >
              {t.table.terminationDate} {sortIndicator('terminationDate')}
            </th>
          ) : null}
          {isVisible('terminationReason') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('terminationReason')}
            >
              {t.table.terminationReason} {sortIndicator('terminationReason')}
            </th>
          ) : null}
          {isVisible('roles') ? (
            <th
              className="min-w-[150px] px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('roles')}
            >
              {t.table.roles} {sortIndicator('roles')}
            </th>
          ) : null}
          {isVisible('tags') ? (
            <th
              className="min-w-[160px] px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('tags')}
            >
              {t.table.tags} {sortIndicator('tags')}
            </th>
          ) : null}
          {isVisible('team') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('team')}
            >
              {t.table.team} {sortIndicator('team')}
            </th>
          ) : null}
          {isVisible('chineseSupervisor') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('chineseSupervisor')}
            >
              {t.table.chineseSupervisor} {sortIndicator('chineseSupervisor')}
            </th>
          ) : null}
          {isVisible('contractNumber') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('contractNumber')}
            >
              {t.table.contractNumber} {sortIndicator('contractNumber')}
            </th>
          ) : null}
          {isVisible('contractType') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('contractType')}
            >
              {t.table.contractType} {sortIndicator('contractType')}
            </th>
          ) : null}
          {isVisible('contractStartDate') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('contractStartDate')}
            >
              {t.table.contractStartDate} {sortIndicator('contractStartDate')}
            </th>
          ) : null}
          {isVisible('contractEndDate') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('contractEndDate')}
            >
              {t.table.contractEndDate} {sortIndicator('contractEndDate')}
            </th>
          ) : null}
          {isVisible('salaryCategory') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('salaryCategory')}
            >
              {t.table.salaryCategory} {sortIndicator('salaryCategory')}
            </th>
          ) : null}
          {isVisible('prime') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('prime')}
            >
              {t.table.prime} {sortIndicator('prime')}
            </th>
          ) : null}
          {isVisible('baseSalary') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('baseSalary')}
            >
              {t.table.baseSalary} {sortIndicator('baseSalary')}
            </th>
          ) : null}
          {isVisible('netMonthly') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('netMonthly')}
            >
              {t.table.netMonthly} {sortIndicator('netMonthly')}
            </th>
          ) : null}
          {isVisible('maritalStatus') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('maritalStatus')}
            >
              {t.table.maritalStatus} {sortIndicator('maritalStatus')}
            </th>
          ) : null}
          {isVisible('childrenCount') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('childrenCount')}
            >
              {t.table.childrenCount} {sortIndicator('childrenCount')}
            </th>
          ) : null}
          {isVisible('cnpsNumber') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('cnpsNumber')}
            >
              {t.table.cnpsNumber} {sortIndicator('cnpsNumber')}
            </th>
          ) : null}
          {isVisible('cnpsDeclarationCode') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('cnpsDeclarationCode')}
            >
              {t.table.cnpsDeclarationCode} {sortIndicator('cnpsDeclarationCode')}
            </th>
          ) : null}
          {isVisible('provenance') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('provenance')}
            >
              {t.table.provenance} {sortIndicator('provenance')}
            </th>
          ) : null}
          {isVisible('frenchName') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('frenchName')}
            >
              {t.table.frenchName} {sortIndicator('frenchName')}
            </th>
          ) : null}
          {isVisible('idNumber') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('idNumber')}
            >
              {t.table.idNumber} {sortIndicator('idNumber')}
            </th>
          ) : null}
          {isVisible('passportNumber') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('passportNumber')}
            >
              {t.table.passportNumber} {sortIndicator('passportNumber')}
            </th>
          ) : null}
          {isVisible('educationAndMajor') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('educationAndMajor')}
            >
              {t.table.educationAndMajor} {sortIndicator('educationAndMajor')}
            </th>
          ) : null}
          {isVisible('certifications') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('certifications')}
            >
              {t.table.certifications} {sortIndicator('certifications')}
            </th>
          ) : null}
          {isVisible('domesticMobile') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('domesticMobile')}
            >
              {t.table.domesticMobile} {sortIndicator('domesticMobile')}
            </th>
          ) : null}
          {isVisible('emergencyContactName') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('emergencyContactName')}
            >
              {t.table.emergencyContactName} {sortIndicator('emergencyContactName')}
            </th>
          ) : null}
          {isVisible('emergencyContactPhone') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('emergencyContactPhone')}
            >
              {t.table.emergencyContactPhone} {sortIndicator('emergencyContactPhone')}
            </th>
          ) : null}
          {isVisible('redBookValidYears') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('redBookValidYears')}
            >
              {t.table.redBookValidYears} {sortIndicator('redBookValidYears')}
            </th>
          ) : null}
          {isVisible('cumulativeAbroadYears') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('cumulativeAbroadYears')}
            >
              {t.table.cumulativeAbroadYears} {sortIndicator('cumulativeAbroadYears')}
            </th>
          ) : null}
          {isVisible('birthplace') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('birthplace')}
            >
              {t.table.birthplace} {sortIndicator('birthplace')}
            </th>
          ) : null}
          {isVisible('residenceInChina') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('residenceInChina')}
            >
              {t.table.residenceInChina} {sortIndicator('residenceInChina')}
            </th>
          ) : null}
          {isVisible('medicalHistory') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('medicalHistory')}
            >
              {t.table.medicalHistory} {sortIndicator('medicalHistory')}
            </th>
          ) : null}
          {isVisible('healthStatus') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('healthStatus')}
            >
              {t.table.healthStatus} {sortIndicator('healthStatus')}
            </th>
          ) : null}
          {isVisible('createdAt') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('createdAt')}
            >
              {t.table.createdAt} {sortIndicator('createdAt')}
            </th>
          ) : null}
          {isVisible('updatedAt') ? (
            <th
              className="px-3 py-3 whitespace-nowrap cursor-pointer select-none"
              onClick={() => handleSort('updatedAt')}
            >
              {t.table.updatedAt} {sortIndicator('updatedAt')}
            </th>
          ) : null}
          {isVisible('actions') ? (
            <th className="px-3 py-3 whitespace-nowrap">{t.table.actions}</th>
          ) : null}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 align-middle">
        {members.map((member, index) => {
          const displayIndex = (page - 1) * pageSize + index + 1
          const chineseProfile = member.nationality === 'china' ? member.chineseProfile : null
          const expatProfile = member.nationality === 'china' ? null : member.expatProfile
          const supervisorLabel =
            formatSupervisorLabel({
              name: expatProfile?.chineseSupervisor?.name ?? null,
              frenchName: expatProfile?.chineseSupervisor?.chineseProfile?.frenchName ?? null,
              username: expatProfile?.chineseSupervisor?.username ?? null,
            }) || t.labels.empty
          return (
            <tr key={member.id} className="hover:bg-slate-50 align-middle">
              {isVisible('sequence') ? (
                <td className="whitespace-nowrap px-4 py-3 text-center text-slate-700 align-middle">
                  {displayIndex}
                </td>
              ) : null}
              {isVisible('name') ? (
                <td className="px-4 py-3 align-middle">
                  <p className="max-w-[10rem] text-sm font-semibold text-slate-900 break-words leading-snug">
                    {member.name?.length ? member.name : t.labels.empty}
                  </p>
                </td>
              ) : null}
              {isVisible('username') ? (
                <td className="whitespace-nowrap px-4 py-3 align-middle">
                  <p className="font-semibold text-slate-900">{member.username}</p>
                </td>
              ) : null}
              {isVisible('gender') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 min-w-[80px] align-middle">
                  {isEditable('gender')
                    ? renderBulkSelect({
                        memberId: member.id,
                        path: 'gender',
                        currentValue: member.gender ?? '',
                        options: genderOptions.map((option) => ({
                          value: option.value,
                          label: option.label[locale] ?? option.value,
                        })),
                      })
                    : findGenderLabel(member.gender)}
                </td>
              ) : null}
              {isVisible('nationality') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('nationality')
                    ? renderBulkSelect({
                        memberId: member.id,
                        path: 'nationality',
                        currentValue: member.nationality ?? '',
                        options: nationalityOptions.map((option) => ({
                          value: option.key,
                          label: option.label[locale] ?? option.key,
                        })),
                      })
                    : findNationalityLabel(member.nationality)}
                </td>
              ) : null}
              {isVisible('phones') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('phones')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'phones',
                        currentValue: member.phones?.join(' / ') ?? '',
                        placeholder: t.form.phonePlaceholder,
                      })
                    : member.phones?.length
                      ? (
                        <div className="space-y-1">
                          {member.phones.map((phone, idx) => (
                            <div key={`${member.id}-phone-${idx}`} className="whitespace-nowrap">
                              {phone}
                            </div>
                          ))}
                        </div>
                      )
                      : (
                        t.labels.empty
                      )}
                </td>
              ) : null}
              {isVisible('joinDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('joinDate')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'joinDate',
                        currentValue: member.joinDate ? member.joinDate.slice(0, 10) : '',
                        type: 'date',
                      })
                    : member.joinDate
                      ? new Date(member.joinDate).toLocaleDateString(locale)
                      : t.labels.empty}
                </td>
              ) : null}
              {isVisible('birthDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {member.birthDate
                    ? new Date(member.birthDate).toLocaleDateString(locale)
                    : t.labels.empty}
                </td>
              ) : null}
              {isVisible('position') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('position')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'position',
                        currentValue: member.position ?? '',
                        placeholder: t.form.positionPlaceholder,
                      })
                    : member.position || t.labels.empty}
                </td>
              ) : null}
              {isVisible('employmentStatus') ? (
                <td className="whitespace-nowrap px-4 py-3 align-middle">
                  {isEditable('employmentStatus')
                    ? renderBulkSelect({
                        memberId: member.id,
                        path: 'employmentStatus',
                        currentValue: member.employmentStatus ?? '',
                        options: (['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const).map((status) => ({
                          value: status,
                          label: statusLabels[status] ?? status,
                        })),
                        allowClear: false,
                      })
                    : (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200">
                        {statusLabels[member.employmentStatus] ?? member.employmentStatus}
                      </span>
                    )}
                </td>
              ) : null}
              {isVisible('terminationDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('terminationDate')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'terminationDate',
                        currentValue: member.terminationDate
                          ? member.terminationDate.slice(0, 10)
                          : '',
                        type: 'date',
                      })
                    : member.terminationDate
                      ? new Date(member.terminationDate).toLocaleDateString(locale)
                      : t.labels.empty}
                </td>
              ) : null}
              {isVisible('terminationReason') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('terminationReason')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'terminationReason',
                        currentValue: member.terminationReason ?? '',
                      })
                    : member.terminationReason?.length
                      ? member.terminationReason
                      : t.labels.empty}
                </td>
              ) : null}
              {isVisible('roles') ? (
                <td className="px-4 py-3 text-slate-700 align-middle min-w-[150px]">
                  <div className="flex flex-col gap-1">
                    {member.roles.map((roleKey) => {
                      const role = rolesData.find(
                        (item) => item.id === roleKey.id || item.name === roleKey.name,
                      )
                      return (
                        <div
                          key={`${member.id}-${roleKey.id ?? roleKey.name}`}
                          className="inline-flex items-center justify-center rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-800 ring-1 ring-sky-100 whitespace-nowrap"
                        >
                          {role?.name ?? roleKey.name}
                        </div>
                      )
                    })}
                  </div>
                </td>
              ) : null}
              {isVisible('tags') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('tags')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'tags',
                        currentValue: member.tags?.join(' / ') ?? '',
                        placeholder: t.form.tagsPlaceholder,
                      })
                    : member.tags?.length
                      ? (
                        <div className="flex flex-wrap gap-1.5">
                          {member.tags.map((tag) => (
                            <span
                              key={`${member.id}-tag-${tag}`}
                              className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-100"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )
                      : (
                        t.labels.empty
                      )}
                </td>
              ) : null}
              {isVisible('team') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('team')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.team',
                        currentValue: expatProfile?.team ?? '',
                        listId: 'bulk-team-options',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.team)}
                </td>
              ) : null}
              {isVisible('chineseSupervisor') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('chineseSupervisor')
                    ? renderBulkSelect({
                        memberId: member.id,
                        path: 'expatProfile.chineseSupervisorId',
                        currentValue: expatProfile?.chineseSupervisorId
                          ? String(expatProfile.chineseSupervisorId)
                          : '',
                        options: chineseSupervisorOptions,
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(supervisorLabel)}
                </td>
              ) : null}
              {isVisible('contractNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.contractNumber)}
                </td>
              ) : null}
              {isVisible('contractType') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('contractType')
                    ? renderBulkSelect({
                        memberId: member.id,
                        path: 'expatProfile.contractType',
                        currentValue: expatProfile?.contractType ?? '',
                        options: [
                          { value: 'CTJ', label: 'CTJ' },
                          { value: 'CDD', label: 'CDD' },
                        ],
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.contractType)}
                </td>
              ) : null}
              {isVisible('contractStartDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('contractStartDate')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.contractStartDate',
                        currentValue: expatProfile?.contractStartDate
                          ? expatProfile.contractStartDate.slice(0, 10)
                          : '',
                        type: 'date',
                        disabled: member.nationality === 'china',
                      })
                    : expatProfile?.contractStartDate
                      ? new Date(expatProfile.contractStartDate).toLocaleDateString(locale)
                      : t.labels.empty}
                </td>
              ) : null}
              {isVisible('contractEndDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('contractEndDate')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.contractEndDate',
                        currentValue: expatProfile?.contractEndDate
                          ? expatProfile.contractEndDate.slice(0, 10)
                          : '',
                        type: 'date',
                        disabled: member.nationality === 'china',
                      })
                    : expatProfile?.contractEndDate
                      ? new Date(expatProfile.contractEndDate).toLocaleDateString(locale)
                      : t.labels.empty}
                </td>
              ) : null}
              {isVisible('salaryCategory') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('salaryCategory')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.salaryCategory',
                        currentValue: expatProfile?.salaryCategory ?? '',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.salaryCategory)}
                </td>
              ) : null}
              {isVisible('prime') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('prime')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.prime',
                        currentValue: expatProfile?.prime ?? '',
                        type: 'number',
                        inputMode: 'decimal',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.prime)}
                </td>
              ) : null}
              {isVisible('baseSalary') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('baseSalary')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.baseSalary',
                        currentValue: toSalaryFilterValue(
                          expatProfile?.baseSalaryAmount,
                          expatProfile?.baseSalaryUnit,
                        ),
                        placeholder: '1000/M',
                        disabled: member.nationality === 'china',
                      })
                    : formatSalary(expatProfile?.baseSalaryAmount, expatProfile?.baseSalaryUnit)}
                </td>
              ) : null}
              {isVisible('netMonthly') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('netMonthly')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.netMonthly',
                        currentValue: toSalaryFilterValue(
                          expatProfile?.netMonthlyAmount,
                          expatProfile?.netMonthlyUnit,
                          'MONTH',
                        ),
                        placeholder: '900/M',
                        disabled: member.nationality === 'china',
                      })
                    : formatSalary(
                        expatProfile?.netMonthlyAmount,
                        expatProfile?.netMonthlyUnit,
                        'MONTH',
                      )}
                </td>
              ) : null}
              {isVisible('maritalStatus') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('maritalStatus')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.maritalStatus',
                        currentValue: expatProfile?.maritalStatus ?? '',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.maritalStatus)}
                </td>
              ) : null}
              {isVisible('childrenCount') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('childrenCount')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.childrenCount',
                        currentValue:
                          expatProfile?.childrenCount === null ||
                          expatProfile?.childrenCount === undefined
                            ? ''
                            : String(expatProfile.childrenCount),
                        type: 'number',
                        inputMode: 'numeric',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileNumber(expatProfile?.childrenCount ?? null)}
                </td>
              ) : null}
              {isVisible('cnpsNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('cnpsNumber')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.cnpsNumber',
                        currentValue: expatProfile?.cnpsNumber ?? '',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.cnpsNumber)}
                </td>
              ) : null}
              {isVisible('cnpsDeclarationCode') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('cnpsDeclarationCode')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.cnpsDeclarationCode',
                        currentValue: expatProfile?.cnpsDeclarationCode ?? '',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.cnpsDeclarationCode)}
                </td>
              ) : null}
              {isVisible('provenance') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('provenance')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'expatProfile.provenance',
                        currentValue: expatProfile?.provenance ?? '',
                        disabled: member.nationality === 'china',
                      })
                    : formatProfileText(expatProfile?.provenance)}
                </td>
              ) : null}
              {isVisible('frenchName') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('frenchName')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.frenchName',
                        currentValue: chineseProfile?.frenchName ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.frenchName)}
                </td>
              ) : null}
              {isVisible('idNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('idNumber')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.idNumber',
                        currentValue: chineseProfile?.idNumber ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.idNumber)}
                </td>
              ) : null}
              {isVisible('passportNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('passportNumber')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.passportNumber',
                        currentValue: chineseProfile?.passportNumber ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.passportNumber)}
                </td>
              ) : null}
              {isVisible('educationAndMajor') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('educationAndMajor')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.educationAndMajor',
                        currentValue: chineseProfile?.educationAndMajor ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.educationAndMajor)}
                </td>
              ) : null}
              {isVisible('certifications') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('certifications')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.certifications',
                        currentValue: chineseProfile?.certifications?.join(' / ') ?? '',
                        placeholder: t.form.certificationsPlaceholder,
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileList(chineseProfile?.certifications)}
                </td>
              ) : null}
              {isVisible('domesticMobile') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('domesticMobile')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.domesticMobile',
                        currentValue: chineseProfile?.domesticMobile ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.domesticMobile)}
                </td>
              ) : null}
              {isVisible('emergencyContactName') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('emergencyContactName')
                    ? renderBulkInput({
                        memberId: member.id,
                        path:
                          member.nationality === 'china'
                            ? 'chineseProfile.emergencyContactName'
                            : 'expatProfile.emergencyContactName',
                        currentValue:
                          member.nationality === 'china'
                            ? chineseProfile?.emergencyContactName ?? ''
                            : expatProfile?.emergencyContactName ?? '',
                      })
                    : formatProfileText(
                        chineseProfile?.emergencyContactName ?? expatProfile?.emergencyContactName,
                      )}
                </td>
              ) : null}
              {isVisible('emergencyContactPhone') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('emergencyContactPhone')
                    ? renderBulkInput({
                        memberId: member.id,
                        path:
                          member.nationality === 'china'
                            ? 'chineseProfile.emergencyContactPhone'
                            : 'expatProfile.emergencyContactPhone',
                        currentValue:
                          member.nationality === 'china'
                            ? chineseProfile?.emergencyContactPhone ?? ''
                            : expatProfile?.emergencyContactPhone ?? '',
                      })
                    : formatProfileText(
                        chineseProfile?.emergencyContactPhone ?? expatProfile?.emergencyContactPhone,
                      )}
                </td>
              ) : null}
              {isVisible('redBookValidYears') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('redBookValidYears')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.redBookValidYears',
                        currentValue:
                          chineseProfile?.redBookValidYears === null ||
                          chineseProfile?.redBookValidYears === undefined
                            ? ''
                            : String(chineseProfile.redBookValidYears),
                        type: 'number',
                        inputMode: 'numeric',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileNumber(chineseProfile?.redBookValidYears)}
                </td>
              ) : null}
              {isVisible('cumulativeAbroadYears') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {isEditable('cumulativeAbroadYears')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.cumulativeAbroadYears',
                        currentValue:
                          chineseProfile?.cumulativeAbroadYears === null ||
                          chineseProfile?.cumulativeAbroadYears === undefined
                            ? ''
                            : String(chineseProfile.cumulativeAbroadYears),
                        type: 'number',
                        inputMode: 'numeric',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileNumber(chineseProfile?.cumulativeAbroadYears)}
                </td>
              ) : null}
              {isVisible('birthplace') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('birthplace')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.birthplace',
                        currentValue: chineseProfile?.birthplace ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.birthplace)}
                </td>
              ) : null}
              {isVisible('residenceInChina') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('residenceInChina')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.residenceInChina',
                        currentValue: chineseProfile?.residenceInChina ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.residenceInChina)}
                </td>
              ) : null}
              {isVisible('medicalHistory') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('medicalHistory')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.medicalHistory',
                        currentValue: chineseProfile?.medicalHistory ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.medicalHistory)}
                </td>
              ) : null}
              {isVisible('healthStatus') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {isEditable('healthStatus')
                    ? renderBulkInput({
                        memberId: member.id,
                        path: 'chineseProfile.healthStatus',
                        currentValue: chineseProfile?.healthStatus ?? '',
                        disabled: member.nationality !== 'china',
                      })
                    : formatProfileText(chineseProfile?.healthStatus)}
                </td>
              ) : null}
              {isVisible('createdAt') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {new Date(member.createdAt).toLocaleString(locale)}
                </td>
              ) : null}
              {isVisible('updatedAt') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {new Date(member.updatedAt).toLocaleString(locale)}
                </td>
              ) : null}
              {isVisible('actions') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  <div className="flex flex-nowrap gap-2">
                    <button
                      type="button"
                      onClick={() => onViewMember(member)}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {t.actions.view}
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditMember(member)}
                      disabled={!canUpdateMember}
                      className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t.actions.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteMember(member)}
                      className="rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!canDeleteMember || submitting}
                    >
                      {t.actions.delete}
                    </button>
                  </div>
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
      </table>
    </>
  )
}
