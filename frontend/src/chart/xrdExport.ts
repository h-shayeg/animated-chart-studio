import type { XrdOption } from './xrd'

export const XRD_PICTURE_FORMATS = ['png', 'jpeg', 'svg'] as const

export type XrdPictureFormat = (typeof XRD_PICTURE_FORMATS)[number]

// The part of the pattern on screen, in percent of its whole range.
export interface ZoomWindow {
  start: number
  end: number
}

// Room under the plot for the axis labels and the axis name, once the zoom slider is gone.
const GRID_BOTTOM = 56

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Reads from a drawn chart how far it is zoomed in. Null means the whole pattern is on screen.
export function zoomWindowOf(chart: { getOption: () => unknown }): ZoomWindow | null {
  const option = chart.getOption()
  const zooms = isRecord(option) && Array.isArray(option.dataZoom) ? option.dataZoom : []
  const zoom: unknown = zooms[0]
  if (!isRecord(zoom)) return null
  const { start, end } = zoom
  if (typeof start !== 'number' || typeof end !== 'number') return null
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return start <= 0 && end >= 100 ? null : { start, end }
}

// The chart as a picture: what is on screen, zoomed in the same way, drawn at once and
// without the zoom slider under it.
export function xrdPictureOption(option: XrdOption, zoom: ZoomWindow | null): XrdOption {
  const grid = isRecord(option.grid) ? option.grid : {}
  return {
    ...option,
    animation: false,
    grid: { ...grid, bottom: GRID_BOTTOM },
    dataZoom: zoom === null ? [] : [{ type: 'inside', start: zoom.start, end: zoom.end }],
  }
}
