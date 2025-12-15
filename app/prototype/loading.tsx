import { SkeletonBlock } from '@/components/Skeletons'

export default function Loading() {
  return (
    <main className="flex min-h-screen w-full items-start justify-center bg-slate-200 p-4">
      <div className="w-full max-w-5xl space-y-4">
        <SkeletonBlock className="h-10 border border-slate-200 bg-white/80" />
        <SkeletonBlock className="h-[75vh] border border-slate-200 bg-white" />
        <p className="text-center text-xs text-slate-500">样例报告加载中...</p>
      </div>
    </main>
  )
}
