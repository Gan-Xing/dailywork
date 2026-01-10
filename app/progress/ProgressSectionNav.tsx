'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  { href: '/progress', label: '道路看板' },
  { href: '/progress/quantities', label: '分项列表' },
  { href: '/progress/inspections', label: '报检记录' },
  { href: '/progress/workflows', label: '分项模板' },
]

export function ProgressSectionNav() {
  const pathname = usePathname()
  const isActive = (href: string) => {
    if (href === '/progress') {
      return pathname === '/progress' || pathname === '/progress/'
    }
    return pathname === href || pathname?.startsWith(`${href}/`)
  }

  return (
    <div className="flex items-center rounded-lg bg-slate-100 p-1">
      {navItems.map((item) => {
        const active = isActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              active
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
