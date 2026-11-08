export type SpectrumTabId =
  | 'xrd'
  | 'raman'
  | 'ftir'
  | 'uvvis'
  | 'pl'
  | 'xps'
  | 'eds'
  | 'xas'
  | 'nmr'
  | 'ms'
  | 'thermal'
  | 'tpdr'

export type TabId = 'chart' | SpectrumTabId

export interface SpectrumTab {
  id: SpectrumTabId
  // The roadmap issue of a tool that is not built yet.
  issue: number | null
}

export const REPO_URL = 'https://github.com/h-shayeg/animated-chart-studio'

export const SPECTRUM_TABS: SpectrumTab[] = [
  { id: 'xrd', issue: null },
  { id: 'raman', issue: 18 },
  { id: 'ftir', issue: 19 },
  { id: 'uvvis', issue: 20 },
  { id: 'pl', issue: 21 },
  { id: 'xps', issue: 22 },
  { id: 'eds', issue: 23 },
  { id: 'xas', issue: 24 },
  { id: 'nmr', issue: 25 },
  { id: 'ms', issue: 26 },
  { id: 'thermal', issue: 27 },
  { id: 'tpdr', issue: 28 },
]

export const TAB_IDS: TabId[] = ['chart', ...SPECTRUM_TABS.map((tab) => tab.id)]
