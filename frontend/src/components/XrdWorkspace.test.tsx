import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import type { Dataset, XrdIdentifyResult, XrdResult } from '../api'
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

const identification: XrdIdentifyResult = {
  phases: [
    {
      name: 'Silicon',
      formula: 'Si',
      space_group: 'Fd-3m',
      score: 0.97,
      matches: [{ peak_index: 0, hkl: [[1, 1, 1]], reference_two_theta: 28.44, difference: 0 }],
      missing: 0,
    },
  ],
  assignments: [{ peak_index: 0, phase_index: 0, hkl: [[1, 1, 1]] }],
}

function reply(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) }
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

it('reads the file, picks the olumns, shows the peaks and names the material', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(reply(makeDataset(40)))
    .mockResolvedValueOnce(reply(result))
    .mockResolvedValueOnce(reply(identification))
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdWorkspace />)

  chooseFile()

  expect(await screen.findByText('28.44')).toBeInTheDocument()
  expect(await screen.findByText('Silicon (Si)')).toBeInTheDocument()
  expect(screen.getByText('(111)')).toBeInTheDocument()
  expect(screen.getByText('Match 97%')).toBeInTheDocument()
  const [analyzeUrl, analyzeInit] = fetchMock.mock.calls[1] as [string, RequestInit]
  const analyzeBody = JSON.parse(analyzeInit.body as string) as {
    two_theta: number[]
    intensity: number[]
  }
  expect(analyzeUrl).toBe('/api/v1/xrd/analyze')
  expect(analyzeBody.two_theta[0]).toBe(20)
  expect(analyzeBody.intensity[0]).toBe(100)
  const [identifyUrl, identifyInit] = fetchMock.mock.calls[2] as [string, RequestInit]
  const identifyBody = JSON.parse(identifyInit.body as string) as Record<string, unknown>
  expect(identifyUrl).toBe('/api/v1/xrd/identify')
  expect(identifyBody.two_theta_min).toBe(20)
  expect(identifyBody.tolerance).toBe(0.3)
})

it('takes a text file from the instrument, whose columns have no names', async () => {
  const pattern: Dataset = {
    filename: 'si.xy',
    rows: 40,
    columns: [
      { name: 'Column 1', kind: 'numeric', missing: 0 },
      { name: 'Column 2', kind: 'numeric', missing: 0 },
    ],
    data: Array.from({ length: 40 }, (_, index) => ({
      'Column 1': 20 + index * 0.5,
      'Column 2': 100 + index,
    })),
  }
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(reply(pattern))
    .mockResolvedValueOnce(reply(result))
    .mockResolvedValueOnce(reply(identification))
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdWorkspace />)

  const input = screen.getByLabelText('Data file')
  expect(input.getAttribute('accept')?.split(',')).toEqual(
    expect.arrayContaining(['.csv', '.xlsx', '.xy', '.xye', '.txt', '.dat', '.asc']),
  )
  fireEvent.change(input, { target: { files: [new File(['20 100'], 'si.xy')] } })

  expect(await screen.findByText('Silicon (Si)')).toBeInTheDocument()
  expect(screen.getByLabelText('Angle column (2θ)')).toHaveValue('Column 1')
  expect(screen.getByLabelText('Intensity column')).toHaveValue('Column 2')
  const [, analyzeInit] = fetchMock.mock.calls[1] as [string, RequestInit]
  const analyzeBody = JSON.parse(analyzeInit.body as string) as {
    two_theta: number[]
    intensity: number[]
  }
  expect(analyzeBody.two_theta.slice(0, 2)).toEqual([20, 20.5])
  expect(analyzeBody.intensity.slice(0, 2)).toEqual([100, 101])
})

it('keeps the peaks and says so when the material cannot be identified', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(reply(makeDataset(40)))
    .mockResolvedValueOnce(reply(result))
    .mockResolvedValueOnce(reply({ phases: [], assignments: [] }))
  vi.stubGlobal('fetch', fetchMock)
  render(<XrdWorkspace />)

  chooseFile()

  expect(await screen.findByText(/No material in the library matches/)).toBeInTheDocument()
  expect(screen.getByText('28.44')).toBeInTheDocument()
})

it('explains what is wrong with data that is not an XRD pattern and does not analyse it', async () => {
  const fetchMock = vi.fn().mockResolvedValueOnce(reply(makeDataset(5)))
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
