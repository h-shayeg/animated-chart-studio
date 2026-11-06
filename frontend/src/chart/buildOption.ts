import type { Dataset } from '../api'
import { PALETTES } from './palettes'
import type { ChartConfig } from './types'

export type ChartOption = Record<string, unknown>

interface BuildInput {
  dataset: Dataset
  config: ChartConfig
  language: string
}

const FONT = '"Vazirmatn Variable", ui-sans-serif, system-ui, sans-serif'

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toLabel(value: unknown): string {
  return value === null || value === undefined ? '—' : String(value)
}

export function buildOption({ dataset, config, language }: BuildInput): ChartOption | null {
  const kinds = new Map(dataset.columns.map((column) => [column.name, column.kind]))
  const xKind = kinds.get(config.xColumn)
  const yColumns = config.yColumns.filter((name) => kinds.get(name) === 'numeric')
  if (xKind === undefined || yColumns.length === 0) return null
  if (config.type === 'scatter' && xKind !== 'numeric') return null

  const numbers = new Intl.NumberFormat(language)
  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.map(formatValue).join(' , ')
    return typeof value === 'number' ? numbers.format(value) : toLabel(value)
  }

  const common: ChartOption = {
    backgroundColor: 'transparent',
    color: [...PALETTES[config.palette]],
    textStyle: { fontFamily: FONT },
    title: {
      text: config.title,
      left: 'center',
      top: 8,
      textStyle: { fontSize: 18, fontWeight: 700 },
    },
    tooltip: {
      trigger: config.type === 'pie' || config.type === 'scatter' ? 'item' : 'axis',
      confine: true,
      valueFormatter: formatValue,
    },
    animation: config.animate,
    animationDuration: config.durationMs,
    animationEasing: 'cubicOut',
  }

  if (config.type === 'pie') {
    const column = yColumns[0] ?? ''
    const slices = dataset.data.flatMap((row) => {
      const value = toNumber(row[column])
      return value !== null && value > 0 ? [{ name: toLabel(row[config.xColumn]), value }] : []
    })
    if (slices.length === 0) return null
    return {
      ...common,
      legend: { bottom: 0, type: 'scroll' },
      series: [
        {
          name: column,
          type: 'pie',
          radius: ['38%', '68%'],
          center: ['50%', '52%'],
          itemStyle: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent' },
          animationType: 'expansion',
          data: slices,
        },
      ],
    }
  }

  const showLegend = yColumns.length > 1
  const legend = showLegend ? { bottom: 0, type: 'scroll' } : undefined
  const grid = {
    left: 16,
    right: 24,
    top: 64,
    bottom: (showLegend ? 48 : 16) + (config.type === 'scatter' ? 24 : 0),
    containLabel: true,
  }
  const valueAxis = {
    type: 'value',
    scale: config.type === 'scatter',
    axisLabel: { formatter: (value: number) => numbers.format(value) },
    splitLine: { lineStyle: { type: 'dashed', opacity: 0.4 } },
  }

  if (config.type === 'scatter') {
    return {
      ...common,
      legend,
      grid,
      xAxis: { ...valueAxis, name: config.xColumn, nameLocation: 'middle', nameGap: 28 },
      yAxis: valueAxis,
      series: yColumns.map((name) => ({
        name,
        type: 'scatter',
        symbolSize: 12,
        data: dataset.data.flatMap((row) => {
          const x = toNumber(row[config.xColumn])
          const y = toNumber(row[name])
          return x !== null && y !== null ? [[x, y]] : []
        }),
      })),
    }
  }

  const rows = dataset.data.length
  const delayStep = Math.min(40, config.durationMs / 2 / Math.max(rows, 1))
  const stacked = config.stacked && (config.type === 'bar' || config.type === 'area')

  return {
    ...common,
    legend,
    grid,
    xAxis: {
      type: 'category',
      boundaryGap: config.type === 'bar',
      data: dataset.data.map((row) => toLabel(row[config.xColumn])),
      axisLabel: { hideOverlap: true },
    },
    yAxis: valueAxis,
    series: yColumns.map((name, index) => ({
      name,
      type: config.type === 'bar' ? 'bar' : 'line',
      data: dataset.data.map((row) => toNumber(row[name])),
      smooth: config.smooth && config.type !== 'bar',
      showSymbol: rows <= 60,
      symbolSize: 7,
      stack: stacked ? 'total' : undefined,
      areaStyle: config.type === 'area' ? { opacity: 0.25 } : undefined,
      itemStyle: config.type === 'bar' ? { borderRadius: [6, 6, 0, 0] } : undefined,
      barMaxWidth: 48,
      emphasis: { focus: 'series' },
      animationDelay: (dataIndex: number) => dataIndex * delayStep + index * 80,
    })),
  }
}
