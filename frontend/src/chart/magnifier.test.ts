import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { buildOption } from './buildOption'
import { frameElements, insetBox, magnifierStatus, pointsInside, resolveWindow } from './magnifier'
import { DEFAULT_MAGNIFIER, defaultConfig, type ChartConfig, type Magnifier } from './types'

type Points = [number, number | null][]

const OPEN: Magnifier = { ...DEFAULT_MAGNIFIER, enabled: true }
const MIDDLE: Magnifier = { ...OPEN, xFrom: 20, xTo: 40 }

function spectrum(): Dataset {
  const data = Array.from({ length: 101 }, (_, index) => ({
    wavenumber: index,
    intensity: 20 + Math.sin(index / 10) * 10,
    second: index % 7,
  }))
  return {
    filename: 'spectrum.xlsx',
    rows: data.length,
    columns: [
      { name: 'wavenumber', kind: 'numeric', missing: 0 },
      { name: 'intensity', kind: 'numeric', missing: 0 },
      { name: 'second', kind: 'numeric', missing: 0 },
    ],
    data,
  } as Dataset
}

function configFor(dataset: Dataset, patch: Partial<ChartConfig>): ChartConfig {
  return { ...defaultConfig(dataset), xColumn: 'wavenumber', yColumns: ['intensity'], ...patch }
}

function build(patch: Partial<ChartConfig>) {
  const dataset = spectrum()
  return buildOption({ dataset, config: configFor(dataset, patch), language: 'en' })
}

describe('resolveWindow', () => {
  const line: Points[] = [
    [
      [0, 0],
      [1, 10],
      [2, 20],
      [3, 30],
      [4, 40],
    ],
  ]

  it('frames the data inside the X range and pads the enlarged view', () => {
    const win = resolveWindow(line, { ...OPEN, xFrom: 1, xTo: 3 }, false)
    expect(win).toMatchObject({ xFrom: 1, xTo: 3, frameYFrom: 10, frameYTo: 30 })
    expect(win?.yFrom).toBeCloseTo(9)
    expect(win?.yTo).toBeCloseTo(31)
  })

  it('swaps bounds that are given the wrong way round', () => {
    expect(resolveWindow(line, { ...OPEN, xFrom: 3, xTo: 1 }, false)).toMatchObject({
      xFrom: 1,
      xTo: 3,
    })
  })

  it('uses a Y range exactly as given', () => {
    const win = resolveWindow(line, { ...OPEN, xFrom: 1, xTo: 3, yFrom: 0, yTo: 100 }, false)
    expect(win).toMatchObject({ yFrom: 0, yTo: 100, frameYFrom: 0, frameYTo: 100 })
  })

  it('gives nothing when fewer than two points are inside', () => {
    expect(resolveWindow(line, { ...OPEN, xFrom: 1.2, xTo: 1.8 }, false)).toBeNull()
  })

  it('adds the series up when they are stacked', () => {
    const stacked: Points[] = [
      [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
      [
        [0, 10],
        [1, 20],
        [2, 30],
      ],
    ]
    const win = resolveWindow(stacked, { ...OPEN, xFrom: 0, xTo: 2 }, true)
    expect(win).toMatchObject({ frameYFrom: 0, frameYTo: 33 })
  })

  it('gives flat data some height', () => {
    const flat: Points[] = [
      [
        [0, 5],
        [1, 5],
        [2, 5],
      ],
    ]
    const win = resolveWindow(flat, { ...OPEN, xFrom: 0, xTo: 2 }, false)
    expect(win?.frameYFrom).toBeCloseTo(4.75)
    expect(win?.frameYTo).toBeCloseTo(5.25)
  })
})

describe('pointsInside', () => {
  const points: Points = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ]

  it('keeps one extra point on each side for lines only', () => {
    expect(pointsInside(points, 1.5, 3.5, false)).toEqual([
      [2, 2],
      [3, 3],
    ])
    expect(pointsInside(points, 1.5, 3.5, true)).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 4],
    ])
  })

  it('returns nothing outside the data', () => {
    expect(pointsInside(points, 10, 20, true)).toEqual([])
  })
})

