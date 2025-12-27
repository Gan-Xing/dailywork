import { TabButton } from '@/components/members/MemberButtons'
import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type MembersTabsHeaderProps = {
  t: MemberCopy
  activeTab: 'members' | 'roles' | 'permissions' | 'payroll'
  onChangeTab: (tab: 'members' | 'roles' | 'permissions' | 'payroll') => void
  tabs: Array<'members' | 'roles' | 'permissions' | 'payroll'>
}

export function MembersTabsHeader({ t, activeTab, onChangeTab, tabs }: MembersTabsHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-slate-100 p-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">{t.tabs[activeTab]}</h2>
        <p className="text-sm text-slate-500">{t.tabDescriptions[activeTab]}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <TabButton key={tab} active={activeTab === tab} onClick={() => onChangeTab(tab)}>
            {t.tabs[tab]}
          </TabButton>
        ))}
      </div>
    </div>
  )
}
