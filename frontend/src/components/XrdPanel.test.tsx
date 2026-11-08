import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { Dataset, XrdResult } from '../api'
import { XrdPanel } from './XrdPanel'

// The chart itself is covered by the tests of the option builder, so it is left out here.
vi.mock('./XrdChart', () => ({ XrdChart: () => null }))

function makeDataset(rows: number): Dataset {
  return {
    filename: 'si.csv',
    rows,
    columns: [
      { name: 'angle', kind: 'numeric', missing: 0 },
      { name: 'counts', kind: 'numeric', missing: 0 },
    ],
    data: Array.from({ length: rows }, (_, index) => ({ angle: 20 + index * 0.5, counts: 100 + index })),
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

afterEach(() => {
  vi.unstubAllGlobals()
})

it('sends the pattern and lists the peaks that come back', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(result) })
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdPanel dataset={makeDataset(30)} />)

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

  expect(await screen.findByText('28.44')).toBeInTheDocument()
  expect(screen.getByText('3.1357')).toBeInTheDocument()
  expect(screen.getByText('39.7')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Download peaks (CSV)' })).toBeInTheDocument()
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  const body = JSON.parse(init.body as string) as Record<string, unknown>
  expect(url).toBe('/api/v1/xrd/analyze')
  expect(body.two_theta).toHaveLength(30)
  expect(body.wavelength).toBe(1.5406)
  expect(body.baseline_method).toBe('snip')
})

it('shows the message of the server when the analysis is rejected', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: 'The angles (2theta) must be between 0 and 180 degrees.' }),
    }),
  )
  render(<XrdPanel dataset={makeDataset(30)} />)

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('between 0 and 180')
})

it('asks for more points before calling the server', () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdPanel dataset={makeDataset(5)} />)

  fireEvent.click(screen.getByRole('button', { name: 'Analyze' }))

  expect(screen.getByRole('alert')).toHaveTextContent('at least 20')
  expect(fetchMock).not.toHaveBeenCalled()
})

it('explains what is missing when there are fewer than two number columns', () => {
  const dataset: Dataset = {
    filename: 'names.csv',
    rows: 1,
    columns: [
      { name: 'name', kind: 'text', missing: 0 },
      { name: 'value', kind: 'numeric', missing: 0 },
    ],
    data: [{ name: 'a', value: 1 }],
  }
  render(<XrdPanel dataset={dataset} />)

  expect(screen.getByRole('status')).toHaveTextContent('two number columns')
  expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
})
