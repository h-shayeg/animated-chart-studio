import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import App from './App'
import i18n, { applyLanguage } from './i18n'
import { useDatasetStore } from './store'

const dataset = {
  filename: 'sample-sales.csv',
  rows: 2,
  columns: [
    { name: 'month', kind: 'datetime', missing: 0 },
    { name: 'sales', kind: 'numeric', missing: 1 },
  ],
  data: [
    { month: '2025-01-01', sales: 120 },
    { month: '2025-02-01', sales: null },
  ],
}

function stubBackend(healthy = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/health') {
        return healthy ? Promise.resolve({ ok: true }) : Promise.reject(new Error('network'))
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(dataset) })
    }),
  )
}

beforeEach(() => {
  useDatasetStore.getState().reset()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await i18n.changeLanguage('en')
  applyLanguage('en')
})

it('shows the title and reports the backend as online', async () => {
  stubBackend()
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Animated Chart Studio' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('backend-status')).toHaveTextContent('online'))
})

it('reports the backend as offline when it cannot be reached', async () => {
  stubBackend(false)
  render(<App />)

  await waitFor(() => expect(screen.getByTestId('backend-status')).toHaveTextContent('offline'))
})

it('loads the sample data and shows it as a table', async () => {
  stubBackend()
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Try sample data' }))

  expect(await screen.findByRole('columnheader', { name: /sales/ })).toBeInTheDocument()
  expect(screen.getByText('2025-01-01')).toBeInTheDocument()
  expect(screen.getByText('1 missing')).toBeInTheDocument()
})

it('shows the statistical summary that comes with the data', async () => {
  const numeric = {
    count: 1,
    mean: 120,
    std: null,
    min: 120,
    q25: 120,
    median: 120,
    q75: 120,
    max: 120,
  }
  const withSummary = {
    ...dataset,
    summary: {
      rows: 2,
      columns: [
        { name: 'month', kind: 'datetime', missing: 0, unique: 2, numeric: null, top_values: [] },
        { name: 'sales', kind: 'numeric', missing: 1, unique: 1, numeric, top_values: [] },
      ],
      correlation: null,
    },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      url === '/health'
        ? Promise.resolve({ ok: true })
        : Promise.resolve({ ok: true, json: () => Promise.resolve(withSummary) }),
    ),
  )
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Try sample data' }))

  expect(await screen.findByRole('heading', { name: 'Statistical summary' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Number columns' })).toBeInTheDocument()
})

it('shows the data without a summary when none came with it', async () => {
  stubBackend()
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Try sample data' }))

  expect(await screen.findByRole('heading', { name: 'Your data' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Statistical summary' })).not.toBeInTheDocument()
})

it('returns to the upload panel when another file is chosen', async () => {
  stubBackend()
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'Try sample data' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Choose another file' }))

  expect(screen.getByTestId('dropzone')).toBeInTheDocument()
})

it('switches the interface to Persian with a right-to-left layout', async () => {
  stubBackend()
  render(<App />)

  fireEvent.click(screen.getByRole('button', { name: 'فارسی' }))

  await waitFor(() => expect(document.documentElement.dir).toBe('rtl'))
  expect(document.documentElement.lang).toBe('fa')
})
