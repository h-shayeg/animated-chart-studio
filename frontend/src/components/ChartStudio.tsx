import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Dataset } from '../api'
import { buildOption } from '../chart/buildOption'
import type { ECharts } from '../chart/echartsSetup'
import { EXPORT_FORMATS, type ExportFormat } from '../chart/formats'
import { magnifierStatus, placementLimits, placementOf } from '../chart/magnifier'
import { PALETTES, PALETTE_NAMES } from '../chart/palettes'
import {
  RANGE_COLORS,
  cropMode,
  normalizeConfig,
  parseBound,
  rangesOf,
  xIsNumericAxis,
} from '../chart/ranges'
import {
  CHART_TYPES,
  defaultConfig,
  type ChartConfig,
  type ColorRange,
  type Magnifier,
  type RangeAxis,
} from '../chart/types'
import { useIsDark } from '../useIsDark'
import { ChartBoundary } from './ChartBoundary'
import { ChartView } from './ChartView'

const MIN_DURATION_MS = 300
const MAX_DURATION_MS = 30_000
const MAX_DELAY_MS = 10_000
const RANGE_AXES: RangeAxis[] = ['y', 'x']
const REST_COLOR = '#94a3b8'
const MIN_HEIGHT_PX = 240
const MAX_HEIGHT_PX = 1600
// Without a chosen height the chart fits the screen, leaving room for the page around it.
const AUTO_HEIGHT = 'clamp(20rem, calc(100svh - 9rem), 52rem)'
const MAGNIFIER_FIELDS = [
  { key: 'xFrom', hint: 'hintStart' },
  { key: 'xTo', hint: 'hintEnd' },
  { key: 'yFrom', hint: 'hintAuto' },
  { key: 'yTo', hint: 'hintAuto' },
] as const
const MAGNIFIER_MESSAGES = {
  unavailable: 'studio.magnifier.unavailable',
  needsRange: 'studio.magnifier.needsRange',
  empty: 'studio.magnifier.empty',
} as const

const BOX_FIELDS = [
  {
    label: 'boxLeft',
    limit: 'left',
    patch: (value: number): Partial<Magnifier> => ({ boxLeft: value }),
  },
  {
    label: 'boxTop',
    limit: 'top',
    patch: (value: number): Partial<Magnifier> => ({ boxTop: value }),
  },
  {
    label: 'boxWidth',
    limit: 'width',
    patch: (value: number): Partial<Magnifier> => ({ boxWidth: value }),
  },
  {
    label: 'boxHeight',
    limit: 'height',
    patch: (value: number): Partial<Magnifier> => ({ boxHeight: value }),
  },
] as const

const CARD =
  'rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/60'
const FIELD =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800'
const NUMBER_FIELD = `${FIELD} w-full min-w-0 px-2`
const ACTION =
  'rounded-full border border-slate-300 bg-white/70 px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:bg-slate-800'
const LEGEND = 'mb-2 text-sm font-semibold'
const SECTION = 'space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800'
const SUMMARY = 'cursor-pointer text-sm font-semibold'

let rangeCounter = 0

function nextRangeId(): string {
  rangeCounter += 1
  return `range-${rangeCounter}`
}

