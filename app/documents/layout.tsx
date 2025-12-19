import { PropsWithChildren } from 'react'

import { DocumentsNav } from './Nav'

export default function DocumentsLayout({ children }: PropsWithChildren) {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-8 lg:px-12 xl:max-w-[1500px] xl:px-14 2xl:max-w-[1700px] 2xl:px-16">
        <div className="grid gap-8 lg:grid-cols-[auto,1fr]">
          <DocumentsNav />
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </main>
  )
}
