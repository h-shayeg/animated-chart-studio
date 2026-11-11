// Small helpers for showing statistics: one way of writing a number, and the colour of a
// correlation.

export const NO_VALUE = '–'

// A statistic as text: whole numbers in full, the rest with as many digits as tell something.
export function formatStat(value: number | null | undefined, language: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE
  const size = Math.abs(value)
  let digits: Intl.NumberFormatOptions
  if (Number.isInteger(value)) digits = { maximumFractionDigits: 0 }
  else if (size >= 1000) digits = { maximumFractionDigits: 2 }
  else if (size >= 1) digits = { maximumFractionDigits: 3 }
  else digits = { maximumSignificantDigits: 3 }
  return new Intl.NumberFormat(language, digits).format(value)
}

// Two colours that read as opposites, cool for "together" and warm for "against each other".
const TOGETHER = '79, 70, 229'
const AGAINST = '225, 29, 72'
// The strongest tint. Text on it keeps a contrast above 7:1 in the light and the dark theme.
const STRONGEST = 0.55

// The background of a correlation: no colour at zero, and a stronger tint the closer the
// value gets to +1 or -1. The number itself is always written in the cell as well.
export function correlationColor(value: number | null): string | undefined {
  if (value === null || !Number.isFinite(value) || value === 0) return undefined
  const strength = Math.min(Math.abs(value), 1) * STRONGEST
  return `rgba(${value > 0 ? TOGETHER : AGAINST}, ${strength.toFixed(3)})`
}

// The scale under the correlation table, from -1 on the left to +1 on the right.
export const CORRELATION_SCALE = [
  'linear-gradient(to right',
  `rgba(${AGAINST}, ${STRONGEST})`,
  `rgba(${AGAINST}, 0) 50%`,
  `rgba(${TOGETHER}, 0) 50%`,
  `rgba(${TOGETHER}, ${STRONGEST}))`,
].join(', ')
