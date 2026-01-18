'use client'

import LiquidGauge, { type GradientStop } from 'react-liquid-gauge'

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

const gradientStops: GradientStop[] = [
  {
    key: '0%',
    stopColor: '#22c55e',
    stopOpacity: 1,
    offset: '0%',
  },
  {
    key: '50%',
    stopColor: '#06b6d4',
    stopOpacity: 0.9,
    offset: '50%',
  },
  {
    key: '100%',
    stopColor: '#0ea5e9',
    stopOpacity: 0.85,
    offset: '100%',
  },
]

export function PointProgressWave({ percent, size = 56, className }: PointProgressWaveProps) {
  const clamped = clampPercent(percent)
  const innerSize = Math.max(0, size - 4)

  return (
    <LiquidGauge
      className={className}
      style={{
        width: size,
        height: size,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        margin: '0 auto',
        transform: 'translateY(2px)',
      }}
      width={innerSize}
      height={innerSize}
      value={clamped}
      minValue={0}
      maxValue={100}
      textRenderer={() => `${clamped.toFixed(1)}%`}
      waveFrequency={2.4}
      waveAmplitude={3}
      riseAnimation
      waveAnimation
      gradientStops={gradientStops}
      waveTextStyle={{
        fill: '#f8fafc',
        stroke: '#0f172a',
        strokeWidth: 1.2,
        paintOrder: 'stroke',
        fontSize: `${Math.max(10, Math.round(size * 0.24))}px`,
        fontWeight: 800,
      }}
      outerCircleStyle={{
        fill: 'transparent',
        stroke: '#0ea5e9',
        strokeWidth: 2,
      }}
      circleStyle={{
        fill: '#e0f2fe',
      }}
      textStyle={{
        fill: '#0f172a',
        stroke: '#f8fafc',
        strokeWidth: 1.2,
        paintOrder: 'stroke',
        fontSize: `${Math.max(10, Math.round(size * 0.24))}px`,
        fontWeight: 800,
      }}
    />
  )
}

export default PointProgressWave
