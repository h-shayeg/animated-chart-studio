import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { ComingSoon } from './ComingSoon'

it('says the tool is coming and links to its roadmap issue', () => {
  render(<ComingSoon tab={{ id: 'raman', issue: 18 }} />)

  expect(screen.getByRole('heading')).toHaveTextContent('Raman spectroscopy is coming soon')
  expect(screen.getByRole('link', { name: 'See the roadmap issue' })).toHaveAttribute(
    'href',
    'https://github.com/h-shayeg/animated-chart-studio/issues/18',
  )
})
