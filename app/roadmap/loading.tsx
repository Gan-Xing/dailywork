import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(69,162,255,0.12),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(244,137,37,0.14),transparent_20%),radial-gradient(circle_at_60%_70%,rgba(72,236,169,0.12),transparent_25%)]" />
      <div className="absolute left-1/2 top-0 -z-10 h-80 w-[60vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-white/8 via-blue-400/10 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 sm:px-8 lg:px-10 xl:max-w-[1500px] xl:px-12 2xl:max-w-[1700px] 2xl:px-14">
        <header className="space-y-3">
          <div className="flex items-center gap-3">
            <SkeletonBar tone="dark" className="h-4 w-16" />
            <SkeletonBar tone="dark" className="h-4 w-24" />
          </div>
          <SkeletonBar tone="dark" className="h-8 w-80" />
          <SkeletonBar tone="dark" className="h-4 w-96" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBar
                // skeleton badges only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                tone="dark"
                className="h-6 w-24"
              />
            ))}
          </div>
        </header>

        <div className="mt-10 space-y-6">
          <SkeletonBlock
            tone="dark"
            className="h-64 border border-white/10 bg-white/5"
          />
          <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-slate-950/30 backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <SkeletonBar tone="dark" className="h-4 w-20" />
              <SkeletonBar tone="dark" className="h-4 w-28" />
              <SkeletonBar tone="dark" className="h-4 w-24" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonBlock
                  // skeleton rows only
                  // eslint-disable-next-line react/no-array-index-key
                  key={index}
                  tone="dark"
                  className="h-20 border border-white/10 bg-white/5"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
