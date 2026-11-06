import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import type { Dataset } from '../api'
import { useDatasetStore } from '../store'
import { DataTable } from './DataTable'

const dataset: Dataset = {
  filename: 'a.csv',
  rows: 1,
  columns: [{ name: 'x', kind: 'numeric', missing: 0 }],
  data: [{ x: 1 }],
}

it('asks the store to read the file again when the header option changes', () => {
  const setHeader = vi.fn().mockResolvedValue(undefined)
  useDatasetStore.setState({ setHeader })
  render(<DataTable dataset={dataset} />)

  fireEvent.click(screen.getByRole('checkbox', { name: 'First row contains column names' }))

  expect(setHeader).toHaveBeenCalledWith(false)
})
