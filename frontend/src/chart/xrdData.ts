import type { Dataset } from '../api'
import { extractPattern } from './xrd'

export const MIN_POINTS = 30
const MIN_SPAN_DEG = 5
const MAX_STEP_DEG = 0.5
const RISING_SHARE = 0.95

export type XrdProblem =
  | 'columns'
  | 'sameColumn'
  | 'points'
  | 'range'
  | 'duplicates'
  | 'coarse'
  | 'flat'

export interface XrdColumns {
  angle: string
  intensity: string
}

function numericNames(dataset: Dataset): string[] {
  return dataset.columns.filter((column) => column.kind === 'numeric').map((column) => column.name)
}

function columnValues(dataset: Dataset, name: string): number[] {
  const values: number[] = []
  for (const row of dataset.data) {
    const value = row[name]
    if (typeof value === 'number' && Number.isFinite(value)) values.push(value)
  }
  return values
}

// An angle column rises from row to row and stays between 0 and 180 degrees.
function looksLikeAngle(values: number[]): boolean {
  if (values.length < 2) return false
  let rising = 0
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) >= (values[index - 1] ?? 0)) rising += 1
  }
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  return (
    rising / (values.length - 1) >= RISING_SHARE &&
    first > 0 &&
    last < 180 &&
    last - first >= MIN_SPAN_DEG
  )
}

// Picks the angle column by its look and the intensity column that follows it.
export function guessColumns(dataset: Dataset): XrdColumns | null {
  const names = numericNames(dataset)
  if (names.length < 2) return null
  const angle = names.find((name) => looksLikeAngle(columnValues(dataset, name))) ?? names[0]
  if (angle === undefined) return null
  const after = names.slice(names.indexOf(angle) + 1)
  const intensity = after[0] ?? names.find((name) => name !== angle)
  if (intensity === undefined) return null
  return { angle, intensity }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle] ?? 0
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
}

// What is wrong with the chosen columns as an XRD pattern. An empty list means the data can be analysed.
export function checkXrdData(dataset: Dataset, columns: XrdColumns): XrdProblem[] {
  if (columns.angle === columns.intensity) return ['sameColumn']
  const { twoTheta, intensity } = extractPattern(dataset, columns.angle, columns.intensity)
  if (twoTheta.length < MIN_POINTS) return ['points']

  const problems: XrdProblem[] = []
  const first = twoTheta[0] ?? 0
  const last = twoTheta[twoTheta.length - 1] ?? 0
  if (first <= 0 || last >= 180 || last - first < MIN_SPAN_DEG) problems.push('range')

  const steps = twoTheta.slice(1).map((value, index) => value - (twoTheta[index] ?? 0))
  if (steps.some((step) => step <= 0)) problems.push('duplicates')
  else if (median(steps) > MAX_STEP_DEG) problems.push('coarse')

  if (intensity.every((value) => value === intensity[0])) problems.push('flat')
  return problems
}
