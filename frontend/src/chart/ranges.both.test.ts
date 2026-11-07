import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { buildOption } from './buildOption'
import { colorLookup, colorPieces, rangeAxisFor, rangePlan, rangesOf } from './ranges'
import {
  DEFAULT_MAGNIFIER,
  defaultConfig,
  type ChartConfig,
  type ColorRange,
  type Magnifier,
  type RangeAxis,
} from './types'

type Points = [number, number | null][]

const RED = '#ef4444'
const BLUE = '#3b82f6'

function range(axis: RangeAxis, from: number | null, to: number | null, color: string): ColorRange {
  return { id: `${axis}-${from}-${to}`, axis, from, to, color }
}

function sample(): Dataset {
  const data = Array.from({ length: 21 }, (_, index) => ({ x: index, a: index * 2, b: index }))
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

function build(patch: Partial<ChartConfig>) {
  const dataset = sample()
  return buildOption({ dataset, config: configFor(dataset, patch), language: 'en' })
}

const diagonal: Points = Array.from({ length: 11 }, (_, index): [number, number] => [index, index])

describe('rangesOf', () => {
  it('splits the ranges by axis and lets a range without an axis follow the default one', () => {
    const dataset = sample()
    const plain: ColorRange = { id: 'plain', from: 1, to: 2, color: '#000000' }
    const config = configFor(dataset, {
      rangeAxis: 'x',
      ranges: [plain, range('y', 1, 2, '#111111'), range('x', 3, 4, '#222222')],
    })
    expect(rangesOf(config, 'x').map((item) => item.id)).toEqual(['plain', 'x-3-4'])
    expect(rangesOf(config, 'y').map((item) => item.id)).toEqual(['y-1-2'])
  })
})

describe('rangePlan and rangeAxisFor', () => {
  const ranges = [range('x', 2, 4, RED), range('y', 6, null, BLUE), range('y', null, null, '#000000')]

  it('keeps both axes when X is a number column, and drops ranges without a bound', () => {
    const dataset = sample()
    const config = configFor(dataset, { ranges })
    const plan = rangePlan(dataset, config)
    expect(plan.x).toHaveLength(1)
    expect(plan.y).toHaveLength(1)
    expect(rangeAxisFor(dataset, config)).toBeNull()
  })

  it('drops the ranges on X where X cannot be coloured, such as on a bar chart', () => {
    const dataset = sample()
    const config = configFor(dataset, { type: 'bar', ranges })
    expect(rangePlan(dataset, config)).toMatchObject({ x: [], y: [{ color: BLUE }] })
    expect(rangeAxisFor(dataset, config)).toBe('y')
  })

  it('draws no ranges on a pie chart', () => {
    const dataset = sample()
    expect(rangePlan(dataset, configFor(dataset, { type: 'pie', ranges }))).toEqual({ x: [], y: [] })
  })

  it('names the axis when only one has ranges', () => {
    const dataset = sample()
    expect(rangeAxisFor(dataset, configFor(dataset, { ranges: [range('x', 2, 4, RED)] }))).toBe('x')
  })
})

describe('colorLookup', () => {
  it('lets a range on Y win over a range on X', () => {
    const colorOf = colorLookup([range('x', 0, 10, RED)], [range('y', 5, null, BLUE)])
    expect(colorOf(1, 1)).toBe(RED)
    expect(colorOf(1, 9)).toBe(BLUE)
    expect(colorOf(20, 1)).toBeNull()
    expect(colorOf(1, null)).toBe(RED)
  })
})

describe('colorPieces', () => {
  it('colours stretches of X for ranges on X', () => {
    expect(colorPieces(diagonal, [range('x', 2, 4, RED)], [])).toEqual([
      { gte: 2, lte: 4, color: RED },
    ])
  })

  it('turns a range on Y into the stretch of X where the line is inside it', () => {
    expect(colorPieces(diagonal, [], [range('y', 6, 8, BLUE)])).toEqual([
      { gte: 6, lte: 8, color: BLUE },
    ])
    expect(colorPieces(diagonal, [], [range('y', 6, null, BLUE)])).toEqual([
      { gte: 6, lte: 10, color: BLUE },
    ])
  })

  it('finds the crossing between two points', () => {
    const line: Points = [
      [0, 0],
      [10, 10],
    ]
    expect(colorPieces(line, [], [range('y', 2.5, 7.5, BLUE)])).toEqual([
      { gte: 2.5, lte: 7.5, color: BLUE },
    ])
  })

  it('lets Y win where both apply', () => {
    expect(colorPieces(diagonal, [range('x', 0, 10, RED)], [range('y', 6, null, BLUE)])).toEqual([
      { gte: 0, lte: 6, color: RED },
      { gte: 6, lte: 10, color: BLUE },
    ])
  })

  it('does not colour by Y across a gap in the data', () => {
    const gap: Points = [
      [0, 1],
      [1, null],
      [2, 3],
    ]
    const pieces = colorPieces(gap, [], [range('y', 0, 5, BLUE)])
    expect(pieces).toHaveLength(1)
    expect(pieces[0]?.lte).toBeLessThan(0)
  })

  it('has nothing to say about a line without points', () => {
    expect(colorPieces([], [range('x', 0, 1, RED)], [])).toEqual([])
  })
})

describe('buildOption with ranges on X and on Y', () => {
  const ranges = [range('x', 2, 6, RED), range('y', 30, null, BLUE)]

  it('colours each line along X with pieces worked out from its own points', () => {
    const option = build({ yColumns: ['a', 'b'], ranges })
    const maps = option?.visualMap as {
      dimension: number
      seriesIndex: number
      pieces: { gte: number; lte: number; color: string }[]
    }[]
    expect(maps.map((item) => item.dimension)).toEqual([0, 0])
    expect(maps.map((item) => item.seriesIndex)).toEqual([0, 1])
    // Series a is 2 times X, so it is above 30 from X = 15 on.
    expect(maps[0]?.pieces).toEqual([
      { gte: 2, lte: 6, color: RED },
      { gte: 15, lte: 20, color: BLUE },
    ])
    // Series b never gets above 20, so only the range on X colours it.
    expect(maps[1]?.pieces).toEqual([{ gte: 2, lte: 6, color: RED }])
  })

  it('colours scatter points by the slot of the range they fall in', () => {
    const option = build({ type: 'scatter', ranges })
    const maps = option?.visualMap as {
      dimension: number
      pieces: { value: number; color: string }[]
    }[]
    expect(maps[0]?.dimension).toBe(2)
    expect(maps[0]?.pieces).toEqual([
      { value: 1, color: BLUE },
      { value: 2, color: RED },
    ])
    const scatter = option?.series as { data: number[][] }[] | undefined
    const data = scatter?.[0]?.data ?? []
    expect(data.every((point) => point.length === 3)).toBe(true)
    expect(data[4]).toEqual([4, 8, 2])
    expect(data[16]).toEqual([16, 32, 1])
    expect(data[10]).toEqual([10, 20, 0])
  })

  it('keeps the range slot of scatter points in the enlarged view', () => {
    const magnifier: Magnifier = { ...DEFAULT_MAGNIFIER, enabled: true, xFrom: 12, xTo: 18 }
    const option = build({ type: 'scatter', ranges, magnifier })
    const series = option?.series as { data: number[][] }[]
    expect(series).toHaveLength(3)
    expect(series[1]?.data.length).toBeGreaterThan(0)
    expect(series[1]?.data.every((point) => point.length === 3)).toBe(true)
  })
})
