import { fireEvent, render, screen } from '@testing-library/react'
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

function slider(name: string): HTMLInputElement {
  return screen.getByRole('slider', { name }) as HTMLInputElement
}

describe('magnifier settings', () => {
  it('shows the box and animation controls once the magnifier is on', () => {
    render(<ChartStudio dataset={spectrum()} />)
    expect(screen.queryByRole('slider', { name: 'Width' })).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show the magnifier' }))

    expect(slider('Width').value).toBe('32')
    expect(slider('Height').value).toBe('52')
  })

  it('keeps the box inside the chart while it is moved and resized', () => {
    render(<ChartStudio dataset={spectrum()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show the magnifier' }))
    expect(slider('Distance from the left').max).toBe('60')

    fireEvent.change(slider('Width'), { target: { value: '20' } })

    expect(slider('Width').value).toBe('20')
    expect(slider('Distance from the left').max).toBe('72')
  })

  it('animates the enlarged view apart from the chart', () => {
    render(<ChartStudio dataset={spectrum()} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show the magnifier' }))
    expect(slider('Duration').disabled).toBe(false)

    fireEvent.click(screen.getByRole('checkbox', { name: 'Animate the enlarged view' }))

    expect(slider('Duration').disabled).toBe(true)
    expect(slider('Start delay').disabled).toBe(true)
  })
})
