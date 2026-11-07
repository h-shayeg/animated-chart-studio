import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ChartBoundary } from './ChartBoundary'

function Broken(): never {
  throw new Error('boom')
}

describe('ChartBoundary', () => {
  it('shows the problem instead of taking the page down, and tries again on a new key', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { rerender } = render(
      <ChartBoundary resetKey="a" title="Failed">
        <Broken />
      </ChartBoundary>,
    )
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('Failed')
    expect(alert.textContent).toContain('boom')

    rerender(
      <ChartBoundary resetKey="b" title="Failed">
        <p>fine</p>
      </ChartBoundary>,
    )
    expect(screen.getByText('fine')).toBeTruthy()
    quiet.mockRestore()
  })
})
