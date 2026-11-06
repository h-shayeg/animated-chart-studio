import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'

import type { ChartOption } from './buildOption'

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
  CanvasRenderer,
])

export { echarts }

export type ECharts = echarts.ECharts

type EChartsOption = Parameters<echarts.ECharts['setOption']>[0]

// The option is assembled from plain objects, so it is cast to the library type once, here.
export function toEChartsOption(option: ChartOption): EChartsOption {
  return option as unknown as EChartsOption
}
