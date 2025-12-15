import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="relative mx-auto max-w-6xl px-6 py-14 sm:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
        <div className="absolute inset-x-0 top-10 -z-10 h-48 bg-gradient-to-r from-emerald-300/20 via-blue-300/15 to-amber-200/20 blur-3xl" />
        <header className="space-y-2">
          <SkeletonBar tone="dark" className="h-4 w-28" />
          <SkeletonBar tone="dark" className="h-8 w-72" />
          <SkeletonBar tone="dark" className="h-4 w-80" />
        </header>

        <div className="mt-8 grid gap-4 lg:grid-cols-[320px,1fr]">
          <SkeletonBlock tone="dark" className="h-64 border border-white/10 bg-white/5" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBlock
                // skeleton list only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                tone="dark"
                className="h-24 border border-white/10 bg-white/5"
              />
            ))}
            <SkeletonBlock tone="dark" className="h-32 border border-white/10 bg-white/5" />
          </div>
        </div>
      </div>
    </main>
  )
}
