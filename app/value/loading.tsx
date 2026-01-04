import { SkeletonBar } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-[1700px] space-y-6 px-6 py-10 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <SkeletonBar tone="light" className="h-3 w-28" />
          <SkeletonBar tone="light" className="mt-2 h-8 w-64" />
          <SkeletonBar tone="light" className="mt-2 h-4 w-80" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <SkeletonBar tone="light" className="h-5 w-24" />
            <SkeletonBar tone="light" className="h-8 w-32" />
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
          <div className="grid gap-2 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <SkeletonBar
                // skeleton stats only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                tone="light"
                className="h-5 w-40"
              />
            ))}
          </div>
          <div className="divide-y divide-slate-200">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                // skeleton rows only
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1.5fr,1fr,1fr,1fr]"
              >
                <SkeletonBar tone="light" className="h-4 w-40" />
                <SkeletonBar tone="light" className="h-4 w-24" />
                <SkeletonBar tone="light" className="h-4 w-20" />
                <SkeletonBar tone="light" className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
