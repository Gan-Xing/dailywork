export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-8 sm:px-8 xl:px-12 2xl:px-14">
      <div className="mx-auto w-full max-w-[1700px] animate-pulse space-y-4">
        <div className="h-16 rounded-xl bg-slate-200" />
        <div className="h-24 rounded-xl bg-slate-200" />
        <div className="h-[420px] rounded-xl bg-slate-200" />
      </div>
    </main>
  )
}

