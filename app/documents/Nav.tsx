'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/documents', label: '概览' },
  { href: '/documents/submissions', label: '提交单' },
  { href: '/documents/templates', label: '模版管理' },
]

export function DocumentsNav() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const isExactActive = (href: string) => pathname === href
  const isSectionActive = (href: string) => pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <aside
      className={`sticky top-6 flex flex-col gap-2 rounded-3xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-md transition-[width] ${
        collapsed ? 'w-16 items-center' : 'w-[240px]'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        {!collapsed ? <p className="px-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">导航</p> : null}
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-100"
          aria-label={collapsed ? '展开导航' : '折叠导航'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>
      {navItems.map((item) => {
        const active =
          item.href === '/documents'
            ? isExactActive('/documents')
            : isSectionActive(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-2xl px-3 py-2 font-semibold transition ${
              active ? 'bg-emerald-50 text-emerald-700 shadow-inner' : 'hover:bg-slate-100 hover:text-slate-900'
            }`}
            title={collapsed ? item.label : undefined}
          >
            <span className={`${collapsed ? 'text-xs font-bold' : ''}`}>{collapsed ? item.label.slice(0, 1) : item.label}</span>
            {active ? <span className="text-xs text-emerald-700">●</span> : null}
          </Link>
        )
      })}
    </aside>
  )
}
