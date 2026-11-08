export type ColumnKind = 'numeric' | 'datetime' | 'boolean' | 'text'

export interface ColumnInfo {
  name: string
  kind: ColumnKind
  missing: number
}

export interface Dataset {
  filename: string
  rows: number
  columns: ColumnInfo[]
  data: Record<string, unknown>[]
}

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function readDetail(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json()
    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail
    }
  } catch {
    // The body was not JSON, so the caller falls back to the status code.
  }
  return undefined
}

export async function parseDataset(file: File, header = true): Promise<Dataset> {
  const body = new FormData()
  body.append('file', file)
  body.append('header', String(header))

  const response = await fetch('/api/v1/datasets/parse', { method: 'POST', body })
  if (!response.ok) {
    const detail = await readDetail(response)
    throw new ApiError(detail ?? `Request failed with status ${response.status}`, response.status)
  }
  return (await response.json()) as Dataset
}

export interface XrdOptions {
  wavelength: number
  smoothing_window: number
  baseline_method: 'none' | 'snip'
  baseline_window: number
  min_prominence: number
  min_distance: number
  shape_factor: number
  instrument_broadening: number
}

export interface XrdPeak {
  position: number
  d_spacing: number
  height: number
  relative_intensity: number
  fwhm: number
  crystallite_size: number | null
}

export interface XrdResult {
  two_theta: number[]
  smoothed: number[]
  baseline: number[]
  corrected: number[]
  peaks: XrdPeak[]
}

export async function analyzeXrd(
  twoTheta: number[],
  intensity: number[],
  options: XrdOptions,
): Promise<XrdResult> {
  const response = await fetch('/api/v1/xrd/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ two_theta: twoTheta, intensity, ...options }),
  })
  if (!response.ok) {
    const detail = await readDetail(response)
    throw new ApiError(detail ?? `Request failed with status ${response.status}`, response.status)
  }
  return (await response.json()) as XrdResult
}
