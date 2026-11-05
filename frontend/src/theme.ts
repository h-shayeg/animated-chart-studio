export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'acs-theme'

export function detectTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    // Storage can be unavailable (for example in private mode), so use the system setting.
  }
  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function applyTheme(theme: Theme, persist = false): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  if (!persist) return
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // The choice is simply not remembered.
  }
}
