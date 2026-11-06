import { useTranslation } from 'react-i18next'

import { ChartStudio } from './components/ChartStudio'
import { DataTable } from './components/DataTable'
import { Header } from './components/Header'
import { UploadPanel } from './components/UploadPanel'
import { useDatasetStore } from './store'

export default function App() {
  const { t } = useTranslation()
  const dataset = useDatasetStore((state) => state.dataset)
  const datasetKey = dataset
    ? `${dataset.filename}:${dataset.columns.map((column) => column.name).join('|')}`
    : ''

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-indigo-50 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950 dark:text-slate-100">
      <Header />
      <main className="mx-auto max-w-6xl space-y-10 px-4 pt-8 pb-16">
        <section className="space-y-3 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">{t('app.title')}</h1>
          <p className="mx-auto max-w-2xl text-slate-600 dark:text-slate-400">
            {t('app.tagline')}
          </p>
        </section>
        {dataset ? (
          <>
            <ChartStudio key={datasetKey} dataset={dataset} />
            <DataTable dataset={dataset} />
          </>
        ) : (
          <UploadPanel />
        )}
      </main>
    </div>
  )
}
