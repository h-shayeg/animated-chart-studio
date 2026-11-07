import type { Dataset } from '../api'
import type { PaletteName } from './palettes'

export type ChartType = 'line' | 'area' | 'bar' | 'scatter' | 'pie'

export const CHART_TYPES: ChartType[] = ['line', 'area', 'bar', 'scatter', 'pie']

export type RangeAxis = 'x' | 'y'

export interface ColorRange {
  id: string
  from: number | null
  to: number | null
  color: string
  // The axis whose values the range colours. Without it the range follows `rangeAxis`.
  axis?: RangeAxis
}

// A frame drawn around a part of the chart, with that part enlarged beside the chart.
// An empty bound is open: X falls back to the ends of the data and Y fits the data in the frame.
export interface Magnifier {
  enabled: boolean
  xFrom: number | null
  xTo: number | null
  yFrom: number | null
  yTo: number | null
  // Where the enlarged view sits, in percent of the chart: its left and top edges and its size.
  boxLeft: number
  boxTop: number
  boxWidth: number
  boxHeight: number
  // Its own animation, apart from the one of the main chart.
  animate: boolean
  durationMs: number
  delayMs: number
}

export const DEFAULT_MAGNIFIER: Magnifier = {
  enabled: false,
  xFrom: null,
  xTo: null,
  yFrom: null,
  yTo: null,
  boxLeft: 60,
  boxTop: 14,
  boxWidth: 32,
  boxHeight: 52,
  animate: true,
  durationMs: 1200,
  delayMs: 0,
}

export interface ChartConfig {
  type: ChartType
  xColumn: string
  yColumns: string[]
  title: string
  palette: PaletteName
  smooth: boolean
  stacked: boolean
  animate: boolean
  durationMs: number
  ranges: ColorRange[]
  // The axis of the ranges that do not name their own.
  rangeAxis: RangeAxis
  // The colour used everywhere outside the ranges. Null keeps each series' own colour.
  restColor: string | null
  cropFrom: number | null
  cropTo: number | null
  zoomSlider: boolean
  magnifier: Magnifier
}

export function defaultConfig(dataset: Dataset): ChartConfig {
  const firstX =
    dataset.columns.find((column) => column.kind === 'datetime') ??
    dataset.columns.find((column) => column.kind !== 'numeric') ??
    dataset.columns[0]
  const xColumn = firstX?.name ?? ''
  const yColumns = dataset.columns
    .filter(
      (column) =>
        column.kind === 'numeric' && column.name !== xColumn && column.missing < dataset.rows,
    )
    .slice(0, 3)
    .map((column) => column.name)

  return {
    type: 'line',
    xColumn,
    yColumns,
    title: dataset.filename.replace(/\.[^.]+$/, ''),
    palette: 'indigo',
    smooth: true,
    stacked: false,
    animate: true,
    durationMs: 1200,
    ranges: [],
    rangeAxis: 'y',
    restColor: null,
    cropFrom: null,
    cropTo: null,
    zoomSlider: false,
    magnifier: { ...DEFAULT_MAGNIFIER },
  }
}
