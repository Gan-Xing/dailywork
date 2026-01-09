'use client'

import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import NewTemplateForm from './NewTemplateForm'

export function NewTemplatePageClient() {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  return (
    <div className="space-y-6">
      <NewTemplateForm />
    </div>
  )
}
