import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useDatasetStore } from './store'

const dataset = {
  filename: 'a.csv',
  rows: 1,
  columns: [{ name: 'x', kind: 'numeric', missing: 0 }],
  data: [{ x: 1 }],
}

beforeEach(() => {
  useDatasetStore.getState().reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('stores the parsed dataset after a successful upload', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(dataset) })
  vi.stubGlobal('fetch', fetchMock)

  await useDatasetStore.getState().loadFile(new File(['x\n1\n'], 'a.csv', { type: 'text/csv' }))

  const state = useDatasetStore.getState()
  expect(state.status).toBe('ready')
  expect(state.dataset).toEqual(dataset)
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
  expect(url).toBe('/api/v1/datasets/parse')
  expect(init.method).toBe('POST')
  expect(init.body).toBeInstanceOf(FormData)
})

it('keeps the server message when the upload is rejected', async () => {
  const rejection = { ok: false, status: 422, json: () => Promise.resolve({ detail: 'Bad file.' }) }
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(rejection))

  await useDatasetStore.getState().loadFile(new File(['x'], 'a.txt'))

  const state = useDatasetStore.getState()
  expect(state.status).toBe('error')
  expect(state.error).toBe('Bad file.')
  expect(state.dataset).toBeNull()
})

it('goes back to the empty state on reset', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(dataset) }),
  )
  await useDatasetStore.getState().loadFile(new File(['x\n1\n'], 'a.csv'))

  useDatasetStore.getState().reset()

  const state = useDatasetStore.getState()
  expect(state.status).toBe('idle')
  expect(state.dataset).toBeNull()
})
