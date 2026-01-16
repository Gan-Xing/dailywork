'use client'

import { usePathname } from 'next/navigation'

import { PageHeaderNav } from '@/components/PageHeaderNav'
import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

export function DocumentsNav() {
  const pathname = usePathname()
  const { locale, setLocale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  const navItems = [
    { href: '/documents', label: copy.nav.items.overview },
    { href: '/documents/files', label: copy.nav.items.files },
    { href: '/documents/submissions', label: copy.nav.items.submissions },
    { href: '/documents/letters', label: copy.nav.items.letters },
    { href: '/documents/templates', label: copy.nav.items.templates },
  ]

  const isExactActive = (href: string) => pathname === href
  const isSectionActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  // Determine current page title and breadcrumb
  let currentPageTitle = copy.nav.title
  let breadcrumbItem = null

  if (pathname === '/documents' || pathname === '/documents/') {
    currentPageTitle = copy.nav.items.overview
  } else if (pathname?.startsWith('/documents/files')) {
    currentPageTitle = copy.breadcrumbs.files
    breadcrumbItem = { href: '/documents/files', label: copy.breadcrumbs.files }
  } else if (pathname?.startsWith('/documents/submissions')) {
    currentPageTitle = copy.breadcrumbs.submissions
    breadcrumbItem = { href: '/documents/submissions', label: copy.breadcrumbs.submissions }
  } else if (pathname?.startsWith('/documents/letters')) {
    currentPageTitle = copy.breadcrumbs.letters
    breadcrumbItem = { href: '/documents/letters', label: copy.breadcrumbs.letters }
  } else if (pathname?.startsWith('/documents/templates')) {
    currentPageTitle = copy.breadcrumbs.templates
    breadcrumbItem = { href: '/documents/templates', label: copy.breadcrumbs.templates }
  }

  const breadcrumbs = [
    { label: copy.breadcrumbs.home, href: '/' },
    breadcrumbItem
      ? { label: breadcrumbItem.label }
      : { label: copy.breadcrumbs.documents },
  ]

  const tabs = navItems.map((item) => ({
    key: item.href,
    label: item.label,
    href: item.href,
    active:
      item.href === '/documents'
        ? isExactActive('/documents')
        : isSectionActive(item.href),
  }))

  return (
    <PageHeaderNav
      breadcrumbs={breadcrumbs}
      title={currentPageTitle}
      tabs={tabs}
      tabsScrollable
      locale={locale}
      onLocaleChange={setLocale}
      breadcrumbVariant="light"
    />
  )
}
