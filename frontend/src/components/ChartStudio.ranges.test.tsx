import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { ChartStudio } from './ChartStudio'

function spectrum(): Dataset {
  const data = Array.from({ length: 30 }, (_, index) => ({
    wavenumber: 400 + index,
    intensity: index * 3,
  }))
  return {
    filename: 'spectrum.csv',
    rows: data.length,
    columns: [
      { name: 'wavenumber', kind: 'numeric', missing: 0 },
      { name: 'intensity', kind: 'numeric', missing: 0 },
    ],
    data,
  } as Dataset
}

describe('colour ranges on X and on Y', () => {
  it('keeps a separate list for each axis, so both can be set together', () => {
    render(<ChartStudio dataset={spectrum()} />)
    const onY = screen.getByRole('group', { name: 'Y values' })
    const onX = screen.getByRole('group', { name: 'X values' })

    fireEvent.click(within(onY).getByRole('button', { name: 'Add range' }))
    fireEvent.click(within(onX).getByRole('button', { name: 'Add range' }))
    fireEvent.click(within(onX).getByRole('button', { name: 'Add range' }))

    expect(within(onY).getAllByLabelText('From')).toHaveLength(1)
    expect(within(onX).getAllByLabelText('From')).toHaveLength(2)
    expect(screen.getByText(/Y range wins/)).toBeTruthy()
  })
})
