import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { analyzeXrd, parseDataset, type Dataset } from '../api'
import { extractPattern, type XrdOutcome } from '../chart/xrd'
import {
  MIN_POINTS,
  checkXrdData,
  guessColumns,
  type XrdColumns,
  type XrdProblem,
} from '../chart/xrdData'
import {
  INITIAL_VALUES,
  readOptions,
  type BaselineMethod,
  type FieldId,
} from '../chart/xrdOptions'
import { RibbonField, RibbonGroup, RibbonPanel } from './Ribbon'
import { XrdResults } from './XrdResults'

interface FieldSpec {
  id: FieldId
  step: string
}

const BASELINE_METHODS: BaselineMethod[] = ['snip', 'none']
const PREPARE_FIELDS: FieldSpec[] = [
  { id: 'smoothing', step: '2' },
  { id: 'baselineWindow', step: '0.5' },
]
const PEAK_FIELDS: FieldSpec[] = [
  { id: 'prominence', step: '0.5' },
  { id: 'distance', step: '0.05' },
]
const CALCULATE_FIELDS: FieldSpec[] = [
  { id: 'wavelength', step: '0.0001' },
  { id: 'shape', step: '0.01' },
  { id: 'instrument', step: '0.01' },
]

const INPUT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900'
const BUTTON_CLASS =
  'rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium transition aria-pressed:border-indigo-500 aria-pressed:bg-indigo-500 aria-pressed:text-white disabled:opacity-60 dark:border-slate-700'
const PRIMARY_CLASS =
  'rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60'
const ALERT_CLASS =
  'rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200'

interface FieldInputsProps {
  fields: FieldSpec[]
  values: Record<FieldId, string>
  onChange: (id: FieldId, value: string) => void
}

function FieldInputs({ fields, values, onChange }: FieldInputsProps) {
  const { t } = useTranslation()
  return (
    <>
      {fields.map((field) => (
        <RibbonField key={field.id} label={t(`xrd.fields.${field.id}`)}>
          <input
            type="number"
            dir="ltr"
            step={field.step}
            inputMode="decimal"
            value={values[field.id]}
            onChange={(event) => onChange(field.id, event.target.value)}
            className={`${INPUT_CLASS} w-24`}
          />
        </RibbonField>
      ))}
    </>
  )
}

