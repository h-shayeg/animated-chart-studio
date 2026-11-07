import type { Dataset } from '../api'
import type { ChartConfig, ColorRange, RangeAxis } from './types'

export const RANGE_COLORS = ['#ef4444', '#22c55e', '#f59e0b', '#3b82f6', '#a855f7']

const X_RANGE_CHARTS: ChartConfig['type'][] = ['line', 'area', 'scatter']

export function parseBound(text: string): number | null {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

// Ranges and crops on the X axis work with values only when X is a number column
// drawn on a value axis. Everywhere else the crop counts rows instead.
export function xIsNumericAxis(dataset: Dataset, config: ChartConfig): boolean {
  const kind = dataset.columns.find((column) => column.name === config.xColumn)?.kind
  return kind === 'numeric' && X_RANGE_CHARTS.includes(config.type)
}

export function cropMode(dataset: Dataset, config: ChartConfig): 'x' | 'rows' {
  return xIsNumericAxis(dataset, config) ? 'x' : 'rows'
}

export function cropDataset(dataset: Dataset, config: ChartConfig): Dataset {
  const { cropFrom, cropTo } = config
  if (cropFrom === null && cropTo === null) return dataset

  let data: Dataset['data']
  if (cropMode(dataset, config) === 'x') {
    data = dataset.data.filter((row) => {
      const x = row[config.xColumn]
      return (
        typeof x === 'number' && (cropFrom === null || x >= cropFrom) && (cropTo === null || x <= cropTo)
      )
    })
  } else {
    const start = Math.max((cropFrom ?? 1) - 1, 0)
    data = dataset.data.slice(start, cropTo ?? undefined)
  }
  return { ...dataset, rows: data.length, data }
}

// The ranges that have a bound, of one axis or of both. A range that does not name its axis
// follows `config.rangeAxis`.
export function activeRanges(config: ChartConfig, axis?: RangeAxis): ColorRange[] {
  return config.ranges.filter(
    (range) =>
      (range.from !== null || range.to !== null) &&
      (axis === undefined || (range.axis ?? config.rangeAxis) === axis),
  )
}

// The one axis whose ranges are drawn, or null when there are none or when both axes have some.
export function rangeAxisFor(dataset: Dataset, config: ChartConfig): 'x' | 'y' | null {
  const { x, y } = rangePlan(dataset, config)
  if (x.length > 0 && y.length === 0) return 'x'
  if (y.length > 0 && x.length === 0) return 'y'
  return null
}

// A crop means something different for values and for row numbers, so it is cleared
// when a change switches between the two.
export function normalizeConfig(
  dataset: Dataset,
  previous: ChartConfig,
  next: ChartConfig,
): ChartConfig {
  if (cropMode(dataset, previous) === cropMode(dataset, next)) return next
  return { ...next, cropFrom: null, cropTo: null }
}

// Lowest and highest value that a colour range can apply to, for the axis it colours by.
export function rangeExtent(
  dataset: Dataset,
  config: ChartConfig,
  yColumns: string[],
  axis: 'x' | 'y',
): [number, number] {
  const stacked = config.stacked && (config.type === 'area' || config.type === 'bar')
  let low = Infinity
  let high = -Infinity
  const take = (value: unknown) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return
    if (value < low) low = value
    if (value > high) high = value
  }
  for (const row of dataset.data) {
    if (axis === 'x') {
      take(row[config.xColumn])
      continue
    }
    let total = 0
    for (const name of yColumns) {
      const value = row[name]
      take(value)
      if (typeof value === 'number' && Number.isFinite(value)) total += value
    }
    if (stacked) take(total)
  }
  return low <= high ? [low, high] : [0, 1]
}

// ECharts puts the colour stops of a line at the edges of the closed pieces and fails when there
// are none, which happens when the only ranges have an open end. So every open end is closed just
// beyond the data, and bounds that were typed the wrong way round are swapped.
export function closeRanges(ranges: ColorRange[], extent: [number, number]): ColorRange[] {
  const [low, high] = extent
  const margin = high - low || Math.abs(high) || 1
  const bounds = ranges
    .flatMap((range) => [range.from, range.to])
    .filter((bound): bound is number => bound !== null)
  const lowest = Math.min(low, ...bounds) - margin
  const highest = Math.max(high, ...bounds) + margin
  return ranges.map((range) => {
    const start = range.from ?? lowest
    const end = range.to ?? highest
    return { ...range, from: Math.min(start, end), to: Math.max(start, end) }
  })
}

// The ranges of one axis, with or without a bound. A range that does not name its axis follows
// `config.rangeAxis`.
export function rangesOf(config: ChartConfig, axis: RangeAxis): ColorRange[] {
  return config.ranges.filter((range) => (range.axis ?? config.rangeAxis) === axis)
}

