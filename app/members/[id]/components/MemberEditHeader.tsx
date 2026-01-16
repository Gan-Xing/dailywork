import { PageHeaderNav } from '@/components/PageHeaderNav'
import type { Locale } from '@/lib/i18n'
import { memberCopy } from '@/lib/i18n/members'

type MemberCopy = (typeof memberCopy)[keyof typeof memberCopy]

type MemberEditHeaderProps = {
  t: MemberCopy
  locale: Locale
  onLocaleChange: (next: Locale) => void
}

export function MemberEditHeader({
  t,
  locale,
  onLocaleChange,
}: MemberEditHeaderProps) {
  return (
    <PageHeaderNav
      breadcrumbs={[
        { label: t.breadcrumbs.home, href: '/' },
        { label: t.breadcrumbs.members, href: '/members' },
        { label: t.breadcrumbs.memberEdit },
      ]}
      title={t.editTitle}
      locale={locale}
      onLocaleChange={onLocaleChange}
      breadcrumbVariant="light"
    />
  )
}
