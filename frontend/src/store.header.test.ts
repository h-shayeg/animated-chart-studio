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

it('uploads the same file again with the new header setting', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(dataset) })
  vi.stubGlobal('fetch', fetchMock)
  await useDatasetStore.getState().loadFile(new File(['a,b\n1,2\n'], 'a.csv'))

  await useDatasetStore.getState().setHeader(false)

  expect(fetchMock).toHaveBeenCalledTimes(2)
  const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
  expect((init.body as FormData).get('header')).toBe('false')
  expect(useDatasetStore.getState().header).toBe(false)
})

it('does nothing when no file has been loaded', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)

  await useDatasetStore.getState().setHeader(false)

  expect(fetchMock).not.toHaveBeenCalled()
})
