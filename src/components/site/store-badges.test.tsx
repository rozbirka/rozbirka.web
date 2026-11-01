import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppStoreBadge } from './store-badges'

describe('store badges', () => {
  it('links App Store to the verified production listing', () => {
    render(<AppStoreBadge />)
    expect(screen.getByRole('link', { name: /app store/i })).toHaveAttribute(
      'href',
      'https://apps.apple.com/ua/app/rozbirka/id6762130912',
    )
  })
})
