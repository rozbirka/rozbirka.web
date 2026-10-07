import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { afterEach, describe, expect, it } from 'vitest'
import { businessApi } from './business'
import { apiClient } from './client'
import { normalizeTenant, tenantSettings } from './tenant-settings'
import { tenantsApi } from './tenants'
import type { Tenant } from './types'

const baseTenant: Tenant = {
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: null,
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: false,
}

function response<T>(
  config: InternalAxiosRequestConfig,
  data: T,
): AxiosResponse<T> {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: new AxiosHeaders(),
    config,
  }
}

const originalAdapter = apiClient.defaults.adapter!

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('normalizeTenant', () => {
  it('keeps supported business settings', () => {
    expect(
      normalizeTenant({
        ...baseTenant,
        countryCode: 'PL',
        timeZoneId: 'Europe/Warsaw',
        documentLanguage: 'pl',
        accountingCurrency: 'PLN',
        regionLocked: true,
        currencyLocked: false,
      }),
    ).toMatchObject({
      countryCode: 'PL',
      timeZoneId: 'Europe/Warsaw',
      documentLanguage: 'pl',
      accountingCurrency: 'PLN',
      regionLocked: true,
      currencyLocked: false,
    })
  })

  it('treats missing and unknown values as unknown, not as defaults', () => {
    const raw = {
      ...baseTenant,
      countryCode: 'DE',
      timeZoneId: 'Mars/Olympus',
      documentLanguage: 'de',
      accountingCurrency: 'RUB',
      regionLocked: 'yes',
    } as unknown as Tenant
    expect(normalizeTenant(raw)).toMatchObject({
      countryCode: null,
      timeZoneId: null,
      documentLanguage: null,
      accountingCurrency: null,
      regionLocked: null,
      currencyLocked: null,
    })
    expect(normalizeTenant(baseTenant).accountingCurrency).toBeNull()
  })

  it('accepts camelCase enum serialisation of the currency', () => {
    const raw = {
      ...baseTenant,
      accountingCurrency: 'gbp',
    } as unknown as Tenant
    expect(normalizeTenant(raw).accountingCurrency).toBe('GBP')
  })
})

describe('tenantSettings', () => {
  it('falls back to Kyiv time only for display, and says so', () => {
    expect(tenantSettings(null)).toEqual({
      countryCode: null,
      timeZone: 'Europe/Kyiv',
      timeZoneKnown: false,
      documentLanguage: null,
      accountingCurrency: null,
      regionLocked: null,
      currencyLocked: null,
    })
    expect(
      tenantSettings({
        ...baseTenant,
        timeZoneId: 'Europe/London',
        accountingCurrency: 'JPY',
        currencyLocked: true,
      }),
    ).toMatchObject({
      timeZone: 'Europe/London',
      timeZoneKnown: true,
      accountingCurrency: 'JPY',
      currencyLocked: true,
    })
  })
})

describe('tenant adapters', () => {
  it('normalizes tenants from the list endpoint', async () => {
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(
        response(config, [
          { ...baseTenant, accountingCurrency: 'USD', countryCode: 'UA' },
          { ...baseTenant, id: 'tenant-2', accountingCurrency: 'XXX' },
        ]),
      )

    const [first, second] = await tenantsApi.list()
    expect(first).toMatchObject({
      accountingCurrency: 'USD',
      countryCode: 'UA',
    })
    expect(second).toMatchObject({
      accountingCurrency: null,
      countryCode: null,
    })
  })

  it('sends business settings in the tenant patch and normalizes the reply', async () => {
    let observed: InternalAxiosRequestConfig | undefined
    apiClient.defaults.adapter = (config) => {
      observed = config
      return Promise.resolve(
        response(config, {
          ...baseTenant,
          countryCode: 'GB',
          timeZoneId: 'Europe/London',
          documentLanguage: 'en-GB',
          accountingCurrency: 'GBP',
        }),
      )
    }

    const updated = await businessApi.update('tenant-1', {
      countryCode: 'GB',
      timeZoneId: 'Europe/London',
      documentLanguage: 'en-GB',
      accountingCurrency: 'GBP',
    })

    expect(observed?.data).toBe(
      JSON.stringify({
        countryCode: 'GB',
        timeZoneId: 'Europe/London',
        documentLanguage: 'en-GB',
        accountingCurrency: 'GBP',
      }),
    )
    expect(updated).toMatchObject({
      accountingCurrency: 'GBP',
      regionLocked: null,
      currencyLocked: null,
    })
  })
})
