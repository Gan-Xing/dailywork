import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 overflow-x-hidden p-4 sm:p-6 xl:max-w-[1500px] xl:px-10 xl:py-8 2xl:max-w-[1700px] 2xl:px-12 2xl:py-10">
      <nav className="flex flex-wrap items-center gap-2">
        <SkeletonBar className="h-6 w-16" />
        <SkeletonBar className="h-6 w-20" />
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBar className="h-7 w-40" />
          <SkeletonBar className="h-4 w-64" />
        </div>
        <SkeletonBar className="h-5 w-28" />
      </div>

      <div className="space-y-3 rounded-lg bg-white p-4 shadow sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SkeletonBar className="h-5 w-28" />
            <SkeletonBar className="mt-2 h-4 w-48" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SkeletonBar className="h-9 w-28" />
            <SkeletonBar className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-12">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonBlock
              // skeleton filter only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="h-12 border border-slate-100 bg-slate-50 md:col-span-3"
            />
          ))}
          <SkeletonBlock className="h-16 border border-slate-100 bg-slate-50 md:col-span-7" />
          <SkeletonBlock className="h-16 border border-slate-100 bg-slate-50 md:col-span-5" />
        </div>
      </div>

      <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            // skeleton rows only
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="grid grid-cols-12 items-center gap-3"
          >
            <SkeletonBar className="col-span-2 h-4" />
            <SkeletonBar className="col-span-7 h-4" />
            <SkeletonBar className="col-span-3 h-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
