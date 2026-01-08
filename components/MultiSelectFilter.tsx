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
  className?: string
  allLabel: string
  selectedLabel: (count: number) => string
  selectAllLabel: string
  clearLabel: string
  searchPlaceholder?: string
  noOptionsLabel?: string
  searchable?: boolean
  disabled?: boolean
  multiple?: boolean
  variant?: 'filter' | 'form'
  zIndex?: number
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  className,
  allLabel,
  selectedLabel,
  selectAllLabel,
  clearLabel,
  searchPlaceholder,
  noOptionsLabel,
  searchable = true,
  disabled = false,
  multiple = true,
  variant = 'filter',
  zIndex = 20,
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

  const isForm = variant === 'form'
  const buttonClassName = isForm
    ? 'flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-left text-sm text-slate-700 shadow-sm transition focus:border-emerald-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'
    : 'flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 shadow-inner shadow-slate-900/5 transition focus:border-sky-400 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400'

  return (
    <div
      className={`flex flex-col gap-1 text-xs text-slate-600${className ? ` ${className}` : ''}`}
      ref={containerRef}
    >
      {!isForm && (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
          {label}
        </span>
      )}
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
          className={buttonClassName}
        >
          <span className="truncate" title={summaryText}>
            {summaryText}
          </span>
          <span className="text-xs text-slate-400">v</span>
        </button>
        {open ? (
          <div
            className="absolute mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl shadow-slate-200/80"
            style={{ zIndex }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-[11px] text-slate-400">
              <span>{summaryText}</span>
              <div className="flex gap-2">
                {multiple && (
                  <button
                    type="button"
                    className="text-sky-600 hover:text-sky-700 hover:underline"
                    onClick={() => onChange(options.map((option) => option.value))}
                  >
                    {selectAllLabel}
                  </button>
                )}
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
              {filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value)
                return (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition ${
                      isSelected ? 'bg-emerald-50 text-emerald-900' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate" title={option.label}>
                      {option.label}
                    </span>
                    <input
                      type={multiple ? 'checkbox' : 'radio'}
                      checked={isSelected}
                      onChange={() => {
                        if (multiple) {
                          onChange(
                            isSelected
                              ? selected.filter((value) => value !== option.value)
                              : [...selected, option.value],
                          )
                        } else {
                          onChange([option.value])
                          setOpen(false)
                          setQuery('')
                        }
                      }}
                      className="sr-only"
                    />
                    {isSelected && (
                      <svg
                        className="h-4 w-4 shrink-0 text-emerald-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </label>
                )
              })}
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
