import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { plural } from '@/lib/utils'
import { Amount, DateValue } from '@/components/app/value'
import { formatFileSize } from '@/components/app/format'
import {
  currencyFractionDigits,
  currencyName,
  isSupportedCurrency,
  parseCurrency,
  searchCurrencies,
  SUPPORTED_CURRENCIES,
} from './currencies'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatTime,
} from './format'
import { useFormat, useT } from './hooks'
import { localePreference } from './locale-preference'
import { LocaleOverride, LocaleProvider, useLocale } from './LocaleProvider'
import { matchLocale, resolveLocale } from './locales'
import { defineMessages, translate } from './messages'
import { selectPlural } from './plural'

const normalize = (value: string | null) => value?.replace(/\s/g, ' ') ?? null

const messages = defineMessages({
  uk: {
    title: 'Мова інтерфейсу',
    greeting: 'Вітаємо, {name}',
    parts: {
      one: '{count} деталь',
      few: '{count} деталі',
      many: '{count} деталей',
      other: '{count} деталі',
    },
  },
  'en-GB': {
    title: 'Interface language',
    greeting: 'Welcome, {name}',
    parts: { one: '{count} part', other: '{count} parts' },
  },
  pl: {
    title: 'Język interfejsu',
    greeting: 'Witaj, {name}',
    parts: {
      one: '{count} część',
      few: '{count} części',
      many: '{count} części',
      other: '{count} części',
    },
  },
})

afterEach(() => {
  localePreference.set(null)
  document.documentElement.lang = 'uk'
})

describe('locale resolution', () => {
  it('maps browser tags onto supported locales by language', () => {
    expect(matchLocale('uk-UA')).toBe('uk')
    expect(matchLocale('en-US')).toBe('en-GB')
    expect(matchLocale('pl')).toBe('pl')
    expect(matchLocale('de-DE')).toBeNull()
    expect(matchLocale('')).toBeNull()
  })

  it('prefers profile, then device, then browser, then en-GB', () => {
    expect(
      resolveLocale({ profile: 'pl', device: 'uk', browser: ['en-GB'] }),
    ).toMatchObject({ locale: 'pl', source: 'profile' })
    expect(
      resolveLocale({ profile: null, device: 'uk', browser: ['pl'] }),
    ).toMatchObject({ locale: 'uk', source: 'device' })
    expect(
      resolveLocale({ profile: 'ru', browser: ['de', 'pl-PL'] }),
    ).toMatchObject({ locale: 'pl', source: 'browser', browserLanguage: 'de' })
    expect(resolveLocale({ browser: ['de-DE'] })).toEqual({
      locale: 'en-GB',
      source: 'fallback',
      browserLanguage: 'de-DE',
    })
    expect(resolveLocale({})).toMatchObject({ locale: 'en-GB' })
  })
})

describe('messages', () => {
  it('interpolates and selects plural forms per locale', () => {
    expect(translate(messages, 'uk', 'greeting', { name: 'Олена' })).toBe(
      'Вітаємо, Олена',
    )
    expect(translate(messages, 'uk', 'parts', { count: 1 })).toBe('1 деталь')
    expect(translate(messages, 'uk', 'parts', { count: 3 })).toBe('3 деталі')
    expect(translate(messages, 'uk', 'parts', { count: 11 })).toBe('11 деталей')
    expect(translate(messages, 'en-GB', 'parts', { count: 1 })).toBe('1 part')
    expect(translate(messages, 'en-GB', 'parts', { count: 5 })).toBe('5 parts')
    expect(translate(messages, 'pl', 'parts', { count: 22 })).toBe('22 części')
    expect(
      normalize(translate(messages, 'en-GB', 'parts', { count: 1200 })),
    ).toBe('1,200 parts')
  })

  it('keeps unknown placeholders visible', () => {
    expect(translate(messages, 'uk', 'greeting')).toBe('Вітаємо, {name}')
  })

  it('requires every locale to define exactly the source keys', () => {
    defineMessages({
      uk: { a: 'А', b: 'Б' },
      // @ts-expect-error -- missing key `b`
      'en-GB': { a: 'A' },
      pl: { a: 'A', b: 'B' },
    })
    defineMessages({
      uk: { a: 'А' },
      // @ts-expect-error -- `extra` is not a source key
      'en-GB': { a: 'A', extra: 'X' },
      pl: { a: 'A' },
    })
  })

  it('keeps the legacy Ukrainian plural helper', () => {
    const forms: [string, string, string] = ['деталь', 'деталі', 'деталей']
    expect(
      [0, 1, 2, 4, 5, 11, 14, 21, 22, 25, 101, 111, -3].map((n) =>
        plural(n, forms),
      ),
    ).toEqual([
      'деталей',
      'деталь',
      'деталі',
      'деталі',
      'деталей',
      'деталей',
      'деталей',
      'деталь',
      'деталі',
      'деталей',
      'деталь',
      'деталей',
      'деталі',
    ])
    expect(selectPlural('en-GB', 1, { one: 'part', other: 'parts' })).toBe(
      'part',
    )
  })
})

