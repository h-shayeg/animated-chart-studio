import { useEffect, useRef } from 'react'

import type { ChartOption } from '../chart/buildOption'
import { echarts, toEChartsOption, type ECharts } from '../chart/echartsSetup'

// A little extra time after the last frame before edits are applied instantly again.
const SETTLE_MS = 300

interface ChartViewProps {
  option: ChartOption
  animateKey: string
  animationMs: number
  dark: boolean
  replayToken: number
  label: string
  // Any CSS height, for example "560px".
  height: string
  onReady: (chart: ECharts | null) => void
}

export function ChartView({
  option,
  animateKey,
  animationMs,
  dark,
  replayToken,
  label,
  height,
  onReady,
}: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const optionRef = useRef(option)
  const animationMsRef = useRef(animationMs)
  const themeRef = useRef<boolean | null>(null)
  const skipAnimationRef = useRef(false)
  const drawnRef = useRef<{ chart: ECharts; key: string } | null>(null)
  const animatingUntilRef = useRef(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    // A theme switch redraws the chart at once, while a first draw plays the animation.
    skipAnimationRef.current = themeRef.current !== null && themeRef.current !== dark
    themeRef.current = dark
    const chart = echarts.init(container, dark ? 'dark' : undefined)
    chartRef.current = chart
    onReady(chart)
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
      onReady(null)
    }
  }, [dark, onReady])

  // A new chart, a new animateKey, or any edit made while an animation is still playing starts
  // the animation again from the beginning, so it always runs to the end. Edits made after it
  // has finished (a new title or colour) are applied at once without playing it again.
  useEffect(() => {
    optionRef.current = option
    animationMsRef.current = animationMs
    const chart = chartRef.current
    if (!chart) return
    const now = performance.now()
    const unchanged = drawnRef.current?.chart === chart && drawnRef.current.key === animateKey
    const running = now < animatingUntilRef.current
    const animate =
      animationMs > 0 && (!unchanged || running) && !skipAnimationRef.current
    skipAnimationRef.current = false
    drawnRef.current = { chart, key: animateKey }
    if (animate) {
      animatingUntilRef.current = now + animationMs + SETTLE_MS
      chart.clear()
      chart.setOption(toEChartsOption(option), { notMerge: true })
    } else {
      animatingUntilRef.current = 0
      chart.setOption(toEChartsOption({ ...option, animation: false }), { notMerge: true })
    }
  }, [option, animateKey, animationMs, dark])

  useEffect(() => {
    if (replayToken === 0) return
    const chart = chartRef.current
    if (!chart) return
    animatingUntilRef.current = performance.now() + animationMsRef.current + SETTLE_MS
    chart.clear()
    chart.setOption(toEChartsOption(optionRef.current), { notMerge: true })
  }, [replayToken])

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} role="img" aria-label={label} className="absolute inset-0" />
    </div>
  )
}
