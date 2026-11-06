import type { ColumnKind, Dataset } from '../api'
import { PALETTES } from './palettes'
import type { ChartConfig } from './types'

export type ChartOption = Record<string, unknown>

interface BuildInput {
  dataset: Dataset
  config: ChartConfig
  language: string
}

type Point = [number | string, number | null]

const FONT = '"Vazirmatn Variable", ui-sans-serif, system-ui, sans-serif'

// ECharts switches the animation off above 2000 points per series by default.
const ANIMATION_THRESHOLD = 20_000
// Above this many rows, line charts draw a reduced set of points that keeps the shape.
const SAMPLING_FROM = 1_000
// Bars and dots appear one after another: the last one starts after this share of the duration.
const STAGGER_SHARE = 0.4

function toNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function toLabel(value: unknown): string {
  return value === null || value === undefined ? '—' : String(value)
}

function toX(value: unknown, kind: ColumnKind): number | string | null {
  if (kind === 'numeric') return toNumber(value)
  return typeof value === 'string' ? value : null
}

function compareX(a: Point, b: Point): number {
  const left = a[0]
  const right = b[0]
  return typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right))
}

function pointsOf(dataset: Dataset, xColumn: string, xKind: ColumnKind, yColumn: string): Point[] {
  return dataset.data
    .flatMap((row): Point[] => {
      const x = toX(row[xColumn], xKind)
      return x === null ? [] : [[x, toNumber(row[yColumn])]]
    })
    .sort(compareX)
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
    animationThreshold: ANIMATION_THRESHOLD,
    animationDuration: config.durationMs,
    animationEasing: 'cubicOut',
  }

  // Items that appear one after another, so the whole chart still ends at the chosen duration.
  const stagger = (count: number) => ({
    animationDuration: Math.round(config.durationMs * (1 - STAGGER_SHARE)),
    animationDelay: (dataIndex: number) =>
      (dataIndex * config.durationMs * STAGGER_SHARE) / Math.max(count, 1),
  })

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

  const rows = dataset.data.length
  const continuousX =
    (config.type === 'line' || config.type === 'area') &&
    (xKind === 'numeric' || xKind === 'datetime')
  const namedX = config.type === 'scatter' || continuousX
  const showLegend = yColumns.length > 1
  const legend = showLegend ? { bottom: 0, type: 'scroll' } : undefined
  const grid = {
    left: 16,
    right: 24,
    top: 64,
    bottom: (showLegend ? 48 : 16) + (namedX ? 24 : 0),
    containLabel: true,
  }
  const valueAxis = {
    type: 'value',
    scale: config.type === 'scatter',
    axisLabel: { formatter: (value: number) => numbers.format(value) },
    splitLine: { lineStyle: { type: 'dashed', opacity: 0.4 } },
  }
  const axisName = { name: config.xColumn, nameLocation: 'middle', nameGap: 28 }

  if (config.type === 'scatter') {
    return {
      ...common,
      legend,
      grid,
      xAxis: { ...valueAxis, ...axisName },
      yAxis: valueAxis,
      series: yColumns.map((name) => {
        const data = dataset.data.flatMap((row) => {
          const x = toNumber(row[config.xColumn])
          const y = toNumber(row[name])
          return x !== null && y !== null ? [[x, y]] : []
        })
        return { name, type: 'scatter', symbolSize: 12, data, ...stagger(data.length) }
      }),
    }
  }

  let xAxis: ChartOption
  if (!continuousX) {
    xAxis = {
      type: 'category',
      boundaryGap: config.type === 'bar',
      data: dataset.data.map((row) => toLabel(row[config.xColumn])),
      axisLabel: { hideOverlap: true },
    }
  } else if (xKind === 'numeric') {
    xAxis = { ...valueAxis, scale: true, ...axisName }
  } else {
    xAxis = { type: 'time', ...axisName }
  }

  const stacked = config.stacked && (config.type === 'bar' || config.type === 'area')

  return {
    ...common,
    legend,
    grid,
    xAxis,
    yAxis: valueAxis,
    series: yColumns.map((name) => ({
      name,
      type: config.type === 'bar' ? 'bar' : 'line',
      data: continuousX
        ? pointsOf(dataset, config.xColumn, xKind, name)
        : dataset.data.map((row) => toNumber(row[name])),
      sampling: config.type !== 'bar' && rows > SAMPLING_FROM ? 'lttb' : undefined,
      smooth: config.smooth && config.type !== 'bar',
      showSymbol: rows <= 60,
      symbolSize: 7,
      stack: stacked ? 'total' : undefined,
      areaStyle: config.type === 'area' ? { opacity: 0.25 } : undefined,
      itemStyle: config.type === 'bar' ? { borderRadius: [6, 6, 0, 0] } : undefined,
      barMaxWidth: 48,
      emphasis: { focus: 'series' },
      ...(config.type === 'bar' ? stagger(rows) : {}),
    })),
  }
}
