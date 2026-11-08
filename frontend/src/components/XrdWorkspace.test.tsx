import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { Dataset, XrdResult } from '../api'
import { XrdWorkspace } from './XrdWorkspace'

// The chart itself is covered by the tests of the option builder, so it is left out here.
vi.mock('./XrdChart', () => ({ XrdChart: () => null }))

function makeDataset(rows: number): Dataset {
  return {
    filename: 'si.csv',
    rows,
    columns: [
      { name: 'index', kind: 'numeric', missing: 0 },
      { name: 'two_theta', kind: 'numeric', missing: 0 },
      { name: 'intensity', kind: 'numeric', missing: 0 },
    ],
    data: Array.from({ length: rows }, (_, index) => ({
      index,
      two_theta: 20 + index * 0.5,
      intensity: 100 + index,
    })),
  }
}

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

function chooseFile() {
  const file = new File(['x'], 'si.csv', { type: 'text/csv' })
  fireEvent.change(screen.getByLabelText('Data file'), { target: { files: [file] } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('asks for data before anything else', () => {
  render(<XrdWorkspace />)

  expect(screen.getByText(/angle column \(2θ\) and an intensity column/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled()
})

it('reads he file, checks it, picks the columns and shows the peaks', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(makeDataset(40)) })
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(result) })
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdWorkspace />)

  chooseFile()

  expect(await screen.findByText('28.44')).toBeInTheDocument()
  const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
  const body = JSON.parse(init.body as string) as { two_theta: number[]; intensity: number[] }
  expect(url).toBe('/api/v1/xrd/analyze')
  expect(body.two_theta[0]).toBe(20)
  expect(body.intensity[0]).toBe(100)
})

it('explains what is wrong with data that is not an XRD pattern and does not analyse it', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(makeDataset(5)) })
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdWorkspace />)

  chooseFile()

  expect(await screen.findByRole('alert')).toHaveTextContent('at least 30')
  expect(screen.getByRole('button', { name: 'Analyze' })).toBeDisabled()
  expect(fetchMock).toHaveBeenCalledTimes(1)
})

it('shows the message of the server when the file cannot be read', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ detail: 'Only csv and xlsx files are supported.' }),
    }),
  )
  render(<XrdWorkspace />)

  chooseFile()

  expect(await screen.findByRole('alert')).toHaveTextContent('Only csv and xlsx files')
})
