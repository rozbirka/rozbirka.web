import { render } from '@testing-library/react'
import { expect, it } from 'vitest'
import { QrPattern } from './landing-ui'

it('keeps the decorative QR square out of the accessibility tree with two DOM nodes', () => {
  const { container } = render(<QrPattern className="size-full" />)
  const svg = container.querySelector('svg')
  expect(svg).toHaveAttribute('viewBox', '0 0 21 21')
  expect(svg).toHaveAttribute('aria-hidden', 'true')
  expect(svg).toHaveAttribute('focusable', 'false')
  expect(svg).toHaveClass('size-full')
  expect(container.querySelectorAll('*')).toHaveLength(2)
  expect(svg?.querySelector('path')).toHaveAttribute('fill', 'currentColor')
})
