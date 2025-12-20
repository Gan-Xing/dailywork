'use client'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

import NewTemplateForm from './NewTemplateForm'

export function NewTemplatePageClient() {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  return (
    <div className="space-y-6">
      <Breadcrumbs
        variant="light"
        items={[
          { label: copy.breadcrumbs.home, href: '/' },
          { label: copy.breadcrumbs.documents, href: '/documents' },
          { label: copy.breadcrumbs.templates, href: '/documents/templates' },
          { label: copy.breadcrumbs.templatesNew },
        ]}
      />
      <NewTemplateForm />
    </div>
  )
}
