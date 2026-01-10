import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-8 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <header className="space-y-2">
          <SkeletonBar tone="light" className="h-4 w-24" />
          <SkeletonBar tone="light" className="h-8 w-60" />
          <SkeletonBar tone="light" className="h-4 w-72" />
        </header>

        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              // skeleton cards only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <SkeletonBar tone="light" className="h-4 w-28" />
                <SkeletonBar tone="light" className="h-4 w-14" />
              </div>
              <div className="mt-4 space-y-2">
                <SkeletonBar tone="light" className="h-3 w-full" />
                <SkeletonBar tone="light" className="h-3 w-3/4" />
                <SkeletonBar tone="light" className="h-3 w-2/3" />
              </div>
              <SkeletonBlock tone="light" className="mt-4 h-12 border border-slate-200 bg-white" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-xs text-slate-500">加载巡检看板...</p>
      </div>
    </main>
  )
}
