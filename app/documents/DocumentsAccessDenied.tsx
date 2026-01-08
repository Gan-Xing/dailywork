'use client'

import { AccessDenied } from '@/components/AccessDenied'
import { locales } from '@/lib/i18n'
import { getDocumentsCopy } from '@/lib/i18n/documents'
import { usePreferredLocale } from '@/lib/usePreferredLocale'

type AccessVariant =
  | 'hub'
  | 'submissionsList'
  | 'submissionCreate'
  | 'submissionDetail'
  | 'filesList'
  | 'templatesList'
  | 'templateCreate'
  | 'templateDetail'

type Props = {
  permissions: string[]
  variant: AccessVariant
}

export function DocumentsAccessDenied({ permissions, variant }: Props) {
  const { locale } = usePreferredLocale('zh', locales)
  const copy = getDocumentsCopy(locale)

  return (
    <AccessDenied
      locale={locale}
      permissions={permissions}
      hint={copy.access[variant]}
    />
  )
}
