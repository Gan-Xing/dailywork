import type { Dispatch, SetStateAction } from 'react'

import { memberCopy } from '@/lib/i18n/members'

import type { FormState } from '../types'
import { parseBirthDateFromIdNumber } from '../utils'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type ChineseProfileFieldsProps = {
  t: MemberCopy
  formState: FormState
  setFormState: Dispatch<SetStateAction<FormState>>
}

export function ChineseProfileFields({ t, formState, setFormState }: ChineseProfileFieldsProps) {
  return (
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
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
        />
      </label>
    </div>
  )
}
