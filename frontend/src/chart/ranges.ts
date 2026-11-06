import type { Dataset } from '../api'
import type { ChartConfig, ColorRange } from './types'

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

export function activeRanges(config: ChartConfig): ColorRange[] {
  return config.ranges.filter((range) => range.from !== null || range.to !== null)
}

export function rangeAxisFor(dataset: Dataset, config: ChartConfig): 'x' | 'y' | null {
  if (config.type === 'pie' || activeRanges(config).length === 0) return null
  if (config.rangeAxis === 'x' && !xIsNumericAxis(dataset, config)) return null
  return config.rangeAxis
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
