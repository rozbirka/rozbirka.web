import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { PrivacyScreen } from './privacy'

it('provides the same standalone legal document with contact-only links', () => {
  render(<PrivacyScreen />)
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'Як ми поводимось з даними',
  )
  const links = screen.getAllByRole('link')
  expect(links.length).toBeGreaterThan(0)
  for (const link of links)
    expect(link).toHaveAttribute('href', 'mailto:support@rozbirka.com')
  expect(screen.queryByRole('navigation')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('describes personal erasure separately from company data and existing subscriptions', () => {
  const { container } = render(<PrivacyScreen />)
  const text = container.textContent
  expect(text).toContain('Спільні записи компанії')
  expect(text).toContain('не скасовує підписку')
  expect(text).not.toMatch(/30 днів|14 днів|усіма пов.язаними даними/)
  for (const provider of [
    'Google',
    'Cloudflare',
    'Twilio',
    'Monobank',
    'RevenueCat',
  ])
    expect(text).toContain(provider)
})