describe('layout', () => {
  it('places the enlarged view on the right of the chart', () => {
    expect(insetBox(1000, 600, { left: 60, top: 10, width: 30, height: 50 })).toEqual({
      x: 600,
      y: 60,
      width: 300,
      height: 300,
    })
  })

  it('joins the right corners of the frame to the left corners of the enlarged view', () => {
    const elements = frameElements(
      { x: 10, y: 20, width: 30, height: 40 },
      { x: 600, y: 64, width: 340, height: 464 },
    )
    expect(elements).toHaveLength(4)
    expect(elements[2]).toMatchObject({ type: 'line', shape: { x1: 40, y1: 20, x2: 600, y2: 64 } })
    expect(elements[3]).toMatchObject({ type: 'line', shape: { x1: 40, y1: 60, x2: 600, y2: 528 } })
  })
})

describe('buildOption with the magnifier', () => {
  it('leaves the chart alone while the magnifier is off', () => {
    const option = build({ magnifier: { ...MIDDLE, enabled: false } })
    expect(Array.isArray(option?.grid)).toBe(false)
  })

  it('adds a second grid, an enlarged series and a frame', () => {
    const option = build({ magnifier: MIDDLE })
    expect(option?.grid).toHaveLength(2)
    expect(option?.xAxis).toHaveLength(2)
    const series = option?.series as { type: string; xAxisIndex?: number }[]
    expect(series.map((item) => item.type)).toEqual(['line', 'line', 'custom'])
    expect(series[1]?.xAxisIndex).toBe(1)
  })

  it('draws only the points of the range in the enlarged view, plus one on each side', () => {
    const option = build({ magnifier: MIDDLE })
    const series = option?.series as { data: unknown[] }[]
    expect(series[1]?.data).toHaveLength(23)
  })

  it('is ignored for charts that cannot show it', () => {
    expect(Array.isArray(build({ type: 'bar', magnifier: MIDDLE })?.grid)).toBe(false)
    expect(build({ type: 'pie', magnifier: MIDDLE })).not.toBeNull()
  })

  it('colours the enlarged view with the same ranges', () => {
    const ranges = [{ id: 'a', from: 0, to: 10, color: '#ff0000' }]
    const option = build({ ranges, magnifier: MIDDLE })
    const maps = option?.visualMap as { seriesIndex: number }[]
    expect(maps.map((item) => item.seriesIndex)).toEqual([0, 1])
  })

  it('paints everything outside the ranges with the rest colour', () => {
    const ranges = [{ id: 'a', from: 0, to: 10, color: '#ff0000' }]
    const option = build({ ranges, restColor: '#00ff00' })
    const maps = option?.visualMap as { outOfRange: { color: string } }[]
    expect(maps[0]?.outOfRange.color).toBe('#00ff00')
  })
})

describe('magnifierStatus', () => {
  const dataset = spectrum()
  const status = (magnifier: Partial<Magnifier>, patch: Partial<ChartConfig> = {}) =>
    magnifierStatus(dataset, configFor(dataset, { magnifier: { ...OPEN, ...magnifier }, ...patch }))

  it('tells why nothing is shown', () => {
    expect(status({ enabled: false })).toBe('off')
    expect(status({})).toBe('needsRange')
    expect(status({ xFrom: 200, xTo: 300 })).toBe('empty')
    expect(status({ xFrom: 20, xTo: 40 }, { type: 'bar' })).toBe('unavailable')
  })

  it('is ready for a line or scatter chart with a range', () => {
    expect(status({ xFrom: 20, xTo: 40 })).toBe('ready')
    expect(status({ xFrom: 20, xTo: 40 }, { type: 'scatter' })).toBe('ready')
  })
})
