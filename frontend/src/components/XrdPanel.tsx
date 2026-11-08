import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { analyzeXrd, type Dataset, type XrdOptions, type XrdResult } from '../api'
import { extractPattern, peaksToCsv, type XrdView } from '../chart/xrd'
import { XrdChart } from './XrdChart'

const MIN_POINTS = 20
const CHART_HEIGHT = '26rem'

type BaselineMethod = XrdOptions['baseline_method']
type Status = 'idle' | 'loading' | 'ready' | 'error'

const FIELDS = [
  { id: 'wavelength', step: '0.0001' },
  { id: 'smoothing', step: '2' },
  { id: 'baselineWindow', step: '0.5' },
  { id: 'prominence', step: '0.5' },
  { id: 'distance', step: '0.05' },
  { id: 'shape', step: '0.01' },
  { id: 'instrument', step: '0.01' },
] as const

type FieldId = (typeof FIELDS)[number]['id']

const INITIAL_VALUES: Record<FieldId, string> = {
  wavelength: '1.5406',
  smoothing: '9',
  baselineWindow: '5',
  prominence: '3',
  distance: '0.2',
  shape: '0.9',
  instrument: '0',
}

const BASELINE_METHODS: BaselineMethod[] = ['snip', 'none']
const VIEWS: XrdView[] = ['original', 'corrected']

const INPUT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900'
const BUTTON_CLASS =
  'rounded-lg border px-3 py-1.5 text-sm font-medium transition aria-pressed:border-indigo-500 aria-pressed:bg-indigo-500 aria-pressed:text-white border-slate-300 dark:border-slate-700'

function readOptions(values: Record<FieldId, string>, baseline: BaselineMethod): XrdOptions | null {
  const read = (id: FieldId) => (values[id].trim() === '' ? Number.NaN : Number(values[id]))
  const options: XrdOptions = {
    wavelength: read('wavelength'),
    smoothing_window: Math.round(read('smoothing')),
    baseline_method: baseline,
    baseline_window: read('baselineWindow'),
    min_prominence: read('prominence'),
    min_distance: read('distance'),
    shape_factor: read('shape'),
    instrument_broadening: read('instrument'),
  }
  const numbers = Object.values(options).filter(
    (value): value is number => typeof value === 'number',
  )
  return numbers.every((value) => Number.isFinite(value)) ? options : null
}

function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface Outcome {
  result: XrdResult
  raw: number[]
}

