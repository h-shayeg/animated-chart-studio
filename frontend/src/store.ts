import { create } from 'zustand'

import { parseDataset, type Dataset } from './api'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface DatasetState {
  dataset: Dataset | null
  file: File | null
  header: boolean
  status: Status
  error: string | null
  loadFile: (file: File, header?: boolean) => Promise<void>
  setHeader: (header: boolean) => Promise<void>
  reset: () => void
}

export const useDatasetStore = create<DatasetState>()((set, get) => ({
  dataset: null,
  file: null,
  header: true,
  status: 'idle',
  error: null,
  loadFile: async (file, header = true) => {
    set({ status: 'loading', error: null, file, header })
    try {
      const dataset = await parseDataset(file, header)
      set({ dataset, status: 'ready' })
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
    }
  },
  setHeader: async (header) => {
    const { file, loadFile } = get()
    if (file) await loadFile(file, header)
  },
  reset: () => set({ dataset: null, file: null, header: true, status: 'idle', error: null }),
}))
