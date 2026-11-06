import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { useEffect, useRef } from 'react'

import type { ChartOption } from '../chart/buildOption'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
])

type EChartsOption = Parameters<echarts.ECharts['setOption']>[0]

// The option is assembled from plain objects, so it is cast to the library type once, here.
function toEChartsOption(option: ChartOption): EChartsOption {
  return option as unknown as EChartsOption
}

interface ChartViewProps {
  option: ChartOption
  dark: boolean
  replayToken: number
  label: string
  onReady: (chart: echarts.ECharts | null) => void
}

export function ChartView({ option, dark, replayToken, label, onReady }: ChartViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const optionRef = useRef(option)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
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

  useEffect(() => {
    optionRef.current = option
    chartRef.current?.setOption(toEChartsOption(option), { notMerge: true })
  }, [option, dark])

  useEffect(() => {
    if (replayToken === 0) return
    const chart = chartRef.current
    if (!chart) return
    chart.clear()
    chart.setOption(toEChartsOption(optionRef.current), { notMerge: true })
  }, [replayToken])

  return <div ref={containerRef} role="img" aria-label={label} className="h-112 w-full" />
}
