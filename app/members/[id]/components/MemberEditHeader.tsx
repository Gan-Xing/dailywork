import { Breadcrumbs } from '@/components/Breadcrumbs'
import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type MemberEditHeaderProps = {
  t: MemberCopy
  locale: Locale
  onLocaleChange: (next: Locale) => void
  displayName: string
}

export function MemberEditHeader({ t, locale, onLocaleChange, displayName }: MemberEditHeaderProps) {
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
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
          {displayName}
        </div>
      </div>
    </>
  )
}
