'use client'

import Link from 'next/link'

import { type Locale } from '@/lib/i18n'

type AccessDeniedProps = {
  locale?: Locale
  title?: string
  description?: string
  permissions?: string[]
  hint?: string
}

const copy: Record<Locale, { badge: string; title: string; description: string; back: string; login: string }> = {
  zh: {
    badge: '访问受限',
    title: '权限不足，暂无法查看该模块',
    description: '需要先登录并具备相应的查看权限才能继续。请联系管理员或使用右上角的登录入口。',
    back: '返回首页',
    login: '前往登录',
  },
  fr: {
    badge: 'Accès restreint',
    title: 'Autorisations insuffisantes',
    description: "Connectez-vous et assurez-vous d'avoir le droit de consulter ce module avant de réessayer.",
    back: 'Retour à l’accueil',
    login: 'Se connecter',
  },
}

export function AccessDenied({ locale = 'zh', title, description, permissions, hint }: AccessDeniedProps) {
  const t = copy[locale]

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-4xl px-6 py-16 lg:px-0">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/90 via-slate-900/70 to-slate-900/60 p-8 shadow-2xl shadow-slate-950/40">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-lg font-semibold text-amber-100 ring-1 ring-white/10">
              !
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">{t.badge}</p>
              <h1 className="text-2xl font-semibold text-white">{title ?? t.title}</h1>
              <p className="text-sm text-slate-100/80">{description ?? t.description}</p>
              {permissions?.length ? (
                <div className="flex flex-wrap gap-2">
                  {permissions.map((code) => (
                    <span
                      key={code}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold tracking-wide text-slate-50"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-md shadow-emerald-300/20 transition hover:-translate-y-0.5 hover:shadow-emerald-300/40"
                >
                  {t.back}
                  <span aria-hidden>↩</span>
                </Link>
                <Link
                  href="/?login=1"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-slate-50 transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10"
                >
                  {t.login}
                  <span aria-hidden>↗</span>
                </Link>
              </div>
              {hint ? <p className="text-xs text-slate-300/80">{hint}</p> : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
