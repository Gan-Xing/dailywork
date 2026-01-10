'use client'

import type { ReactNode } from 'react'

import { Breadcrumbs, type BreadcrumbItem } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Locale } from '@/lib/i18n'

type ProgressHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  breadcrumbs: BreadcrumbItem[]
  right?: ReactNode
  locale?: Locale
  onLocaleChange?: (locale: Locale) => void
}

export function ProgressHeader({
  title,
  subtitle,
  breadcrumbs,
  right,
  locale,
  onLocaleChange,
}: ProgressHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-md sm:px-8 xl:px-12 2xl:px-14">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <Breadcrumbs items={breadcrumbs} variant="light" />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl tracking-tight">
            {title}
          </h1>
          {subtitle ? <p className="text-sm text-slate-600">{subtitle}</p> : null}
        </div>
        {right ? (
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            {right}
            {locale && onLocaleChange ? (
              <>
                <div className="hidden h-6 w-px bg-slate-200 sm:block" />
                <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  )
}
