'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export type SingleSelectOption = { value: string; label: string; searchText?: string }

type Props = {
  label: string
  value: string
  options: SingleSelectOption[]
  placeholder: string
  searchPlaceholder?: string
  emptyLabel?: string
  onChange: (value: string) => void
  className?: string
  disabled?: boolean
}

export function SingleSelect({
  label,
  value,
  options,
  placeholder,
  searchPlaceholder = '搜索…',
  emptyLabel = '暂无选项',
  onChange,
  className,
  disabled,
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

  const selectedLabel = options.find((option) => option.value === value)?.label ?? ''
  const summaryText = selectedLabel || placeholder

  const filteredOptions = useMemo(() => {
    if (query.trim() === '') return options
    const term = query.trim().toLowerCase()
    return options.filter((option) => {
      const haystack = (option.searchText ?? option.label).toLowerCase()
      return haystack.includes(term)
    })
  }, [options, query])

  return (
    <div
      className={`flex flex-col gap-1 text-xs text-slate-600${className ? ` ${className}` : ''}`}
      ref={containerRef}
    >
      {label ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => {
            if (disabled) return
            if (open) {
              setOpen(false)
              setQuery('')
            } else {
              setOpen(true)
            }
          }}
          className="flex w-full items-center justify-between rounded-full border border-slate-200 bg-white px-4 py-2 text-left text-sm text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
        >
          <span className="truncate">{summaryText}</span>
          <span className="text-xs text-slate-400">v</span>
        </button>
        {open ? (
          <div className="absolute z-20 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-xl shadow-slate-200/80">
            <div className="mt-1">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
              />
            </div>
            <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
              {filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                  className={`flex w-full items-center rounded-lg px-2 py-1 text-left transition hover:bg-slate-50 ${
                    option.value === value ? 'bg-slate-100 font-semibold' : ''
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                </button>
              ))}
              {filteredOptions.length === 0 ? (
                <p className="px-2 py-1 text-[11px] text-slate-400">{emptyLabel}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
