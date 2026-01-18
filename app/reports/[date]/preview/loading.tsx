import { SkeletonBlock, SkeletonText } from '@/components/Skeletons'
import { ReportsHeader } from '../../ReportsHeader'

export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <ReportsHeader
        className="z-30 py-4"
        breadcrumbs={[
          { label: <SkeletonText className="h-5 w-16" />, href: '/' },
          { label: <SkeletonText className="h-5 w-24" />, href: '/reports' },
          { label: <SkeletonText className="h-5 w-20" /> },
        ]}
        title={<SkeletonText className="h-7 w-40" />}
        subtitle={<SkeletonText className="h-4 w-24" />}
      />
      <section className="flex w-full items-start justify-center bg-slate-200 px-4 pb-10 pt-6 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="w-full max-w-5xl space-y-4">
          <SkeletonBlock className="h-10 border border-slate-200 bg-white/80" />
          <SkeletonBlock className="h-[75vh] border border-slate-200 bg-white" />
          <p className="text-center text-xs text-slate-500">报告预览加载中...</p>
        </div>
      </section>
    </main>
  )
}
