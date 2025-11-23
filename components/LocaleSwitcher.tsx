'use client'

import { useState } from 'react'

import { localeLabels, locales, type Locale } from '@/lib/i18n'

type Variant = 'dark' | 'light'

type Props = {
  locale: Locale
  onChange: (locale: Locale) => void
  variant?: Variant
  className?: string
}

const variantStyles: Record<Variant, { button: string; panel: string; item: string }> = {
  dark: {
    button:
      'border-white/15 bg-slate-900/80 text-slate-50 shadow-lg shadow-slate-900/40 hover:border-white/30 hover:bg-slate-900/90',
    panel:
      'border-white/10 bg-slate-900/90 text-slate-50 shadow-xl shadow-slate-900/60 backdrop-blur',
    item: 'hover:bg-white/10',
  },
  light: {
    button:
      'border-slate-200 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50',
    panel: 'border-slate-200 bg-white text-slate-800 shadow-lg shadow-slate-200/80 backdrop-blur',
    item: 'hover:bg-slate-50',
  },
}

export function LocaleSwitcher({
  locale,
  onChange,
  variant = 'dark',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false)
  const styles = variantStyles[variant]

  const handleToggle = () => setOpen((prev) => !prev)
  const handleSelect = (next: Locale) => {
    onChange(next)
    setOpen(false)
  }

  return (
    <div
      className={`relative ${className}`}
      tabIndex={-1}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setOpen(false)
        }
      }}
    >
      <button
        type="button"
        aria-label="Change language"
        onClick={handleToggle}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold tracking-wide transition ${styles.button}`}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="h-5 w-5"
          stroke="currentColor"
          fill="none"
          strokeWidth={1.6}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21c4.97 0 9-4.03 9-9s-4.03-9-9-9-9 4.03-9 9 4.03 9 9 9Z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.6 9h16.8M3.6 15h16.8M12 3c2.4 3.2 2.4 14.8 0 18M12 3c-2.4 3.2-2.4 14.8 0 18"
          />
        </svg>
        <span className="uppercase">{localeLabels[locale]}</span>
        <svg
          viewBox="0 0 20 20"
          aria-hidden
          className={`h-3 w-3 transition ${open ? 'rotate-180' : 'rotate-0'}`}
          fill="currentColor"
        >
          <path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z" />
        </svg>
      </button>

      {open ? (
        <div
          className={`absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-2xl border ${styles.panel}`}
        >
          {locales.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleSelect(item)}
              className={`flex w-full items-center justify-between px-4 py-2 text-sm transition ${styles.item} ${
                item === locale ? 'font-semibold' : ''
              }`}
            >
              <span>{localeLabels[item]}</span>
              {item === locale ? <span aria-hidden>·</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
