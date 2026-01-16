'use client'

import { PageHeaderNav } from '@/components/PageHeaderNav'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type Props = {
  t: MemberCopy
  activeTab: 'overview' | 'members' | 'roles' | 'permissions' | 'payroll'
  onChangeTab: (tab: 'overview' | 'members' | 'roles' | 'permissions' | 'payroll') => void
  tabs: Array<'overview' | 'members' | 'roles' | 'permissions' | 'payroll'>
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
  const navTabs = tabs.map((tab) => ({
    key: tab,
    label: t.tabs[tab],
    onClick: () => onChangeTab(tab),
    active: activeTab === tab,
  }))

  return (
    <PageHeaderNav
      breadcrumbs={[
        { label: breadcrumbHome, href: '/' },
        { label: breadcrumbMembers },
      ]}
      title={t.title}
      tabs={navTabs}
      locale={locale}
      onLocaleChange={onLocaleChange}
      breadcrumbVariant="light"
    />
  )
}
