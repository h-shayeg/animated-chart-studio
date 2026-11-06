import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { cropDataset, cropMode, parseBound, rangeAxisFor } from './ranges'
import { defaultConfig, type ChartConfig } from './types'

const dataset: Dataset = {
  filename: 'xy.csv',
  rows: 4,
  columns: [
    { name: 'x', kind: 'numeric', missing: 0 },
    { name: 'y', kind: 'numeric', missing: 0 },
  ],
  data: [
    { x: 1, y: 10 },
    { x: 2, y: 20 },
    { x: 3, y: 30 },
    { x: 4, y: 40 },
  ],
}

const range = { id: 'a', from: 2, to: 3, color: '#ff0000' }

function config(patch: Partial<ChartConfig> = {}): ChartConfig {
  return { ...defaultConfig(dataset), ...patch }
}

describe('parseBound', () => {
  it('reads numbers and treats empty or invalid text as an open bound', () => {
    expect(parseBound('2.5')).toBe(2.5)
    expect(parseBound('-3')).toBe(-3)
    expect(parseBound('')).toBeNull()
    expect(parseBound('  ')).toBeNull()
    expect(parseBound('abc')).toBeNull()
  })
})

describe('cropDataset', () => {
  it('returns the same table when nothing is cropped', () => {
    expect(cropDataset(dataset, config())).toBe(dataset)
  })

  it('keeps the rows whose X value is inside the range of a number axis', () => {
    const result = cropDataset(dataset, config({ cropFrom: 2, cropTo: 3 }))

    expect(cropMode(dataset, config())).toBe('x')
    expect(result.data).toEqual([
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ])
    expect(result.rows).toBe(2)
  })

  it('counts rows from 1 when the chart has no number axis', () => {
    const bars = config({ type: 'bar', cropFrom: 2, cropTo: 3 })

    expect(cropMode(dataset, bars)).toBe('rows')
    expect(cropDataset(dataset, bars).data).toEqual([
      { x: 2, y: 20 },
      { x: 3, y: 30 },
    ])
  })

  it('leaves one side open when a bound is empty', () => {
    expect(cropDataset(dataset, config({ cropFrom: 3 })).rows).toBe(2)
    expect(cropDataset(dataset, config({ cropTo: 2 })).rows).toBe(2)
  })
})

describe('rangeAxisFor', () => {
  it('is empty without ranges and for pie charts', () => {
    expect(rangeAxisFor(dataset, config())).toBeNull()
    expect(rangeAxisFor(dataset, config({ type: 'pie', ranges: [range] }))).toBeNull()
  })

  it('follows the chosen axis when it can be used', () => {
    expect(rangeAxisFor(dataset, config({ ranges: [range], rangeAxis: 'y' }))).toBe('y')
    expect(rangeAxisFor(dataset, config({ ranges: [range], rangeAxis: 'x' }))).toBe('x')
  })

  it('does not allow X ranges on a category axis', () => {
    expect(rangeAxisFor(dataset, config({ type: 'bar', ranges: [range], rangeAxis: 'x' }))).toBeNull()
  })
})
