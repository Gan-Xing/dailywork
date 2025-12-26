'use client'

import { useMemo, useState } from 'react'
import {
  employmentStatusLabels,
  genderOptions,
  memberCopy,
  nationalityOptions,
} from '@/lib/i18n/members'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import type { Member } from '@/types/members'

type Props = {
  member: Member | null
  open: boolean
  onClose: () => void
  onEdit: (member: Member) => void
}

type TabKey = 'overview' | 'contracts' | 'payroll' | 'documents'

export function MemberDetailDrawer({ member, open, onClose, onEdit }: Props) {
  const { locale } = usePreferredLocale()
  const t = memberCopy[locale]
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale])

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
    const frenchName = supervisor?.chineseProfile?.frenchName?.trim()
    return frenchName || supervisor?.username || t.labels.empty
  }

  const sections = [
    { key: 'overview', label: t.drawer.tabs.overview },
    { key: 'contracts', label: t.drawer.tabs.contracts },
    { key: 'payroll', label: t.drawer.tabs.payroll },
    // { key: 'documents', label: '档案 Documents' },
  ] as const
  const displayName = member.name?.length ? member.name : t.labels.empty

  return (
    <div className="relative z-50" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
      {/* Background backdrop */}
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
            <div className="pointer-events-auto w-screen max-w-2xl transform transition duration-500 sm:duration-700">
              <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                {/* Header */}
                <div className="bg-slate-900 px-4 py-6 sm:px-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold leading-6 text-white" id="slide-over-title">
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
                  <div className="mt-4 flex gap-2">
                    <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300 ring-1 ring-inset ring-slate-700/20">
                      {findGenderLabel(member.gender)}
                    </span>
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      member.employmentStatus === 'ACTIVE' 
                        ? 'bg-green-400/10 text-green-400 ring-green-400/20' 
                        : 'bg-red-400/10 text-red-400 ring-red-400/20'
                    }`}>
                      {employmentStatusLabels[locale][member.employmentStatus]}
                    </span>
                    {member.position && (
                       <span className="inline-flex items-center rounded-md bg-sky-400/10 px-2 py-1 text-xs font-medium text-sky-400 ring-1 ring-inset ring-sky-400/20">
                         {member.position}
                       </span>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200">
                  <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                    {sections.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as TabKey)}
                        className={`
                          whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium
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

                {/* Content */}
                <div className="flex-1 px-4 py-6 sm:px-6">
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Basic Info Group */}
                      <section>
                        <h3 className="text-sm font-medium leading-6 text-gray-900 border-b pb-2 mb-4">
                          {t.drawer.sections.basicInfo}
                        </h3>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                          <DetailItem label={t.table.phones} value={formatList(member.phones)} emptyLabel={t.labels.empty} />
                          <DetailItem label={t.table.birthDate} value={formatDate(member.birthDate)} emptyLabel={t.labels.empty} />
                          <DetailItem label={t.table.joinDate} value={formatDate(member.joinDate)} emptyLabel={t.labels.empty} />
                          <DetailItem
                            label={t.table.roles}
                            value={member.roles.map((role) => role.name).join(', ') || t.labels.empty}
                            emptyLabel={t.labels.empty}
                          />
                          <DetailItem label={t.table.tags} value={formatList(member.tags)} emptyLabel={t.labels.empty} />
                          <DetailItem label={t.table.team} value={member.expatProfile?.team ?? ''} emptyLabel={t.labels.empty} />
                          <DetailItem label={t.table.chineseSupervisor} value={formatSupervisor()} emptyLabel={t.labels.empty} />
                        </dl>
                      </section>

                      {/* Contract Info */}
                      <section>
                         <h3 className="text-sm font-medium leading-6 text-gray-900 border-b pb-2 mb-4 mt-6">
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
                         </dl>
                      </section>

                      {/* Salary Info */}
                      <section>
                        <h3 className="text-sm font-medium leading-6 text-gray-900 border-b pb-2 mb-4 mt-6">
                          {t.drawer.sections.salary}
                        </h3>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
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

                       {/* Personal Details */}
                       <section>
                        <h3 className="text-sm font-medium leading-6 text-gray-900 border-b pb-2 mb-4 mt-6">
                          {t.drawer.sections.personal}
                        </h3>
                        <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                           <DetailItem
                             label={t.table.maritalStatus}
                             value={member.expatProfile?.maritalStatus ?? ''}
                             emptyLabel={t.labels.empty}
                           />
                           <DetailItem
                             label={t.table.childrenCount}
                             value={member.expatProfile?.childrenCount?.toString() ?? ''}
                             emptyLabel={t.labels.empty}
                           />
                           <DetailItem
                             label={t.table.provenance}
                             value={member.expatProfile?.provenance ?? ''}
                             emptyLabel={t.labels.empty}
                           />
                           <DetailItem
                             label={t.table.cnpsNumber}
                             value={member.expatProfile?.cnpsNumber ?? ''}
                             emptyLabel={t.labels.empty}
                           />
                        </dl>
                      </section>
                      
                      {/* Chinese Profile Specifics */}
                      {member.nationality === 'china' && (
                        <section>
                          <h3 className="text-sm font-medium leading-6 text-gray-900 border-b pb-2 mb-4 mt-6">
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

                       {/* Expat Emergency Contact (if not chinese, usually) */}
                       {member.nationality !== 'china' && (
                          <section>
                            <h3 className="text-sm font-medium leading-6 text-gray-900 border-b pb-2 mb-4 mt-6">
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

                  {activeTab === 'contracts' && (
                    <div className="text-center py-10 text-gray-500">
                      <div className="mx-auto h-12 w-12 text-gray-300 mb-3">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                           <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <p>{t.drawer.comingSoon.contracts}</p>
                    </div>
                  )}

                  {activeTab === 'payroll' && (
                    <div className="text-center py-10 text-gray-500">
                      <div className="mx-auto h-12 w-12 text-gray-300 mb-3">
                         <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                      </div>
                      <p>{t.drawer.comingSoon.payroll}</p>
                    </div>
                  )}
                </div>
              </div>
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
