import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { buildOption, type ChartOption } from './buildOption'
import { defaultConfig, type ChartConfig } from './types'

const dataset: Dataset = {
  filename: 'sales.csv',
  rows: 3,
  columns: [
    { name: 'month', kind: 'datetime', missing: 0 },
    { name: 'sales', kind: 'numeric', missing: 1 },
    { name: 'profit', kind: 'numeric', missing: 0 },
    { name: 'empty', kind: 'numeric', missing: 3 },
  ],
  data: [
    { month: '2025-01-01', sales: 10, profit: 3, empty: null },
    { month: '2025-02-01', sales: null, profit: 4, empty: null },
    { month: '2025-03-01', sales: 30, profit: 5, empty: null },
  ],
}

const unsorted: Dataset = {
  filename: 'xy.csv',
  rows: 3,
  columns: [
    { name: 'x', kind: 'numeric', missing: 0 },
    { name: 'y', kind: 'numeric', missing: 0 },
  ],
  data: [
    { x: 3, y: 30 },
    { x: 1, y: 10 },
    { x: 2, y: 20 },
  ],
}

const base = defaultConfig(dataset)

function build(patch: Partial<ChartConfig> = {}, source: Dataset = dataset): ChartOption | null {
  const config = patch.xColumn || source !== dataset ? defaultConfig(source) : base
  return buildOption({ dataset: source, config: { ...config, ...patch }, language: 'en' })
}

interface Series {
  name: string
  type: string
  data: unknown[]
  stack?: string
  areaStyle?: unknown
  sampling?: string
  animationDuration?: number
  animationDelay?: unknown
}

function seriesOf(option: ChartOption | null): Series[] {
  return (option?.series ?? []) as Series[]
}

function axisType(option: ChartOption | null, axis: 'xAxis' | 'yAxis'): string | undefined {
  return (option?.[axis] as { type?: string } | undefined)?.type
}

describe('defaultConfig', () => {
  it('uses the date column for X and the filled number columns for Y', () => {
    expect(base.xColumn).toBe('month')
    expect(base.yColumns).toEqual(['sales', 'profit'])
    expect(base.title).toBe('sales')
  })

  it('takes the first column as X when every column is a number', () => {
    const config = defaultConfig(unsorted)

    expect(config.xColumn).toBe('x')
    expect(config.yColumns).toEqual(['y'])
  })
})

describe('buildOption', () => {
  it('draws a date column on a time axis with date and value points', () => {
    const option = build()
    const series = seriesOf(option)

    expect(axisType(option, 'xAxis')).toBe('time')
    expect(series.map((item) => item.name)).toEqual(['sales', 'profit'])
    expect(series[0]?.type).toBe('line')
    expect(series[0]?.data).toEqual([
      ['2025-01-01', 10],
      ['2025-02-01', null],
      ['2025-03-01', 30],
    ])
  })

  it('uses a number axis and sorts the points when X is a number column', () => {
    const option = build({}, unsorted)

    expect(axisType(option, 'xAxis')).toBe('value')
    expect(seriesOf(option)[0]?.data).toEqual([
      [1, 10],
      [2, 20],
      [3, 30],
    ])
  })

  it('keeps a category axis for bar charts', () => {
    const option = build({ type: 'bar' })

    expect(axisType(option, 'xAxis')).toBe('category')
    expect(seriesOf(option)[0]?.data).toEqual([10, null, 30])
  })

  it('stacks area charts', () => {
    const series = seriesOf(build({ type: 'area', stacked: true }))

    expect(series.every((item) => item.stack === 'total' && item.areaStyle !== undefined)).toBe(
      true,
    )
  })

  it('draws a pie from the first value column only', () => {
    const series = seriesOf(build({ type: 'pie' }))

    expect(series).toHaveLength(1)
    expect(series[0]?.type).toBe('pie')
    expect(series[0]?.data).toHaveLength(2)
  })

  it('needs a numeric X column for scatter charts', () => {
    expect(build({ type: 'scatter' })).toBeNull()

    const series = seriesOf(build({ type: 'scatter', xColumn: 'sales', yColumns: ['profit'] }))
    expect(series[0]?.data).toEqual([
      [10, 3],
      [30, 5],
    ])
  })

  it('returns nothing when no value column is selected', () => {
    expect(build({ yColumns: [] })).toBeNull()
  })

  it('turns the animation off when asked and keeps it on for large tables', () => {
    expect(build({ animate: false })?.animation).toBe(false)
    expect(Number(build()?.animationThreshold)).toBeGreaterThan(2000)
  })

  it('draws a reduced set of points for very long line charts', () => {
    const rows = Array.from({ length: 1500 }, (_, index) => ({ x: index, y: index % 7 }))
    const large: Dataset = { ...unsorted, rows: rows.length, data: rows }

    expect(seriesOf(build({}, large))[0]?.sampling).toBe('lttb')
    expect(seriesOf(build({}, unsorted))[0]?.sampling).toBeUndefined()
  })

  it('reveals a line chart over the whole chosen duration', () => {
    const option = build({ durationMs: 20_000 })

    expect(option?.animationDuration).toBe(20_000)
    expect(seriesOf(option)[0]?.animationDelay).toBeUndefined()
  })

  it('lets bars appear one after another within the chosen duration', () => {
    const series = seriesOf(build({ type: 'bar', durationMs: 10_000 }))

    expect(series[0]?.animationDuration).toBe(6000)
    expect(typeof series[0]?.animationDelay).toBe('function')
  })
})