export function XrdPanel({ dataset }: { dataset: Dataset }) {
  const { t } = useTranslation()
  const numericColumns = useMemo(
    () => dataset.columns.filter((column) => column.kind === 'numeric').map((column) => column.name),
    [dataset],
  )
  const [xColumn, setXColumn] = useState(numericColumns[0] ?? '')
  const [yColumn, setYColumn] = useState(numericColumns[1] ?? '')
  const [baseline, setBaseline] = useState<BaselineMethod>('snip')
  const [values, setValues] = useState(INITIAL_VALUES)
  const [view, setView] = useState<XrdView>('original')
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const labels = useMemo(
    () => ({
      raw: t('xrd.series.raw'),
      smoothed: t('xrd.series.smoothed'),
      baseline: t('xrd.series.baseline'),
      corrected: t('xrd.series.corrected'),
      peaks: t('xrd.series.peaks'),
      xAxis: t('xrd.axis.angle'),
      yAxis: t('xrd.axis.intensity'),
    }),
    [t],
  )

  const fail = (message: string) => {
    setStatus('error')
    setError(message)
    setOutcome(null)
  }

  const analyze = async () => {
    const pattern = extractPattern(dataset, xColumn, yColumn)
    if (pattern.twoTheta.length < MIN_POINTS) {
      fail(t('xrd.notEnoughPoints', { count: MIN_POINTS }))
      return
    }
    const options = readOptions(values, baseline)
    if (!options) {
      fail(t('xrd.invalidNumber'))
      return
    }
    setStatus('loading')
    setError(null)
    try {
      const result = await analyzeXrd(pattern.twoTheta, pattern.intensity, options)
      setOutcome({ result, raw: pattern.intensity })
      setStatus('ready')
    } catch (caught) {
      fail(caught instanceof Error ? caught.message : t('xrd.failed'))
    }
  }

  const csvName = `${dataset.filename.replace(/\.[^.]+$/, '')}-xrd-peaks.csv`

  return (
    <section
      aria-labelledby="xrd-title"
      className="space-y-5 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <header className="space-y-1">
        <h2 id="xrd-title" className="text-xl font-bold">
          {t('xrd.title')}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400">{t('xrd.subtitle')}</p>
      </header>

      {numericColumns.length < 2 ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">
          {t('xrd.needsColumns')}
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('xrd.angleColumn')}</span>
              <select
                value={xColumn}
                onChange={(event) => setXColumn(event.target.value)}
                className={INPUT_CLASS}
              >
                {numericColumns.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span>{t('xrd.intensityColumn')}</span>
              <select
                value={yColumn}
                onChange={(event) => setYColumn(event.target.value)}
                className={INPUT_CLASS}
              >
                {numericColumns.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm">{t('xrd.baseline')}</span>
            <div role="group" aria-label={t('xrd.baseline')} className="flex gap-2">
              {BASELINE_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={baseline === method}
                  onClick={() => setBaseline(method)}
                  className={BUTTON_CLASS}
                >
                  {t(`xrd.baselineMethod.${method}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((field) => (
              <label key={field.id} className="flex flex-col gap-1 text-sm">
                <span>{t(`xrd.fields.${field.id}`)}</span>
                <input
                  type="number"
                  dir="ltr"
                  step={field.step}
                  inputMode="decimal"
                  value={values[field.id]}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.id]: event.target.value }))
                  }
                  className={INPUT_CLASS}
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={status === 'loading'}
            onClick={() => void analyze()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {status === 'loading' ? t('xrd.analyzing') : t('xrd.analyze')}
          </button>

          {error ? (
            <p role="alert" className="text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          {outcome ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm">{t('xrd.view.label')}</span>
                <div role="group" aria-label={t('xrd.view.label')} className="flex gap-2">
                  {VIEWS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={view === option}
                      onClick={() => setView(option)}
                      className={BUTTON_CLASS}
                    >
                      {t(`xrd.view.${option}`)}
                    </button>
                  ))}
                </div>
              </div>

              <XrdChart
                result={outcome.result}
                raw={outcome.raw}
                view={view}
                labels={labels}
                label={t('xrd.chartLabel')}
                height={CHART_HEIGHT}
              />

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{t('xrd.peaks.title')}</h3>
                  {outcome.result.peaks.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => downloadCsv(csvName, peaksToCsv(outcome.result.peaks))}
                      className={BUTTON_CLASS}
                    >
                      {t('xrd.peaks.download')}
                    </button>
                  ) : null}
                </div>
                {outcome.result.peaks.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {t('xrd.peaks.none')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800">
                          {['position', 'spacing', 'height', 'relative', 'width', 'size'].map(
                            (column) => (
                              <th key={column} scope="col" className="px-3 py-2 text-start font-medium">
                                {t(`xrd.peaks.${column}`)}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {outcome.result.peaks.map((peak) => (
                          <tr
                            key={peak.position}
                            className="border-b border-slate-100 tabular-nums dark:border-slate-800/60"
                          >
                            <td className="px-3 py-2">{peak.position.toFixed(2)}</td>
                            <td className="px-3 py-2">{peak.d_spacing.toFixed(4)}</td>
                            <td className="px-3 py-2">{peak.height.toFixed(1)}</td>
                            <td className="px-3 py-2">{peak.relative_intensity.toFixed(1)}</td>
                            <td className="px-3 py-2">{peak.fwhm.toFixed(3)}</td>
                            <td className="px-3 py-2">
                              {peak.crystallite_size === null
                                ? '–'
                                : peak.crystallite_size.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
