import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-950">
      <section className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-slate-50 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
          <SkeletonBar tone="dark" className="h-3 w-28" />
          <SkeletonBar tone="dark" className="mt-2 h-8 w-64" />
          <SkeletonBar tone="dark" className="mt-2 h-4 w-80" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <SkeletonBar tone="dark" className="h-4 w-48" />
            <SkeletonBar tone="dark" className="h-7 w-32" />
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-white/10 bg-slate-950/80 p-6 backdrop-blur">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              // skeleton groups only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="space-y-3 rounded-2xl border border-white/5 bg-slate-950/70 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <SkeletonBar tone="dark" className="h-4 w-48" />
                  <SkeletonBar tone="dark" className="h-3 w-40" />
                </div>
                <SkeletonBar tone="dark" className="h-4 w-16" />
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr>
                      {Array.from({ length: 5 }).map((_, headIndex) => (
                        <th key={headIndex} className="px-3 py-2">
                          <SkeletonBar tone="dark" className="h-3 w-20" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 3 }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-white/5">
                        {Array.from({ length: 5 }).map((_, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2">
                            <SkeletonBar tone="dark" className="h-4 w-24" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SkeletonBlock tone="dark" className="h-12 border border-white/5 bg-white/10" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
