'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  employmentStatusLabels,
  genderOptions,
  memberCopy,
  nationalityOptions,
} from '@/lib/i18n/members'
import { formatSupervisorLabel, resolveTeamDisplayName } from '@/lib/members/utils'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { Member } from '@/types/members'

type Props = {
  member: Member | null
  open: boolean
  onClose: () => void
  onEdit: (member: Member) => void
  teamSupervisorMap: Map<string, { teamZh?: string | null }>
  canViewCompensation: boolean
  viewerNationality: string | null
}

type TabKey = 'overview' | 'contracts' | 'payroll' | 'documents'

type CompensationPayload = {
  contractChanges: Array<{
    id: number
    contractNumber: string | null
    contractType: string | null
    salaryCategory: string | null
    salaryAmount: string | null
    salaryUnit: 'MONTH' | 'HOUR' | null
    prime: string | null
    startDate: string | null
    endDate: string | null
    changeDate: string
    reason: string | null
    team: string | null
    chineseSupervisorName: string | null
    position: string | null
  }>
  payrollChanges: Array<{
    id: number
    salaryCategory: string | null
    salaryAmount: string | null
    salaryUnit: 'MONTH' | 'HOUR' | null
    prime: string | null
    baseSalaryAmount: string | null
    baseSalaryUnit: 'MONTH' | 'HOUR' | null
    netMonthlyAmount: string | null
    netMonthlyUnit: 'MONTH' | 'HOUR' | null
    changeDate: string
  }>
  payrollPayouts: Array<{
    id: number
    runId: number | null
    payoutDate: string
    amount: string
    currency: string | null
    note: string | null
    team: string | null
    chineseSupervisorName: string | null
  }>
}

