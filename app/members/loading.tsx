import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8 xl:max-w-[1500px] xl:px-10 2xl:max-w-[1700px] 2xl:px-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SkeletonBar className="h-6 w-16" />
          <SkeletonBar className="h-6 w-24" />
        </div>
        <SkeletonBar className="h-8 w-32" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonBar
            // skeleton tabs only
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="h-9 w-28"
          />
        ))}
      </div>

      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBar className="h-5 w-36" />
            <SkeletonBar className="h-4 w-48" />
          </div>
          <div className="flex flex-wrap gap-2">
            <SkeletonBar className="h-9 w-28" />
            <SkeletonBar className="h-9 w-28" />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock
              // skeleton filters only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="h-12 border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              // skeleton rows only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="flex items-center justify-between px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-3">
                <SkeletonBar className="h-4 w-24" />
                <SkeletonBar className="h-4 w-20" />
                <SkeletonBar className="h-4 w-28" />
              </div>
              <SkeletonBar className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
