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
    stopColor: '#34d399',
    stopOpacity: 1,
    offset: '0%',
  },
  {
    key: '50%',
    stopColor: '#22d3ee',
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

  return (
    <LiquidGauge
      className={className}
      style={{ width: size, height: size, display: 'block', margin: '0 auto' }}
      width={size}
      height={size}
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
        fontSize: `${Math.max(10, Math.round(size * 0.24))}px`,
        fontWeight: 700,
      }}
      outerCircleStyle={{
        fill: 'transparent',
        stroke: '#0ea5e9',
        strokeWidth: 2,
      }}
      circleStyle={{
        fill: '#0ea5e910',
      }}
      textStyle={{
        fill: '#f8fafc',
        fontSize: `${Math.max(10, Math.round(size * 0.24))}px`,
        fontWeight: 700,
      }}
    />
  )
}

export default PointProgressWave
