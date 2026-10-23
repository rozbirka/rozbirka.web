import axios, { AxiosError, AxiosHeaders } from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { requestLocale } from '@/i18n'
import { isProblemCode, normalizeApiProblem } from './errors'

function axiosFailure(status: number, data: unknown, headers = {}) {
  return new AxiosError(
    'request failed',
    'ERR_BAD_RESPONSE',
    { headers: new AxiosHeaders(), method: 'get', url: '/resource' },
    undefined,
    {
      status,
      statusText: 'Error',
      headers,
      config: { headers: new AxiosHeaders() },
      data,
    },
  )
}

describe('normalizeApiProblem', () => {
  it('normalizes nested middleware errors', () => {
    expect(
      normalizeApiProblem(
        axiosFailure(422, {
          error: { code: 'INVALID', message: 'Invalid request' },
        }),
      ),
    ).toMatchObject({
      kind: 'validation',
      status: 422,
      code: 'INVALID',
      message: 'Перевірте правильність введених даних.',
    })
  })

  it('normalizes flat permission errors and validation dictionaries', () => {
    expect(
      normalizeApiProblem(
        axiosFailure(403, {
          error: 'FORBIDDEN',
          message: 'Denied',
          errors: { name: ['Required'] },
        }),
      ),
    ).toMatchObject({
      kind: 'forbidden',
      code: 'FORBIDDEN',
      fieldErrors: { name: ['Це поле обов’язкове.'] },
    })
  })

  it('reads Core validation details from a 400 response', () => {
    expect(
      normalizeApiProblem(
        axiosFailure(400, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Перевірте введені дані',
            details: [{ field: 'desiredSalePrice', message: 'Завелика сума' }],
          },
        }),
      ),
    ).toMatchObject({
      status: 400,
      fieldErrors: {
        desiredSalePrice: ['Перевірте правильність введених даних.'],
      },
    })
  })

  it('reads retry-after and marks an expired session', () => {
    expect(
      normalizeApiProblem(axiosFailure(401, {}, { 'retry-after': '30' })),
    ).toMatchObject({ kind: 'session-expired', retryAfterSeconds: 30 })
  })

  it('maps missing resources to not-found', () => {
    expect(normalizeApiProblem(axiosFailure(404, {}))).toMatchObject({
      kind: 'not-found',
      status: 404,
    })
  })

  it('maps conflicting requests to conflict', () => {
    expect(normalizeApiProblem(axiosFailure(409, {}))).toMatchObject({
      kind: 'conflict',
      status: 409,
    })
  })

  it('maps server response failures to server', () => {
    expect(normalizeApiProblem(axiosFailure(503, {}))).toMatchObject({
      kind: 'server',
      status: 503,
    })
  })

  it('distinguishes cancellation, timeout, and offline failures', () => {
    expect(normalizeApiProblem(new axios.CanceledError())).toMatchObject({
      kind: 'cancelled',
    })
    expect(
      normalizeApiProblem(new AxiosError('timeout', 'ECONNABORTED')),
    ).toMatchObject({ kind: 'timeout' })
    expect(
      normalizeApiProblem(new AxiosError('network', 'ERR_NETWORK')),
    ).toMatchObject({
      kind: 'network',
    })
  })
})

describe('isProblemCode', () => {
  const conflict = (code: string) =>
    axiosFailure(409, { error: { code, message: 'Conflict' } })

  it('matches a code whatever convention Core wrote it in', () => {
    // `ErrorCodes` constants are UPPER_SNAKE; the shipping and integration
    // services throw lower_snake literals. Both have to be recognisable.
    expect(
      isProblemCode(conflict('ORDER_INVALID_STATUS'), 'ORDER_INVALID_STATUS'),
    ).toBe(true)
    expect(
      isProblemCode(conflict('ORDER_INVALID_STATUS'), 'order_invalid_status'),
    ).toBe(true)
    expect(
      isProblemCode(
        conflict('delivery_not_configured'),
        'DELIVERY_NOT_CONFIGURED',
      ),
    ).toBe(true)
  })

  it('does not match a different code or a failure without one', () => {
    expect(
      isProblemCode(conflict('ORDER_INVALID_STATUS'), 'PARTS_NOT_AVAILABLE'),
    ).toBe(false)
    expect(isProblemCode(axiosFailure(500, {}), 'ORDER_INVALID_STATUS')).toBe(
      false,
    )
    expect(isProblemCode(new Error('boom'), 'ORDER_INVALID_STATUS')).toBe(false)
  })
})

describe('fallback messages follow the request locale', () => {
  afterEach(() => requestLocale.set(null))

  it('uses Ukrainian before a locale is known', () => {
    expect(normalizeApiProblem(axiosFailure(500, {})).message).toBe(
      'Сталася помилка сервера. Спробуйте пізніше.',
    )
  })

  it('uses the interface locale the requests carry', () => {
    requestLocale.set('en-GB')
    expect(normalizeApiProblem(axiosFailure(403, {})).message).toBe(
      'You don’t have access to this action.',
    )
    requestLocale.set('pl')
    expect(normalizeApiProblem(new Error('boom')).message).toBe(
      'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.',
    )
  })

  it('replaces unknown server text with an interface-language fallback', () => {
    requestLocale.set('en-GB')
    expect(
      normalizeApiProblem(axiosFailure(409, { message: 'Вже існує' })).message,
    ).toBe('Couldn’t complete the action because of a data conflict.')
  })
})

describe('part editing restrictions', () => {
  afterEach(() => requestLocale.set(null))

  it.each([
    [
      'uk',
      'reserved',
      'Запчастина у резерві. Редагування та зміна ціни недоступні.',
    ],
    [
      'uk',
      'sold',
      'Запчастину вже продано. Редагування та зміна ціни недоступні.',
    ],
    [
      'en-GB',
      'reserved',
      'This part is reserved. Editing and price changes are unavailable.',
    ],
    [
      'en-GB',
      'sold',
      'This part has been sold. Editing and price changes are unavailable.',
    ],
    [
      'pl',
      'reserved',
      'Ta część jest zarezerwowana. Edycja i zmiana ceny są niedostępne.',
    ],
    [
      'pl',
      'sold',
      'Ta część została sprzedana. Edycja i zmiana ceny są niedostępne.',
    ],
  ] as const)(
    'explains %s / %s after client and screen normalisation',
    (locale, status, message) => {
      requestLocale.set(locale)
      const problem = normalizeApiProblem(
        axiosFailure(409, {
          error: {
            code: 'PART_NOT_EDITABLE',
            message: `Part is ${status} and cannot be edited.`,
          },
        }),
      )
      expect(problem).toMatchObject({
        code: 'PART_NOT_EDITABLE',
        status: 409,
        message,
      })
      expect(normalizeApiProblem(problem).message).toBe(message)
    },
  )

  it('keeps a safe editing explanation when the server omits the status', () => {
    expect(
      normalizeApiProblem(
        axiosFailure(409, {
          error: { code: 'PART_NOT_EDITABLE', message: 'private diagnostic' },
        }),
      ).message,
    ).toBe(
      'Редагування та зміна ціни недоступні: запчастина у резерві або вже продана.',
    )
  })
})
