import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="relative mx-auto max-w-6xl px-6 py-12 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-8 -z-10 h-48 bg-gradient-to-r from-emerald-200/50 via-sky-200/40 to-amber-200/40 blur-3xl" />
        <header className="space-y-2">
          <SkeletonBar tone="light" className="h-4 w-28" />
          <SkeletonBar tone="light" className="h-8 w-72" />
          <SkeletonBar tone="light" className="h-4 w-80" />
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-[320px,1fr]">
          <SkeletonBlock tone="light" className="h-64 border border-slate-200 bg-white" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock
                // skeleton list only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                tone="light"
                className="h-24 border border-slate-200 bg-white"
              />
            ))}
            <SkeletonBlock tone="light" className="h-32 border border-slate-200 bg-white" />
          </div>
        </div>
      </div>
    </main>
  )
}
