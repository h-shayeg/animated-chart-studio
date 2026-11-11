import { SVGRenderer } from 'echarts/renderers'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'

import type { XrdResult } from '../api'
import { echarts, toEChartsOption } from './echartsSetup'
import { buildXrdOption, type XrdLabels } from './xrd'
import { xrdPictureOption, zoomWindowOf } from './xrdExport'

echarts.use([SVGRenderer])

const labels: XrdLabels = {
  raw: 'Raw data',
  smoothed: 'Smoothed',
  baseline: 'Baseline',
  corrected: 'Corrected',
  peaks: 'Peaks',
  xAxis: '2θ (°)',
  yAxis: 'Intensity',
}

const result: XrdResult = {
  two_theta: [20, 28.44, 40, 47.3, 60],
  smoothed: [100, 1100, 100, 650, 100],
  baseline: [100, 100, 100, 100, 100],
  corrected: [0, 1000, 0, 550, 0],
  peaks: [
    {
      position: 28.44,
      d_spacing: 3.1357,
      height: 1000,
      relative_intensity: 100,
      fwhm: 0.207,
      crystallite_size: 39.7,
    },
    {
      position: 47.3,
      d_spacing: 1.9203,
      height: 550,
      relative_intensity: 55,
      fwhm: 0.206,
      crystallite_size: 42.1,
    },
  ],
}

const option = buildXrdOption(result, [100, 1105, 98, 655, 101], 'original', labels, [
  '(111)',
  '(220)',
])

function drawn(zoom: unknown) {
  return { getOption: () => ({ dataZoom: zoom }) }
}

beforeAll(() => {
  // jsdom has no canvas, so the library estimates the size of text, which is enough here.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null)
})

afterAll(() => {
  vi.restoreAllMocks()
})

it('reads how far the chart on screen is zoomed in', () => {
  expect(zoomWindowOf(drawn([{ start: 25, end: 75 }, { start: 25, end: 75 }]))).toEqual({
    start: 25,
    end: 75,
  })
})

it('takes the whole pattern when the chart is not zoomed in or says nothing usable', () => {
  expect(zoomWindowOf(drawn([{ start: 0, end: 100 }]))).toBeNull()
  expect(zoomWindowOf(drawn([]))).toBeNull()
  expect(zoomWindowOf(drawn(undefined))).toBeNull()
  expect(zoomWindowOf(drawn([{ start: '25', end: 75 }]))).toBeNull()
  expect(zoomWindowOf(drawn([{ start: 80, end: 20 }]))).toBeNull()
  expect(zoomWindowOf(drawn([{ start: Number.NaN, end: 50 }]))).toBeNull()
  expect(zoomWindowOf({ getOption: () => null })).toBeNull()
})

it('leaves the zoom slider out of the picture and draws it at once', () => {
  const picture = xrdPictureOption(option, null)

  expect(picture.dataZoom).toEqual([])
  expect(picture.animation).toBe(false)
  expect(picture.grid).toMatchObject({ left: 64, bottom: 56 })
  expect(picture.series).toBe(option.series)
  // The chart on the page keeps its slider.
  expect(option.dataZoom).toHaveLength(2)
})

it('keeps the part of the pattern that is on screen', () => {
  const picture = xrdPictureOption(option, { start: 10, end: 60 })

  expect(picture.dataZoom).toEqual([{ type: 'inside', start: 10, end: 60 }])
})

function svgOf(drawnOption: Record<string, unknown>): string {
  const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 900, height: 400 })
  chart.setOption(toEChartsOption(drawnOption))
  const svg = chart.renderToSVGString()
  chart.dispose()
  return svg
}

it('draws as a picture with the peak labels and without the slider', () => {
  const picture = svgOf(xrdPictureOption(option, null))
  const onPage = svgOf({ ...option, animation: false })

  expect(picture).toContain('28.44 (111)')
  expect(picture).toContain('47.30 (220)')
  expect(picture).toContain('Intensity')
  // The slider is drawn from many shapes, so the picture without it is the shorter one.
  expect(picture.length).toBeLessThan(onPage.length)
})

it('draws only the part of the pattern that is on screen', () => {
  // The first half of the pattern, from 20 to 40 degrees: the peak at 47.30 is outside it.
  const picture = svgOf(xrdPictureOption(option, { start: 0, end: 50 }))

  expect(picture).toContain('28.44 (111)')
  expect(picture).not.toContain('47.30 (220)')
})
