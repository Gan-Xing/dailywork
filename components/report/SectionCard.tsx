'use client'

import type { ReactNode } from 'react'

interface SectionCardProps {
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  id?: string
}

export function SectionCard({ title, description, children, actions, id }: SectionCardProps) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm shadow-slate-100 backdrop-blur"
    >
      <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  )
}
