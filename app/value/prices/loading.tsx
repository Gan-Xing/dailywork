import { SkeletonBar, SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto max-w-[1700px] space-y-6 px-6 py-10 sm:px-8 xl:px-12 2xl:px-14">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          <SkeletonBar tone="light" className="h-3 w-28" />
          <SkeletonBar tone="light" className="mt-2 h-8 w-64" />
          <SkeletonBar tone="light" className="mt-2 h-4 w-80" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
            <SkeletonBar tone="light" className="h-4 w-48" />
            <SkeletonBar tone="light" className="h-7 w-32" />
          </div>
        </div>

        <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              // skeleton groups only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <SkeletonBar tone="light" className="h-4 w-48" />
                  <SkeletonBar tone="light" className="h-3 w-40" />
                </div>
                <SkeletonBar tone="light" className="h-4 w-16" />
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr>
                      {Array.from({ length: 5 }).map((_, headIndex) => (
                        <th key={headIndex} className="px-3 py-2">
                          <SkeletonBar tone="light" className="h-3 w-20" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 3 }).map((_, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-slate-200">
                        {Array.from({ length: 5 }).map((_, cellIndex) => (
                          <td key={cellIndex} className="px-3 py-2">
                            <SkeletonBar tone="light" className="h-4 w-24" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <SkeletonBlock tone="light" className="h-12 border border-slate-200 bg-white" />
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
