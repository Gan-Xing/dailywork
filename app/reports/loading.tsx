import { SkeletonBar, SkeletonBlock, SkeletonCircle, SkeletonText } from '@/components/Skeletons'
import { ReportsHeader } from './ReportsHeader'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportsHeader
        className="z-30 py-4"
        breadcrumbs={[
          { label: <SkeletonText className="h-5 w-16" />, href: '/' },
          { label: <SkeletonText className="h-5 w-24" /> },
        ]}
        title={<SkeletonText className="h-7 w-40" />}
        rightSlot={<SkeletonBar className="h-8 w-32" />}
      />
      <section className="mx-auto w-full max-w-[1700px] space-y-8 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <SkeletonBar className="h-3 w-24" />
            <SkeletonBar className="mt-2 h-7 w-48" />
            <SkeletonBar className="mt-2 h-4 w-64" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SkeletonBar className="h-8 w-20" />
            <SkeletonBar className="h-8 w-20" />
            <SkeletonBar className="h-8 w-24" />
          </div>
        </div>
        <SkeletonBlock className="mt-4 h-12 rounded-2xl border border-slate-100 bg-slate-50" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              // skeleton table rows only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <SkeletonCircle size="1.25rem" />
                <SkeletonBar className="h-4 w-24" />
              </div>
              <SkeletonBar className="h-3 w-32" />
              <SkeletonBar className="h-4 w-12" />
            </div>
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
      </section>
    </main>
  )
}
