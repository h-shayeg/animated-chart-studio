import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { RibbonTabs } from './Ribbon'

it('lists every tab and marks the active one', () => {
  render(<RibbonTabs active="xrd" onChange={() => {}} />)

  expect(screen.getAllByRole('tab')).toHaveLength(13)
  expect(screen.getByRole('tab', { name: 'XRD' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('tab', { name: 'Raman' })).toHaveAttribute('aria-selected', 'false')
})

it('reports the tab that was clicked', () => {
  const onChange = vi.fn()
  render(<RibbonTabs active="chart" onChange={onChange} />)

  fireEvent.click(screen.getByRole('tab', { name: 'Raman' }))

  expect(onChange).toHaveBeenCalledWith('raman')
})

it('moves to the next tab with the arrow key', () => {
  const onChange = vi.fn()
  render(<RibbonTabs active="chart" onChange={onChange} />)

  fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })

  expect(onChange).toHaveBeenCalledWith('xrd')
})
