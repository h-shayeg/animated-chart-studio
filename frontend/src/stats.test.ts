import { expect, it } from 'vitest'

import { correlationColor, formatStat } from './stats'

it('writes whole numbers in full', () => {
  expect(formatStat(390, 'en')).toBe('390')
  expect(formatStat(1234567, 'en')).toBe('1,234,567')
  expect(formatStat(-12, 'en')).toBe('-12')
  expect(formatStat(0, 'en')).toBe('0')
})

it('keeps as many digits as tell something', () => {
  expect(formatStat(60.5530002, 'en')).toBe('60.553')
  expect(formatStat(1234.56789, 'en')).toBe('1,234.57')
  expect(formatStat(0.000123456, 'en')).toBe('0.000123')
  expect(formatStat(-0.5, 'en')).toBe('-0.5')
})

it('shows a dash for a statistic that could not be worked out', () => {
  expect(formatStat(null, 'en')).toBe('–')
  expect(formatStat(undefined, 'en')).toBe('–')
  expect(formatStat(Number.NaN, 'en')).toBe('–')
  expect(formatStat(Number.POSITIVE_INFINITY, 'en')).toBe('–')
})

it('writes numbers the Persian way in Persian', () => {
  expect(formatStat(390, 'fa')).toBe('۳۹۰')
  expect(formatStat(1.59, 'fa')).toBe('۱٫۵۹')
})

it('tints a correlation by its sign and its strength', () => {
  expect(correlationColor(1)).toBe('rgba(79, 70, 229, 0.550)')
  expect(correlationColor(0.5)).toBe('rgba(79, 70, 229, 0.275)')
  expect(correlationColor(-1)).toBe('rgba(225, 29, 72, 0.550)')
  expect(correlationColor(-0.2)).toBe('rgba(225, 29, 72, 0.110)')
})

it('leaves no link and no value without a tint', () => {
  expect(correlationColor(0)).toBeUndefined()
  expect(correlationColor(null)).toBeUndefined()
  expect(correlationColor(Number.NaN)).toBeUndefined()
})

it('never tints more strongly than a full correlation', () => {
  expect(correlationColor(1.0000001)).toBe('rgba(79, 70, 229, 0.550)')
})
