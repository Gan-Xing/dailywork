import { PageHeaderNav } from '@/components/PageHeaderNav'
import { SkeletonBar, SkeletonBlock, SkeletonCircle, SkeletonText } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <PageHeaderNav
        className="z-30 py-4"
        breadcrumbs={[
          { label: <SkeletonText className="h-5 w-16" />, href: '/' },
          { label: <SkeletonText className="h-5 w-24" />, href: '/reports' },
          { label: <SkeletonText className="h-5 w-20" /> },
        ]}
        title={<SkeletonText className="h-7 w-40" />}
        subtitle={<SkeletonText className="h-4 w-24" />}
        rightSlot={
          <div className="flex items-center gap-2">
            <SkeletonBar className="h-9 w-24" />
            <SkeletonBar className="h-9 w-24" />
            <SkeletonBar className="h-9 w-24" />
          </div>
        }
        breadcrumbVariant="light"
      />
      <section className="mx-auto flex w-full max-w-[1700px] flex-col gap-8 px-4 pb-12 pt-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm shadow-slate-100">
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonBlock className="h-48 border border-slate-100 bg-slate-50" />
          <SkeletonBlock className="h-48 border border-slate-100 bg-slate-50" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <SkeletonBlock
              // skeleton summary only
              // eslint-disable-next-line react/no-array-index-key
              key={index}
              className="h-32 border border-slate-100 bg-slate-50"
            />
          ))}
        </div>
      </div>

        <section className="space-y-5">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            // skeleton section only
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <SkeletonBar className="h-3 w-32" />
                <SkeletonBar className="h-4 w-48" />
              </div>
              <SkeletonCircle size="3rem" className="bg-slate-100" />
            </div>
            <div className="mt-4 space-y-2">
              <SkeletonBar className="h-3 w-full" />
              <SkeletonBar className="h-3 w-11/12" />
              <SkeletonBar className="h-3 w-5/6" />
            </div>
          </div>
        ))}
        </section>
      </section>
    </main>
  )
}
