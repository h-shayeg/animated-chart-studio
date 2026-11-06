import { useEffect, useRef } from 'react'

import type { ChartOption } from '../chart/buildOption'
import { echarts, toEChartsOption, type ECharts } from '../chart/echartsSetup'

interface ChartViewProps {
  option: ChartOption
  animateKey: string
  dark: boolean
  replayToken: number
  label: string
  onReady: (chart: ECharts | null) => void
}

export function ChartView({
  option,
  animateKey,
  dark,
  replayToken,
  label,
  onReady,
}: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const optionRef = useRef(option)
  const themeRef = useRef<boolean | null>(null)
  const skipAnimationRef = useRef(false)
  const drawnRef = useRef<{ chart: ECharts; key: string } | null>(null)

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

  // Only a new chart or a new animateKey plays the animation. Small edits such as a new
  // title or colour are applied at once, so a long animation does not restart for each one.
  useEffect(() => {
    optionRef.current = option
    const chart = chartRef.current
    if (!chart) return
    const unchanged = drawnRef.current?.chart === chart && drawnRef.current.key === animateKey
    const animate = !unchanged && !skipAnimationRef.current
    skipAnimationRef.current = false
    drawnRef.current = { chart, key: animateKey }
    chart.setOption(toEChartsOption(animate ? option : { ...option, animation: false }), {
      notMerge: true,
    })
  }, [option, animateKey, dark])

  useEffect(() => {
    if (replayToken === 0) return
    const chart = chartRef.current
    if (!chart) return
    chart.clear()
    chart.setOption(toEChartsOption(optionRef.current), { notMerge: true })
  }, [replayToken])

  return (
    <div className="relative min-h-112 w-full flex-1">
      <div ref={containerRef} role="img" aria-label={label} className="absolute inset-0" />
    </div>
  )
}
