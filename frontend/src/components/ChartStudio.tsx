import type * as echarts from 'echarts/core'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Dataset } from '../api'
import { buildOption } from '../chart/buildOption'
import { PALETTES, PALETTE_NAMES } from '../chart/palettes'
import { CHART_TYPES, defaultConfig, type ChartConfig } from '../chart/types'
import { useIsDark } from '../useIsDark'
import { ChartView } from './ChartView'

const CARD =
  'rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60'
const FIELD =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'
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
  const [chart, setChart] = useState<echarts.ECharts | null>(null)

  const option = useMemo(
    () => buildOption({ dataset, config, language: i18n.language }),
    [dataset, config, i18n.language],
  )
  const numbers = new Intl.NumberFormat(i18n.language)
  const numericColumns = dataset.columns.filter((column) => column.kind === 'numeric')
  const xKind = dataset.columns.find((column) => column.name === config.xColumn)?.kind

  const update = (patch: Partial<ChartConfig>) =>
    setConfig((current) => ({ ...current, ...patch }))

  const toggleY = (name: string) =>
    update({
      yColumns: config.yColumns.includes(name)
        ? config.yColumns.filter((item) => item !== name)
        : [...config.yColumns, name],
    })

  const download = () => {
    if (!chart) return
    const link = document.createElement('a')
    link.href = chart.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: dark ? '#0f172a' : '#ffffff',
    })
    link.download = `${config.title || 'chart'}.png`
    link.click()
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
            className={FIELD}
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
            className={FIELD}
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
            min={300}
            max={3000}
            step={100}
            value={config.durationMs}
            disabled={!config.animate}
            onChange={(event) => update({ durationMs: Number(event.target.value) })}
            className="w-full accent-indigo-600"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!config.animate || option === null}
            onClick={() => setReplayToken((token) => token + 1)}
            className={ACTION}
          >
            {t('studio.replay')}
          </button>
          <button type="button" disabled={chart === null} onClick={download} className={ACTION}>
            {t('studio.download')}
          </button>
        </div>
      </aside>

      <div className={`${CARD} p-4`}>
        {option ? (
          <ChartView
            option={option}
            dark={dark}
            replayToken={replayToken}
            label={t('studio.chartLabel')}
            onReady={setChart}
          />
        ) : (
          <p role="status" className="grid h-112 place-items-center px-6 text-center text-slate-500">
            {hint}
          </p>
        )}
      </div>
    </section>
  )
}
