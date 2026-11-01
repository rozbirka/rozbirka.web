import { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { requestLocale, type Locale } from '@/i18n'
import { readCustomerPhoneConflict } from './customers'
import { normalizeApiProblem } from './errors'

const failure = (code: string, message: string, details?: unknown) =>
  new AxiosError('Request failed', undefined, undefined, undefined, {
    status: code === 'VALIDATION_ERROR' ? 400 : 409,
    statusText: 'Error',
    config: { headers: new AxiosHeaders() },
    headers: {},
    data: {
      error: {
        code,
        message,
        details,
        customerId: 'customer-1',
        customerName: 'Володя',
        isActive: true,
      },
    },
  })

afterEach(() => requestLocale.set(null))

describe('error localisation across screens', () => {
  it.each<[Locale, string]>([
    ['uk', 'Клієнт із таким номером телефону вже існує.'],
    ['en-GB', 'A customer with this phone number already exists.'],
    ['pl', 'Klient z tym numerem telefonu już istnieje.'],
  ])(
    'localises duplicate customers in %s without losing reuse data',
    (locale, message) => {
      requestLocale.set(locale)
      const error = failure(
        'CUSTOMER_PHONE_EXISTS',
        'A customer with this phone already exists.',
      )
      expect(normalizeApiProblem(error).message).toBe(message)
      expect(readCustomerPhoneConflict(error)).toEqual({
        customerId: 'customer-1',
        customerName: 'Володя',
        isActive: true,
        message,
      })
    },
  )

  it('uses a localised fallback for new server errors and keeps diagnostics', () => {
    const error = failure('FUTURE_ERROR', 'Internal English diagnostic')
    expect(normalizeApiProblem(error)).toMatchObject({
      code: 'FUTURE_ERROR',
      kind: 'conflict',
      status: 409,
      message: 'Не вдалося виконати дію через конфлікт даних.',
      cause: error,
    })
  })

  it('localises field errors as well as the validation summary', () => {
    const problem = normalizeApiProblem(
      failure('VALIDATION_ERROR', 'Validation failed.', [
        { field: 'name', message: 'This field is required.' },
        { field: 'price', message: 'Unexpected English validation text' },
      ]),
    )
    expect(problem.kind).toBe('validation')
    expect(problem.fieldErrors).toEqual({
      name: ['Це поле обов’язкове.'],
      price: ['Перевірте правильність введених даних.'],
    })
  })

  it('relocalises a previously normalised error after changing the interface language', () => {
    const problem = normalizeApiProblem(
      failure('CUSTOMER_PHONE_EXISTS', 'English'),
    )
    requestLocale.set('pl')
    expect(normalizeApiProblem(problem).message).toBe(
      'Klient z tym numerem telefonu już istnieje.',
    )
  })

  it('recognises lower-case codes without changing the code used by recovery logic', () => {
    const error = failure('insufficient_quantity', 'Not enough stock')
    expect(normalizeApiProblem(error)).toMatchObject({
      code: 'insufficient_quantity',
      message: 'Недостатньо запчастин у наявності. Перевірте кількість.',
      cause: error,
    })
  })

  it('gives a useful rate-limit message and preserves the retry delay', () => {
    requestLocale.set('pl')
    const error = failure('UNRECOGNISED_THROTTLE', 'Too many requests')
    error.response!.status = 429
    error.response!.headers['retry-after'] = '30'
    expect(normalizeApiProblem(error)).toMatchObject({
      message: 'Zbyt wiele żądań. Poczekaj i spróbuj ponownie.',
      retryAfterSeconds: 30,
      status: 429,
    })
  })

  it('keeps reviewed client errors specific and translates them to the current language', () => {
    requestLocale.set('pl')
    expect(
      normalizeApiProblem(new Error('Couldn’t load the car catalogue.'))
        .message,
    ).toBe('Nie udało się wczytać katalogu samochodów.')
  })
})

it.each<[Locale, string]>([
  [
    'uk',
    'Ви не можете змінювати власні права. Зверніться до власника розбірки.',
  ],
  [
    'en-GB',
    'You cannot change your own permissions. Contact the business owner.',
  ],
  [
    'pl',
    'Nie możesz zmieniać własnych uprawnień. Skontaktuj się z właścicielem firmy.',
  ],
])(
  'localises the self-permission restriction in %s through repeated normalisation',
  (locale, message) => {
    requestLocale.set(locale)
    const problem = normalizeApiProblem(
      failure('VALIDATION_ERROR', 'Cannot change own permissions.'),
    )
    expect(problem.message).toBe(message)
    expect(normalizeApiProblem(problem).message).toBe(message)
  },
)
