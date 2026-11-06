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

export async function parseDataset(file: File): Promise<Dataset> {
  const body = new FormData()
  body.append('file', file)

  const response = await fetch('/api/v1/datasets/parse', { method: 'POST', body })
  if (!response.ok) {
    const detail = await readDetail(response)
    throw new ApiError(detail ?? `Request failed with status ${response.status}`, response.status)
  }
  return (await response.json()) as Dataset
}
