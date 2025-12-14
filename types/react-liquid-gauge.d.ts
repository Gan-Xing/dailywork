declare module 'react-liquid-gauge' {
  import type { CSSProperties, ReactNode } from 'react'

  export type GradientStop = {
    key: string
    stopColor: string
    stopOpacity?: number
    offset?: string | number
  }

  export type LiquidGaugeProps = {
    value: number
    minValue?: number
    maxValue?: number
    width?: number
    height?: number
    className?: string
    style?: CSSProperties
    textRenderer?: (props: { value: number }) => ReactNode
    waveFrequency?: number
    waveAmplitude?: number
    riseAnimation?: boolean
    waveAnimation?: boolean
    gradientStops?: GradientStop[]
    waveTextStyle?: CSSProperties
    textStyle?: CSSProperties
    outerCircleStyle?: CSSProperties
    circleStyle?: CSSProperties
  }

  export default function LiquidGauge(props: LiquidGaugeProps): JSX.Element
}
