import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="space-y-2">
          <SkeletonBar tone="dark" className="h-4 w-24" />
          <SkeletonBar tone="dark" className="h-8 w-60" />
          <SkeletonBar tone="dark" className="h-4 w-72" />
        </header>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // skeleton cards only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-emerald-500/10"
            >
              <div className="flex items-center justify-between">
                <SkeletonBar tone="dark" className="h-4 w-28" />
                <SkeletonBar tone="dark" className="h-4 w-14" />
              </div>
              <div className="mt-4 space-y-2">
                <SkeletonBar tone="dark" className="h-3 w-full" />
                <SkeletonBar tone="dark" className="h-3 w-3/4" />
                <SkeletonBar tone="dark" className="h-3 w-2/3" />
              </div>
              <SkeletonBlock tone="dark" className="mt-4 h-12 border border-white/5 bg-white/10" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-300/80">加载巡检看板...</p>
      </div>
    </main>
  )
}
