'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { type BreadcrumbItem } from '@/components/Breadcrumbs'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import type { Locale } from '@/lib/i18n'
import { getReportsLandingCopy } from '@/lib/i18n/reportsLanding'

type ReportsHeaderProps = {
  title: ReactNode
  subtitle?: ReactNode
  breadcrumbs: BreadcrumbItem[]
  locale?: Locale
  onLocaleChange?: (locale: Locale) => void
  rightSlot?: ReactNode
  className?: string
  containerClassName?: string
  tabsClassName?: string
  tabsScrollable?: boolean
}

export function ReportsHeader({
  title,
  subtitle,
  breadcrumbs,
  locale,
  onLocaleChange,
  rightSlot,
  className,
  containerClassName,
  tabsClassName,
  tabsScrollable = true,
}: ReportsHeaderProps) {
  const pathname = usePathname()
  const resolvedLocale: Locale = locale ?? 'zh'
  const navCopy = getReportsLandingCopy(resolvedLocale).nav
  const isActive = (href: string) => {
    if (href === '/reports') {
      if (pathname === '/reports' || pathname === '/reports/') {
        return true
      }
      return (
        pathname?.startsWith('/reports/') &&
        !pathname?.startsWith('/reports/leader-logs') &&
        !pathname?.startsWith('/reports/log-extractor') &&
        !pathname?.startsWith('/reports/weekly-rollups')
      )
    }
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  const tabs = [
    { key: 'reports', label: navCopy.reports, href: '/reports' },
    { key: 'weekly-rollups', label: navCopy.weeklyRollups, href: '/reports/weekly-rollups' },
    { key: 'leader-logs', label: navCopy.leaderLogs, href: '/reports/leader-logs' },
    { key: 'log-extractor', label: navCopy.logExtractor, href: '/reports/log-extractor' },
  ].map((item) => ({
    ...item,
    active: isActive(item.href),
  }))

  return (
    <PageHeaderNav
      className={className}
      containerClassName={containerClassName}
      tabsClassName={tabsClassName}
      tabsScrollable={tabsScrollable}
      breadcrumbs={breadcrumbs}
      title={title}
      subtitle={subtitle}
      tabs={tabs}
      locale={locale}
      onLocaleChange={onLocaleChange}
      localeVariant="light"
      breadcrumbVariant="light"
      rightSlot={rightSlot}
    />
  )
}
