import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import type { XrdResult } from '../api'
import type { ECharts } from '../chart/echartsSetup'
import type { XrdOption } from '../chart/xrd'
import { XrdResults } from './XrdResults'

const mocks = vi.hoisted(() => ({
  exportPicture: vi.fn(),
  chart: null as unknown,
}))

vi.mock('../chart/exportChart', () => ({ exportPicture: mocks.exportPicture }))

// A stand-in for the chart: it hands out whatever chart the test has prepared.
vi.mock('./XrdChart', () => ({
  XrdChart: ({ onReady }: { onReady?: (chart: ECharts | null) => void }) => {
    useEffect(() => {
      if (mocks.chart !== null) onReady?.(mocks.chart as ECharts)
    }, [onReady])
    return null
  },
}))

const result: XrdResult = {
  two_theta: [20, 28.44, 40],
  smoothed: [100, 1100, 100],
  baseline: [100, 100, 100],
  corrected: [0, 1000, 0],
  peaks: [
    {
      position: 28.44,
      d_spacing: 3.1357,
      height: 1000,
      relative_intensity: 100,
      fwhm: 0.207,
      crystallite_size: 39.7,
    },
  ],
}

function show() {
  render(
    <XrdResults
      outcome={{ result, raw: [100, 1105, 98] }}
      csvName="si-xrd-peaks.csv"
      pictureName="si-xrd"
      identification={null}
      identifying={false}
      identifyError={null}
    />,
  )
}

function fakeChart(zoom: { start: number; end: number }) {
  return {
    getDom: () => ({ clientWidth: 800, clientHeight: 416 }),
    getOption: () => ({ dataZoom: [zoom] }),
  }
}

beforeEach(() => {
  mocks.exportPicture.mockReset()
  mocks.chart = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('cannot save a picture before the chart is drawn', () => {
  show()

  expect(screen.getByRole('button', { name: 'Save chart as picture' })).toBeDisabled()
})

it('saves the chart as a PNG picture of what is on screen, without the zoom slider', async () => {
  mocks.chart = fakeChart({ start: 25, end: 75 })
  show()

  fireEvent.click(screen.getByRole('button', { name: 'Save chart as picture' }))

  await waitFor(() => expect(mocks.exportPicture).toHaveBeenCalledTimes(1))
  const [format, context] = mocks.exportPicture.mock.calls[0] as [
    string,
    { option: XrdOption; width: number; height: number; title: string; dark: boolean },
  ]
  expect(format).toBe('png')
  expect(context).toMatchObject({ width: 800, height: 416, title: 'si-xrd', dark: false })
  expect(context.option.dataZoom).toEqual([{ type: 'inside', start: 25, end: 75 }])
  expect(context.option.series.map((series) => series.name)).toEqual([
    'Raw data',
    'Smoothed',
    'Baseline',
    'Peaks',
  ])
})

it('saves the view and the format that were chosen', async () => {
  mocks.chart = fakeChart({ start: 0, end: 100 })
  show()

  fireEvent.click(screen.getByRole('button', { name: 'Baseline removed' }))
  fireEvent.change(screen.getByLabelText('Picture format'), { target: { value: 'svg' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save chart as picture' }))

  await waitFor(() => expect(mocks.exportPicture).toHaveBeenCalledTimes(1))
  const [format, context] = mocks.exportPicture.mock.calls[0] as [string, { option: XrdOption }]
  expect(format).toBe('svg')
  expect(context.option.dataZoom).toEqual([])
  expect(context.option.series.map((series) => series.name)).toEqual(['Corrected', 'Peaks'])
})

it('says so when the picture cannot be saved', async () => {
  mocks.chart = fakeChart({ start: 0, end: 100 })
  mocks.exportPicture.mockImplementation(() => {
    throw new Error('no canvas')
  })
  show()

  fireEvent.click(screen.getByRole('button', { name: 'Save chart as picture' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('The picture could not be saved: no canvas')
})
