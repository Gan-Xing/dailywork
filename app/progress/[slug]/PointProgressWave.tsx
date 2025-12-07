'use client'

import { useEffect, useRef } from 'react'

import type { LiquidOptions } from '@antv/g2plot'
import { Liquid } from '@antv/g2plot'

interface Props {
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

export function PointProgressWave({ percent, size = 56, className }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return undefined

    const clamped = clampPercent(percent)
    const options: LiquidOptions = {
      percent: clamped / 100,
      width: size,
      height: size,
      outline: { border: 2, distance: 2 },
      wave: { length: 56, count: 4 }, // 再加密波峰、缩短波长，波动更明显
      liquidStyle: {
        fill: 'l(90) 0:#34d399 1:#22d3ee',
      },
      statistic: {
        title: false,
        content: {
          formatter: () => `${clamped.toFixed(1)}%`,
          style: {
            fontSize: '12px',
            fontWeight: 700,
            fill: '#f8fafc', // 高对比度文字，适配深色背景
          },
        },
      },
      theme: {
        styleSheet: {
          brandColor: '#22d3ee',
        },
      },
      animation: {
        appear: { animation: 'wave-in', duration: 1200 },
        update: { animation: 'wave-in', duration: 1200 },
      },
    }

    const chart = new Liquid(node, options)
    chart.render()

    return () => {
      chart.destroy()
    }
  }, [percent, size])

  return <div ref={containerRef} className={className} />
}
