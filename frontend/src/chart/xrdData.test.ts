import { describe, expect, it } from 'vitest'

import type { Dataset } from '../api'
import { checkXrdData, guessColumns } from './xrdData'

function pattern(rows: number, step = 0.5, start = 20): Dataset {
  return {
    filename: 'si.csv',
    rows,
    columns: [
      { name: 'index', kind: 'numeric', missing: 0 },
      { name: 'two_theta', kind: 'numeric', missing: 0 },
      { name: 'intensity', kind: 'numeric', missing: 0 },
    ],
    data: Array.from({ length: rows }, (_, index) => ({
      index,
      two_theta: start + index * step,
      intensity: 100 + (index % 7) * 10,
    })),
  }
}

const columns = { angle: 'two_theta', intensity: 'intensity' }

describe('guessColumns', () => {
  it('skips a row-number column and takes the angle column and the intensity after it', () => {
    expect(guessColumns(pattern(40))).toEqual(columns)
  })

  it('gives nothing when there are fewer than two number columns', () => {
    const dataset: Dataset = {
      filename: 'a.csv',
      rows: 1,
      columns: [
        { name: 'name', kind: 'text', missing: 0 },
        { name: 'value', kind: 'numeric', missing: 0 },
      ],
      data: [{ name: 'a', value: 1 }],
    }

    expect(guessColumns(dataset)).toBeNull()
  })
})

describe('checkXrdData', () => {
  it('accepts a normal pattern', () => {
    expect(checkXrdData(pattern(40), columns)).toEqual([])
  })

  it('rejects the same column twice', () => {
    expect(checkXrdData(pattern(40), { angle: 'two_theta', intensity: 'two_theta' })).toEqual([
      'sameColumn',
    ])
  })

  it('asks for more points', () => {
    expect(checkXrdData(pattern(5), columns)).toEqual(['points'])
  })

  it('rejects angles outside 0 to 180 degrees', () => {
    expect(checkXrdData(pattern(40, 5, 100), columns)).toContain('range')
  })

  it('rejects a repeated angle', () => {
    expect(checkXrdData(pattern(40, 0), columns)).toContain('duplicates')
  })

  it('rejects a step that is too coarse', () => {
    expect(checkXrdData(pattern(40, 2), columns)).toContain('coarse')
  })

  it('rejects an intensity that never changes', () => {
    const dataset = pattern(40)
    dataset.data = dataset.data.map((row) => ({ ...row, intensity: 5 }))

    expect(checkXrdData(dataset, columns)).toContain('flat')
  })
})
