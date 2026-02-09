'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import { type BreadcrumbItem } from '@/components/Breadcrumbs'
import { PageHeaderNav } from '@/components/PageHeaderNav'
import type { Locale } from '@/lib/i18n'
import { getResourcesCopy, type ResourcesTabKey } from '@/lib/i18n/resources'

type Props = {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  breadcrumbs: BreadcrumbItem[]
  title?: ReactNode
  subtitle?: ReactNode
}

const resolveActiveTab = (pathname: string | null): ResourcesTabKey => {
  if (!pathname) return 'overview'
  if (pathname === '/resources' || pathname === '/resources/') return 'overview'
  if (pathname === '/resources/machines/logs' || pathname.startsWith('/resources/machines/logs/')) {
    return 'machineLogs'
  }
  if (pathname === '/resources/machines' || pathname.startsWith('/resources/machines/')) {
    return 'machines'
  }
  if (pathname === '/resources/materials' || pathname.startsWith('/resources/materials/')) {
    return 'materials'
  }
  return 'overview'
}

export function ResourcesHeader({ locale, onLocaleChange, breadcrumbs, title, subtitle }: Props) {
  const pathname = usePathname()
  const t = getResourcesCopy(locale)
  const activeTab = resolveActiveTab(pathname)

  const tabs = [
    { key: 'overview', label: t.tabs.overview, href: '/resources' },
    { key: 'machines', label: t.tabs.machines, href: '/resources/machines' },
    { key: 'machineLogs', label: t.tabs.machineLogs, href: '/resources/machines/logs' },
    { key: 'materials', label: t.tabs.materials, href: '/resources/materials' },
  ].map((tab) => ({
    ...tab,
    active: tab.key === activeTab,
  }))

  const resolvedTitle = title ?? t.title
  const resolvedSubtitle = subtitle ?? t.tabDescriptions[activeTab]

  return (
    <PageHeaderNav
      breadcrumbs={breadcrumbs}
      title={resolvedTitle}
      subtitle={resolvedSubtitle}
      tabs={tabs}
      locale={locale}
      onLocaleChange={onLocaleChange}
      localeVariant="light"
      breadcrumbVariant="light"
      tabsScrollable
    />
  )
}
