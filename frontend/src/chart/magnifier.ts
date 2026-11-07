import type { Dataset } from '../api'
import { cropDataset, xIsNumericAxis } from './ranges'
import type { ChartConfig, Magnifier } from './types'

type OptionRecord = Record<string, unknown>
type Point = [number, number | null]

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface MagnifierWindow {
  xFrom: number
  xTo: number
  // Range of the enlarged view. With an open Y it leaves a little room around the data.
  yFrom: number
  yTo: number
  // Range of the frame on the main chart. With an open Y it is exactly the data inside it.
  frameYFrom: number
  frameYTo: number
}

export type MagnifierStatus = 'off' | 'unavailable' | 'needsRange' | 'empty' | 'ready'

// The enlarged view sits in a box that is placed and sized in percent of the chart. The box keeps
// to the right of MIN_LEFT, where the main chart stays, and clear of the edges, where the axis
// labels need room.
const MIN_LEFT = 40
const MAX_RIGHT = 92
const MIN_WIDTH = 12
const MIN_TOP = 0
const MAX_BOTTOM = 86
const MIN_HEIGHT = 15
// The main chart ends this far (in percent) before the box, which leaves room for the lines that
// join them.
const GAP = 6
// Dots of a scatter chart appear one after another, the last one after this share of the duration.
// The main chart uses the same share.
const SCATTER_STAGGER = 0.4

export interface Placement {
  left: number
  top: number
  width: number
  height: number
}

function clamp(value: number, low: number, high: number): number {
  const wanted = Number.isFinite(value) ? value : low
  return Math.min(Math.max(wanted, low), Math.max(high, low))
}

// The box of the enlarged view, kept inside the room it is given.
export function placementOf(magnifier: Magnifier): Placement {
  const width = clamp(magnifier.boxWidth, MIN_WIDTH, MAX_RIGHT - MIN_LEFT)
  const height = clamp(magnifier.boxHeight, MIN_HEIGHT, MAX_BOTTOM - MIN_TOP)
  return {
    width,
    height,
    left: clamp(magnifier.boxLeft, MIN_LEFT, MAX_RIGHT - width),
    top: clamp(magnifier.boxTop, MIN_TOP, MAX_BOTTOM - height),
  }
}

// How far each slider may go, so that the box never leaves the room it is given.
export function placementLimits(placement: Placement) {
  return {
    left: [MIN_LEFT, MAX_RIGHT - placement.width],
    top: [MIN_TOP, MAX_BOTTOM - placement.height],
    width: [MIN_WIDTH, MAX_RIGHT - placement.left],
    height: [MIN_HEIGHT, MAX_BOTTOM - placement.top],
  } as const
}

// Share of the data range added above and below the enlarged view when Y is left open.
const Y_PADDING = 0.05
// The enlarged view shows a dot for every point only while there are this few of them.
const SYMBOL_LIMIT = 80
const LINE_COLOR = '#64748b'
const FRAME_FILL = 'rgba(100, 116, 139, 0.12)'

interface RenderApi {
  value: (dimension: number) => number
  coord: (point: [number, number]) => [number, number]
  getWidth: () => number
  getHeight: () => number
}

function extent(values: number[]): [number, number] | null {
  let low = Infinity
  let high = -Infinity
  for (const value of values) {
    if (value < low) low = value
    if (value > high) high = value
  }
  return low <= high ? [low, high] : null
}

function xWindow(xs: number[], magnifier: Magnifier): [number, number] | null {
  const data = extent(xs)
  if (data === null) return null
  const start = magnifier.xFrom ?? data[0]
  const end = magnifier.xTo ?? data[1]
  const from = Math.min(start, end)
  const to = Math.max(start, end)
  return from < to ? [from, to] : null
}

function yExtent(series: Point[][], stacked: boolean): [number, number] | null {
  const values: number[] = []
  if (stacked) {
    const length = Math.max(0, ...series.map((points) => points.length))
    for (let index = 0; index < length; index += 1) {
      values.push(series.reduce((sum, points) => sum + (points[index]?.[1] ?? 0), 0))
    }
    values.push(0)
  } else {
    for (const points of series) {
      for (const [, y] of points) {
        if (y !== null) values.push(y)
      }
    }
  }
  return extent(values)
}

