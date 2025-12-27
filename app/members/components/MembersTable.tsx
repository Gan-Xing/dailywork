import { memberCopy } from '@/lib/i18n/members'
import type { ColumnKey, SortField } from '@/lib/members/constants'
import type { Member, Role } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type MembersTableProps = {
  members: Member[]
  page: number
  pageSize: number
  locale: string
  t: MemberCopy
  isVisible: (key: ColumnKey) => boolean
  handleSort: (field: SortField) => void
  sortIndicator: (field: SortField) => string
  rolesData: Role[]
  canUpdateMember: boolean
  canDeleteMember: boolean
  submitting: boolean
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
  return (
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
            expatProfile?.chineseSupervisor?.chineseProfile?.frenchName?.trim() ||
            expatProfile?.chineseSupervisor?.username ||
            t.labels.empty
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
                  {findGenderLabel(member.gender)}
                </td>
              ) : null}
              {isVisible('nationality') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {findNationalityLabel(member.nationality)}
                </td>
              ) : null}
              {isVisible('phones') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {member.phones?.length ? (
                    <div className="space-y-1">
                      {member.phones.map((phone, idx) => (
                        <div key={`${member.id}-phone-${idx}`} className="whitespace-nowrap">
                          {phone}
                        </div>
                      ))}
                    </div>
                  ) : (
                    t.labels.empty
                  )}
                </td>
              ) : null}
              {isVisible('joinDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {member.joinDate
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
                  {member.position || t.labels.empty}
                </td>
              ) : null}
              {isVisible('employmentStatus') ? (
                <td className="whitespace-nowrap px-4 py-3 align-middle">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-800 ring-1 ring-slate-200">
                    {statusLabels[member.employmentStatus] ?? member.employmentStatus}
                  </span>
                </td>
              ) : null}
              {isVisible('terminationDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {member.terminationDate
                    ? new Date(member.terminationDate).toLocaleDateString(locale)
                    : t.labels.empty}
                </td>
              ) : null}
              {isVisible('terminationReason') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {member.terminationReason?.length ? member.terminationReason : t.labels.empty}
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
                  {member.tags?.length ? (
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
                  ) : (
                    t.labels.empty
                  )}
                </td>
              ) : null}
              {isVisible('team') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.team)}
                </td>
              ) : null}
              {isVisible('chineseSupervisor') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(supervisorLabel)}
                </td>
              ) : null}
              {isVisible('contractNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.contractNumber)}
                </td>
              ) : null}
              {isVisible('contractType') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.contractType)}
                </td>
              ) : null}
              {isVisible('contractStartDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {expatProfile?.contractStartDate
                    ? new Date(expatProfile.contractStartDate).toLocaleDateString(locale)
                    : t.labels.empty}
                </td>
              ) : null}
              {isVisible('contractEndDate') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {expatProfile?.contractEndDate
                    ? new Date(expatProfile.contractEndDate).toLocaleDateString(locale)
                    : t.labels.empty}
                </td>
              ) : null}
              {isVisible('salaryCategory') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.salaryCategory)}
                </td>
              ) : null}
              {isVisible('prime') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.prime)}
                </td>
              ) : null}
              {isVisible('baseSalary') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatSalary(expatProfile?.baseSalaryAmount, expatProfile?.baseSalaryUnit)}
                </td>
              ) : null}
              {isVisible('netMonthly') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatSalary(
                    expatProfile?.netMonthlyAmount,
                    expatProfile?.netMonthlyUnit,
                    'MONTH',
                  )}
                </td>
              ) : null}
              {isVisible('maritalStatus') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.maritalStatus)}
                </td>
              ) : null}
              {isVisible('childrenCount') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileNumber(expatProfile?.childrenCount ?? null)}
                </td>
              ) : null}
              {isVisible('cnpsNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.cnpsNumber)}
                </td>
              ) : null}
              {isVisible('cnpsDeclarationCode') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.cnpsDeclarationCode)}
                </td>
              ) : null}
              {isVisible('provenance') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(expatProfile?.provenance)}
                </td>
              ) : null}
              {isVisible('frenchName') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.frenchName)}
                </td>
              ) : null}
              {isVisible('idNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.idNumber)}
                </td>
              ) : null}
              {isVisible('passportNumber') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.passportNumber)}
                </td>
              ) : null}
              {isVisible('educationAndMajor') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.educationAndMajor)}
                </td>
              ) : null}
              {isVisible('certifications') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileList(chineseProfile?.certifications)}
                </td>
              ) : null}
              {isVisible('domesticMobile') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.domesticMobile)}
                </td>
              ) : null}
              {isVisible('emergencyContactName') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(
                    chineseProfile?.emergencyContactName ?? expatProfile?.emergencyContactName,
                  )}
                </td>
              ) : null}
              {isVisible('emergencyContactPhone') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(
                    chineseProfile?.emergencyContactPhone ?? expatProfile?.emergencyContactPhone,
                  )}
                </td>
              ) : null}
              {isVisible('redBookValidYears') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileNumber(chineseProfile?.redBookValidYears)}
                </td>
              ) : null}
              {isVisible('cumulativeAbroadYears') ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-700 align-middle">
                  {formatProfileNumber(chineseProfile?.cumulativeAbroadYears)}
                </td>
              ) : null}
              {isVisible('birthplace') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.birthplace)}
                </td>
              ) : null}
              {isVisible('residenceInChina') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.residenceInChina)}
                </td>
              ) : null}
              {isVisible('medicalHistory') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.medicalHistory)}
                </td>
              ) : null}
              {isVisible('healthStatus') ? (
                <td className="px-4 py-3 text-slate-700 align-middle">
                  {formatProfileText(chineseProfile?.healthStatus)}
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
  )
}
