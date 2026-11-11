import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import type { XrdIdentifyResult, XrdPhaseMatch } from '../api'
import type { ECharts } from '../chart/echartsSetup'
import {
  buildXrdOption,
  hklText,
  peaksToCsv,
  type XrdOutcome,
  type XrdView,
} from '../chart/xrd'
import {
  XRD_PICTURE_FORMATS,
  xrdPictureOption,
  zoomWindowOf,
  type XrdPictureFormat,
} from '../chart/xrdExport'
import { useIsDark } from '../useIsDark'
import { XrdChart } from './XrdChart'

const CHART_HEIGHT = '26rem'
const VIEWS: XrdView[] = ['original', 'corrected']
const BUTTON_CLASS =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition aria-pressed:border-indigo-500 aria-pressed:bg-indigo-500 aria-pressed:text-white disabled:opacity-60 dark:border-slate-700'
const SELECT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900'
const COLUMNS = ['position', 'hkl', 'spacing', 'height', 'relative', 'width', 'size']

function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

interface MaterialCardProps {
  identification: XrdIdentifyResult | null
  identifying: boolean
  error: string | null
}

function describe(phase: XrdPhaseMatch): string {
  return `${phase.name} (${phase.formula})`
}

function MaterialCard({ identification, identifying, error }: MaterialCardProps) {
  const { t } = useTranslation()
  let body: ReactNode = null
  if (identifying) {
    body = <p className="text-sm">{t('xrd.identify.working')}</p>
  } else if (error) {
    body = <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>
  } else if (identification && identification.phases.length === 0) {
    body = <p className="text-sm">{t('xrd.identify.none')}</p>
  } else if (identification) {
    const { phases, assignments } = identification
    const used = [...new Set(assignments.map((item) => item.phase_index))].sort((a, b) => a - b)
    const found = used
      .map((index) => phases[index])
      .filter((phase): phase is XrdPhaseMatch => phase !== undefined)
    const others = phases.filter((_, index) => !used.includes(index))
    body = (
      <>
        <ul className="space-y-1">
          {found.map((phase) => (
            <li key={`${phase.name}-${phase.space_group}`} className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-semibold">{describe(phase)}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400" dir="ltr">
                {phase.space_group}
              </span>
              <span className="text-sm font-medium text-indigo-600 dark:text-indigo-300">
                {t('xrd.identify.score', { score: Math.round(phase.score * 100) })}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t('xrd.identify.matched', { count: assignments.length })}
        </p>
        {others.length > 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('xrd.identify.others')}:{' '}
            {others.map((phase) => `${describe(phase)} ${Math.round(phase.score * 100)}%`).join('، ')}
          </p>
        ) : null}
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('xrd.identify.note')}</p>
      </>
   )
  }
  if (body === null) return null
  return (
    <div className="space-y-2 rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900 dark:bg-indigo-950/40">
      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
        {t('xrd.identify.title')}
      </h3>
      {body}
    </div>
  )
}

interface XrdResultsProps {
  outcome: XrdOutcome
  csvName: string
  // The name of a saved picture of the chart, without its ending.
  pictureName: string
  identification: XrdIdentifyResult | null
  identifying: boolean
  identifyError: string | null
}

export function XrdResults({
  outcome,
  csvName,
  pictureName,
  identification,
  identifying,
  identifyError,
}: XrdResultsProps) {
  const { t } = useTranslation()
  const dark = useIsDark()
  const [view, setView] = useState<XrdView>('original')
  const [chart, setChart] = useState<ECharts | null>(null)
  const [format, setFormat] = useState<XrdPictureFormat>('png')
  const [pictureError, setPictureError] = useState<string | null>(null)
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
  const peaks = outcome.result.peaks
  const hkl = useMemo(() => {
    const byPeak = new Map<number, string>()
    for (const item of identification?.assignments ?? []) {
      byPeak.set(item.peak_index, hklText(item.hkl))
    }
    return peaks.map((_, index) => byPeak.get(index) ?? null)
  }, [identification, peaks])
  const chartOption = useMemo(
    () => buildXrdOption(outcome.result, outcome.raw, view, labels, hkl),
    [outcome, view, labels, hkl],
  )

  const savePicture = async () => {
    if (!chart) return
    setPictureError(null)
    try {
      const { exportPicture } = await import('../chart/exportChart')
      const frame = chart.getDom()
      exportPicture(format, {
        option: xrdPictureOption(chartOption, zoomWindowOf(chart)),
        width: frame.clientWidth,
        height: frame.clientHeight,
        title: pictureName,
        dark,
      })
    } catch (error) {
      setPictureError(error instanceof Error ? error.message : String(error))
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/60">
      <MaterialCard identification={identification} identifying={identifying} error={identifyError} />

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
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <select
            aria-label={t('xrd.picture.format')}
            value={format}
            onChange={(event) => setFormat(event.target.value as XrdPictureFormat)}
            className={SELECT_CLASS}
          >
            {XRD_PICTURE_FORMATS.map((item) => (
              <option key={item} value={item}>
                {t(`studio.formats.${item}`)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={chart === null}
            onClick={() => void savePicture()}
            className={BUTTON_CLASS}
          >
            {t('xrd.picture.save')}
          </button>
        </div>
      </div>
      {pictureError ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {t('xrd.picture.failed')} {pictureError}
        </p>
      ) : null}

      <XrdChart
        option={chartOption}
        label={t('xrd.chartLabel')}
        height={CHART_HEIGHT}
        onReady={setChart}
      />

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">{t('xrd.peaks.title')}</h3>
          {peaks.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadCsv(csvName, peaksToCsv(peaks, identification ? hkl : undefined))}
              className={BUTTON_CLASS}
            >
              {t('xrd.peaks.download')}
            </button>
          ) : null}
        </div>
        {peaks.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{t('xrd.peaks.none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {COLUMNS.map((column) => (
                    <th key={column} scope="col" className="px-3 py-2 text-start font-medium">
                      {t(`xrd.peaks.${column}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {peaks.map((peak, index) => (
                  <tr
                    key={peak.position}
                    className="border-b border-slate-100 tabular-nums dark:border-slate-800/60"
                  >
                    <td className="px-3 py-2">{peak.position.toFixed(2)}</td>
                    <td className="px-3 py-2" dir="ltr">
                      {hkl[index] ?? '–'}
                    </td>
                    <td className="px-3 py-2">{peak.d_spacing.toFixed(4)}</td>
                    <td className="px-3 py-2">{peak.height.toFixed(1)}</td>
                    <td className="px-3 py-2">{peak.relative_intensity.toFixed(1)}</td>
                    <td className="px-3 py-2">{peak.fwhm.toFixed(3)}</td>
                    <td className="px-3 py-2">
                      {peak.crystallite_size === null ? '–' : peak.crystallite_size.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  </section>
  )
}
