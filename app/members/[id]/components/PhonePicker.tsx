import type { RefObject } from 'react'

import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type PhonePickerProps = {
  t: MemberCopy
  phones: string[]
  phoneInput: string
  onPhoneInputChange: (value: string) => void
  onAddPhone: () => void
  onRemovePhone: (index: number) => void
  showPhonePicker: boolean
  onTogglePicker: () => void
  phonePickerRef: RefObject<HTMLDivElement>
  phoneSummary: string
}

export function PhonePicker({
  t,
  phones,
  phoneInput,
  onPhoneInputChange,
  onAddPhone,
  onRemovePhone,
  showPhonePicker,
  onTogglePicker,
  phonePickerRef,
  phoneSummary,
}: PhonePickerProps) {
  return (
    <div className="relative" ref={phonePickerRef}>
      <button
        type="button"
        onClick={onTogglePicker}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-white"
      >
        <span>{phoneSummary}</span>
        <span className="text-xs text-slate-500" aria-hidden>
          ⌵
        </span>
      </button>
      {showPhonePicker ? (
        <div className="absolute z-20 mt-2 w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-2xl shadow-slate-900/10">
          <div className="flex flex-wrap items-center gap-3">
            <input
              list="phone-options"
              value={phoneInput}
              onChange={(event) => onPhoneInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ',') {
                  event.preventDefault()
                  onAddPhone()
                }
              }}
              className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              placeholder={t.form.phonePlaceholder}
            />
            <datalist id="phone-options">
              {phones.map((phone) => (
                <option key={phone} value={phone} />
              ))}
            </datalist>
            <button
              type="button"
              onClick={onAddPhone}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t.form.addPhone}
            </button>
          </div>
          <div className="mt-3 max-h-36 space-y-1 overflow-y-auto">
            {phones.length === 0 ? (
              <p className="text-xs text-slate-500">{t.labels.empty}</p>
            ) : (
              phones.map((phone, index) => (
                <div
                  key={`phone-${index}-${phone}`}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800 ring-1 ring-slate-200"
                >
                  <span className="truncate">{phone}</span>
                  <button
                    type="button"
                    onClick={() => onRemovePhone(index)}
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
  )
}
