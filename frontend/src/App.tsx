import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { ChartStudio } from './components/ChartStudio'
import { ComingSoon } from './components/ComingSoon'
import { DataTable } from './components/DataTable'
import { Header } from './components/Header'
import { RibbonTabs } from './components/Ribbon'
import { SummaryPanel } from './components/SummaryPanel'
import { UploadPanel } from './components/UploadPanel'
import { XrdWorkspace } from './components/XrdWorkspace'
import { useDatasetStore } from './store'
import { SPECTRUM_TABS, type TabId } from './spectra/tabs'

export default function App() {
  const { t } = useTranslation()
  const dataset = useDatasetStore((state) => state.dataset)
  const [tab, setTab] = useState<TabId>('chart')
  const datasetKey = dataset
    ? `${dataset.filename}:${dataset.columns.map((column) => column.name).join('|')}`
    : ''

  const waiting = SPECTRUM_TABS.find((item) => item.id === tab && item.issue !== null)
  let soon: ReactNode = null
  if (waiting) soon = <ComingSoon tab={waiting} />

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100">
      <Header />
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <RibbonTabs active={tab} onChange={setTab} />
      </div>
      <main
        className={`mx-auto max-w-6xl px-4 pb-16 ${tab === 'chart' ? 'pt-8' : 'pt-0'}`}
      >
        <div hidden={tab !== 'chart'} className="space-y-10">
          <section className="space-y-3 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
              {t('app.title')}
            </h1>
            <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
              {t('app.tagline')}
            </p>
          </section>
          {dataset ? (
            <>
              <ChartStudio key={datasetKey} dataset={dataset} />
              {dataset.summary ? <SummaryPanel summary={dataset.summary} /> : null}
              <DataTable dataset={dataset} />
            </>
          ) : (
            <UploadPanel />
          )}
        </div>
        <div hidden={tab !== 'xrd'}>
          <XrdWorkspace />
        </div>
        {soon}
      </main>
    </div>
  )
}
