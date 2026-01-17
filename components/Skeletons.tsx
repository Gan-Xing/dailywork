type SkeletonTone = 'light' | 'dark'

const toneBar: Record<SkeletonTone, string> = {
  light: 'bg-slate-200',
  dark: 'bg-white/10',
}

const toneBlock: Record<SkeletonTone, string> = {
  light: 'bg-slate-100',
  dark: 'bg-white/5',
}

export function SkeletonBar({ className, tone = 'light' }: { className?: string; tone?: SkeletonTone }) {
  return (
    <div
      className={`animate-pulse rounded-full ${toneBar[tone]} ${className ?? ''}`.trim()}
    />
  )
}

export function SkeletonText({
  className,
  tone = 'light',
}: {
  className?: string
  tone?: SkeletonTone
}) {
  return (
    <span
      className={`inline-block animate-pulse rounded-full ${toneBar[tone]} ${className ?? ''}`.trim()}
    />
  )
}

export function SkeletonBlock({
  className,
  tone = 'light',
}: {
  className?: string
  tone?: SkeletonTone
}) {
  return (
    <div
      className={`animate-pulse rounded-xl ${toneBlock[tone]} ${className ?? ''}`.trim()}
    />
  )
}

export function SkeletonCircle({
  size = '3rem',
  tone = 'light',
  className,
}: {
  size?: string
  tone?: SkeletonTone
  className?: string
}) {
  return (
    <div
      className={`animate-pulse rounded-full ${toneBlock[tone]} ${className ?? ''}`.trim()}
      style={{ width: size, height: size }}
    />
  )
}
