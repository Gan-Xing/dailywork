'use client'

import Link from 'next/link'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type Props = {
  canViewSubmissions: boolean
  canCreateSubmission: boolean
  canViewTemplates: boolean
  canViewFiles: boolean
}

export function DocumentsHubClient({
  canViewSubmissions,
  canCreateSubmission,
  canViewTemplates,
  canViewFiles,
}: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        variant="light"
        items={[
          { label: copy.breadcrumbs.home, href: '/' },
          { label: copy.breadcrumbs.documents },
        ]}
      />
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {copy.hub.badge.title}
        <span className="h-[1px] w-10 bg-emerald-200" />
        {copy.hub.badge.accent}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">{copy.hub.title}</h1>
            <p className="max-w-2xl text-slate-600">{copy.hub.description}</p>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                {copy.hub.tags.mvp}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {copy.hub.tags.scope}
              </span>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                {copy.hub.tags.pdf}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">{copy.hub.quickActions.title}</p>
            <div className="mt-2 flex flex-col gap-2">
              {canCreateSubmission ? (
                <Link
                  href="/documents/submissions/new"
                  className="rounded-full bg-emerald-500 px-3 py-2 text-center text-white shadow transition hover:-translate-y-0.5 hover:shadow-emerald-300/40"
                >
                  {copy.hub.quickActions.createSubmission}
                </Link>
              ) : (
                <span className="rounded-full bg-slate-200 px-3 py-2 text-center font-semibold text-slate-500">
                  {copy.hub.quickActions.createSubmission}
                </span>
              )}
              {canViewTemplates ? (
                <Link
                  href="/documents/templates"
                  className="rounded-full border border-slate-200 px-3 py-2 text-center font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                >
                  {copy.hub.quickActions.manageTemplates}
                </Link>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-2 text-center font-semibold text-slate-500">
                  {copy.hub.quickActions.manageTemplates}
                </span>
              )}
              {canViewFiles ? (
                <Link
                  href="/documents/files"
                  className="rounded-full border border-slate-200 px-3 py-2 text-center font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-100"
                >
                  {copy.hub.quickActions.manageFiles}
                </Link>
              ) : (
                <span className="rounded-full bg-slate-100 px-3 py-2 text-center font-semibold text-slate-500">
                  {copy.hub.quickActions.manageFiles}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {copy.hub.submissionsCard.label}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {copy.hub.submissionsCard.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{copy.hub.submissionsCard.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              {canViewSubmissions ? (
                <Link
                  href="/documents/submissions"
                  className="rounded-2xl bg-white px-4 py-2 text-slate-900 shadow-sm ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-200"
                >
                  {copy.hub.submissionsCard.cta}
                </Link>
              ) : (
                <span className="rounded-2xl bg-slate-100 px-4 py-2 text-slate-500 ring-1 ring-slate-200">
                  {copy.hub.submissionsCard.cta}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {copy.hub.templatesCard.label}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {copy.hub.templatesCard.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{copy.hub.templatesCard.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              {canViewTemplates ? (
                <Link
                  href="/documents/templates"
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-800 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-white hover:text-slate-900"
                >
                  {copy.hub.templatesCard.cta}
                </Link>
              ) : (
                <span className="rounded-2xl border border-slate-200 px-4 py-2 text-slate-500">
                  {copy.hub.templatesCard.cta}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {copy.hub.filesCard.label}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {copy.hub.filesCard.title}
            </h2>
            <p className="mt-2 text-sm text-slate-600">{copy.hub.filesCard.description}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
              {canViewFiles ? (
                <Link
                  href="/documents/files"
                  className="rounded-2xl bg-white px-4 py-2 text-slate-900 shadow-sm ring-1 ring-emerald-100 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-emerald-200"
                >
                  {copy.hub.filesCard.cta}
                </Link>
              ) : (
                <span className="rounded-2xl bg-slate-100 px-4 py-2 text-slate-500 ring-1 ring-slate-200">
                  {copy.hub.filesCard.cta}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