export function XrdWorkspace() {
  const { t } = useTranslation()
  const fileInput = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [header, setHeader] = useState(true)
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [columns, setColumns] = useState<XrdColumns | null>(null)
  const [reading, setReading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [baseline, setBaseline] = useState<BaselineMethod>('snip')
  const [values, setValues] = useState(INITIAL_VALUES)
  const [working, setWorking] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<XrdOutcome | null>(null)

  const problems = useMemo<XrdProblem[]>(() => {
    if (!dataset) return []
    if (!columns) return ['columns']
    return checkXrdData(dataset, columns)
  }, [dataset, columns])
  const ready = dataset !== null && columns !== null && problems.length === 0
  const numericColumns = dataset
    ? dataset.columns.filter((column) => column.kind === 'numeric').map((column) => column.name)
    : []

  const analyze = async (source: Dataset, chosen: XrdColumns) => {
    const options = readOptions(values, baseline)
    if (!options) {
      setOutcome(null)
      setAnalysisError(t('xrd.invalidNumber'))
      return
    }
    const pattern = extractPattern(source, chosen.angle, chosen.intensity)
    setWorking(true)
    setAnalysisError(null)
    try {
      const result = await analyzeXrd(pattern.twoTheta, pattern.intensity, options)
      setOutcome({ result, raw: pattern.intensity })
    } catch (caught) {
      setOutcome(null)
      setAnalysisError(caught instanceof Error ? caught.message : t('xrd.failed'))
    } finally {
      setWorking(false)
    }
  }

  const importFile = async (chosen: File, firstRowHeader: boolean) => {
    setReading(true)
    setImportError(null)
    setAnalysisError(null)
    setOutcome(null)
    setFile(chosen)
    try {
      const parsed = await parseDataset(chosen, firstRowHeader)
      const guessed = guessColumns(parsed)
      setDataset(parsed)
      setColumns(guessed)
      // Data that passes the checks is analysed at once.
      if (guessed && checkXrdData(parsed, guessed).length === 0) await analyze(parsed, guessed)
    } catch (caught) {
      setDataset(null)
      setColumns(null)
      setImportError(caught instanceof Error ? caught.message : t('spectra.import.failed'))
    } finally {
      setReading(false)
    }
  }

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0]
    event.target.value = ''
    if (chosen) void importFile(chosen, header)
  }

  const onHeaderChange = (checked: boolean) => {
    setHeader(checked)
    if (file) void importFile(file, checked)
  }

  const chooseColumn = (key: keyof XrdColumns, name: string) => {
    if (!columns) return
    setColumns({ ...columns, [key]: name })
    setOutcome(null)
  }

  const csvName = `${(file?.name ?? 'xrd').replace(/\.[^.]+$/, '')}-xrd-peaks.csv`

  return (
    <div className="space-y-5">
      <RibbonPanel tab="xrd">
        <RibbonGroup label={t('spectra.groups.data')}>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.xlsx"
            aria-label={t('spectra.import.fileInput')}
            onChange={onPick}
            className="sr-only"
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={reading}
              onClick={() => fileInput.current?.click()}
              className={PRIMARY_CLASS}
            >
              {reading ? t('spectra.import.reading') : t('spectra.import.button')}
            </button>
            <span className="max-w-40 truncate text-xs" title={file?.name}>
              {file ? file.name : t('spectra.import.noFile')}
            </span>
          </div>
          <label className="flex max-w-32 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={header}
              onChange={(event) => onHeaderChange(event.target.checked)}
            />
            <span>{t('spectra.import.header')}</span>
          </label>
          {dataset && columns ? (
            <>
              <RibbonField label={t('xrd.angleColumn')}>
                <select
                  value={columns.angle}
                  onChange={(event) => chooseColumn('angle', event.target.value)}
                  className={INPUT_CLASS}
                >
                  {numericColumns.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </RibbonField>
              <RibbonField label={t('xrd.intensityColumn')}>
                <select
                  value={columns.intensity}
                  onChange={(event) => chooseColumn('intensity', event.target.value)}
                  className={INPUT_CLASS}
                >
                  {numericColumns.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </RibbonField>
            </>
          ) : null}
        </RibbonGroup>

        <RibbonGroup label={t('spectra.groups.prepare')}>
          <div className="flex flex-col gap-1 text-xs">
            <span>{t('xrd.baseline')}</span>
            <div role="group" aria-label={t('xrd.baseline')} className="flex gap-1">
              {BASELINE_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  aria-pressed={baseline === method}
                  onClick={() => setBaseline(method)}
                  className={BUTTON_CLASS}
                >
                  {t(`xrd.baselineMethod.${method}`)}
                </button>
              ))}
            </div>
          </div>
          <FieldInputs
            fields={PREPARE_FIELDS}
            values={values}
            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          />
        </RibbonGroup>

        <RibbonGroup label={t('spectra.groups.peaks')}>
          <FieldInputs
            fields={PEAK_FIELDS}
            values={values}
            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          />
        </RibbonGroup>

        <RibbonGroup label={t('spectra.groups.calculate')}>
          <FieldInputs
            fields={CALCULATE_FIELDS}
            values={values}
            onChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          />
        </RibbonGroup>

        <RibbonGroup label={t('spectra.groups.analyze')}>
          <button
            type="button"
            disabled={!ready || working || reading}
            onClick={() => {
              if (dataset && columns) void analyze(dataset, columns)
            }}
            className={PRIMARY_CLASS}
          >
            {working ? t('xrd.analyzing') : t('xrd.analyze')}
          </button>
        </RibbonGroup>
      </RibbonPanel>

      {importError ? (
        <p role="alert" className={ALERT_CLASS}>
          {importError}
        </p>
      ) : null}

      {problems.length > 0 ? (
        <div role="alert" className={ALERT_CLASS}>
          <p className="font-semibold">{t('spectra.problems.title')}</p>
          <ul className="mt-1 list-disc ps-5">
            {problems.map((problem) => (
              <li key={problem}>{t(`spectra.problems.${problem}`, { count: MIN_POINTS })}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {analysisError ? (
        <p role="alert" className={ALERT_CLASS}>
          {analysisError}
        </p>
      ) : null}

      {outcome ? <XrdResults outcome={outcome} csvName={csvName} /> : null}

      {!dataset && !importError ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {t('spectra.empty')}
        </p>
      ) : null}
    </div>
  )
}
