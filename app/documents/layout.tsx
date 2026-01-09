import { PropsWithChildren } from 'react'

import { DocumentsNav } from './Nav'

export default function DocumentsLayout({ children }: PropsWithChildren) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <DocumentsNav />
      <div className="relative mx-auto max-w-6xl px-6 py-8 sm:px-8 lg:px-12 xl:max-w-[1700px] xl:px-12 2xl:px-14">
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  )
}