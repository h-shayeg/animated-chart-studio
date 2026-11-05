import { useTranslation } from 'react-i18next'

import type { ColumnKind, Dataset } from '../api'
import { useDatasetStore } from '../store'

const MAX_VISIBLE_ROWS = 100

const KIND_STYLES: Record<ColumnKind, string> = {
  numeric: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  datetime: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  boolean: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  text: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
}

function formatCell(value: unknown, kind: ColumnKind, formatter: Intl.NumberFormat): string {
  if (value === null || value === undefined) return '—'
  if (kind === 'numeric' && typeof value === 'number') return formatter.format(value)
  return String(value)
}

export function DataTable({ dataset }: { dataset: Dataset }) {
  const { t, i18n } = useTranslation()
  const reset = useDatasetStore((state) => state.reset)
  const formatter = new Intl.NumberFormat(i18n.language)
  const visibleRows = dataset.data.slice(0, MAX_VISIBLE_ROWS)

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">{t('table.title')}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <bdi>{dataset.filename}</bdi> · {t('table.rows', { count: dataset.rows })} ·{' '}
            {t('table.columns', { count: dataset.columns.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800"
        >
          {t('table.replace')}
        </button>
      </div>

      <div className="max-h-128 overflow-auto rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
            <tr>
              {dataset.columns.map((column) => (
                <th key={column.name} className="px-4 py-3 text-start font-semibold">
                  <div>{column.name}</div>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${KIND_STYLES[column.kind]}`}
                    >
                      {t(`kind.${column.kind}`)}
                    </span>
                    {column.missing > 0 && (
                      <span className="text-xs font-normal text-amber-600 dark:text-amber-400">
                        {t('table.missing', { count: column.missing })}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {visibleRows.map((row, index) => (
              <tr key={index} className="hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30">
                {dataset.columns.map((column) => (
                  <td key={column.name} className="px-4 py-2 whitespace-nowrap">
                    {formatCell(row[column.name], column.kind, formatter)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {dataset.rows > MAX_VISIBLE_ROWS && (
        <p className="text-center text-sm text-slate-500">
          {t('table.showing', { count: MAX_VISIBLE_ROWS })}
        </p>
      )}
    </section>
  )
}
