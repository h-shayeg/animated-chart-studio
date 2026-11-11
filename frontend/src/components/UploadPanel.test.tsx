import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { useDatasetStore } from '../store'
import { UploadPanel } from './UploadPanel'

function drop(file: File) {
  fireEvent.drop(screen.getByTestId('dropzone'), {
    dataTransfer: {
      files: [file],
      items: [{ kind: 'file', type: file.type, getAsFile: () => file }],
      types: ['Files'],
    },
  })
}

beforeEach(() => {
  useDatasetStore.getState().reset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('takes a text file written by an instrument', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        filename: 'pattern.xy',
        rows: 1,
        columns: [
          { name: 'Column 1', kind: 'numeric', missing: 0 },
          { name: 'Column 2', kind: 'numeric', missing: 0 },
        ],
        data: [{ 'Column 1': 20, 'Column 2': 100 }],
      }),
  })
  vi.stubGlobal('fetch', fetchMock)
  render(<UploadPanel />)

  // Browsers do not know this file type, so it arrives without one.
  drop(new File(['20 100\n'], 'pattern.xy', { type: '' }))

  await waitFor(() => expect(useDatasetStore.getState().dataset?.filename).toBe('pattern.xy'))
  expect(fetchMock).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('turns down a file type it cannot read and names the ones it can', async () => {
  const fetchMock = vi.fn()
  vi.stubGlobal('fetch', fetchMock)
  render(<UploadPanel />)

  drop(new File(['%PDF'], 'paper.pdf', { type: 'application/pdf' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('.xy')
  expect(fetchMock).not.toHaveBeenCalled()
})