export interface RangePlan {
  x: ColorRange[]
  y: ColorRange[]
}

// The ranges that are really drawn: only those with a bound, none on a pie chart, and on the X axis
// only where X is a number column on a line, area or scatter chart.
export function rangePlan(dataset: Dataset, config: ChartConfig): RangePlan {
  if (config.type === 'pie') return { x: [], y: [] }
  return {
    x: xIsNumericAxis(dataset, config) ? activeRanges(config, 'x') : [],
    y: activeRanges(config, 'y'),
  }
}

type LinePoint = [number, number | null]

export type ColorPiece = { gte: number; lte: number; color: string }

interface Span {
  low: number
  high: number
  color: string
}

// Bounds that were typed the wrong way round are swapped, and an empty bound stays open.
function spansOf(ranges: ColorRange[]): Span[] {
  return ranges.map(({ from, to, color }) => {
    if (from !== null && to !== null) {
      return { low: Math.min(from, to), high: Math.max(from, to), color }
    }
    return { low: from ?? -Infinity, high: to ?? Infinity, color }
  })
}

function firstHit(spans: Span[], value: number): string | null {
  return spans.find((span) => value >= span.low && value <= span.high)?.color ?? null
}

// The colour of a point with a value on X and on Y when ranges on both axes apply together.
// Where a range on Y and a range on X overlap, the one on Y wins.
export function colorLookup(
  xRanges: ColorRange[],
  yRanges: ColorRange[],
): (x: number, y: number | null) => string | null {
  const xs = spansOf(xRanges)
  const ys = spansOf(yRanges)
  return (x, y) => (y === null ? null : firstHit(ys, y)) ?? firstHit(xs, x)
}

// The height of the line through the points at x, or null across a gap.
function heightAt(points: LinePoint[], x: number): number | null {
  let low = 0
  let high = points.length - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if ((points[middle]?.[0] ?? Infinity) <= x) low = middle
    else high = middle - 1
  }
  const left = points[low]
  if (left === undefined) return null
  const right = points[low + 1]
  if (right === undefined || left[0] === x) return left[1]
  if (left[1] === null || right[1] === null) return null
  return left[1] + ((x - left[0]) / (right[0] - left[0])) * (right[1] - left[1])
}

// A line can be coloured along one axis only. So when ranges on X and on Y apply together, the
// stretches where its height is inside a range on Y are turned into stretches of X, found where
// the line crosses the bounds, and put together with the ranges on X.
export function colorPieces(
  points: LinePoint[],
  xRanges: ColorRange[],
  yRanges: ColorRange[],
): ColorPiece[] {
  const first = points[0]
  const last = points[points.length - 1]
  if (first === undefined || last === undefined) return []
  const start = first[0]
  const end = last[0]
  const xs = spansOf(xRanges)
  const ys = spansOf(yRanges)

  const cuts = new Set<number>([start, end])
  for (const span of xs) {
    for (const bound of [span.low, span.high]) {
      if (bound > start && bound < end) cuts.add(bound)
    }
  }
  const heights = ys.flatMap((span) => [span.low, span.high]).filter(Number.isFinite)
  for (let index = 1; index < points.length; index += 1) {
    const left = points[index - 1]
    const right = points[index]
    if (left === undefined || right === undefined) continue
    const [leftX, from] = left
    const [rightX, to] = right
    if (from === null || to === null) continue
    for (const bound of heights) {
      const below = from - bound
      const above = to - bound
      if (below * above > 0 || below === above) continue
      const share = below / (below - above)
      cuts.add(share === 0 ? leftX : share === 1 ? rightX : leftX + share * (rightX - leftX))
    }
  }

  const sorted = [...cuts].sort((a, b) => a - b)
  const pieces: ColorPiece[] = []
  for (let index = 1; index < sorted.length; index += 1) {
    const from = sorted[index - 1]
    const to = sorted[index]
    if (from === undefined || to === undefined) continue
    const middle = (from + to) / 2
    const height = heightAt(points, middle)
    const color = (height === null ? null : firstHit(ys, height)) ?? firstHit(xs, middle)
    if (color === null) continue
    const previous = pieces[pieces.length - 1]
    if (previous !== undefined && previous.color === color && previous.lte === from) {
      previous.lte = to
    } else {
      pieces.push({ gte: from, lte: to, color })
    }
  }

  // A visual map without pieces would split the data into pieces by itself, so there is always
  // one. When no range applies it lies where nothing is drawn.
  if (pieces.length === 0) {
    const color = xRanges[0]?.color ?? yRanges[0]?.color ?? '#000000'
    return [{ gte: start - 2, lte: start - 1, color }]
  }
  return pieces
}