describe('formatters', () => {
  it('formats numbers by locale (pl leaves four digits ungrouped)', () => {
    expect(normalize(formatNumber(12480.5, 'uk'))).toBe('12 480,5')
    expect(formatNumber(12480.5, 'en-GB')).toBe('12,480.5')
    expect(formatNumber(1234, 'pl')).toBe('1234')
    expect(normalize(formatNumber(12480, 'pl'))).toBe('12 480')
    expect(formatNumber(null, 'uk')).toBeNull()
    expect(formatNumber('abc', 'uk')).toBeNull()
  })

  it('formats money with the ISO code and currency precision', () => {
    expect(normalize(formatMoney(12480, 'USD', 'uk'))).toBe('12 480,00 USD')
    expect(normalize(formatMoney(12480, 'USD', 'en-GB'))).toBe('12,480.00 USD')
    expect(normalize(formatMoney('12480', 'USD', 'pl'))).toBe('12 480,00 USD')
    expect(normalize(formatMoney(1500.4, 'JPY', 'en-GB'))).toBe('1,500 JPY')
    expect(normalize(formatMoney(5, 'uah', 'uk'))).toBe('5,00 UAH')
    expect(normalize(formatMoney(5, null, 'uk'))).toBe('5')
    expect(
      normalize(formatMoney(5.5, 'EUR', 'uk', { fractionDigits: 0 })),
    ).toBe('6 EUR')
    expect(formatMoney(undefined, 'EUR', 'uk')).toBeNull()
  })

  it('formats dates in the business time zone', () => {
    const instant = '2026-10-07T11:30:00Z'
    expect(formatDate(instant, 'uk')).toBe('07.10.2026')
    expect(formatDateTime(instant, 'uk')).toBe('07.10.2026, 14:30')
    expect(formatDateTime(instant, 'en-GB', 'Europe/London')).toBe(
      '07/10/2026, 12:30',
    )
    expect(formatTime(instant, 'pl', 'Europe/Warsaw')).toBe('13:30')
    expect(formatDateTime(instant, 'uk', 'Not/AZone')).toBe('07.10.2026, 14:30')
    expect(formatDate('nope', 'uk')).toBeNull()
  })
})

describe('currency catalog', () => {
  it('lists the ten supported currencies with precision', () => {
    expect(SUPPORTED_CURRENCIES).toHaveLength(10)
    expect(currencyFractionDigits('JPY')).toBe(0)
    expect(currencyFractionDigits('CZK')).toBe(2)
    expect(currencyFractionDigits('KWD')).toBe(3)
    expect(currencyName('PLN', 'pl')).toBe('złoty polski')
    expect(currencyName('GBP', 'en-GB')).toBe('Pound sterling')
  })

  it('guards unknown values', () => {
    expect(isSupportedCurrency('GBP')).toBe(true)
    expect(isSupportedCurrency('RUB')).toBe(false)
    expect(parseCurrency('gbp')).toBe('GBP')
    expect(parseCurrency('XYZ')).toBeNull()
    expect(parseCurrency(3)).toBeNull()
  })

  it('searches by code and by localized name', () => {
    const codes = (query: string, locale: 'uk' | 'en-GB' | 'pl') =>
      searchCurrencies(query, locale).map((info) => info.code)
    expect(codes('зл', 'uk')).toEqual(['PLN'])
    expect(codes('фунт', 'uk')).toEqual(['GBP'])
    expect(codes('pl', 'uk')).toEqual(['PLN'])
    expect(codes('zloty', 'en-GB')).toEqual(['PLN'])
    expect(codes('dolar', 'pl')).toEqual(['USD', 'CAD'])
    expect(codes('c', 'en-GB')).toEqual(['CZK', 'CHF', 'CAD'])
    expect(codes('', 'uk')).toHaveLength(10)
    expect(codes('xyz', 'uk')).toEqual([])
  })
})

