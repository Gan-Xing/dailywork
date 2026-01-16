'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { type BreadcrumbItem } from '@/components/Breadcrumbs'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import type { Locale } from '@/lib/i18n'
import { getProgressCopy } from '@/lib/i18n/progress'

type ProgressHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  breadcrumbs: BreadcrumbItem[]
  locale?: Locale
  onLocaleChange?: (locale: Locale) => void
}

export function ProgressHeader({
  title,
  subtitle,
  breadcrumbs,
  locale,
  onLocaleChange,
}: ProgressHeaderProps) {
  const pathname = usePathname()
  const resolvedLocale: Locale = locale ?? 'zh'
  const copy = getProgressCopy(resolvedLocale)
  const isActive = (href: string) => {
    if (href === '/progress') {
      return pathname === '/progress' || pathname === '/progress/'
    }
    return pathname === href || pathname?.startsWith(`${href}/`)
  }
  const tabs = [
    { href: '/progress', label: copy.nav.tabs.board },
    { href: '/progress/quantities', label: copy.nav.tabs.quantities },
    { href: '/progress/inspections', label: copy.nav.tabs.inspections },
    { href: '/progress/workflows', label: copy.nav.tabs.workflows },
  ].map((item) => ({
    key: item.href,
    label: item.label,
    href: item.href,
    active: isActive(item.href),
  }))

  return (
    <PageHeaderNav
      breadcrumbs={breadcrumbs}
      title={title}
      subtitle={subtitle}
      tabs={tabs}
      locale={locale}
      onLocaleChange={onLocaleChange}
      breadcrumbVariant="light"
    />
  )
}
