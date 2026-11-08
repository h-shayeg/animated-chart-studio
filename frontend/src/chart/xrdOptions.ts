import type { XrdOptions } from '../api'

export type BaselineMethod = XrdOptions['baseline_method']

export type FieldId =
  | 'smoothing'
  | 'baselineWindow'
  | 'prominence'
  | 'distance'
  | 'wavelength'
  | 'shape'
  | 'instrument'

export const INITIAL_VALUES: Record<FieldId, string> = {
  smoothing: '9',
  baselineWindow: '5',
  prominence: '3',
  distance: '0.2',
  wavelength: '1.5406',
  shape: '0.9',
  instrument: '0',
}

// Turns what was typed into the options of the analysis, or null when a field is not a number.
export function readOptions(
  values: Record<FieldId, string>,
  baseline: BaselineMethod,
): XrdOptions | null {
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
