import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import type { Dataset } from '../api'
import { ChartStudio } from './ChartStudio'

const dataset: Dataset = {
  filename: 'sales.csv',
  rows: 2,
  columns: [
    { name: 'month', kind: 'datetime', missing: 0 },
    { name: 'sales', kind: 'numeric', missing: 0 },
    { name: 'profit', kind: 'numeric', missing: 0 },
  ],
  data: [
    { month: '2025-01-01', sales: 10, profit: 3 },
    { month: '2025-02-01', sales: 20, profit: 4 },
  ],
}

it('starts with a line chart of the number columns', () => {
  render(<ChartStudio dataset={dataset} />)

  expect(screen.getByRole('button', { name: 'Line' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('checkbox', { name: 'sales' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'profit' })).toBeChecked()
})

it('switches the chart type', () => {
  render(<ChartStudio dataset={dataset} />)

  fireEvent.click(screen.getByRole('button', { name: 'Bar' }))

  expect(screen.getByRole('button', { name: 'Bar' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Line' })).toHaveAttribute('aria-pressed', 'false')
})

it('explains what is missing when no value column is selected', () => {
  render(<ChartStudio dataset={dataset} />)

  fireEvent.click(screen.getByRole('checkbox', { name: 'sales' }))
  fireEvent.click(screen.getByRole('checkbox', { name: 'profit' }))

  expect(screen.getByRole('status')).toHaveTextContent('Pick at least one number column')
})

it('asks for a number column on the X axis of a scatter chart', () => {
  render(<ChartStudio dataset={dataset} />)

  fireEvent.click(screen.getByRole('button', { name: 'Scatter' }))

  expect(screen.getByRole('status')).toHaveTextContent('needs a number column')
})

it('allows animations as long as thirty seconds', () => {
  render(<ChartStudio dataset={dataset} />)

  expect(screen.getByRole('slider')).toHaveAttribute('max', '30000')
})

it('offers image, vector and video export formats', () => {
  render(<ChartStudio dataset={dataset} />)

  const formats = screen.getAllByRole('option', { name: /PNG|JPEG|SVG|WebM/ })

  expect(formats).toHaveLength(4)
})
