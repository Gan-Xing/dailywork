import { useState, type Dispatch, type FormEvent, type RefObject, type SetStateAction } from 'react'

import type { Locale } from '@/lib/i18n'
import {
  memberCopy,
  genderOptions,
  nationalityRegionLabels,
  type EmploymentStatus,
  type NationalityRegion,
  type NationalityOption,
} from '@/lib/i18n/members'
import { normalizeTagsInput, parseBirthDateFromIdNumber } from '@/lib/members/utils'
import type { ExpatProfileForm, MemberFormState as FormState, Role } from '@/types/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type MemberFormModalProps = {
  t: MemberCopy
  open: boolean
  modalTitle: string
  modalSubtitle: string
  locale: Locale
  formMode: 'create' | 'view'
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
  rolesData: Role[]
  canAssignRole: boolean
  onToggleRole: (roleId: number) => void
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  positionOptions: string[]
  teamOptions: string[]
  chineseSupervisorOptions: { value: string; label: string }[]
  nationalityByRegion: Map<NationalityRegion, NationalityOption[]>
  statusLabels: Record<EmploymentStatus, string>
  isChineseForm: boolean
  profileExpanded: boolean
  setProfileExpanded: Dispatch<SetStateAction<boolean>>
  showPhonePicker: boolean
  setShowPhonePicker: Dispatch<SetStateAction<boolean>>
  phoneInput: string
  setPhoneInput: Dispatch<SetStateAction<string>>
  addPhoneFromInput: () => void
  removePhone: (index: number) => void
  phonePickerRef: RefObject<HTMLDivElement>
  actionError: string | null
  submitting: boolean
}

