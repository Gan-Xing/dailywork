'use client'

import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type Props = { id: string; status: string }

export default function TemplateActions({ id, status }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  const call = async (nextStatus: 'PUBLISHED' | 'ARCHIVED') => {
    await fetch(`/api/documents/templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    window.location.reload()
  }

  if (status !== 'PUBLISHED') {
    return (
      <button
        type="button"
        onClick={() => call('PUBLISHED')}
        className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
      >
        {copy.templateActions.publish}
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={() => call('ARCHIVED')}
      className="rounded-full border border-slate-300 px-3 py-1 text-slate-700 hover:border-slate-400 hover:bg-slate-100"
    >
      {copy.templateActions.archive}
    </button>
  )
}
