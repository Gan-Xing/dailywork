import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-slate-50 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
          <SkeletonBar tone="dark" className="h-3 w-28" />
          <SkeletonBar tone="dark" className="mt-2 h-8 w-64" />
          <SkeletonBar tone="dark" className="mt-2 h-4 w-80" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SkeletonBar tone="dark" className="h-5 w-24" />
            <SkeletonBar tone="dark" className="h-8 w-32" />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70 shadow-inner shadow-emerald-500/10">
          <div className="grid gap-2 border-b border-white/5 bg-white/5 p-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBar
                // skeleton stats only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                tone="dark"
                className="h-5 w-40"
              />
            ))}
          </div>
          <div className="divide-y divide-white/5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                // skeleton rows only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1.5fr,1fr,1fr,1fr]"
              >
                <SkeletonBar tone="dark" className="h-4 w-40" />
                <SkeletonBar tone="dark" className="h-4 w-24" />
                <SkeletonBar tone="dark" className="h-4 w-20" />
                <SkeletonBar tone="dark" className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
