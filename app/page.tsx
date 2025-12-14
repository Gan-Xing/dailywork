import { Suspense } from 'react'

import HomePageClient from './HomePageClient'

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageClient />
    </Suspense>
  )
}

function HomePageFallback() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(69,162,255,0.15),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(244,137,37,0.16),transparent_20%),radial-gradient(circle_at_60%_70%,rgba(72,236,169,0.15),transparent_25%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-80 w-[60vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-white/8 via-blue-400/10 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-12 xl:max-w-[1500px] xl:px-14 2xl:max-w-[1700px] 2xl:px-16">
        <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
          <div className="h-9 w-32 rounded-full bg-white/10" />
          <div className="h-9 w-28 rounded-full bg-white/10" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-200" />
            DAILYWORK
            <span className="h-[1px] w-10 bg-slate-300/40" />
            HUB
          </div>
          <div className="space-y-3">
            <div className="h-12 w-full max-w-3xl rounded-full bg-white/10" />
            <div className="h-12 w-full max-w-2xl rounded-full bg-white/10" />
            <p className="h-5 w-full max-w-xl rounded-full bg-white/10" />
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="h-12 w-32 rounded-2xl bg-white/20" />
            <div className="h-12 w-32 rounded-2xl border border-white/20" />
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3 xl:gap-8">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // fallback only; index is stable for this static map
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-slate-950/30 sm:p-6"
            >
              <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/5 via-white/0 to-white/10 opacity-60" />
              <div className="flex items-center justify-between">
                <div className="h-6 w-32 rounded-full bg-white/20" />
                <div className="h-6 w-20 rounded-full bg-white/10" />
              </div>
              <div className="mt-3 h-4 w-40 rounded-full bg-white/10" />
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="h-6 w-16 rounded-full bg-white/10" />
                <span className="h-6 w-14 rounded-full bg-white/10" />
                <span className="h-6 w-10 rounded-full bg-white/10" />
              </div>
              <div className="mt-6 h-6 w-24 rounded-full bg-white/15" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