function segmentClass(selected: boolean): string {
  return `rounded-lg border px-2 py-1.5 text-sm font-medium transition ${
    selected
      ? 'border-indigo-600 bg-indigo-600 text-white'
      : 'border-slate-300 bg-white hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-800'
  }`
}

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
  const [heightPx, setHeightPx] = useState<number | null>(null)

  const option = useMemo(
    () => buildOption({ dataset, config, language: i18n.language }),
    [dataset, config, i18n.language],
  )
  const numbers = new Intl.NumberFormat(i18n.language)
  const numericColumns = dataset.columns.filter((column) => column.kind === 'numeric')
  const xKind = dataset.columns.find((column) => column.name === config.xColumn)?.kind
  const mode = cropMode(dataset, config)
  const cropped = config.cropFrom !== null || config.cropTo !== null
  const busy = progress !== null
  const chartHeight =
    heightPx === null
      ? AUTO_HEIGHT
      : `${Math.min(Math.max(heightPx, MIN_HEIGHT_PX), MAX_HEIGHT_PX)}px`
  const magnifierState = useMemo(() => magnifierStatus(dataset, config), [dataset, config])
  const placement = placementOf(config.magnifier)
  const limits = placementLimits(placement)
  // The animation of the enlarged view may last longer than the one of the main chart.
  const insetAnimates = magnifierState === 'ready' && config.magnifier.animate
  const totalAnimationMs = Math.max(
    config.animate ? config.durationMs : 0,
    insetAnimates ? config.magnifier.delayMs + config.magnifier.durationMs : 0,
  )
  const animateKey = [
    config.type,
    config.xColumn,
    config.yColumns.join('|'),
    config.stacked,
    config.magnifier.enabled,
  ].join(':')

  const update = (patch: Partial<ChartConfig>) =>
    setConfig((current) => normalizeConfig(dataset, current, { ...current, ...patch }))

  const patchMagnifier = (patch: Partial<Magnifier>) =>
    update({ magnifier: { ...config.magnifier, ...patch } })

  const toggleY = (name: string) =>
    update({
      yColumns: config.yColumns.includes(name)
        ? config.yColumns.filter((item) => item !== name)
        : [...config.yColumns, name],
    })

  const addRange = (axis: RangeAxis) =>
    update({
      ranges: [
        ...config.ranges,
        {
          id: nextRangeId(),
          from: null,
          to: null,
          axis,
          color: RANGE_COLORS[config.ranges.length % RANGE_COLORS.length] ?? '#ef4444',
        },
      ],
    })

  const updateRange = (id: string, patch: Partial<ColorRange>) =>
    update({
      ranges: config.ranges.map((range) => (range.id === id ? { ...range, ...patch } : range)),
    })

  const removeRange = (id: string) =>
    update({ ranges: config.ranges.filter((range) => range.id !== id) })

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
        durationMs: totalAnimationMs,
        onProgress: setProgress,
      })
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error))
    } finally {
      setProgress(null)
    }
  }

  let hint = t('studio.noData')
  if (config.yColumns.length === 0) hint = t('studio.needNumeric')
  else if (config.type === 'scatter' && xKind !== 'numeric') hint = t('studio.scatterNeedsNumericX')
  else if (cropped) hint = t('studio.crop.empty')

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
                className={segmentClass(config.type === type)}
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

        <details open className={SECTION}>
          <summary className={SUMMARY}>{t('studio.ranges.title')}</summary>
          {config.type === 'pie' ? (
            <p className="mt-3 text-sm text-slate-500">{t('studio.ranges.notForPie')}</p>
          ) : (
            <div className="mt-3 space-y-4">
              {RANGE_AXES.map((axis) => (
                <fieldset key={axis} className="space-y-3">
                  <legend className={LEGEND}>
                    {t(axis === 'x' ? 'studio.ranges.byX' : 'studio.ranges.byY')}
                  </legend>
                  {axis === 'x' && !xIsNumericAxis(dataset, config) ? (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {t('studio.ranges.xUnavailable')}
                    </p>
                  ) : (
                    <>
                      {rangesOf(config, axis).map((range) => (
                        <div
                          key={range.id}
                          className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2"
                        >
                          <input
                            type="number"
                            step="any"
                            aria-label={t('studio.ranges.from')}
                            value={range.from ?? ''}
                            onChange={(event) =>
                              updateRange(range.id, { from: parseBound(event.target.value) })
                            }
                            className={NUMBER_FIELD}
                          />
                          <input
                            type="number"
                            step="any"
                            aria-label={t('studio.ranges.to')}
                            value={range.to ?? ''}
                            onChange={(event) =>
                              updateRange(range.id, { to: parseBound(event.target.value) })
                            }
                            className={NUMBER_FIELD}
                          />
                          <input
                            type="color"
                            aria-label={t('studio.ranges.color')}
                            value={range.color}
                            onChange={(event) =>
                              updateRange(range.id, { color: event.target.value })
                            }
                            className="h-9 w-10 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
                          />
                          <button
                            type="button"
                            aria-label={t('studio.ranges.remove')}
                            onClick={() => removeRange(range.id)}
                            className="rounded-full px-2 text-lg leading-none text-slate-500 hover:text-rose-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addRange(axis)} className={ACTION}>
                        {t('studio.ranges.add')}
                      </button>
                    </>
                  )}
                </fieldset>
              ))}
              {xIsNumericAxis(dataset, config) &&
                rangesOf(config, 'x').length > 0 &&
                rangesOf(config, 'y').length > 0 && (
                  <p className="text-xs text-slate-500">{t('studio.ranges.priority')}</p>
                )}
              {config.ranges.length > 0 && (
                <div className="flex items-center justify-between gap-2">
                  <Toggle
                    label={t('studio.ranges.rest')}
                    checked={config.restColor !== null}
                    onChange={(on) => update({ restColor: on ? REST_COLOR : null })}
                  />
                  {config.restColor !== null && (
                    <input
                      type="color"
                      aria-label={t('studio.ranges.restColor')}
                      value={config.restColor}
                      onChange={(event) => update({ restColor: event.target.value })}
                      className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-300 bg-transparent p-0.5 dark:border-slate-700"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </details>

        <details open className={SECTION}>
          <summary className={SUMMARY}>{t('studio.crop.title')}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">
              {t(mode === 'x' ? 'studio.crop.helpX' : 'studio.crop.helpRows')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                aria-label={t(mode === 'x' ? 'studio.crop.xFrom' : 'studio.crop.rowFrom')}
                value={config.cropFrom ?? ''}
                onChange={(event) => update({ cropFrom: parseBound(event.target.value) })}
                className={NUMBER_FIELD}
              />
              <input
                type="number"
                step="any"
                aria-label={t(mode === 'x' ? 'studio.crop.xTo' : 'studio.crop.rowTo')}
                value={config.cropTo ?? ''}
                onChange={(event) => update({ cropTo: parseBound(event.target.value) })}
                className={NUMBER_FIELD}
              />
            </div>
            <button
              type="button"
              disabled={!cropped}
              onClick={() => update({ cropFrom: null, cropTo: null })}
              className={ACTION}
            >
              {t('studio.crop.reset')}
            </button>
            {config.type !== 'pie' && (
              <Toggle
                label={t('studio.crop.zoomSlider')}
                checked={config.zoomSlider}
                onChange={(zoomSlider) => update({ zoomSlider })}
              />
            )}
          </div>
        </details>

        <details open className={SECTION}>
          <summary className={SUMMARY}>{t('studio.magnifier.title')}</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">{t('studio.magnifier.help')}</p>
            <Toggle
              label={t('studio.magnifier.enable')}
              checked={config.magnifier.enabled}
              onChange={(enabled) => patchMagnifier({ enabled })}
            />
            {config.magnifier.enabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {MAGNIFIER_FIELDS.map((field) => (
                    <input
                      key={field.key}
                      type="number"
                      step="any"
                      aria-label={t(`studio.magnifier.${field.key}`)}
                      placeholder={t(`studio.magnifier.${field.hint}`)}
                      value={config.magnifier[field.key] ?? ''}
                      onChange={(event) =>
                        update({
                          magnifier: {
                            ...config.magnifier,
                            [field.key]: parseBound(event.target.value),
                          },
                        })
                      }
                      className={NUMBER_FIELD}
                    />
                  ))}
                </div>
                {magnifierState !== 'ready' && magnifierState !== 'off' && (
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    {t(MAGNIFIER_MESSAGES[magnifierState])}
                  </p>
                )}

                <fieldset className="space-y-2">
                  <legend className={LEGEND}>{t('studio.magnifier.box')}</legend>
                  {BOX_FIELDS.map((field) => {
                    const [low, high] = limits[field.limit]
                    return (
                      <label key={field.label} className="block text-xs">
                        <span className="mb-1 block">
                          {t(`studio.magnifier.${field.label}`)}:{' '}
                          {t('studio.magnifier.percent', {
                            value: numbers.format(Math.round(placement[field.limit])),
                          })}
                        </span>
                        <input
                          type="range"
                          min={low}
                          max={high}
                          step={1}
                          aria-label={t(`studio.magnifier.${field.label}`)}
                          value={placement[field.limit]}
                          onChange={(event) =>
                            patchMagnifier(field.patch(Number(event.target.value)))
                          }
                          className="w-full accent-indigo-600"
                        />
                      </label>
                    )
                  })}
                </fieldset>

                <fieldset className="space-y-2">
                  <legend className={LEGEND}>{t('studio.magnifier.animation')}</legend>
                  <Toggle
                    label={t('studio.magnifier.animate')}
                    checked={config.magnifier.animate}
                    onChange={(animate) => patchMagnifier({ animate })}
                  />
                  <label className="block text-xs">
                    <span className="mb-1 block">
                      {t('studio.magnifier.duration')}:{' '}
                      {numbers.format(config.magnifier.durationMs / 1000)} {t('studio.seconds')}
                    </span>
                    <input
                      type="range"
                      min={MIN_DURATION_MS}
                      max={MAX_DURATION_MS}
                      step={100}
                      aria-label={t('studio.magnifier.duration')}
                      value={config.magnifier.durationMs}
                      disabled={!config.magnifier.animate}
                      onChange={(event) => patchMagnifier({ durationMs: Number(event.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                  <label className="block text-xs">
                    <span className="mb-1 block">
                      {t('studio.magnifier.delay')}:{' '}
                      {numbers.format(config.magnifier.delayMs / 1000)} {t('studio.seconds')}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={MAX_DELAY_MS}
                      step={100}
                      aria-label={t('studio.magnifier.delay')}
                      value={config.magnifier.delayMs}
                      disabled={!config.magnifier.animate}
                      onChange={(event) => patchMagnifier({ delayMs: Number(event.target.value) })}
                      className="w-full accent-indigo-600"
                    />
                  </label>
                </fieldset>
              </>
            )}
          </div>
        </details>

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

        <div className="text-sm">
          <span className="mb-1 block font-semibold">{t('studio.height')}</span>
          <div className="flex gap-2">
            <input
              type="number"
              min={MIN_HEIGHT_PX}
              max={MAX_HEIGHT_PX}
              step={20}
              aria-label={t('studio.height')}
              placeholder={t('studio.heightAuto')}
              value={heightPx ?? ''}
              onChange={(event) => setHeightPx(parseBound(event.target.value))}
              className={NUMBER_FIELD}
            />
            <button
              type="button"
              disabled={heightPx === null}
              onClick={() => setHeightPx(null)}
              className={`${ACTION} whitespace-nowrap`}
            >
              {t('studio.heightFit')}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <button
            type="button"
            disabled={totalAnimationMs === 0 || option === null || busy}
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
                ? t('studio.recording', {
                    percent: numbers.format(Math.round((progress ?? 0) * 100)),
                  })
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

      <div className={`${CARD} flex min-w-0 self-start p-4 lg:sticky lg:top-20`}>
        {option ? (
          <ChartBoundary resetKey={option} title={t('studio.chartFailed')}>
            <ChartView
              option={option}
              animateKey={animateKey}
              animationMs={totalAnimationMs}
              dark={dark}
              replayToken={replayToken}
              label={t('studio.chartLabel')}
              height={chartHeight}
              onReady={setChart}
            />
          </ChartBoundary>
        ) : (
          <p
            role="status"
            style={{ height: chartHeight }}
            className="grid flex-1 place-items-center px-6 text-center text-slate-500"
          >
            {hint}
          </p>
        )}
      </div>
    </section>
  )
}
