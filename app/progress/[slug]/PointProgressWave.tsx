'use client'

import { useId } from 'react'

export interface PointProgressWaveProps {
  percent: number
  size?: number
  className?: string
}

const clampPercent = (value: number) => {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 100) return 100
  return value
}

export function PointProgressWave({ percent, size = 56, className }: PointProgressWaveProps) {
  const clamped = clampPercent(percent)
  const viewBoxSize = 100
  const waveTop = 96 - clamped * 0.86
  const fontSize = Math.max(18, Math.round(size * 0.28))
  const svgId = useId().replaceAll(':', '')
  const fillId = `${svgId}-fill`
  const clipId = `${svgId}-clip`

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        margin: '0 auto',
        transform: 'translateY(2px)',
      }}
    >
      <svg
        role="img"
        aria-label={`进度 ${clamped.toFixed(1)}%`}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        width={size}
        height={size}
      >
        <defs>
          <linearGradient id={fillId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.85" />
          </linearGradient>
          <clipPath id={clipId}>
            <circle cx="50" cy="50" r="46" />
          </clipPath>
        </defs>
        <circle cx="50" cy="50" r="46" fill="#e0f2fe" stroke="#0ea5e9" strokeWidth="4" />
        <g clipPath={`url(#${clipId})`}>
          <path
            d={`M0 ${waveTop} C 18 ${waveTop - 8}, 34 ${waveTop + 8}, 50 ${waveTop} S 82 ${
              waveTop - 8
            }, 100 ${waveTop} V 100 H 0 Z`}
            fill={`url(#${fillId})`}
          />
        </g>
        <text
          x="50"
          y="54"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#0f172a"
          stroke="#f8fafc"
          strokeWidth="2"
          paintOrder="stroke"
          fontSize={fontSize}
          fontWeight="800"
        >
          {clamped.toFixed(1)}%
        </text>
      </svg>
    </div>
  )
}

export default PointProgressWave
