import type { ColumnKind, Dataset } from '../api'
import { applyMagnifier, magnifierStatus } from './magnifier'
import { PALETTES } from './palettes'
import {
  closeRanges,
  colorLookup,
  colorPieces,
  cropDataset,
  rangeAxisFor,
  rangeExtent,
  rangePlan,
} from './ranges'
import type { ChartConfig, ColorRange } from './types'

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

function pieceOf(range: ColorRange): Record<string, unknown> {
  return {
    ...(range.from === null ? {} : { gte: range.from }),
    ...(range.to === null ? {} : { lte: range.to }),
    color: range.color,
  }
}

type NumericPoint = [number, number | null]

// A stacked series sits on top of the ones before it, so its ranges are matched against the total.
function runningTotals(series: NumericPoint[][]): NumericPoint[][] {
  return series.map((points, index) =>
    points.map(([x, y], position): NumericPoint => {
      if (y === null) return [x, null]
      const below = series
        .slice(0, index)
        .reduce((sum, other) => sum + (other[position]?.[1] ?? 0), 0)
      return [x, y + below]
    }),
  )
}

// The points each line is drawn through, with numbers on X, for working out its colour pieces.
function rangePoints(
  dataset: Dataset,
  config: ChartConfig,
  xKind: ColumnKind,
  yColumns: string[],
): NumericPoint[][] {
  const series = yColumns.map((name) =>
    pointsOf(dataset, config.xColumn, xKind, name).flatMap(([x, y]): NumericPoint[] =>
      typeof x === 'number' ? [[x, y]] : [],
    ),
  )
  return config.stacked && config.type === 'area' ? runningTotals(series) : series
}

function buildBaseOption({ dataset: source, config, language }: BuildInput): ChartOption | null {
  const kinds = new Map(source.columns.map((column) => [column.name, column.kind]))
  const xKind = kinds.get(config.xColumn)
  const yColumns = config.yColumns.filter((name) => kinds.get(name) === 'numeric')
  if (xKind === undefined || yColumns.length === 0) return null
  if (config.type === 'scatter' && xKind !== 'numeric') return null

  const dataset = cropDataset(source, config)
  if (dataset.data.length === 0) return null

  const numbers = new Intl.NumberFormat(language)
  const formatValue = (value: unknown): string => {
    if (Array.isArray(value)) return value.map(formatValue).join(' , ')
    return typeof value === 'number' ? numbers.format(value) : toLabel(value)
  }

  const palette = PALETTES[config.palette]
  const common: ChartOption = {
    backgroundColor: 'transparent',
    color: [...palette],
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
    bottom: (showLegend ? 48 : 16) + (namedX ? 24 : 0) + (config.zoomSlider ? 40 : 0),
    containLabel: true,
  }
  const dataZoom = config.zoomSlider
    ? [{ type: 'inside' }, { type: 'slider', height: 22, bottom: showLegend ? 32 : 8 }]
    : undefined

  const plan = rangePlan(source, config)
  const both = plan.x.length > 0 && plan.y.length > 0
  // One visual map per series, so a series keeps its own colour outside every range.
  const rangeAxis = rangeAxisFor(source, config)
  const pieces =
    rangeAxis === null
      ? []
      : closeRanges(
          plan[rangeAxis],
          rangeExtent(dataset, config, yColumns, rangeAxis),
        ).map(pieceOf)
  let visualMap =
    rangeAxis === null
      ? undefined
      : yColumns.map((_, index) => ({
          type: 'piecewise',
          show: false,
          seriesIndex: index,
          dimension: rangeAxis === 'x' ? 0 : 1,
          pieces,
          outOfRange: { color: config.restColor ?? palette[index % palette.length] ?? palette[0] },
        }))

  const rest = (index: number) => config.restColor ?? palette[index % palette.length] ?? palette[0]
  // Ranges on X and on Y together: a scatter point is coloured by its slot in this list (0 means
  // outside every range), and a line by stretches of X worked out from its own points.
  const slots = [...new Set([...plan.y, ...plan.x].map((range) => range.color))]
  const colorOf = both ? colorLookup(plan.x, plan.y) : null
  const slotOf = (x: number, y: number): number => {
    const color = colorOf === null ? null : colorOf(x, y)
    return color === null ? 0 : slots.indexOf(color) + 1
  }
  if (both) {
    const lines = config.type === 'scatter' ? [] : rangePoints(dataset, config, xKind, yColumns)
    visualMap = yColumns.map((_, index) => ({
      type: 'piecewise',
      show: false,
      seriesIndex: index,
      dimension: config.type === 'scatter' ? 2 : 0,
      pieces:
        config.type === 'scatter'
          ? slots.map((color, slot) => ({ value: slot + 1, color }))
          : colorPieces(lines[index] ?? [], plan.x, plan.y),
      outOfRange: { color: rest(index) },
    }))
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
      dataZoom,
      visualMap,
      xAxis: { ...valueAxis, ...axisName },
      yAxis: valueAxis,
      series: yColumns.map((name) => {
        const data = dataset.data.flatMap((row) => {
          const x = toNumber(row[config.xColumn])
          const y = toNumber(row[name])
          return x !== null && y !== null ? [colorOf === null ? [x, y] : [x, y, slotOf(x, y)]] : []
        })
        return {
          name,
          type: 'scatter',
          symbolSize: 12,
          data,
          // The third value of a point, its range slot, is kept out of the tooltip.
          ...(colorOf === null ? {} : { encode: { x: 0, y: 1, tooltip: [0, 1] } }),
          ...stagger(data.length),
        }
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
    dataZoom,
    visualMap,
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

// The magnifier is added on top of the finished chart, so the code above stays as it was.
export function buildOption(input: BuildInput): ChartOption | null {
  const option = buildBaseOption(input)
  if (option === null || magnifierStatus(input.dataset, input.config) !== 'ready') return option
  return applyMagnifier(option, input.config, new Intl.NumberFormat(input.language))
}
