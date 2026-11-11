import { render, screen, within } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'

import type { AnalysisSummary } from '../api'
import i18n, { applyLanguage } from '../i18n'
import { SummaryPanel } from './SummaryPanel'

const summary: AnalysisSummary = {
  rows: 10,
  columns: [
    { name: 'date', kind: 'datetime', missing: 0, unique: 10, numeric: null, top_values: [] },
    {
      name: 'city',
      kind: 'text',
      missing: 1,
      unique: 2,
      numeric: null,
      top_values: [
        { value: 'Tehran', count: 6 },
        { value: 'Tabriz', count: 3 },
      ],
    },
    {
      name: 'temperature',
      kind: 'numeric',
      missing: 0,
      unique: 10,
      numeric: {
        count: 10,
        mean: 390,
        std: 60.5530002,
        min: 300,
        q25: 345,
        median: 390,
        q75: 435,
        max: 480,
      },
      top_values: [],
    },
    {
      name: 'cost',
      kind: 'numeric',
      missing: 1,
      unique: 9,
      numeric: {
        count: 9,
        mean: 629.9,
        std: null,
        min: 0.000123,
        q25: 618.25,
        median: 684,
        q75: 753.75,
        max: 820,
      },
      top_values: [],
    },
    { name: 'empty', kind: 'numeric', missing: 10, unique: 0, numeric: null, top_values: [] },
  ],
  correlation: {
    columns: ['temperature', 'cost', 'empty'],
    matrix: [
      [1, -0.7831, null],
      [-0.7831, 1, null],
      [null, null, null],
    ],
  },
}

function cellsOf(table: HTMLElement, name: string): string[] {
  const row = within(table).getByRole('rowheader', { name }).closest('tr')
  if (!row) throw new Error(`No row for ${name}`)
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '')
}

afterEach(async () => {
  await i18n.changeLanguage('en')
  applyLanguage('en')
})

it('lists the statistics of each number column', () => {
  render(<SummaryPanel summary={summary} />)

  expect(screen.getByRole('heading', { name: 'Statistical summary' })).toBeInTheDocument()
  expect(screen.getByText('Worked out from every row of the file (10 rows).')).toBeInTheDocument()
  const [numbers] = screen.getAllByRole('table')
  if (!numbers) throw new Error('No table')
  expect(within(numbers).getAllByRole('columnheader')).toHaveLength(10)
  expect(cellsOf(numbers, 'temperature')).toEqual([
    '10',
    '0',
    '390',
    '60.553',
    '300',
    '345',
    '390',
    '435',
    '480',
  ])
})

it('shows a dash where a statistic could not be worked out', () => {
  render(<SummaryPanel summary={summary} />)

  const [numbers] = screen.getAllByRole('table')
  if (!numbers) throw new Error('No table')
  expect(cellsOf(numbers, 'cost')[3]).toBe('–')
  expect(cellsOf(numbers, 'cost')[4]).toBe('0.000123')
  expect(cellsOf(numbers, 'empty')).toEqual(['0', '10', '–', '–', '–', '–', '–', '–', '–'])
})

it('lists the other columns with their type and most frequent values', () => {
  render(<SummaryPanel summary={summary} />)

  const others = screen.getAllByRole('table')[1]
  if (!others) throw new Error('No table')
  expect(cellsOf(others, 'city')).toEqual(['Text', '1', '2', 'Tehran × 6Tabriz × 3'])
  expect(cellsOf(others, 'date')).toEqual(['Date', '0', '10', '–'])
})

it('shows the correlation as numbers on a tint, with its scale', () => {
  render(<SummaryPanel summary={summary} />)

  expect(
    screen.getByText(/\+1 means two columns rise together, -1 means one falls/),
  ).toBeInTheDocument()
  const against = screen.getAllByTitle('temperature and cost: -0.78')[0]
  expect(against).toHaveTextContent('-0.78')
  expect(against).toHaveStyle({ backgroundColor: 'rgba(225, 29, 72, 0.431)' })
  const together = screen.getByTitle('temperature and temperature: 1.00')
  expect(together).toHaveStyle({ backgroundColor: 'rgba(79, 70, 229, 0.55)' })
  const unknown = screen.getByTitle('temperature and empty: –')
  expect(unknown).toHaveTextContent('–')
  expect(unknown.style.backgroundColor).toBe('')
  expect(screen.queryByText(/Only the first/)).not.toBeInTheDocument()
})

it('says so when the correlation holds only the first number columns', () => {
  const first = {
    columns: ['temperature', 'cost'],
    matrix: [
      [1, -0.7831],
      [-0.7831, 1],
    ],
  }
  render(<SummaryPanel summary={{ ...summary, correlation: first }} />)

  expect(screen.getByText('Only the first 2 number columns are shown.')).toBeInTheDocument()
})

it('leaves out the parts a table has nothing for', () => {
  const textOnly: AnalysisSummary = {
    rows: 2,
    columns: summary.columns.slice(0, 2),
    correlation: null,
  }
  render(<SummaryPanel summary={textOnly} />)

  expect(screen.queryByRole('heading', { name: 'Number columns' })).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Other columns' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: /Correlation/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('table')).toHaveLength(1)
})

it('writes the numbers the Persian way in Persian', async () => {
  await i18n.changeLanguage('fa')
  applyLanguage('fa')
  render(<SummaryPanel summary={summary} />)

  const [numbers] = screen.getAllByRole('table')
  if (!numbers) throw new Error('No table')
  expect(cellsOf(numbers, 'temperature').slice(2, 4)).toEqual(['۳۹۰', '۶۰٫۵۵۳'])
  expect(screen.getAllByTitle(/temperature و cost/)[0]).toHaveTextContent('۰٫۷۸')
})