function Probe() {
  const { locale, resolution, setDevicePreference } = useLocale()
  const t = useT(messages)
  const format = useFormat()
  return (
    <div>
      <p data-testid="locale">{`${locale}:${resolution.source}`}</p>
      <p data-testid="title">{t('title')}</p>
      <p data-testid="parts">{t('parts', { count: 2 })}</p>
      <p data-testid="time">{format.dateTime('2026-10-07T11:30:00Z')}</p>
      <button type="button" onClick={() => setDevicePreference('pl')}>
        pl
      </button>
    </div>
  )
}

describe('LocaleProvider', () => {
  it('defaults to Ukrainian and Kyiv without a provider', () => {
    render(<Probe />)
    expect(screen.getByTestId('title')).toHaveTextContent('Мова інтерфейсу')
    expect(screen.getByTestId('time')).toHaveTextContent('07.10.2026, 14:30')
  })

  it('resolves the profile language, applies the tenant zone and sets lang', () => {
    render(
      <LocaleProvider profileLanguage="en-GB" timeZone="Europe/London">
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale')).toHaveTextContent('en-GB:profile')
    expect(screen.getByTestId('parts')).toHaveTextContent('2 parts')
    expect(screen.getByTestId('time')).toHaveTextContent('07/10/2026, 12:30')
    expect(document.documentElement.lang).toBe('en-GB')
  })

  it('remembers a device choice when the profile has none', async () => {
    render(
      <LocaleProvider profileLanguage={null}>
        <Probe />
      </LocaleProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'pl' }))
    expect(screen.getByTestId('locale')).toHaveTextContent('pl:device')
    expect(screen.getByTestId('title')).toHaveTextContent('Język interfejsu')
    expect(localePreference.get()).toBe('pl')
    expect(document.documentElement.lang).toBe('pl')
  })

  it('ignores an unsupported profile language', () => {
    localePreference.set('uk')
    render(
      <LocaleProvider profileLanguage="de">
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale')).toHaveTextContent('uk:device')
  })

  it('pins a locale for SSR and overrides it for single-language pages', () => {
    const { unmount } = render(
      <LocaleProvider profileLanguage="pl" locale="uk">
        <Probe />
      </LocaleProvider>,
    )
    expect(screen.getByTestId('locale')).toHaveTextContent('uk:pinned')
    unmount()

    const { rerender } = render(
      <LocaleProvider profileLanguage="en-GB">
        <LocaleOverride locale="uk">
          <Probe />
        </LocaleOverride>
      </LocaleProvider>,
    )
    expect(screen.getByTestId('title')).toHaveTextContent('Мова інтерфейсу')
    expect(document.documentElement.lang).toBe('uk')

    rerender(
      <LocaleProvider profileLanguage="en-GB">
        <Probe />
      </LocaleProvider>,
    )
    expect(document.documentElement.lang).toBe('en-GB')
  })
})

describe('value components', () => {
  it('keeps the legacy Ukrainian Amount and DateValue output', () => {
    render(
      <>
        <Amount currency="UAH" value={8400} />
        <DateValue value="2026-08-28T13:45:00Z" />
      </>,
    )
    expect(screen.getByText(/^8\s400 ₴$/)).toBeInTheDocument()
    expect(screen.getByText('28.08.2026, 16:45')).toBeInTheDocument()
  })

  it('renders ISO code money and dates in the current locale', () => {
    render(
      <LocaleProvider locale="en-GB" timeZone="Europe/London">
        <Amount currency="JPY" currencyDisplay="code" value={1500} />
        <DateValue value="2026-08-28T13:45:00Z" />
      </LocaleProvider>,
    )
    expect(screen.getByText(/^1,500\sJPY$/)).toBeInTheDocument()
    expect(screen.getByText('28/08/2026, 14:45')).toBeInTheDocument()
  })

  it('localizes file sizes through a feature namespace', () => {
    expect(normalize(formatFileSize(1536))).toBe('1,5 КБ')
    expect(formatFileSize(1536, 'en-GB')).toBe('1.5 KB')
    expect(formatFileSize(300, 'pl')).toBe('300 B')
  })
})