export function MemberFormModal({
  t,
  open,
  modalTitle,
  modalSubtitle,
  locale,
  formMode,
  formState,
  setFormState,
  rolesData,
  canAssignRole,
  onToggleRole,
  onClose,
  onSubmit,
  positionOptions,
  teamOptions,
  chineseSupervisorOptions,
  nationalityByRegion,
  statusLabels,
  isChineseForm,
  profileExpanded,
  setProfileExpanded,
  showPhonePicker,
  setShowPhonePicker,
  phoneInput,
  setPhoneInput,
  addPhoneFromInput,
  removePhone,
  phonePickerRef,
  actionError,
  submitting,
}: MemberFormModalProps) {
  const [tagsInput, setTagsInput] = useState(() => formState.tags.join('\n'))

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl shadow-slate-900/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-slate-900">{modalTitle}</p>
            <p className="text-sm text-slate-500">{modalSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            X
          </button>
        </div>

        <form
          className="mt-4 grid gap-4"
          onSubmit={onSubmit}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.name}</span>
              <input
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder={t.form.namePlaceholder}
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.username}</span>
              <input
                value={formState.username}
                onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder="chen.rong"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.password}</span>
              <input
                type="password"
                value={formState.password}
                onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder={t.form.passwordPlaceholder}
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.gender}</span>
              <select
                value={formState.gender}
                onChange={(event) => setFormState((prev) => ({ ...prev, gender: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {genderOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label[locale]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.nationality}</span>
              <select
                value={formState.nationality}
                onChange={(event) => setFormState((prev) => ({ ...prev, nationality: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                <option value="">{t.form.nationalityPlaceholder}</option>
                {Array.from(nationalityByRegion.entries()).map(([region, options]) => (
                  <optgroup key={region} label={nationalityRegionLabels[locale][region as NationalityRegion]}>
                    {options.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label[locale]}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.position}</span>
              <input
                list="position-options"
                value={formState.position}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    position: event.target.value,
                  }))
                }
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder={t.form.positionPlaceholder}
              />
              <datalist id="position-options">
                {positionOptions.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </label>
            <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
              <span className="block font-semibold">{t.form.phones}</span>
              <div className="relative" ref={phonePickerRef}>
                <button
                  type="button"
                  disabled={formMode === 'view'}
                  onClick={() => setShowPhonePicker((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span>
                    {formState.phones.length ? t.form.phoneSaved(formState.phones.length) : t.form.phonePlaceholder}
                  </span>
                  <span className="text-xs text-slate-500" aria-hidden>
                    ⌵
                  </span>
                </button>
                {showPhonePicker && formMode !== 'view' ? (
                  <div className="absolute z-20 mt-2 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl shadow-slate-900/10">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        list="phone-options"
                        value={phoneInput}
                        onChange={(event) => setPhoneInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ',') {
                            event.preventDefault()
                            addPhoneFromInput()
                          }
                        }}
                        className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                        placeholder={t.form.phonePlaceholder}
                      />
                      <datalist id="phone-options">
                        {formState.phones.map((phone) => (
                          <option key={phone} value={phone} />
                        ))}
                      </datalist>
                      <button
                        type="button"
                        onClick={addPhoneFromInput}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {t.form.addPhone}
                      </button>
                    </div>
                    <div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
                      {formState.phones.length === 0 ? (
                        <p className="text-xs text-slate-500">{t.labels.empty}</p>
                      ) : (
                        formState.phones.map((phone, index) => (
                          <div
                            key={`phone-${index}-${phone}`}
                            className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200"
                          >
                            <span className="truncate">{phone}</span>
                            <button
                              type="button"
                              onClick={() => removePhone(index)}
                              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                            >
                              {t.actions.delete}
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </label>
            <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
              <span className="block font-semibold">{t.form.tags}</span>
              <textarea
                rows={2}
                value={tagsInput}
                onChange={(event) => {
                  const nextValue = event.target.value
                  setTagsInput(nextValue)
                  setFormState((prev) => ({
                    ...prev,
                    tags: normalizeTagsInput(nextValue),
                  }))
                }}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                placeholder={t.form.tagsPlaceholder}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.joinDate}</span>
              <input
                type="date"
                value={formState.joinDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, joinDate: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.birthDate}</span>
              <input
                type="date"
                value={formState.birthDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, birthDate: event.target.value }))}
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
              />
            </label>
            <label className="space-y-1 text-sm text-slate-700">
              <span className="block font-semibold">{t.form.status}</span>
              <select
                value={formState.employmentStatus}
                onChange={(event) =>
                  setFormState((prev) => {
                    const nextStatus = event.target.value as EmploymentStatus
                    return {
                      ...prev,
                      employmentStatus: nextStatus,
                      ...(nextStatus === 'TERMINATED'
                        ? {}
                        : { terminationDate: '', terminationReason: '' }),
                    }
                  })
                }
                disabled={formMode === 'view'}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              >
                {(['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as EmploymentStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formState.employmentStatus === 'TERMINATED' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <span className="block font-semibold">{t.form.terminationDate}</span>
                <input
                  type="date"
                  value={formState.terminationDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, terminationDate: event.target.value }))
                  }
                  disabled={formMode === 'view'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <span className="block font-semibold">{t.form.terminationReason}</span>
                <textarea
                  rows={2}
                  value={formState.terminationReason}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, terminationReason: event.target.value }))
                  }
                  disabled={formMode === 'view'}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-100"
                />
              </label>
            </div>
          ) : null}

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <button
              type="button"
              onClick={() => setProfileExpanded((prev) => !prev)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {t.form.profileSection}
                </p>
                <p className="text-xs text-slate-500">
                  {isChineseForm ? t.form.profileChinaHint : t.form.profileExpatHint}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
                {profileExpanded ? t.form.collapse : t.form.expand}
              </span>
            </button>
            {profileExpanded ? (
              isChineseForm ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.frenchName}</span>
                    <input
                      value={formState.chineseProfile.frenchName}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, frenchName: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.idNumber}</span>
                    <input
                      value={formState.chineseProfile.idNumber}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          birthDate:
                            prev.birthDate || prev.nationality !== 'china'
                              ? prev.birthDate
                              : parseBirthDateFromIdNumber(event.target.value) || prev.birthDate,
                          chineseProfile: { ...prev.chineseProfile, idNumber: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.passportNumber}</span>
                    <input
                      value={formState.chineseProfile.passportNumber}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, passportNumber: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.educationAndMajor}</span>
                    <input
                      value={formState.chineseProfile.educationAndMajor}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, educationAndMajor: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                    <span className="block font-semibold">{t.form.certifications}</span>
                    <textarea
                      rows={2}
                      value={formState.chineseProfile.certifications.join('\n')}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: {
                            ...prev.chineseProfile,
                            certifications: event.target.value
                              .split(/[\/,，;\n]+/)
                              .map((item) => item.trim())
                              .filter(Boolean),
                          },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                      placeholder={t.form.certificationsPlaceholder}
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.domesticMobile}</span>
                    <input
                      value={formState.chineseProfile.domesticMobile}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, domesticMobile: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.emergencyContactName}</span>
                    <input
                      value={formState.chineseProfile.emergencyContactName}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, emergencyContactName: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.emergencyContactPhone}</span>
                    <input
                      value={formState.chineseProfile.emergencyContactPhone}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, emergencyContactPhone: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.redBookValidYears}</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.chineseProfile.redBookValidYears}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, redBookValidYears: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.cumulativeAbroadYears}</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.chineseProfile.cumulativeAbroadYears}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: {
                            ...prev.chineseProfile,
                            cumulativeAbroadYears: event.target.value,
                          },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.birthplace}</span>
                    <input
                      value={formState.chineseProfile.birthplace}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, birthplace: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.residenceInChina}</span>
                    <input
                      value={formState.chineseProfile.residenceInChina}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, residenceInChina: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                    <span className="block font-semibold">{t.form.medicalHistory}</span>
                    <textarea
                      rows={2}
                      value={formState.chineseProfile.medicalHistory}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, medicalHistory: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700 sm:col-span-2">
                    <span className="block font-semibold">{t.form.healthStatus}</span>
                    <textarea
                      rows={2}
                      value={formState.chineseProfile.healthStatus}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          chineseProfile: { ...prev.chineseProfile, healthStatus: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.team}</span>
                    <input
                      list="team-options"
                      value={formState.expatProfile.team}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, team: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                    <datalist id="team-options">
                      {teamOptions.map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.chineseSupervisor}</span>
                    <select
                      value={formState.expatProfile.chineseSupervisorId}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: {
                            ...prev.expatProfile,
                            chineseSupervisorId: event.target.value,
                          },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">{t.labels.empty}</option>
                      {chineseSupervisorOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.contractNumber}</span>
                    <input
                      value={formState.expatProfile.contractNumber}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, contractNumber: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.contractType}</span>
                    <select
                      value={formState.expatProfile.contractType}
                      onChange={(event) =>
                        setFormState((prev) => {
                          const nextType = event.target.value as ExpatProfileForm['contractType']
                          const nextUnit =
                            nextType === 'CDD' && prev.expatProfile.baseSalaryUnit === 'HOUR'
                              ? 'MONTH'
                              : prev.expatProfile.baseSalaryUnit
                          return {
                            ...prev,
                            expatProfile: {
                              ...prev.expatProfile,
                              contractType: nextType,
                              baseSalaryUnit: nextUnit,
                            },
                          }
                        })
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">{t.labels.empty}</option>
                      <option value="CTJ">CTJ</option>
                      <option value="CDD">CDD</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.contractStartDate}</span>
                    <input
                      type="date"
                      value={formState.expatProfile.contractStartDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, contractStartDate: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.contractEndDate}</span>
                    <input
                      type="date"
                      value={formState.expatProfile.contractEndDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, contractEndDate: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.salaryCategory}</span>
                    <input
                      value={formState.expatProfile.salaryCategory}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, salaryCategory: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.prime}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formState.expatProfile.prime}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, prime: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.baseSalaryAmount}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formState.expatProfile.baseSalaryAmount}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, baseSalaryAmount: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.baseSalaryUnit}</span>
                    <select
                      value={formState.expatProfile.baseSalaryUnit}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: {
                            ...prev.expatProfile,
                            baseSalaryUnit: event.target.value as ExpatProfileForm['baseSalaryUnit'],
                          },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="">{t.labels.empty}</option>
                      <option value="MONTH">{t.form.salaryUnitMonth}</option>
                      <option value="HOUR">{t.form.salaryUnitHour}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.netMonthlyAmount}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={formState.expatProfile.netMonthlyAmount}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: {
                            ...prev.expatProfile,
                            netMonthlyAmount: event.target.value,
                            netMonthlyUnit: 'MONTH',
                          },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.netMonthlyUnit}</span>
                    <select
                      value={formState.expatProfile.netMonthlyUnit || 'MONTH'}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: {
                            ...prev.expatProfile,
                            netMonthlyUnit: event.target.value as ExpatProfileForm['netMonthlyUnit'],
                          },
                        }))
                      }
                      disabled
                      className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    >
                      <option value="MONTH">{t.form.salaryUnitMonth}</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.maritalStatus}</span>
                    <input
                      value={formState.expatProfile.maritalStatus}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, maritalStatus: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.childrenCount}</span>
                    <input
                      type="number"
                      min={0}
                      value={formState.expatProfile.childrenCount}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, childrenCount: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.cnpsNumber}</span>
                    <input
                      value={formState.expatProfile.cnpsNumber}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, cnpsNumber: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.cnpsDeclarationCode}</span>
                    <input
                      value={formState.expatProfile.cnpsDeclarationCode}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, cnpsDeclarationCode: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.provenance}</span>
                    <input
                      value={formState.expatProfile.provenance}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, provenance: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.emergencyContactName}</span>
                    <input
                      value={formState.expatProfile.emergencyContactName}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, emergencyContactName: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="space-y-1 text-sm text-slate-700">
                    <span className="block font-semibold">{t.form.emergencyContactPhone}</span>
                    <input
                      value={formState.expatProfile.emergencyContactPhone}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          expatProfile: { ...prev.expatProfile, emergencyContactPhone: event.target.value },
                        }))
                      }
                      disabled={formMode === 'view'}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                </div>
              )
            ) : null}
          </div>

          {canAssignRole ? (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">{t.form.roles}</p>
              <div className="flex flex-wrap gap-2">
                {rolesData.map((role) => (
                  <label
                    key={role.id}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${
                      formState.roleIds.includes(role.id)
                        ? 'border-sky-300 bg-sky-50 text-sky-800'
                        : 'border-slate-200 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="accent-sky-600"
                      checked={formState.roleIds.includes(role.id)}
                      onChange={() => onToggleRole(role.id)}
                      disabled={formMode === 'view'}
                    />
                    {role.name}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {actionError ? <p className="text-sm text-rose-600">{actionError}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t.actions.cancel}
            </button>
            {formMode !== 'view' ? (
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-sky-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
              >
                {t.actions.save}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
