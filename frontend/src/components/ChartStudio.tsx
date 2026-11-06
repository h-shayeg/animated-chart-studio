import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Dataset } from '../api'
import { buildOption } from '../chart/buildOption'
import type { ECharts } from '../chart/echartsSetup'
import { EXPORT_FORMATS, type ExportFormat } from '../chart/formats'
import { PALETTES, PALETTE_NAMES } from '../chart/palettes'
import { CHART_TYPES, defaultConfig, type ChartConfig } from '../chart/types'
import { useIsDark } from '../useIsDark'
import { ChartView } from './ChartView'

const MIN_DURATION_MS = 300
const MAX_DURATION_MS = 30_000

const CARD =
  'rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60'
const FIELD =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'
const ACTION =
  'rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800'
const LEGEND = 'mb-2 text-sm font-semibold'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-indigo-600"
      />
      {label}
    </label>
  )
}

export function ChartStudio({ dataset }: { dataset: Dataset }) {
  const { t, i18n } = useTranslation()
  const dark = useIsDark()
  const [config, setConfig] = useState(() => defaultConfig(dataset))
  const [replayToken, setReplayToken] = useState(0)
  const [chart, setChart] = useState<ECharts | null>(null)
  const [format, setFormat] = useState<ExportFormat>('png')
  const [progress, setProgress] = useState<number | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const option = useMemo(
    () => buildOption({ dataset, config, language: i18n.language }),
    [dataset, config, i18n.language],
  )
  const numbers = new Intl.NumberFormat(i18n.language)
  const numericColumns = dataset.columns.filter((column) => column.kind === 'numeric')
  const xKind = dataset.columns.find((column) => column.name === config.xColumn)?.kind
  const busy = progress !== null
  const animateKey = [config.type, config.xColumn, config.yColumns.join('|'), config.stacked].join(
    ':',
  )

  const update = (patch: Partial<ChartConfig>) =>
    setConfig((current) => ({ ...current, ...patch }))

  const toggleY = (name: string) =>
    update({
      yColumns: config.yColumns.includes(name)
        ? config.yColumns.filter((item) => item !== name)
        : [...config.yColumns, name],
    })

  const runExport = async () => {
    if (!chart || !option) return
    setExportError(null)
    setProgress(0)
    try {
      const { exportChart } = await import('../chart/exportChart')
      await exportChart(format, {
        chart,
        option,
        title: config.title,
        dark,
        durationMs: config.durationMs,
        onProgress: setProgress,
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setProgress(null)
    }
  }

  const hint =
    config.yColumns.length === 0
      ? t('studio.needNumeric')
      : config.type === 'scatter' && xKind !== 'numeric'
        ? t('studio.scatterNeedsNumericX')
        : t('studio.noData')

  return (
    <section className="grid gap-6 lg:grid-cols-[20rem_1fr]">
      <aside className={`${CARD} space-y-5 p-5`}>
        <h2 className="text-lg font-bold">{t('studio.title')}</h2>

        <fieldset>
          <legend className={LEGEND}>{t('studio.type')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {CHART_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={config.type === type}
                onClick={() => update({ type })}
                className={`rounded-lg border px-2 py-1.5 text-sm font-medium transition ${
                  config.type === type
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800'
                }`}
              >
                {t(`studio.types.${type}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t('studio.xAxis')}</span>
          <select
            value={config.xColumn}
            onChange={(event) => update({ xColumn: event.target.value })}
            className={`${FIELD} w-full`}
          >
            {dataset.columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-2">
          <legend className={LEGEND}>{t('studio.yAxis')}</legend>
          {numericColumns.map((column) => (
            <Toggle
              key={column.name}
              label={column.name}
              checked={config.yColumns.includes(column.name)}
              onChange={() => toggleY(column.name)}
            />
          ))}
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold">{t('studio.chartTitle')}</span>
          <input
            type="text"
            value={config.title}
            onChange={(event) => update({ title: event.target.value })}
            className={`${FIELD} w-full`}
          />
        </label>

        <fieldset>
          <legend className={LEGEND}>{t('studio.palette')}</legend>
          <div className="flex gap-2">
            {PALETTE_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                aria-label={t(`studio.palettes.${name}`)}
                aria-pressed={config.palette === name}
                onClick={() => update({ palette: name })}
                className={`flex h-8 flex-1 overflow-hidden rounded-lg ring-2 ${
                  config.palette === name ? 'ring-indigo-500' : 'ring-transparent'
                }`}
              >
                {PALETTES[name].slice(0, 4).map((color) => (
                  <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                ))}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-2">
          {(config.type === 'line' || config.type === 'area') && (
            <Toggle
              label={t('studio.smooth')}
              checked={config.smooth}
              onChange={(smooth) => update({ smooth })}
            />
          )}
          {(config.type === 'bar' || config.type === 'area') && (
            <Toggle
              label={t('studio.stacked')}
              checked={config.stacked}
              onChange={(stacked) => update({ stacked })}
            />
          )}
          <Toggle
            label={t('studio.animate')}
            checked={config.animate}
            onChange={(animate) => update({ animate })}
          />
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-semibold">
            {t('studio.duration')}: {numbers.format(config.durationMs / 1000)} {t('studio.seconds')}
          </span>
          <input
            type="range"
            min={MIN_DURATION_MS}
            max={MAX_DURATION_MS}
            step={100}
            value={config.durationMs}
            disabled={!config.animate}
            onChange={(event) => update({ durationMs: Number(event.target.value) })}
            className="w-full accent-indigo-600"
          />
        </label>

        <div className="space-y-3">
          <button
            type="button"
            disabled={!config.animate || option === null || busy}
            onClick={() => setReplayToken((token) => token + 1)}
            className={ACTION}
          >
            {t('studio.replay')}
          </button>
          <div className="flex gap-2">
            <select
              aria-label={t('studio.formatLabel')}
              value={format}
              disabled={busy}
              onChange={(event) => setFormat(event.target.value as ExportFormat)}
              className={`${FIELD} min-w-0 flex-1`}
            >
              {EXPORT_FORMATS.map((item) => (
                <option key={item} value={item}>
                  {t(`studio.formats.${item}`)}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={chart === null || option === null || busy}
              onClick={() => void runExport()}
              className={`${ACTION} whitespace-nowrap`}
            >
              {busy && format === 'webm'
                ? t('studio.recording', { percent: numbers.format(Math.round((progress ?? 0) * 100)) })
                : t('studio.export')}
            </button>
          </div>
          {exportError && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {t('studio.exportFailed')} {exportError}
            </p>
          )}
        </div>
      </aside>

      <div className={`${CARD} flex p-4`}>
        {option ? (
          <ChartView
            option={option}
            animateKey={animateKey}
            dark={dark}
            replayToken={replayToken}
            label={t('studio.chartLabel')}
            onReady={setChart}
          />
        ) : (
          <p
            role="status"
            className="grid min-h-112 flex-1 place-items-center px-6 text-center text-slate-500"
          >
            {hint}
          </p>
        )}
      </div>
    </section>
  )
}
