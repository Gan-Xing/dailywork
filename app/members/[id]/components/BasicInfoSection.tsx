import type { Dispatch, RefObject, SetStateAction } from 'react'

import {
  genderOptions,
  nationalityRegionLabels,
  type NationalityOption,
  type NationalityRegion,
} from '@/lib/i18n/members'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

import type { FormState } from '../types'
import { PhonePicker } from './PhonePicker'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type BasicInfoSectionProps = {
  t: MemberCopy
  locale: Locale
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
  nationalityByRegion: Map<NationalityRegion, NationalityOption[]>
  phoneSummary: string
  phoneInput: string
  onPhoneInputChange: (value: string) => void
  onAddPhone: () => void
  onRemovePhone: (index: number) => void
  showPhonePicker: boolean
  onTogglePhonePicker: () => void
  phonePickerRef: RefObject<HTMLDivElement>
}

export function BasicInfoSection({
  t,
  locale,
  formState,
  setFormState,
  nationalityByRegion,
  phoneSummary,
  phoneInput,
  onPhoneInputChange,
  onAddPhone,
  onRemovePhone,
  showPhonePicker,
  onTogglePhonePicker,
  phonePickerRef,
}: BasicInfoSectionProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block font-semibold">{t.form.name}</span>
          <input
            value={formState.name}
            onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder="陈蓉 / Marie Dupont"
          />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block font-semibold">{t.form.username}</span>
          <input
            value={formState.username}
            onChange={(event) => setFormState((prev) => ({ ...prev, username: event.target.value }))}
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder={t.form.passwordPlaceholder}
          />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span className="block font-semibold">{t.form.gender}</span>
          <select
            value={formState.gender}
            onChange={(event) => setFormState((prev) => ({ ...prev, gender: event.target.value }))}
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          >
            <option value="">{t.form.nationalityPlaceholder}</option>
            {Array.from(nationalityByRegion.entries()).map(([region, options]) => (
              <optgroup key={region} label={nationalityRegionLabels[locale][region]}>
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
            value={formState.position}
            onChange={(event) =>
              setFormState((prev) => ({
                ...prev,
                position: event.target.value,
              }))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
            placeholder={t.form.positionPlaceholder}
          />
        </label>
        <label className="space-y-2 text-sm text-slate-700 sm:col-span-2">
          <span className="block font-semibold">{t.form.phones}</span>
          <PhonePicker
            t={t}
            phones={formState.phones}
            phoneInput={phoneInput}
            onPhoneInputChange={onPhoneInputChange}
            onAddPhone={onAddPhone}
            onRemovePhone={onRemovePhone}
            showPhonePicker={showPhonePicker}
            onTogglePicker={onTogglePhonePicker}
            phonePickerRef={phonePickerRef}
            phoneSummary={phoneSummary}
          />
        </label>
      </div>
    </>
  )
}
