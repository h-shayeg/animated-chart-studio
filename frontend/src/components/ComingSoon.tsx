import { useTranslation } from 'react-i18next'

import { REPO_URL, type SpectrumTab } from '../spectra/tabs'

export function ComingSoon({ tab }: { tab: SpectrumTab }) {
  const { t } = useTranslation()
  return (
    <section
      role="tabpanel"
      aria-labelledby={`tab-${tab.id}`}
      className="space-y-3 rounded-b-xl border border-t-0 border-slate-200 bg-slate-50/80 p-8 text-center dark:border-slate-800 dark:bg-slate-900/60"
    >
      <h2 className="text-xl font-bold">
        {t('spectra.comingSoon.title', { name: t(`spectra.tabTitles.${tab.id}`) })}
      </h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">{t('spectra.comingSoon.text')}</p>
      {tab.issue !== null ? (
        <a
          href={`${REPO_URL}/issues/${tab.issue}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-sm font-medium text-indigo-600 underline dark:text-indigo-300"
        >
          {t('spectra.comingSoon.link')}
        </a>
      ) : null}
    </section>
  )
}
