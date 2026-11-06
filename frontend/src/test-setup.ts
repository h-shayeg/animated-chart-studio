import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import './i18n'

// The real chart needs a canvas, which the test browser does not have.
vi.mock('./components/ChartView', () => ({ ChartView: () => null }))

afterEach(() => {
  cleanup()
})