export function resolveWindow(
  series: Point[][],
  magnifier: Magnifier,
  stacked: boolean,
): MagnifierWindow | null {
  const range = xWindow(
    series.flatMap((points) => points.map(([x]) => x)),
    magnifier,
  )
  if (range === null) return null
  const [xFrom, xTo] = range
  const inside = series.map((points) => points.filter(([x]) => x >= xFrom && x <= xTo))
  if (Math.max(0, ...inside.map((points) => points.length)) < 2) return null

  const { yFrom: lowUser, yTo: highUser } = magnifier
  if (lowUser !== null && highUser !== null) {
    const yFrom = Math.min(lowUser, highUser)
    const yTo = Math.max(lowUser, highUser)
    return yFrom < yTo ? { xFrom, xTo, yFrom, yTo, frameYFrom: yFrom, frameYTo: yTo } : null
  }

  const data = yExtent(inside, stacked)
  if (data === null) return null
  const [low, high] = data
  const pad = high > low ? (high - low) * Y_PADDING : Math.abs(high) * Y_PADDING || 1
  // Flat data has no height, so its frame gets the same room as the enlarged view.
  const framePad = high > low ? 0 : pad
  const yFrom = lowUser ?? low - pad
  const yTo = highUser ?? high + pad
  const frameYFrom = lowUser ?? low - framePad
  const frameYTo = highUser ?? high + framePad
  return yFrom < yTo && frameYFrom < frameYTo
    ? { xFrom, xTo, yFrom, yTo, frameYFrom, frameYTo }
    : null
}

function pointsFromDataset(dataset: Dataset, xColumn: string, yColumn: string): Point[] {
  return dataset.data.flatMap((row): Point[] => {
    const x = row[xColumn]
    if (typeof x !== 'number' || !Number.isFinite(x)) return []
    const y = row[yColumn]
    return [[x, typeof y === 'number' && Number.isFinite(y) ? y : null]]
  })
}

export function magnifierStatus(source: Dataset, config: ChartConfig): MagnifierStatus {
  const { enabled, xFrom, xTo } = config.magnifier
  if (!enabled) return 'off'
  if (!xIsNumericAxis(source, config)) return 'unavailable'
  if (xFrom === null && xTo === null) return 'needsRange'
  const shown = cropDataset(source, config)
  const kinds = new Map(source.columns.map((column) => [column.name, column.kind]))
  const series = config.yColumns
    .filter((name) => kinds.get(name) === 'numeric')
    .map((name) => pointsFromDataset(shown, config.xColumn, name))
  const stacked = config.stacked && config.type === 'area'
  return resolveWindow(series, config.magnifier, stacked) === null ? 'empty' : 'ready'
}

// Lines also keep the point just outside each end, so they reach the edge of the enlarged view.
export function pointsInside(
  points: Point[],
  from: number,
  to: number,
  neighbours: boolean,
): Point[] {
  const indexes = points.flatMap(([x], index) => (x >= from && x <= to ? [index] : []))
  const first = indexes[0]
  const last = indexes[indexes.length - 1]
  if (first === undefined || last === undefined) return []
  if (!neighbours) return points.filter(([x]) => x >= from && x <= to)
  return points.slice(Math.max(first - 1, 0), last + 2)
}

function numericPoints(data: unknown): Point[] {
  if (!Array.isArray(data)) return []
  return data.flatMap((item: unknown): Point[] => {
    if (!Array.isArray(item)) return []
    const [x, y, ...rest] = item as unknown[]
    if (typeof x !== 'number' || !Number.isFinite(x)) return []
    // Further values, such as the range slot of a scatter point, stay with the point.
    return [[x, typeof y === 'number' && Number.isFinite(y) ? y : null, ...rest] as Point]
  })
}

function isRecord(value: unknown): value is OptionRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// The plot area of the enlarged view in pixels, from the chart size and the placement of its box.
export function insetBox(width: number, height: number, placement: Placement): Box {
  return {
    x: (width * placement.left) / 100,
    y: (height * placement.top) / 100,
    width: (width * placement.width) / 100,
    height: (height * placement.height) / 100,
  }
}

// The frame on the main chart, the border of the enlarged view and two lines joining them.
export function frameElements(frame: Box, inset: Box): OptionRecord[] {
  const right = frame.x + frame.width
  const link = { stroke: LINE_COLOR, lineWidth: 1, lineDash: [4, 3] }
  return [
    {
      type: 'rect',
      shape: { ...frame },
      style: { fill: FRAME_FILL, stroke: LINE_COLOR, lineWidth: 1.5, lineDash: [5, 3] },
    },
    {
      type: 'rect',
      shape: { ...inset },
      style: { fill: 'none', stroke: LINE_COLOR, lineWidth: 1.5 },
    },
    { type: 'line', shape: { x1: right, y1: frame.y, x2: inset.x, y2: inset.y }, style: link },
    {
      type: 'line',
      shape: { x1: right, y1: frame.y + frame.height, x2: inset.x, y2: inset.y + inset.height },
      style: link,
    },
  ]
}

function frameRenderer(placement: Placement) {
  return (_params: unknown, api: RenderApi): OptionRecord | null => {
    const [x1, y1] = api.coord([api.value(0), api.value(1)])
    const [x2, y2] = api.coord([api.value(2), api.value(3)])
    if (![x1, y1, x2, y2].every(Number.isFinite)) return null
    const frame: Box = {
      x: Math.min(x1, x2),
      y: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    }
    const inset = insetBox(api.getWidth(), api.getHeight(), placement)
    return { type: 'group', children: frameElements(frame, inset) }
  }
}

