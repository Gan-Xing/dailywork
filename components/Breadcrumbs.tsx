import Link from 'next/link'
import type { ReactNode } from 'react'

export type BreadcrumbItem = {
  label: ReactNode
  href?: string
}

export type BreadcrumbsProps = {
  items: BreadcrumbItem[]
  variant?: 'dark' | 'light'
}

export function Breadcrumbs({ items, variant = 'dark' }: BreadcrumbsProps) {
  const isDark = variant === 'dark'
  const containerClass = isDark
    ? 'flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-200/80'
    : 'flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600'
  const linkClass = isDark
    ? 'rounded-full border border-white/10 bg-white/5 px-3 py-1 transition hover:border-white/25 hover:bg-white/10 text-slate-50'
    : 'rounded-full border border-slate-200 bg-white px-3 py-1 transition hover:bg-slate-50'
  const currentClass = isDark
    ? 'rounded-full border border-white/5 bg-white/5 px-3 py-1 text-slate-100'
    : 'rounded-full border border-slate-100 bg-slate-50 px-3 py-1 text-slate-800'
  const dividerClass = isDark ? 'text-slate-500' : 'text-slate-400'

  return (
    <nav className={containerClass}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={index} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link href={item.href} className={linkClass}>
                {item.label}
              </Link>
            ) : (
              <span className={currentClass}>{item.label}</span>
            )}
            {!isLast ? <span className={dividerClass}>/</span> : null}
          </div>
        )
      })}
    </nav>
  )
}
