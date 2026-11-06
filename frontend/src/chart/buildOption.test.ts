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
  ],
  data: [
    { month: '2025-01-01', sales: 10, profit: 3 },
    { month: '2025-02-01', sales: null, profit: 4 },
    { month: '2025-03-01', sales: 30, profit: 5 },
  ],
}

const base = defaultConfig(dataset)

function build(patch: Partial<ChartConfig> = {}): ChartOption | null {
  return buildOption({ dataset, config: { ...base, ...patch }, language: 'en' })
}

interface Series {
  name: string
  type: string
  data: unknown[]
  stack?: string
  areaStyle?: unknown
}

function seriesOf(option: ChartOption | null): Series[] {
  return (option?.series ?? []) as Series[]
}

describe('defaultConfig', () => {
  it('uses the date column for X and the number columns for Y', () => {
    expect(base.xColumn).toBe('month')
    expect(base.yColumns).toEqual(['sales', 'profit'])
    expect(base.title).toBe('sales')
  })
})

describe('buildOption', () => {
  it('builds one line series per value column and keeps missing values as null', () => {
    const series = seriesOf(build())

    expect(series.map((item) => item.name)).toEqual(['sales', 'profit'])
    expect(series[0]?.type).toBe('line')
    expect(series[0]?.data).toEqual([10, null, 30])
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

  it('turns the animation off when asked', () => {
    expect(build({ animate: false })?.animation).toBe(false)
  })
})
