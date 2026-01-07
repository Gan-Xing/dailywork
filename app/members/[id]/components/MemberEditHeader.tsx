import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

import { MemberSwitchSelect } from './MemberSwitchSelect'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type SelectOption = { value: string; label: string; searchText?: string }

type MemberEditHeaderProps = {
  t: MemberCopy
  locale: Locale
  onLocaleChange: (next: Locale) => void
  teamOptions: SelectOption[]
  memberOptions: SelectOption[]
  selectedTeam: string
  selectedMemberId: string
  onTeamSelect: (value: string) => void
  onMemberSelect: (value: string) => void
}

export function MemberEditHeader({
  t,
  locale,
  onLocaleChange,
  teamOptions,
  memberOptions,
  selectedTeam,
  selectedMemberId,
  onTeamSelect,
  onMemberSelect,
}: MemberEditHeaderProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Breadcrumbs
          variant="light"
          items={[
            { label: t.breadcrumbs.home, href: '/' },
            { label: t.breadcrumbs.members, href: '/members' },
            { label: t.breadcrumbs.memberEdit },
          ]}
        />
        <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">MEMBER</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-3xl">{t.editTitle}</h1>
          <p className="mt-2 text-sm text-slate-600">{t.editSubtitle}</p>
        </div>
        <div className="flex w-full flex-wrap items-end justify-end gap-3 sm:w-auto sm:flex-nowrap">
          <MemberSwitchSelect
            label={t.form.team}
            value={selectedTeam}
            options={teamOptions}
            placeholder={t.labels.selectTeam}
            searchPlaceholder={t.filters.searchPlaceholder}
            emptyLabel={t.filters.noOptions}
            onChange={onTeamSelect}
            className="min-w-[180px]"
          />
          <MemberSwitchSelect
            label={t.form.name}
            value={selectedMemberId}
            options={memberOptions}
            placeholder={t.labels.selectMember}
            searchPlaceholder={t.filters.searchPlaceholder}
            emptyLabel={t.filters.noOptions}
            onChange={onMemberSelect}
            className="min-w-[200px]"
          />
        </div>
      </div>
    </>
  )
}
