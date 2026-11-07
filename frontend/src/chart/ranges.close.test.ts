import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { buildOption } from './buildOption'
import { closeRanges, rangeExtent } from './ranges'
import { defaultConfig, type ChartConfig, type ColorRange, type RangeAxis } from './types'

function range(from: number | null, to: number | null): ColorRange {
  return { id: `${from}-${to}`, from, to, color: '#ef4444' }
}

function sample(): Dataset {
  const data = Array.from({ length: 21 }, (_, index) => ({ x: index, a: index * 2, b: 100 }))
  return {
    filename: 'sample.csv',
    rows: data.length,
    columns: [
      { name: 'x', kind: 'numeric', missing: 0 },
      { name: 'a', kind: 'numeric', missing: 0 },
      { name: 'b', kind: 'numeric', missing: 0 },
    ],
    data,
  } as Dataset
}

function configFor(dataset: Dataset, patch: Partial<ChartConfig>): ChartConfig {
  return { ...defaultConfig(dataset), xColumn: 'x', yColumns: ['a'], ...patch }
}

describe('closeRanges', () => {
  it('closes an open end just past the data', () => {
    expect(closeRanges([range(5, null)], [0, 10])).toMatchObject([{ from: 5, to: 20 }])
    expect(closeRanges([range(null, 5)], [0, 10])).toMatchObject([{ from: -10, to: 5 }])
  })

  it('closes a range with no bounds at all', () => {
    expect(closeRanges([range(null, null)], [0, 10])).toMatchObject([{ from: -10, to: 20 }])
  })

  it('reaches past a bound that lies outside the data', () => {
    expect(closeRanges([range(100, null)], [0, 10])).toMatchObject([{ from: 100, to: 110 }])
  })

  it('swaps bounds that were typed the wrong way round', () => {
    expect(closeRanges([range(8, 2)], [0, 10])).toMatchObject([{ from: 2, to: 8 }])
  })

  it('gives flat data some room', () => {
    const [closed] = closeRanges([range(5, null)], [5, 5])
    expect(closed?.to).toBeGreaterThan(5)
  })
})

describe('rangeExtent', () => {
  const dataset = sample()

  it('follows the X column', () => {
    expect(rangeExtent(dataset, configFor(dataset, {}), ['a'], 'x')).toEqual([0, 20])
  })

  it('spans the Y columns that are drawn', () => {
    expect(rangeExtent(dataset, configFor(dataset, {}), ['a', 'b'], 'y')).toEqual([0, 100])
  })

  it('counts the sum of stacked series', () => {
    const config = configFor(dataset, { type: 'area', stacked: true })
    expect(rangeExtent(dataset, config, ['a', 'b'], 'y')).toEqual([0, 140])
  })
})

const OPEN: [RangeAxis, ColorRange][] = [
  ['y', range(5, null)],
  ['y', range(null, 5)],
  ['x', range(5, null)],
  ['x', range(null, 5)],
]

describe('buildOption with a range that has an open end', () => {
  it.each(OPEN)('gives every piece two ends when colouring by %s', (axis, open) => {
    const dataset = sample()
    const config = configFor(dataset, { rangeAxis: axis, ranges: [open] })
    const option = buildOption({ dataset, config, language: 'en' })
    const maps = option?.visualMap as { pieces: { gte: number; lte: number }[] }[]
    expect(maps).toHaveLength(1)
    expect(maps[0]?.pieces).toHaveLength(1)
    for (const piece of maps[0]?.pieces ?? []) {
      expect(Number.isFinite(piece.gte)).toBe(true)
      expect(Number.isFinite(piece.lte)).toBe(true)
    }
  })
})