export function MemberDetailDrawer({
  member,
  open,
  onClose,
  onEdit,
  teamSupervisorMap,
  canViewCompensation,
  viewerNationality,
}: Props) {
  const { locale } = usePreferredLocale()
  const t = memberCopy[locale]
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])
  const [compensation, setCompensation] = useState<CompensationPayload | null>(null)
  const [compensationLoading, setCompensationLoading] = useState(false)
  const [compensationError, setCompensationError] = useState<string | null>(null)
  const memberId = member?.id ?? null
  const isViewerChinese = viewerNationality === 'china'
  const showCompensationTabs = member?.nationality !== 'china'
  const canShowCompensation = canViewCompensation && showCompensationTabs

  useEffect(() => {
    if (!open || !member) return
    setActiveTab('overview')
  }, [open, member, memberId])

  useEffect(() => {
    if (!open || !member) return
    setCompensation(null)
    setCompensationError(null)
    if (!canShowCompensation) return
    let cancelled = false
    const loadCompensation = async () => {
      setCompensationLoading(true)
      try {
        const res = await fetch(`/api/members/${member.id}/compensation`)
        if (!res.ok) {
          throw new Error(t.feedback.loadError)
        }
        const data = (await res.json()) as CompensationPayload
        if (!cancelled) {
          setCompensation(data)
        }
      } catch (error) {
        if (!cancelled) {
          setCompensationError(error instanceof Error ? error.message : t.feedback.loadError)
        }
      } finally {
        if (!cancelled) {
          setCompensationLoading(false)
        }
      }
    }
    void loadCompensation()
    return () => {
      cancelled = true
    }
  }, [open, member, memberId, canShowCompensation, t.feedback.loadError])

  if (!open || !member) return null

  const findNationalityLabel = (value: string | null) => {
    const option = nationalityOptions.find((item) => item.key === value)
    return option ? option.label[locale] : value || t.labels.empty
  }

  const findGenderLabel = (value: string | null) => {
    const option = genderOptions.find((item) => item.value === value)
    return option ? option.label[locale] : value || t.labels.empty
  }

  const formatList = (values?: string[] | null) =>
    values && values.length ? values.join(' / ') : t.labels.empty

  const formatDate = (value?: string | null) => {
    if (!value) return t.labels.empty
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleDateString(locale)
  }

  const formatDateTime = (value?: string | null) => {
    if (!value) return t.labels.empty
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value
    return parsed.toLocaleString(locale)
  }

  const formatAmount = (amount?: string | null, currency?: string | null) => {
    if (amount === null || amount === undefined || amount === '') return t.labels.empty
    const numericAmount = Number(amount)
    const formattedAmount = Number.isNaN(numericAmount) ? amount : numberFormatter.format(numericAmount)
    return currency ? `${formattedAmount} ${currency}` : formattedAmount
  }

  const formatSalary = (
    amount?: string | null,
    unit?: 'MONTH' | 'HOUR' | null,
    fallbackUnit?: 'MONTH' | 'HOUR' | null,
  ) => {
    if (amount === null || amount === undefined || amount === '') return t.labels.empty
    const resolvedUnit = unit ?? fallbackUnit
    const numericAmount = Number(amount)
    const formattedAmount = Number.isNaN(numericAmount) ? amount : numberFormatter.format(numericAmount)
    if (!resolvedUnit) return formattedAmount
    const unitLabel = resolvedUnit === 'MONTH' ? t.form.salaryUnitMonth : t.form.salaryUnitHour
    return `${formattedAmount} / ${unitLabel}`
  }
  const formatSupervisor = () => {
    const supervisor = member.expatProfile?.chineseSupervisor
    const label = formatSupervisorLabel({
      name: supervisor?.name ?? null,
      frenchName: supervisor?.chineseProfile?.frenchName ?? null,
      username: supervisor?.username ?? null,
    })
    return label || t.labels.empty
  }

  const teamLabel = resolveTeamDisplayName(
    member.expatProfile?.team ?? null,
    locale,
    teamSupervisorMap,
  )

  const sections = [
    { key: 'overview', label: t.drawer.tabs.overview },
    ...(showCompensationTabs
      ? ([
          { key: 'contracts', label: t.drawer.tabs.contracts },
          { key: 'payroll', label: t.drawer.tabs.payroll },
          // { key: 'documents', label: '档案 Documents' },
        ] as const)
      : []),
  ] as const
  const displayName = member.name?.length ? member.name : t.labels.empty
  const contractChanges = compensation?.contractChanges ?? []
  const payrollChanges = compensation?.payrollChanges ?? []
  const payrollPayouts = compensation?.payrollPayouts ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 sm:px-6" aria-labelledby="member-detail-title" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-slate-900/60" onClick={onClose} />
      <div className="relative w-full max-w-5xl">
        <div
          className="max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex max-h-[90vh] flex-col">
            <div className="bg-slate-900 px-4 py-6 sm:px-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold leading-6 text-white" id="member-detail-title">
                    {displayName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {member.username} • {findNationalityLabel(member.nationality)}
                  </p>
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <button
                    onClick={() => onEdit(member)}
                    className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-200 hover:border-sky-400 hover:bg-sky-500/20"
                  >
                    {t.actions.edit}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 text-slate-400 hover:text-white focus:outline-none"
                    onClick={onClose}
                  >
                    <span className="sr-only">{t.labels.close}</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700/20">
                  {findGenderLabel(member.gender)}
                </span>
                <span
                  className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                    member.employmentStatus === 'ACTIVE'
                      ? 'bg-green-400/10 text-green-400 ring-green-400/20'
                      : 'bg-red-400/10 text-red-400 ring-red-400/20'
                  }`}
                >
                  {employmentStatusLabels[locale][member.employmentStatus]}
                </span>
                {member.position && (
                  <span className="inline-flex items-center rounded-md bg-sky-400/10 px-2 py-1 text-xs font-medium text-sky-400 ring-1 ring-inset ring-sky-400/20">
                    {member.position}
                  </span>
                )}
              </div>
            </div>

            <div className="border-b border-gray-200">
              <nav className="-mb-px flex flex-wrap gap-6 px-6" aria-label="Tabs">
                {sections.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabKey)}
                    className={`
                      whitespace-nowrap border-b-2 py-3 text-sm font-medium
                      ${activeTab === tab.key
                        ? 'border-sky-600 text-sky-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}
                    `}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-4 border-b pb-2 text-sm font-medium leading-6 text-gray-900">
                      {t.drawer.sections.basicInfo}
                    </h3>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                      <DetailItem label={t.table.phones} value={formatList(member.phones)} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.birthDate} value={formatDate(member.birthDate)} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.joinDate} value={formatDate(member.joinDate)} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.terminationDate} value={formatDate(member.terminationDate)} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.terminationReason} value={member.terminationReason ?? ''} emptyLabel={t.labels.empty} />
                      <DetailItem
                        label={t.table.roles}
                        value={member.roles.map((role) => role.name).join(', ') || t.labels.empty}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem label={t.table.tags} value={formatList(member.tags)} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.project} value={member.project?.name ?? ''} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.team} value={teamLabel} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.chineseSupervisor} value={formatSupervisor()} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.createdAt} value={formatDateTime(member.createdAt)} emptyLabel={t.labels.empty} />
                      <DetailItem label={t.table.updatedAt} value={formatDateTime(member.updatedAt)} emptyLabel={t.labels.empty} />
                    </dl>
                  </section>

                  {member.nationality !== 'china' && (
                    <section>
                      <h3 className="mb-4 mt-6 border-b pb-2 text-sm font-medium leading-6 text-gray-900">
                        {t.drawer.sections.personal}
                      </h3>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                        <DetailItem label={t.table.maritalStatus} value={member.expatProfile?.maritalStatus ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem
                          label={t.table.childrenCount}
                          value={member.expatProfile?.childrenCount?.toString() ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                        <DetailItem label={t.table.provenance} value={member.expatProfile?.provenance ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem label={t.table.cnpsNumber} value={member.expatProfile?.cnpsNumber ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem
                          label={t.table.cnpsDeclarationCode}
                          value={member.expatProfile?.cnpsDeclarationCode ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                      </dl>
                    </section>
                  )}

                  {member.nationality === 'china' && isViewerChinese && (
                    <section>
                      <h3 className="mb-4 mt-6 border-b pb-2 text-sm font-medium leading-6 text-gray-900">
                        {t.drawer.sections.chineseProfile}
                      </h3>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                        <DetailItem label={t.table.frenchName} value={member.chineseProfile?.frenchName ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem label={t.table.idNumber} value={member.chineseProfile?.idNumber ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem label={t.table.passportNumber} value={member.chineseProfile?.passportNumber ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem
                          label={t.table.educationAndMajor}
                          value={member.chineseProfile?.educationAndMajor ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                        <DetailItem
                          label={t.table.domesticMobile}
                          value={member.chineseProfile?.domesticMobile ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                        <DetailItem label={t.table.birthplace} value={member.chineseProfile?.birthplace ?? ''} emptyLabel={t.labels.empty} />
                        <DetailItem
                          label={t.table.residenceInChina}
                          value={member.chineseProfile?.residenceInChina ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                        <DetailItem
                          label={t.table.emergencyContactName}
                          value={member.chineseProfile?.emergencyContactName ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                        <DetailItem
                          label={t.table.emergencyContactPhone}
                          value={member.chineseProfile?.emergencyContactPhone ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                      </dl>
                    </section>
                  )}

                  {member.nationality !== 'china' && (
                    <section>
                      <h3 className="mb-4 mt-6 border-b pb-2 text-sm font-medium leading-6 text-gray-900">
                        {t.drawer.sections.emergencyContact}
                      </h3>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                        <DetailItem
                          label={t.table.emergencyContactName}
                          value={member.expatProfile?.emergencyContactName ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                        <DetailItem
                          label={t.table.emergencyContactPhone}
                          value={member.expatProfile?.emergencyContactPhone ?? ''}
                          emptyLabel={t.labels.empty}
                        />
                      </dl>
                    </section>
                  )}
                </div>
              )}

              {showCompensationTabs && activeTab === 'contracts' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-4 border-b pb-2 text-sm font-medium leading-6 text-gray-900">
                      {t.drawer.sections.contract}
                    </h3>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                      <DetailItem
                        label={t.table.contractNumber}
                        value={member.expatProfile?.contractNumber ?? ''}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.contractType}
                        value={member.expatProfile?.contractType ?? ''}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.contractStartDate}
                        value={formatDate(member.expatProfile?.contractStartDate)}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.contractEndDate}
                        value={formatDate(member.expatProfile?.contractEndDate)}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.salaryCategory}
                        value={member.expatProfile?.salaryCategory ?? ''}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.team}
                        value={teamLabel}
                        emptyLabel={t.labels.empty}
                      />
                    </dl>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-medium leading-6 text-gray-900">
                        {t.compensation.contractChanges}
                      </h3>
                      {compensationLoading && (
                        <span className="text-xs text-gray-400">{t.feedback.loading}</span>
                      )}
                    </div>
                    {!canShowCompensation && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {t.errors.needMemberUpdate}
                      </div>
                    )}
                    {compensationError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {compensationError}
                      </div>
                    )}
                    {canShowCompensation && (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">{t.compensation.fields.changeDate}</th>
                              <th className="px-4 py-3">{t.table.contractNumber}</th>
                              <th className="px-4 py-3">{t.table.contractType}</th>
                              <th className="px-4 py-3">{t.compensation.fields.startDate}</th>
                              <th className="px-4 py-3">{t.compensation.fields.endDate}</th>
                              <th className="px-4 py-3">{t.compensation.fields.reason}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {contractChanges.length === 0 ? (
                              <tr>
                                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={6}>
                                  {t.feedback.emptyHistory}
                                </td>
                              </tr>
                            ) : (
                              contractChanges.map((item) => (
                                <tr key={item.id} className="text-slate-700">
                                  <td className="px-4 py-3">{formatDate(item.changeDate)}</td>
                                  <td className="px-4 py-3">{item.contractNumber ?? t.labels.empty}</td>
                                  <td className="px-4 py-3">{item.contractType ?? t.labels.empty}</td>
                                  <td className="px-4 py-3">{formatDate(item.startDate)}</td>
                                  <td className="px-4 py-3">{formatDate(item.endDate)}</td>
                                  <td className="px-4 py-3">{item.reason || t.labels.empty}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {showCompensationTabs && activeTab === 'payroll' && (
                <div className="space-y-6">
                  <section>
                    <h3 className="mb-4 border-b pb-2 text-sm font-medium leading-6 text-gray-900">
                      {t.drawer.sections.salary}
                    </h3>
                    <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                      <DetailItem
                        label={t.table.salaryCategory}
                        value={member.expatProfile?.salaryCategory ?? ''}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.prime}
                        value={formatAmount(member.expatProfile?.prime)}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.baseSalary}
                        value={formatSalary(member.expatProfile?.baseSalaryAmount, member.expatProfile?.baseSalaryUnit)}
                        emptyLabel={t.labels.empty}
                      />
                      <DetailItem
                        label={t.table.netMonthly}
                        value={formatSalary(member.expatProfile?.netMonthlyAmount, member.expatProfile?.netMonthlyUnit, 'MONTH')}
                        emptyLabel={t.labels.empty}
                      />
                    </dl>
                  </section>

                  <section>
                    <div className="mb-4 flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-medium leading-6 text-gray-900">
                        {t.compensation.payrollChanges}
                      </h3>
                      {compensationLoading && (
                        <span className="text-xs text-gray-400">{t.feedback.loading}</span>
                      )}
                    </div>
                    {!canShowCompensation && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {t.errors.needMemberUpdate}
                      </div>
                    )}
                    {compensationError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {compensationError}
                      </div>
                    )}
                    {canShowCompensation && (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">{t.compensation.fields.changeDate}</th>
                              <th className="px-4 py-3">{t.table.salaryCategory}</th>
                              <th className="px-4 py-3">{t.table.baseSalary}</th>
                              <th className="px-4 py-3">{t.table.netMonthly}</th>
                              <th className="px-4 py-3">{t.table.prime}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {payrollChanges.length === 0 ? (
                              <tr>
                                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={5}>
                                  {t.feedback.emptyHistory}
                                </td>
                              </tr>
                            ) : (
                              payrollChanges.map((item) => (
                                <tr key={item.id} className="text-slate-700">
                                  <td className="px-4 py-3">{formatDate(item.changeDate)}</td>
                                  <td className="px-4 py-3">{item.salaryCategory ?? t.labels.empty}</td>
                                  <td className="px-4 py-3">
                                    {formatSalary(item.baseSalaryAmount, item.baseSalaryUnit)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {formatSalary(item.netMonthlyAmount, item.netMonthlyUnit, 'MONTH')}
                                  </td>
                                  <td className="px-4 py-3">{formatAmount(item.prime)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="mb-4 flex items-center justify-between border-b pb-2">
                      <h3 className="text-sm font-medium leading-6 text-gray-900">
                        {t.compensation.payrollPayouts}
                      </h3>
                      {compensationLoading && (
                        <span className="text-xs text-gray-400">{t.feedback.loading}</span>
                      )}
                    </div>
                    {!canShowCompensation && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                        {t.errors.needMemberUpdate}
                      </div>
                    )}
                    {compensationError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                        {compensationError}
                      </div>
                    )}
                    {canShowCompensation && (
                      <div className="overflow-hidden rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">{t.compensation.fields.payoutDate}</th>
                              <th className="px-4 py-3">{t.compensation.fields.amount}</th>
                              <th className="px-4 py-3">{t.compensation.fields.currency}</th>
                              <th className="px-4 py-3">{t.compensation.fields.note}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {payrollPayouts.length === 0 ? (
                              <tr>
                                <td className="px-4 py-6 text-center text-sm text-slate-400" colSpan={4}>
                                  {t.feedback.emptyHistory}
                                </td>
                              </tr>
                            ) : (
                              payrollPayouts.map((item) => (
                                <tr key={item.id} className="text-slate-700">
                                  <td className="px-4 py-3">{formatDate(item.payoutDate)}</td>
                                  <td className="px-4 py-3">{formatAmount(item.amount, item.currency)}</td>
                                  <td className="px-4 py-3">{item.currency ?? t.labels.empty}</td>
                                  <td className="px-4 py-3">{item.note || t.labels.empty}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailItem({
  label,
  value,
  emptyLabel,
}: {
  label: string
  value?: string | null
  emptyLabel: string
}) {
  const displayValue = value === null || value === undefined || value === '' ? emptyLabel : value
  return (
    <div className="sm:col-span-1">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{displayValue}</dd>
    </div>
  )
}
