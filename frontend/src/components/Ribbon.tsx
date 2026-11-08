import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { TAB_IDS, type TabId } from '../spectra/tabs'

interface RibbonTabsProps {
  active: TabId
  onChange: (id: TabId) => void
}

// The strip of tabs along the top, like the tabs of Excel's ribbon.
export function RibbonTabs({ active, onChange }: RibbonTabsProps) {
  const { t } = useTranslation()
  const buttons = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let step = 0
    if (event.key === 'ArrowRight') step = 1
    if (event.key === 'ArrowLeft') step = -1
    if (step === 0) return
    event.preventDefault()
    const direction = document.documentElement.dir === 'rtl' ? -step : step
    const index = (TAB_IDS.indexOf(active) + direction + TAB_IDS.length) % TAB_IDS.length
    const next = TAB_IDS[index]
    if (next === undefined) return
    onChange(next)
    buttons.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label={t('spectra.tabsLabel')}
      onKeyDown={onKeyDown}
      className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800"
    >
      {TAB_IDS.map((id) => (
        <button
          key={id}
          ref={(element) => {
            buttons.current[id] = element
          }}
          id={`tab-${id}`}
          type="button"
          role="tab"
          aria-selected={active === id}
          tabIndex={active === id ? 0 : -1}
          onClick={() => onChange(id)}
          className="-mb-px rounded-t-lg border border-transparent px-4 py-2 text-sm font-medium whitespace-nowrap text-slate-600 transition hover:text-slate-900 aria-selected:border-slate-200 aria-selected:border-b-slate-50 aria-selected:bg-slate-50 aria-selected:text-indigo-600 dark:text-slate-400 dark:hover:text-slate-100 dark:aria-selected:border-slate-800 dark:aria-selected:border-b-slate-900 dark:aria-selected:bg-slate-900/60 dark:aria-selected:text-indigo-300"
        >
          {t(`spectra.tabs.${id}`)}
        </button>
      ))}
    </div>
  )
}

// The band of tools under the tabs. Each tool group has its name at the bottom.
export function RibbonPanel({ tab, children }: { tab: TabId; children: ReactNode }) {
  return (
    <div
      role="tabpanel"
      aria-labelledby={`tab-${tab}`}
      className="flex flex-wrap items-stretch rounded-b-xl border border-t-0 border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60"
    >
      {children}
    </div>
  )
}

export function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col justify-between gap-2 border-e border-slate-200 px-4 py-3 last:border-e-0 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      <span className="text-center text-xs text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  )
}

export function RibbonField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex max-w-32 flex-col gap-1 text-xs">
      <span>{label}</span>
      {children}
    </label>
  )
}
