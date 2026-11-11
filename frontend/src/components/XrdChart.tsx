import { useEffect, useRef } from 'react'

import { echarts, type ECharts } from '../chart/echartsSetup'
import type { XrdOption } from '../chart/xrd'
import { useIsDark } from '../useIsDark'

type SetOptionArgument = Parameters<ECharts['setOption']>[0]

interface XrdChartProps {
  option: XrdOption
  label: string
  // Any CSS height, for example "26rem".
  height: string
  // Hands out the drawn chart, and null when it is taken down.
  onReady?: (chart: ECharts | null) => void
}

export function XrdChart({ option, label, height, onReady }: XrdChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const dark = useIsDark()

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = echarts.init(container, dark ? 'dark' : undefined)
    chartRef.current = chart
    onReady?.(chart)
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
      onReady?.(null)
    }
  }, [dark, onReady])

  useEffect(() => {
    // The option is assembled from plain objects, so it is cast to the library type once, here.
    chartRef.current?.setOption(option as unknown as SetOptionArgument, { notMerge: true })
  }, [option, dark])

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} role="img" aria-label={label} className="absolute inset-0" />
    </div>
  )
}
