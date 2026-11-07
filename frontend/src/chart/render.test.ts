import { SVGRenderer } from 'echarts/renderers'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { Dataset } from '../api'
import { buildOption } from './buildOption'
import { echarts, toEChartsOption } from './echartsSetup'
import { defaultConfig, type ChartConfig, type ColorRange } from './types'

echarts.use([SVGRenderer])

// These tests draw with the real chart library, as an SVG string so that no canvas is needed.
// A chart the library cannot draw fails here instead of blanking the page in a browser, which
// the tests that replace the chart view with a stand-in cannot notice.

beforeAll(() => {
  // jsdom has no canvas, so the library estimates the size of text, which is enough here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
})

afterAll(() => {
  vi.restoreAllMocks()
})

function range(from: number | null, to: number | null): ColorRange {
  return { id: `${from}-${to}`, from, to, color: '#ef4444' }
}

function spectrum(rows: number): Dataset {
  const data = Array.from({ length: rows }, (_, index) => ({
    wavenumber: 400 + index,
    intensity: 50 + Math.sin(index / 40) * 30,
    shoulder: 30 + Math.cos(index / 55) * 10,
  }))
  return {
    filename: 'spectrum.xlsx',
    rows,
    columns: [
      { name: 'wavenumber', kind: 'numeric', missing: 0 },
      { name: 'intensity', kind: 'numeric', missing: 0 },
      { name: 'shoulder', kind: 'numeric', missing: 0 },
    ],
    data,
  } as Dataset
}

function draw(patch: Partial<ChartConfig>, rows = 150): string {
  const dataset = spectrum(rows)
  const config: ChartConfig = {
    ...defaultConfig(dataset),
    xColumn: 'wavenumber',
    yColumns: ['intensity', 'shoulder'],
    ...patch,
  }
  const option = buildOption({ dataset, config, language: 'en' })
  if (option === null) throw new Error('There was nothing to draw.')
  const chart = echarts.init(null, undefined, {
    renderer: 'svg',
    ssr: true,
    width: 900,
    height: 560,
  })
  try {
    chart.setOption(toEChartsOption({ ...option, animation: false }))
    return chart.renderToSVGString()
  } finally {
    chart.dispose()
  }
}

const TYPES = ['line', 'area', 'scatter', 'bar'] as const

describe('drawing with the real chart library', () => {
  it('draws a plain chart of every type', () => {
    for (const type of TYPES) expect(draw({ type })).toContain('<svg')
  })

  for (const type of TYPES) {
    for (const axis of ['x', 'y'] as const) {
      const at = axis === 'x' ? 450 : 60
      const cases: [string, ColorRange[]][] = [
        ['a closed range', [range(at - 10, at + 10)]],
        ['a range with only a start', [range(at, null)]],
        ['a range with only an end', [range(null, at)]],
        ['two ranges that touch', [range(null, at), range(at, null)]],
      ]
      for (const [name, ranges] of cases) {
        it(`draws a ${type} chart coloured by ${axis} with ${name}`, () => {
          expect(draw({ type, rangeAxis: axis, ranges })).toContain('<svg')
        })
      }
    }
  }

  it('draws a long line chart, which is sampled, with a half-open range', () => {
    const svg = draw({ type: 'line', rangeAxis: 'y', ranges: [range(60, null)] }, 1500)
    expect(svg).toContain('<svg')
  })

  it('draws with one colour for everything outside the ranges', () => {
    const svg = draw({ ranges: [range(60, null)], restColor: '#00ff00' })
    expect(svg).toContain('<svg')
  })

  it('draws the magnifier, with and without colour ranges', () => {
    const base = defaultConfig(spectrum(1)).magnifier
    const magnifier = { ...base, enabled: true, xFrom: 450, xTo: 500 }
    expect(draw({ magnifier })).toContain('<svg')
    expect(draw({ magnifier, rangeAxis: 'y', ranges: [range(60, null)] })).toContain('<svg')
    expect(draw({ type: 'scatter', magnifier })).toContain('<svg')
  })
})

describe('drawing with ranges on X and on Y together', () => {
  const onX: ColorRange = { ...range(400, 420), axis: 'x', color: '#ef4444' }
  const onY: ColorRange = { ...range(70, null), axis: 'y', color: '#3b82f6' }
  const ranges = [onX, onY]

  for (const type of ['line', 'area', 'scatter'] as const) {
    it(`draws a ${type} chart in the colours of both kinds of range`, () => {
      const svg = draw({ type, ranges })
      expect(svg).toContain('#ef4444')
      expect(svg).toContain('#3b82f6')
    })
  }

  it('draws stacked areas and a long sampled line with both kinds of range', () => {
    expect(draw({ type: 'area', stacked: true, ranges })).toContain('<svg')
    expect(draw({ type: 'line', ranges }, 1500)).toContain('<svg')
  })

  it('draws the magnifier together with both kinds of range', () => {
    const base = defaultConfig(spectrum(1)).magnifier
    const magnifier = { ...base, enabled: true, xFrom: 450, xTo: 500 }
    expect(draw({ magnifier, ranges })).toContain('<svg')
    expect(draw({ type: 'scatter', magnifier, ranges })).toContain('<svg')
  })
})
