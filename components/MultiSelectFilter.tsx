'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type MultiSelectOption = {
  value: string
  label: string
}

type Props = {
  label: string
  options: MultiSelectOption[]
  selected: string[]
  onChange: (next: string[]) => void
  allLabel: string
  selectedLabel: (count: number) => string
  selectAllLabel: string
  clearLabel: string
  searchPlaceholder?: string
  noOptionsLabel?: string
  searchable?: boolean
  disabled?: boolean
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  allLabel,
  selectedLabel,
  selectAllLabel,
  clearLabel,
  searchPlaceholder,
  noOptionsLabel,
  searchable = true,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = useMemo(() => {
    if (!searchable || query.trim() === '') return options
    const term = query.trim().toLowerCase()
    return options.filter((option) => {
      const labelValue = option.label.toLowerCase()
      const valueValue = option.value.toLowerCase()
      return labelValue.includes(term) || valueValue.includes(term)
    })
  }, [options, query, searchable])

  const summaryText = selected.length === 0 ? allLabel : selectedLabel(selected.length)

  return (
    <div className="flex flex-col gap-1 text-xs text-slate-500" ref={containerRef}>
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          onClick={() => {
            if (open) {
              setOpen(false)
              setQuery('')
            } else {
              setOpen(true)
            }
          }}
          className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-inner shadow-slate-900/5 transition focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <span className="truncate">{summaryText}</span>
          <span className="text-xs text-slate-400">v</span>
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl shadow-slate-200/80">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-400">
              <span>{summaryText}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-sky-600 hover:text-sky-700 hover:underline"
                  onClick={() => onChange(options.map((option) => option.value))}
                >
                  {selectAllLabel}
                </button>
                <button
                  type="button"
                  className="text-slate-500 hover:text-slate-600 hover:underline"
                  onClick={() => onChange([])}
                >
                  {clearLabel}
                </button>
              </div>
            </div>
            {searchable ? (
              <div className="mt-2">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-400 focus:outline-none"
                />
              </div>
            ) : null}
            <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
              {filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.value)}
                    onChange={() => {
                      onChange(
                        selected.includes(option.value)
                          ? selected.filter((value) => value !== option.value)
                          : [...selected, option.value],
                      )
                    }}
                    className="h-4 w-4 rounded border-slate-300 bg-white accent-sky-500"
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))}
              {filteredOptions.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-slate-400">
                  {noOptionsLabel ?? 'No options'}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
