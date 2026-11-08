import { describe, expect, it } from 'vitest'

import type { Dataset, XrdResult } from '../api'
import { baselineAt, buildXrdOption, extractPattern, peaksToCsv, type XrdLabels } from './xrd'

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
      crystallite_size: null,
    },
  ],
}

describe('extractPattern', () => {
  it('sorts by angle and skips rows with a missing or non-number value', () => {
    const dataset: Dataset = {
      filename: 'a.csv',
      rows: 4,
      columns: [
        { name: 'angle', kind: 'numeric', missing: 0 },
        { name: 'counts', kind: 'numeric', missing: 1 },
      ],
      data: [
        { angle: 30, counts: 3 },
        { angle: 10, counts: 1 },
        { angle: 20, counts: null },
        { angle: '25', counts: '2' },
      ],
    }

    expect(extractPattern(dataset, 'angle', 'counts')).toEqual({
      twoTheta: [10, 25, 30],
      intensity: [1, 2, 3],
    })
  })
})

describe('baselineAt', () => {
  it('reads between the two nearest points and stays at the ends', () => {
    expect(baselineAt(result, 15)).toBe(105)
    expect(baselineAt(result, 20)).toBe(110)
    expect(baselineAt(result, 5)).toBe(100)
    expect(baselineAt(result, 99)).toBe(120)
  })
})

describe('peaksToCsv', () => {
  it('writes a header and one rounded row per peak, leaving an unknown size empty', () => {
    expect(peaksToCsv(result.peaks)).toBe(
      '2theta_deg,d_angstrom,height,relative_percent,fwhm_deg,crystallite_size_nm\n20,4.4,50,100,0.2,',
    )
  })
})

describe('buildXrdOption', () => {
  it('draws the corrected curve and the peaks at their corrected height', () => {
    const option = buildXrdOption(result, [105, 155, 125], 'corrected', labels)

    expect(option.series.map((item) => item.name)).toEqual(['Corrected', 'Peaks'])
    expect(option.series[1]?.data).toEqual([{ name: '20.00', value: [20, 50] }])
  })

  it('draws raw, smoothed and baseline curves and lifts the peaks onto the baseline', () => {
    const option = buildXrdOption(result, [105, 155, 125], 'original', labels)

    expect(option.series.map((item) => item.name)).toEqual([
      'Raw',
      'Smoothed',
      'Baseline',
      'Peaks',
    ])
    expect(option.series[3]?.data).toEqual([{ name: '20.00', value: [20, 160] }])
  })
})
