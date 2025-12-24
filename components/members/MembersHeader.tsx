'use client'

import Link from 'next/link'

import { LocaleSwitcher } from '@/components/LocaleSwitcher'
import type { Locale } from '@/lib/i18n'

type Stat = {
  label: string
  value: number | string
  helper?: string
  accent: string
}

type Props = {
  title: string
  subtitle: string
  breadcrumbHome: string
  breadcrumbMembers: string
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  stats: Stat[]
}

export function MembersHeader({
  title,
  subtitle,
  breadcrumbHome,
  breadcrumbMembers,
  locale,
  onLocaleChange,
  stats,
}: Props) {
  return (
    <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 pb-14 pt-12 text-white">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(14,165,233,0.2), transparent 40%), radial-gradient(circle at 80% 0%, rgba(94,234,212,0.18), transparent 36%)',
        }}
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-8 px-6 sm:px-8 xl:max-w-[1500px] xl:px-12 2xl:max-w-[1700px] 2xl:px-14">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-200">RBAC · MEMBER</p>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-200 sm:text-base">{subtitle}</p>
            </div>
            <nav className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-100">
              <Link
                href="/"
                className="rounded-full border border-white/20 bg-white/10 px-3 py-1 transition hover:border-white/40 hover:bg-white/20"
              >
                {breadcrumbHome}
              </Link>
              <span className="text-slate-300">/</span>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1">
                {breadcrumbMembers}
              </span>
            </nav>
          </div>
          <LocaleSwitcher locale={locale} onChange={onLocaleChange} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6 2xl:gap-8">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </div>
    </section>
  )
}

function StatCard({
  label,
  value,
  helper,
  accent,
}: {
  label: string
  value: number | string
  helper?: string
  accent: string
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/10 p-4 shadow-lg shadow-slate-900/50 backdrop-blur">
      <div
        className={`absolute -right-10 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${accent} opacity-40 blur-3xl`}
      />
      <p className="text-sm text-slate-200">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
      {helper ? <p className="text-xs text-slate-200">{helper}</p> : null}
    </div>
  )
}
