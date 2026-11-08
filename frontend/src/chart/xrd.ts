import type { Dataset, XrdPeak, XrdResult } from '../api'

export type XrdView = 'original' | 'corrected'

export interface Pattern {
  twoTheta: number[]
  intensity: number[]
}

export interface XrdLabels {
  raw: string
  smoothed: string
  baseline: string
  corrected: string
  peaks: string
  xAxis: string
  yAxis: string
}

export interface XrdSeries extends Record<string, unknown> {
  type: 'line' | 'scatter'
  name: string
  data: unknown[]
}

export interface XrdOption extends Record<string, unknown> {
  series: XrdSeries[]
}

const ANIMATION_MS = 1200
const COLORS = {
  raw: '#94a3b8',
  smoothed: '#6366f1',
  baseline: '#f59e0b',
  corrected: '#6366f1',
  peaks: '#ef4444',
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

// Reads the two columns, skips rows where either value is missing and sorts by angle.
export function extractPattern(dataset: Dataset, xColumn: string, yColumn: string): Pattern {
  const pairs: [number, number][] = []
  for (const row of dataset.data) {
    const x = toNumber(row[xColumn])
    const y = toNumber(row[yColumn])
    if (x !== null && y !== null) pairs.push([x, y])
  }
  pairs.sort((a, b) => a[0] - b[0])
  return {
    twoTheta: pairs.map(([x]) => x),
    intensity: pairs.map(([, y]) => y),
  }
}

// The baseline height under a peak, found between the two nearest points of the curve.
export function baselineAt(result: Pick<XrdResult, 'two_theta' | 'baseline'>, position: number): number {
  const angles = result.two_theta
  const baseline = result.baseline
  const index = angles.findIndex((angle) => angle >= position)
  if (index === -1) return baseline[baseline.length - 1] ?? 0
  if (index === 0) return baseline[0] ?? 0
  const x0 = angles[index - 1] ?? 0
  const x1 = angles[index] ?? 0
  const y0 = baseline[index - 1] ?? 0
  const y1 = baseline[index] ?? 0
  const span = x1 - x0
  return span === 0 ? y1 : y0 + ((position - x0) / span) * (y1 - y0)
}

function round(value: number): number {
  return Number(value.toFixed(4))
}

export function peaksToCsv(peaks: XrdPeak[]): string {
  const header = '2theta_deg,d_angstrom,height,relative_percent,fwhm_deg,crystallite_size_nm'
  const rows = peaks.map((peak) =>
    [
      round(peak.position),
      round(peak.d_spacing),
      round(peak.height),
      round(peak.relative_intensity),
      round(peak.fwhm),
      peak.crystallite_size === null ? '' : round(peak.crystallite_size),
    ].join(','),
  )
  return [header, ...rows].join('\n')
}

function line(
  name: string,
  angles: number[],
  values: number[],
  color: string,
  width: number,
  dashed = false,
): XrdSeries {
  return {
    type: 'line',
    name,
    showSymbol: false,
    sampling: 'lttb',
    animationDuration: ANIMATION_MS,
    data: angles.map((angle, index) => [angle, values[index] ?? 0]),
    lineStyle: { color, width, type: dashed ? 'dashed' : 'solid' },
    itemStyle: { color },
  }
}

function peakSeries(result: XrdResult, view: XrdView, name: string): XrdSeries {
  return {
    type: 'scatter',
    name,
    symbol: 'triangle',
    symbolSize: 11,
    symbolRotate: 180,
    z: 10,
    itemStyle: { color: COLORS.peaks },
    label: { show: true, position: 'top', formatter: '{b}', fontSize: 11 },
    data: result.peaks.map((peak) => ({
      name: peak.position.toFixed(2),
      value: [
        peak.position,
        view === 'original' ? peak.height + baselineAt(result, peak.position) : peak.height,
      ],
    })),
  }
}

export function buildXrdOption(
  result: XrdResult,
  raw: number[],
  view: XrdView,
  labels: XrdLabels,
): XrdOption {
  const angles = result.two_theta
  const curves =
    view === 'corrected'
      ? [line(labels.corrected, angles, result.corrected, COLORS.corrected, 1.6)]
      : [
          line(labels.raw, angles, raw, COLORS.raw, 1),
          line(labels.smoothed, angles, result.smoothed, COLORS.smoothed, 1.6),
          line(labels.baseline, angles, result.baseline, COLORS.baseline, 1.4, true),
        ]
  return {
    backgroundColor: 'transparent',
    animationDuration: ANIMATION_MS,
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    legend: { top: 8 },
    grid: { left: 64, right: 28, top: 56, bottom: 96 },
    xAxis: { type: 'value', name: labels.xAxis, nameLocation: 'middle', nameGap: 30, scale: true },
    yAxis: { type: 'value', name: labels.yAxis, nameLocation: 'middle', nameGap: 48 },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 22, bottom: 28 }],
    series: [...curves, peakSeries(result, view, labels.peaks)],
  }
}

export interface XrdOutcome {
  result: XrdResult
  raw: number[]
}
