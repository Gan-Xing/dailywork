'use client'

import Link from 'next/link'

import { AccessDenied } from '@/components/AccessDenied'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'

import { ResourcesHeader } from './ResourcesHeader'
import { useResourcesSession } from './hooks/useResourcesSession'

const Card = ({
  title,
  description,
  cta,
  href,
  tone,
  disabled,
}: {
  title: string
  description: string
  cta: string
  href: string
  tone: string
  disabled?: boolean
}) => {
  const className = `group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 transition ${
    disabled ? 'opacity-60' : 'hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/10'
  }`

  const content = (
    <>
      <div className={`absolute -right-16 -top-20 h-52 w-52 rounded-full bg-gradient-to-br ${tone} opacity-50 blur-3xl`} />
      <div className="relative flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
            {cta}
          </span>
          {!disabled ? (
            <span className="text-slate-400 transition group-hover:translate-x-1">→</span>
          ) : null}
        </div>
      </div>
    </>
  )

  if (disabled) {
    return <div className={className}>{content}</div>
  }

  return (
    <Link href={href} className={className}>
      {content}
    </Link>
  )
}

export function ResourcesPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const { canViewMachines, canViewMachineLogs, canViewMaterials, shouldShowAccessDenied } = useResourcesSession()

  if (shouldShowAccessDenied) {
    return (
      <AccessDenied locale={locale} permissions={['machine:view', 'machine-log:view', 'material:view']} hint={t.access.needAnyView} />
    )
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources },
        ]}
        title={t.landing.overviewTitle}
        subtitle={t.landing.overviewDescription}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-[1700px] gap-6 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14 min-w-0">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card
              title={t.landing.cards.machines.title}
              description={t.landing.cards.machines.description}
              cta={t.landing.cards.machines.cta}
              href="/resources/machines"
              tone="from-emerald-200 via-sky-200 to-indigo-200"
              disabled={!canViewMachines}
            />
            <Card
              title={t.landing.cards.machineLogs.title}
              description={t.landing.cards.machineLogs.description}
              cta={t.landing.cards.machineLogs.cta}
              href="/resources/machines/logs"
              tone="from-sky-200 via-indigo-200 to-rose-200"
              disabled={!canViewMachineLogs}
            />
            <Card
              title={t.landing.cards.materials.title}
              description={t.landing.cards.materials.description}
              cta={t.landing.cards.materials.cta}
              href="/resources/materials"
              tone="from-amber-200 via-rose-200 to-fuchsia-200"
              disabled={!canViewMaterials}
            />
          </div>
        </div>
      </section>
    </main>
  )
}
