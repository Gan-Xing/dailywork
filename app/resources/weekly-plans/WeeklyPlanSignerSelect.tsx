import type { WeeklyPlanSignerOption } from './signerOptions'

export function WeeklyPlanSignerSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: WeeklyPlanSignerOption[]
  placeholder: string
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-700">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-slate-50"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={String(option.id)}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
