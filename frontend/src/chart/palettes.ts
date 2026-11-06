export const PALETTES = {
  indigo: ['#4f46e5', '#06b6d4', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6'],
  sunset: ['#f97316', '#ef4444', '#eab308', '#ec4899', '#a855f7', '#fb7185'],
  ocean: ['#0ea5e9', '#14b8a6', '#6366f1', '#22d3ee', '#3b82f6', '#2dd4bf'],
  forest: ['#16a34a', '#65a30d', '#0d9488', '#ca8a04', '#15803d', '#84cc16'],
} as const

export type PaletteName = keyof typeof PALETTES

export const PALETTE_NAMES = Object.keys(PALETTES) as PaletteName[]
