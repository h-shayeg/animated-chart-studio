import { describe, expect, it } from 'vitest'

import { INITIAL_VALUES, readOptions } from './xrdOptions'

describe('readOptions', () => {
  it('turns the starting values into the options of the analysis', () => {
    expect(readOptions(INITIAL_VALUES, 'snip')).toEqual({
      wavelength: 1.5406,
      smoothing_window: 9,
      baseline_method: 'snip',
      baseline_window: 5,
      min_prominence: 3,
      min_distance: 0.2,
      shape_factor: 0.9,
      instrument_broadening: 0,
    })
  })

  it('rounds the smoothing window to a whole number', () => {
    expect(readOptions({ ...INITIAL_VALUES, smoothing: '8.6' }, 'none')?.smoothing_window).toBe(9)
  })

  it('gives nothing when a field is empty or not a number', () => {
    expect(readOptions({ ...INITIAL_VALUES, wavelength: '' }, 'snip')).toBeNull()
    expect(readOptions({ ...INITIAL_VALUES, shape: 'abc' }, 'snip')).toBeNull()
  })
})
