import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'

import { useDatasetStore } from '../store'

const ACCEPT = {
  'text/csv': ['.csv'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
}

const SAMPLE_ROWS = [
  ['2025-01-01', 120, 32, 80],
  ['2025-02-01', 135, 38, 86],
  ['2025-03-01', 160, 51, 97],
  ['2025-04-01', 150, 47, 93],
  ['2025-05-01', 178, 60, 110],
  ['2025-06-01', 195, 68, 121],
  ['2025-07-01', 210, 75, 133],
  ['2025-08-01', 205, 71, 128],
  ['2025-09-01', 230, 84, 142],
  ['2025-10-01', 248, 93, 155],
  ['2025-11-01', 240, 88, 150],
  ['2025-12-01', 275, 104, 171],
]

function sampleFile(): File {
  const lines = ['month,sales,profit,customers', ...SAMPLE_ROWS.map((row) => row.join(','))]
  return new File([lines.join('\n')], 'sample-sales.csv', { type: 'text/csv' })
}

export function UploadPanel() {
  const { t } = useTranslation()
  const status = useDatasetStore((state) => state.status)
  const error = useDatasetStore((state) => state.error)
  const loadFile = useDatasetStore((state) => state.loadFile)
  const [rejected, setRejected] = useState(false)
  const loading = status === 'loading'

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: ACCEPT,
    multiple: false,
    disabled: loading,
    onDropAccepted: ([file]) => {
      setRejected(false)
      if (file) void loadFile(file)
    },
    onDropRejected: () => setRejected(true),
  })

  const message = loading
    ? t('upload.loading')
    : isDragActive
      ? t('upload.dropActive')
      : t('upload.drop')

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div
        {...getRootProps()}
        data-testid="dropzone"
        className={[
          'cursor-pointer rounded-3xl border-2 border-dashed p-12 text-center shadow-sm backdrop-blur transition',
          isDragActive
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
            : 'border-slate-300 bg-white/60 hover:border-indigo-400 dark:border-slate-700 dark:bg-slate-900/60',
        ].join(' ')}
      >
        <input {...getInputProps()} />
        <p className="text-lg font-semibold">{t('upload.title')}</p>
        <p className="mt-2 text-slate-600 dark:text-slate-400">{message}</p>
        <p className="mt-1 text-sm text-slate-500">{t('upload.hint')}</p>
      </div>

      <div className="text-center">
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadFile(sampleFile())}
          className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {t('upload.sample')}
        </button>
      </div>

      {rejected && (
        <p role="alert" className="text-center text-sm text-rose-600 dark:text-rose-400">
          {t('upload.rejected')}
        </p>
      )}
      {status === 'error' && (
        <p role="alert" className="text-center text-sm text-rose-600 dark:text-rose-400">
          {t('upload.failed')} {error}
        </p>
      )}
    </section>
  )
}
