import { describe, expect, it } from 'vitest'

import type { XrdResult } from '../api'
import { buildXrdOption, formatMiller, hklText, peaksToCsv, type XrdLabels } from './xrd'

const labels: XrdLabels = {
  raw: 'Raw',
  smoothed: 'Smoothed',
  baseline: 'Baseline',
  corrected: 'Corrected',
  peaks: 'Peaks',
  xAxis: '2theta',
  yAxis: 'Intensity',
}

const result: XrdResult = {
  two_theta: [10, 20, 30],
  smoothed: [110, 160, 130],
  baseline: [100, 110, 120],
  corrected: [10, 50, 10],
  peaks: [
    {
      position: 20,
      d_spacing: 4.4,
      height: 50,
      relative_intensity: 100,
      fwhm: 0.2,
      crystallite_size: 40,
    },
  ],
}

describe('formatMiller', () => {
  it('writes the indices together and puts a bar over a negative one', () => {
    expect(formatMiller([1, 1, 1])).toBe('(111)')
    expect(formatMiller([-1, 1, 1])).toBe('(1\u030411)')
  })

  it('separates the indices when one has two digits', () => {
    expect(formatMiller([10, 0, -2])).toBe('(10 0 2\u0304)')
  })
})

describe('hklText', () => {
  it('shows the first two families that share a spacing', () => {
    expect(hklText([[5, 1, 1], [3, 3, 3], [4, 4, 0]])).toBe('(511) / (333)')
    expect(hklText([[1, 1, 1]])).toBe('(111)')
  })
})

describe('the indices on the chart and in the file', () => {
  it('adds the indices to the name of a peak', () => {
    const option = buildXrdOption(result, [105, 155, 125], 'corrected', labels, ['(111)'])

    expect(option.series[1]?.data).toEqual([{ name: '20.00 (111)', value: [20, 50] }])
  })

  it('adds an hkl column to the file only when the indices are known', () => {
    expect(peaksToCsv(result.peaks)).not.toContain('hkl')
    expect(peaksToCsv(result.peaks, ['(111)'])).toBe(
      '2theta_deg,d_angstrom,height,relative_percent,fwhm_deg,crystallite_size_nm,hkl\n20,4.4,50,100,0.2,40,(111)',
    )
  })
})
