import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { buildOption } from './buildOption'
import { placementLimits, placementOf } from './magnifier'
import { DEFAULT_MAGNIFIER, defaultConfig, type ChartConfig, type Magnifier } from './types'

type Item = Record<string, unknown>

function spectrum(): Dataset {
  const data = Array.from({ length: 101 }, (_, index) => ({
    wavenumber: index,
    intensity: 20 + Math.sin(index / 10) * 10,
  }))
  return {
    filename: 'spectrum.xlsx',
    rows: data.length,
    columns: [
      { name: 'wavenumber', kind: 'numeric', missing: 0 },
      { name: 'intensity', kind: 'numeric', missing: 0 },
    ],
    data,
  } as Dataset
}

function build(patch: Partial<ChartConfig>, magnifier: Partial<Magnifier> = {}) {
  const dataset = spectrum()
  const config: ChartConfig = {
    ...defaultConfig(dataset),
    xColumn: 'wavenumber',
    yColumns: ['intensity'],
    ...patch,
    magnifier: { ...DEFAULT_MAGNIFIER, enabled: true, xFrom: 20, xTo: 40, ...magnifier },
  }
  return buildOption({ dataset, config, language: 'en' })
}

describe('placementOf', () => {
  it('uses the box of the settings when it fits', () => {
    expect(placementOf(DEFAULT_MAGNIFIER)).toEqual({ left: 60, top: 14, width: 32, height: 52 })
  })

  it('keeps the box clear of the main chart and of the edges', () => {
    const wide = placementOf({ ...DEFAULT_MAGNIFIER, boxLeft: 10, boxWidth: 90 })
    expect(wide.left).toBe(40)
    expect(wide.left + wide.width).toBeLessThanOrEqual(92)

    const low = placementOf({ ...DEFAULT_MAGNIFIER, boxTop: 80, boxHeight: 60 })
    expect(low.top + low.height).toBeLessThanOrEqual(86)
  })

  it('falls back to the smallest value for a number that is not usable', () => {
    expect(placementOf({ ...DEFAULT_MAGNIFIER, boxWidth: Number.NaN }).width).toBe(12)
  })
})

describe('placementLimits', () => {
  it('lets each slider go as far as the others leave room', () => {
    expect(placementLimits(placementOf(DEFAULT_MAGNIFIER))).toEqual({
      left: [40, 60],
      top: [0, 34],
      width: [12, 32],
      height: [15, 72],
    })
  })
})

describe('the box of the enlarged view in the option', () => {
  it('puts the second grid where the box is and stops the main chart before it', () => {
    const option = build({}, { boxLeft: 50, boxTop: 20, boxWidth: 40, boxHeight: 40 })
    const grids = option?.grid as Item[]
    expect(grids[1]).toMatchObject({ left: '50%', top: '20%', width: '40%', height: '40%' })
    expect(grids[0]?.right).toBe('56%')
  })
})

describe('the animation of the enlarged view', () => {
  it('lasts and starts as set, apart from the main chart', () => {
    const option = build({}, { durationMs: 2000, delayMs: 500 })
    const series = option?.series as Item[]
    expect(series[1]).toMatchObject({ animationDuration: 2000, animationDelay: 500 })
    expect(series[0]?.animation).toBeUndefined()
    expect(option?.animation).toBe(true)
  })

  it('can be switched off while the main chart still moves', () => {
    const option = build({}, { animate: false })
    const series = option?.series as Item[]
    expect(series[1]?.animation).toBe(false)
    expect(option?.animation).toBe(true)
  })

  it('can be the only one that moves', () => {
    const option = build({ animate: false })
    const series = option?.series as Item[]
    expect(option?.animation).toBe(true)
    expect(series[0]?.animation).toBe(false)
    expect(series[1]?.animation).toBeUndefined()
  })

  it('is off when both are off', () => {
    const option = build({ animate: false }, { animate: false })
    const series = option?.series as Item[]
    expect(option?.animation).toBe(false)
    expect(series[1]?.animation).toBe(false)
  })

  it('lets scatter dots appear one after another after the delay', () => {
    const option = build({ type: 'scatter' }, { durationMs: 2000, delayMs: 500 })
    const series = option?.series as Item[]
    const delay = series[1]?.animationDelay as (index: number) => number
    expect(delay(0)).toBe(500)
    expect(delay(10)).toBeGreaterThan(500)
    expect(series[1]?.animationDuration).toBe(1200)
  })
})
