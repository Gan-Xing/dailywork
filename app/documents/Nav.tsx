'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
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

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-md sm:px-8 xl:px-12 2xl:px-14">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Left: Title & Breadcrumbs */}
        <div className="flex flex-col gap-1">
          <Breadcrumbs variant="light" items={breadcrumbs} />
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl tracking-tight">
            {currentPageTitle}
          </h1>
        </div>

        {/* Center/Right: Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          {/* Segmented Control for Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1 overflow-x-auto max-w-full no-scrollbar">
            {navItems.map((item) => {
              const active =
                item.href === '/documents'
                  ? isExactActive('/documents')
                  : isSectionActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold transition-all
                    ${
                      active
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }
                  `}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Language Switcher */}
          <LocaleSwitcher locale={locale} onChange={setLocale} />
        </div>
      </div>
    </header>
  )
}