// The enlarged view animates on its own: it can be switched off, last another time or start later.
function insetTiming(magnifier: Magnifier, lines: boolean) {
  return (count: number): OptionRecord => {
    if (!magnifier.animate) return { animation: false }
    if (lines) {
      return { animationDuration: magnifier.durationMs, animationDelay: magnifier.delayMs }
    }
    return {
      animationDuration: Math.round(magnifier.durationMs * (1 - SCATTER_STAGGER)),
      animationDelay: (index: number) =>
        magnifier.delayMs + (index * magnifier.durationMs * SCATTER_STAGGER) / Math.max(count, 1),
    }
  }
}

// Turns a finished line, area or scatter option into one with a second grid that shows the chosen
// range enlarged, and a frame with two joining lines on the main chart.
export function applyMagnifier(
  option: OptionRecord,
  config: ChartConfig,
  numbers: Intl.NumberFormat,
): OptionRecord {
  const { grid, xAxis, yAxis } = option
  const series = Array.isArray(option.series) ? (option.series as OptionRecord[]) : []
  if (series.length === 0 || !isRecord(grid) || !isRecord(xAxis) || !isRecord(yAxis)) return option

  const points = series.map((item) => numericPoints(item.data))
  const stacked = config.stacked && config.type === 'area'
  const win = resolveWindow(points, config.magnifier, stacked)
  if (win === null) return option

  const place = placementOf(config.magnifier)
  const lines = config.type !== 'scatter'
  const timing = insetTiming(config.magnifier, lines)
  const enlarged = series.map((item, index) => {
    const data = pointsInside(points[index] ?? [], win.xFrom, win.xTo, lines)
    return {
      ...item,
      data,
      xAxisIndex: 1,
      yAxisIndex: 1,
      ...(lines
        ? {
            sampling: undefined,
            showSymbol: data.length <= SYMBOL_LIMIT,
            stack: typeof item.stack === 'string' ? `${item.stack}-enlarged` : undefined,
          }
        : {}),
      ...timing(data.length),
    }
  })

  const labels = { formatter: (value: number) => numbers.format(value), hideOverlap: true }
  const enlargedX = {
    type: 'value',
    gridIndex: 1,
    min: win.xFrom,
    max: win.xTo,
    splitNumber: 3,
    axisLabel: labels,
    splitLine: yAxis.splitLine,
  }
  const enlargedY = {
    type: 'value',
    gridIndex: 1,
    position: 'right',
    min: win.yFrom,
    max: win.yTo,
    splitNumber: 4,
    axisLabel: labels,
    splitLine: yAxis.splitLine,
  }
  const frame: OptionRecord = {
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    xAxisIndex: 0,
    yAxisIndex: 0,
    dimensions: ['x1', 'y1', 'x2', 'y2'],
    encode: { x: [0, 2], y: [1, 3] },
    data: [[win.xFrom, win.frameYFrom, win.xTo, win.frameYTo]],
    renderItem: frameRenderer(place),
    silent: true,
    clip: false,
    animation: false,
    z: 6,
    tooltip: { show: false },
  }

  const rawVisualMap = option.visualMap
  const rawZoom = option.dataZoom
  const rawLegend = option.legend
  // When only the enlarged view is animated, the main chart has to be switched off by itself.
  const mainSeries =
    !config.animate && config.magnifier.animate
      ? series.map((item) => ({ ...item, animation: false }))
      : series

  return {
    ...option,
    animation: config.animate || config.magnifier.animate,
    grid: [
      { ...grid, right: `${100 - (place.left - GAP)}%` },
      {
        left: `${place.left}%`,
        top: `${place.top}%`,
        width: `${place.width}%`,
        height: `${place.height}%`,
        containLabel: false,
      },
    ],
    xAxis: [xAxis, enlargedX],
    yAxis: [yAxis, enlargedY],
    series: [...mainSeries, ...enlarged, frame],
    // The legend lists the data series once, and never the frame.
    legend: isRecord(rawLegend)
      ? { ...rawLegend, data: series.map((item) => item.name) }
      : rawLegend,
    // The enlarged view is coloured by the same ranges as the main chart.
    visualMap: Array.isArray(rawVisualMap)
      ? [
          ...rawVisualMap,
          ...rawVisualMap.map((item: OptionRecord) => ({
            ...item,
            seriesIndex: series.length + Number(item.seriesIndex),
          })),
        ]
      : rawVisualMap,
    // Zooming moves only the main chart; the frame stays while it overlaps the window.
    dataZoom: Array.isArray(rawZoom)
      ? rawZoom.map((item: OptionRecord) => ({
          ...item,
          xAxisIndex: 0,
          filterMode: 'weakFilter',
        }))
      : rawZoom,
  }
}
