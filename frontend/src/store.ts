import { create } from 'zustand'

import { parseDataset, type Dataset } from './api'

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface DatasetState {
  dataset: Dataset | null
  status: Status
  error: string | null
  loadFile: (file: File) => Promise<void>
  reset: () => void
}

export const useDatasetStore = create<DatasetState>()((set) => ({
  dataset: null,
  status: 'idle',
  error: null,
  loadFile: async (file) => {
    set({ status: 'loading', error: null })
    try {
      const dataset = await parseDataset(file)
      set({ dataset, status: 'ready' })
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Unknown error' })
    }
  },
  reset: () => set({ dataset: null, status: 'idle', error: null }),
}))
