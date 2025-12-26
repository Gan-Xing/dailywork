'use client'

import Link from 'next/link'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type Props = {
  t: MemberCopy
  activeTab: 'members' | 'roles' | 'permissions'
  onChangeTab: (tab: 'members' | 'roles' | 'permissions') => void
  tabs: Array<'members' | 'roles' | 'permissions'>
  breadcrumbHome: string
  breadcrumbMembers: string
  locale: Locale
  onLocaleChange: (locale: Locale) => void
}

export function MembersPageHeader({
  t,
  activeTab,
  onChangeTab,
  tabs,
  breadcrumbHome,
  breadcrumbMembers,
  locale,
  onLocaleChange,
}: Props) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 px-6 py-3 backdrop-blur-md sm:px-8 xl:px-12 2xl:px-14">
      <div className="mx-auto flex max-w-[1700px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
        
        {/* Left: Title & Breadcrumbs */}
        <div className="flex flex-col gap-1">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-500">
            <Link href="/" className="hover:text-slate-900 transition-colors">
              {breadcrumbHome}
            </Link>
            <span>/</span>
            <span className="text-slate-900">{breadcrumbMembers}</span>
          </nav>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl tracking-tight">
            {t.title}
          </h1>
        </div>

        {/* Center/Right: Tab Switcher & Actions */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          
          {/* Segmented Control for Tabs */}
          <div className="flex items-center rounded-lg bg-slate-100 p-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab
              return (
                <button
                  key={tab}
                  onClick={() => onChangeTab(tab)}
                  className={`
                    rounded-md px-3 py-1.5 text-xs font-semibold transition-all
                    ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
                    }
                  `}
                >
                  {t.tabs[tab]}
                </button>
              )
            })}
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Language Switcher */}
          <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
      </div>
    </header>
  )
}
