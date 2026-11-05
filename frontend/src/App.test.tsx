import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

import App from './App'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('shows the app title and reports the backend as online', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  render(<App />)

  expect(screen.getByRole('heading', { name: 'Animated Chart Studio' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('online'))
})

it('reports the backend as offline when the request fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
  render(<App />)

  await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('offline'))
})
