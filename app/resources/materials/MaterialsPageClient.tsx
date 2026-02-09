'use client'

import { AccessDenied } from '@/components/AccessDenied'
import { usePreferredLocale } from '@/lib/usePreferredLocale'
import { getResourcesCopy } from '@/lib/i18n/resources'

import { ResourcesHeader } from '../ResourcesHeader'
import { useResourcesSession } from '../hooks/useResourcesSession'

const DEFAULT_BULK_MATERIALS_ZH = ['柴油', '汽油', '水泥', '钢筋', '沥青', '润滑油']
const DEFAULT_BULK_MATERIALS_FR = [
  'Gasoil',
  'Essence',
  'Ciment',
  'Fer à béton',
  'Bitume',
  'Huile (lubrifiant)',
]

export function MaterialsPageClient() {
  const { locale, setLocale } = usePreferredLocale()
  const t = getResourcesCopy(locale)
  const { authLoaded, canViewMaterials } = useResourcesSession()

  if (authLoaded && !canViewMaterials) {
    return (
      <AccessDenied locale={locale} permissions={['material:view']} hint={t.access.needMaterialView} />
    )
  }

  const items = locale === 'fr' ? DEFAULT_BULK_MATERIALS_FR : DEFAULT_BULK_MATERIALS_ZH

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ResourcesHeader
        locale={locale}
        onLocaleChange={setLocale}
        breadcrumbs={[
          { label: t.breadcrumbs.home, href: '/' },
          { label: t.breadcrumbs.resources, href: '/resources' },
          { label: t.breadcrumbs.materials },
        ]}
      />

      <section className="w-full bg-slate-50">
        <div className="mx-auto grid max-w-[1700px] gap-8 px-6 pb-14 pt-6 sm:px-8 xl:px-12 2xl:px-14 min-w-0">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
            <div className="flex flex-col gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{t.materials.title}</h2>
              <p className="text-sm text-slate-600">{t.materials.comingSoon}</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((name) => (
                <div
                  key={name}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800"
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

