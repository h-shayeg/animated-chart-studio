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
  rangeAxis: RangeAxis
  cropFrom: number | null
  cropTo: number | null
  zoomSlider: boolean
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
    cropFrom: null,
    cropTo: null,
    zoomSlider: false,
  }
}
