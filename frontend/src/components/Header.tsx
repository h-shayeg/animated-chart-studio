import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { applyLanguage, type Language } from '../i18n'
import { applyTheme, currentTheme, type Theme } from '../theme'

type BackendStatus = 'loading' | 'online' | 'offline'

const STATUS_DOT: Record<BackendStatus, string> = {
  loading: 'bg-amber-400',
  online: 'bg-emerald-500',
  offline: 'bg-rose-500',
}

const BUTTON_CLASS =
  'rounded-full border border-slate-300 bg-white/70 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800'

function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>('loading')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/health', { signal: controller.signal })
      .then((response) => setStatus(response.ok ? 'online' : 'offline'))
      .catch(() => {
        if (!controller.signal.aborted) setStatus('offline')
      })
    return () => controller.abort()
  }, [])

  return status
}

function BackendBadge() {
  const { t } = useTranslation()
  const status = useBackendStatus()

  return (
    <span
      data-testid="backend-status"
      className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400"
    >
      <span className={`size-2 rounded-full ${STATUS_DOT[status]}`} aria-hidden="true" />
      {t('backend.label')}: {t(`backend.${status}`)}
    </span>
  )
}

function LanguageToggle() {
  const { t, i18n } = useTranslation()
  const next: Language = i18n.language === 'fa' ? 'en' : 'fa'

  return (
    <button
      type="button"
      className={BUTTON_CLASS}
      onClick={() => {
        void i18n.changeLanguage(next)
        applyLanguage(next, true)
      }}
    >
      {t('language.switchTo')}
    </button>
  )
}

function ThemeToggle() {
  const { t } = useTranslation()
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={BUTTON_CLASS}
      onClick={() => {
        applyTheme(next, true)
        setTheme(next)
      }}
    >
      {t(next === 'dark' ? 'theme.toDark' : 'theme.toLight')}
    </button>
  )
}

export function Header() {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 24 24" className="size-9" aria-hidden="true">
          <rect width="24" height="24" rx="6" className="fill-indigo-600" />
          <path
            d="M7 16v-4M12 16V8M17 16v-6"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <BackendBadge />
      </div>
      <div className="flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </header>
  )
}
