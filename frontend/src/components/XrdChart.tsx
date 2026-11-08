import { useEffect, useMemo, useRef } from 'react'

import type { XrdResult } from '../api'
import { echarts, type ECharts } from '../chart/echartsSetup'
import { buildXrdOption, type XrdLabels, type XrdView } from '../chart/xrd'
import { useIsDark } from '../useIsDark'

type SetOptionArgument = Parameters<ECharts['setOption']>[0]

interface XrdChartProps {
  result: XrdResult
  raw: number[]
  view: XrdView
  labels: XrdLabels
  label: string
  // Any CSS height, for example "26rem".
  height: string
}

export function XrdChart({ result, raw, view, labels, label, height }: XrdChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ECharts | null>(null)
  const dark = useIsDark()
  const option = useMemo(
    () => buildXrdOption(result, raw, view, labels),
    [result, raw, view, labels],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const chart = echarts.init(container, dark ? 'dark' : undefined)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(container)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [dark])

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
