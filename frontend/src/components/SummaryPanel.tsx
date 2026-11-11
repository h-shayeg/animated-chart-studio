import { useTranslation } from 'react-i18next'

import type { AnalysisSummary, ColumnSummary, Correlation, NumericStats } from '../api'
import { CORRELATION_SCALE, NO_VALUE, correlationColor, formatStat } from '../stats'

const STAT_KEYS: readonly (keyof NumericStats)[] = [
  'mean',
  'std',
  'min',
  'q25',
  'median',
  'q75',
  'max',
]

const CARD =
  'overflow-auto rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60'
const HEAD = 'sticky top-0 bg-slate-100 dark:bg-slate-800'
const TH = 'px-4 py-3 text-start font-semibold whitespace-nowrap'
const TD = 'px-4 py-2 whitespace-nowrap tabular-nums'
const NAME = 'px-4 py-2 text-start font-medium whitespace-nowrap'
const ROWS = 'divide-y divide-slate-200 dark:divide-slate-800'
const SUBTITLE = 'font-semibold'

function NumberColumns({ columns }: { columns: ColumnSummary[] }) {
  const { t, i18n } = useTranslation()
  const stat = (value: number | null | undefined) => formatStat(value, i18n.language)

  return (
    <div className="space-y-2">
      <h3 className={SUBTITLE}>{t('summary.numbers')}</h3>
      <div className={`${CARD} max-h-128`}>
        <table className="min-w-full text-sm">
          <thead className={HEAD}>
            <tr>
              <th scope="col" className={TH}>
                {t('summary.column')}
              </th>
              <th scope="col" className={TH}>
                {t('summary.count')}
              </th>
              <th scope="col" className={TH}>
                {t('summary.missing')}
              </th>
              {STAT_KEYS.map((key) => (
                <th key={key} scope="col" className={TH}>
                  {t(`summary.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={ROWS}>
            {columns.map((column) => (
              <tr key={column.name}>
                <th scope="row" className={NAME}>
                  <bdi>{column.name}</bdi>
                </th>
                <td className={TD}>{stat(column.numeric?.count ?? 0)}</td>
                <td className={TD}>{stat(column.missing)}</td>
                {STAT_KEYS.map((key) => (
                  <td key={key} className={TD}>
                    {stat(column.numeric?.[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OtherColumns({ columns }: { columns: ColumnSummary[] }) {
  const { t, i18n } = useTranslation()
  const stat = (value: number) => formatStat(value, i18n.language)

  return (
    <div className="space-y-2">
      <h3 className={SUBTITLE}>{t('summary.others')}</h3>
      <div className={`${CARD} max-h-128`}>
        <table className="min-w-full text-sm">
          <thead className={HEAD}>
            <tr>
              {(['column', 'kind', 'missing', 'unique', 'top'] as const).map((key) => (
                <th key={key} scope="col" className={TH}>
                  {t(`summary.${key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={ROWS}>
            {columns.map((column) => (
              <tr key={column.name}>
                <th scope="row" className={NAME}>
                  <bdi>{column.name}</bdi>
                </th>
                <td className={TD}>{t(`kind.${column.kind}`)}</td>
                <td className={TD}>{stat(column.missing)}</td>
                <td className={TD}>{stat(column.unique)}</td>
                <td className="px-4 py-2">
                  {column.top_values.length === 0 ? (
                    NO_VALUE
                  ) : (
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {column.top_values.map((item) => (
                        <li key={item.value} className="whitespace-nowrap">
                          <bdi>{item.value}</bdi>{' '}
                          <span className="text-slate-500 tabular-nums dark:text-slate-400">
                            × {stat(item.count)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface CorrelationTableProps {
  correlation: Correlation
  // How many number columns the file has; the table may hold only the first ones.
  numberColumns: number
}

function CorrelationTable({ correlation, numberColumns }: CorrelationTableProps) {
  const { t, i18n } = useTranslation()
  const value = (cell: number | null | undefined) =>
    cell === null || cell === undefined
      ? NO_VALUE
      : new Intl.NumberFormat(i18n.language, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(cell)
  // The ends and the middle of the scale, written the way the language writes signed numbers.
  const signed = new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero' })
  const ends = { minus: signed.format(-1), zero: signed.format(0), plus: signed.format(1) }

  return (
    <div className="space-y-2">
      <h3 className={SUBTITLE}>{t('summary.correlation')}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {t('summary.correlationHelp', ends)}
      </p>
      <div className={`${CARD} max-h-144 w-fit max-w-full`}>
        <table className="text-sm">
          <thead>
            <tr>
              <td />
              {correlation.columns.map((name) => (
                <th
                  key={name}
                  scope="col"
                  className="px-3 py-2 text-center font-medium whitespace-nowrap"
                >
                  <bdi>{name}</bdi>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {correlation.columns.map((rowName, row) => (
              <tr key={rowName}>
                <th scope="row" className={NAME}>
                  <bdi>{rowName}</bdi>
                </th>
                {correlation.columns.map((columnName, column) => {
                  const cell = correlation.matrix[row]?.[column] ?? null
                  return (
                    <td
                      key={columnName}
                      title={t('summary.pair', { a: rowName, b: columnName, value: value(cell) })}
                      style={{ backgroundColor: correlationColor(cell) }}
                      className="border border-white/60 px-3 py-2 text-center tabular-nums dark:border-slate-900/60"
                    >
                      {value(cell)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        dir="ltr"
        aria-hidden="true"
        className="w-56 text-xs text-slate-500 dark:text-slate-400"
      >
        <div className="h-2 rounded-full" style={{ backgroundImage: CORRELATION_SCALE }} />
        <div className="mt-1 flex justify-between tabular-nums">
          <span>{ends.minus}</span>
          <span>{ends.zero}</span>
          <span>{ends.plus}</span>
        </div>
      </div>
      {numberColumns > correlation.columns.length ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('summary.correlationLimit', { count: correlation.columns.length })}
        </p>
      ) : null}
    </div>
  )
}

export function SummaryPanel({ summary }: { summary: AnalysisSummary }) {
  const { t } = useTranslation()
  const numbers = summary.columns.filter((column) => column.kind === 'numeric')
  const others = summary.columns.filter((column) => column.kind !== 'numeric')

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-xl font-bold">{t('summary.title')}</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('summary.hint', { count: summary.rows })}
        </p>
      </div>
      {numbers.length > 0 ? <NumberColumns columns={numbers} /> : null}
      {others.length > 0 ? <OtherColumns columns={others} /> : null}
      {summary.correlation ? (
        <CorrelationTable correlation={summary.correlation} numberColumns={numbers.length} />
      ) : null}
    </section>
  )
}
