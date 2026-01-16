'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { Breadcrumbs, type BreadcrumbItem } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Locale } from '@/lib/i18n'

export type HeaderNavTab = {
  key: string
  label: ReactNode
  href?: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
}

type Props = {
  breadcrumbs: BreadcrumbItem[]
  title: ReactNode
  subtitle?: ReactNode
  tabs?: HeaderNavTab[]
  locale?: Locale
  onLocaleChange?: (locale: Locale) => void
  localeVariant?: 'dark' | 'light'
  breadcrumbVariant?: 'dark' | 'light'
  showLocaleDivider?: boolean
  tabsScrollable?: boolean
  className?: string
  containerClassName?: string
  tabsClassName?: string
  rightSlot?: ReactNode
}

export function PageHeaderNav({
  breadcrumbs,
  title,
  subtitle,
  tabs,
  locale,
  onLocaleChange,
  localeVariant,
  breadcrumbVariant = 'light',
  showLocaleDivider,
  tabsScrollable = false,
  className = '',
  containerClassName = '',
  tabsClassName = '',
  rightSlot,
}: Props) {
  const hasTabs = Boolean(tabs?.length)
  const hasLocale = Boolean(locale && onLocaleChange)
  const showDivider = showLocaleDivider ?? (hasTabs || rightSlot ? hasLocale : false)

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-md sm:px-8 xl:px-12 2xl:px-14 ${className}`}
    >
      <div
        className={`mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between ${containerClassName}`}
      >
        <div className="flex flex-col gap-1">
          <Breadcrumbs variant={breadcrumbVariant} items={breadcrumbs} />
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl tracking-tight">
              {title}
            </h1>
            {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
          </div>
        </div>

        {hasTabs || rightSlot || hasLocale ? (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {hasTabs ? (
              <div
                className={`flex items-center rounded-lg bg-slate-100 p-1 ${tabsScrollable ? 'overflow-x-auto max-w-full no-scrollbar' : ''} ${tabsClassName}`}
              >
                {tabs?.map((tab) => {
                  const tabClassName = `whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                    tab.active
                      ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                  } ${tab.disabled ? 'pointer-events-none opacity-60' : ''}`

                  if (tab.href) {
                    return (
                      <Link
                        key={tab.key}
                        href={tab.href}
                        className={tabClassName}
                        aria-current={tab.active ? 'page' : undefined}
                      >
                        {tab.label}
                      </Link>
                    )
                  }

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={tab.onClick}
                      className={tabClassName}
                      disabled={tab.disabled}
                      aria-pressed={tab.active}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            ) : null}

            {rightSlot}

            {locale && onLocaleChange ? (
              <>
                {showDivider ? <div className="hidden h-6 w-px bg-slate-200 sm:block" /> : null}
                <LocaleSwitcher
                  locale={locale}
                  onChange={onLocaleChange}
                  {...(localeVariant ? { variant: localeVariant } : {})}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
