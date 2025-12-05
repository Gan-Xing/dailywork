import Link from 'next/link'

export default function NotFound() {
  return (
    <main className='relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-slate-50'>
      <div className='absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_20%,rgba(69,162,255,0.12),transparent_25%),radial-gradient(circle_at_90%_10%,rgba(244,137,37,0.14),transparent_20%),radial-gradient(circle_at_60%_70%,rgba(72,236,169,0.12),transparent_25%)]' />
      <div className='absolute left-1/2 top-0 -z-10 h-80 w-[60vw] -translate-x-1/2 rounded-full bg-gradient-to-br from-white/8 via-blue-400/10 to-transparent blur-3xl' />

      <div className='w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-2xl shadow-slate-950/40 backdrop-blur'>
        <p className='inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200'>
          404
          <span className='h-[1px] w-10 bg-slate-300/40' />
          Not Found
        </p>
        <h1 className='mt-4 text-3xl font-semibold leading-tight text-slate-50'>
          找不到页面
        </h1>
        <p className='mt-3 text-slate-200/80'>
          你访问的地址不存在或已被移动，请返回首页继续浏览。
        </p>
        <div className='mt-6 flex flex-wrap justify-center gap-3'>
          <Link
            href='/'
            className='inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-blue-500/20 transition hover:-translate-y-0.5 hover:shadow-blue-500/30'>
            返回首页
            <span aria-hidden>↗</span>
          </Link>
        </div>
      </div>
    </main>
  )
}
