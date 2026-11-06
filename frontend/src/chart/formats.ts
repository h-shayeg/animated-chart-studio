export const EXPORT_FORMATS = ['png', 'jpeg', 'svg', 'webm'] as const

export type ExportFormat = (typeof EXPORT_FORMATS)[number]
