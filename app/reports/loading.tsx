import { SkeletonBar, SkeletonBlock, SkeletonCircle } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="relative mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonBar className="h-6 w-16" />
          <SkeletonBar className="h-6 w-24" />
        </div>
        <SkeletonBar className="h-8 w-32" />
      </div>

      <SkeletonBlock className="h-40 border border-slate-200 bg-white/80 p-6" />

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="mt-2 h-7 w-40" />
          </div>
          <div className="flex gap-2">
            <SkeletonCircle size="2.5rem" />
            <SkeletonCircle size="2.5rem" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-7 gap-2">
          {Array.from({ length: 21 }).map((_, index) => (
            <SkeletonBlock
              // skeleton grid only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="h-16 rounded-2xl border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm shadow-slate-100">
        <SkeletonBar className="h-3 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              // skeleton list only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="space-y-2">
                <SkeletonBar className="h-4 w-32" />
                <SkeletonBar className="h-3 w-44" />
              </div>
              <SkeletonBar className="h-4 w-16" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
