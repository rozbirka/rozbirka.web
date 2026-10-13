import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LocaleOverride } from '@/i18n/LocaleProvider'
import { SupportLink } from './support-link'
import { telegramSupportHref } from '@/lib/telegram-support'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

describe('public Telegram support links', () => {
  it('does not expose a placeholder or accept URL/script injection', () => {
    expect(telegramSupportHref(undefined)).toBeNull()
    expect(telegramSupportHref('https://example.com')).toBeNull()
    expect(telegramSupportHref('javascript:alert(1)')).toBeNull()
    expect(telegramSupportHref('@rozbirka_support_bot')).toBe(
      'https://t.me/rozbirka_support_bot',
    )
  })
  it('hides support when no bot has been configured', () => {
    vi.stubEnv('VITE_TELEGRAM_SUPPORT_BOT', '')
    render(
      <LocaleOverride locale="uk">
        <SupportLink floating />
      </LocaleOverride>,
    )
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('leaves no empty footer item when support is disabled', () => {
    vi.stubEnv('VITE_TELEGRAM_SUPPORT_BOT', '')
    render(
      <LocaleOverride locale="uk">
        <ul>
          <SupportLink asListItem />
        </ul>
      </LocaleOverride>,
    )
    expect(screen.queryByRole('listitem')).toBeNull()
  })
  it.each([
    ['uk', 'Написати в підтримку'],
    ['en-GB', 'Contact support'],
    ['pl', 'Napisz do wsparcia'],
  ] as const)(
    'localizes %s and safely opens the configured bot',
    (locale, label) => {
      vi.stubEnv('VITE_TELEGRAM_SUPPORT_BOT', 'rozbirka_support_bot')
      render(
        <LocaleOverride locale={locale}>
          <SupportLink floating />
        </LocaleOverride>,
      )
      const link = screen.getByRole('link')
      expect(link.textContent).toContain(label)
      expect(link.getAttribute('href')).toBe(
        'https://t.me/rozbirka_support_bot',
      )
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('target')).toBe('_blank')
    },
  )
})
