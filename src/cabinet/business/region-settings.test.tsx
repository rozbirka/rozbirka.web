/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { beforeEach, expect, it, vi } from 'vitest'
import { businessApi } from '@/api/business'
import type { Tenant } from '@/api/types'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { RegionSettings } from './region-settings'

vi.mock('@/api/business', () => ({ businessApi: { update: vi.fn() } }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const tenant: Tenant = {
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: 'Львів',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
  countryCode: 'UA',
  timeZoneId: 'Europe/Kyiv',
  documentLanguage: 'uk',
  accountingCurrency: 'USD',
  regionLocked: false,
  currencyLocked: false,
}

const cabinet = {
  status: 'ready',
  targetTenant: tenant,
  snapshot: {
    userId: 'user-1',
    tenantId: tenant.id,
    generation: 1,
    role: 'Owner',
    permissions: new Set(['team.manage']),
    features: new Set(),
    entitlement: {
      state: 'active',
      usage: {
        cars: { used: 1, max: 10 },
        intakes: { used: 1, max: 10 },
        parts: { used: 1, max: 10 },
        users: { used: 1, max: 10 },
        cashRegisters: { used: 1, max: 10 },
      },
    },
    subscription: null,
    cabinetParityRollout: {
      configuration: JSON.stringify({
        version: 1,
        mode: 'on',
        canaryPercent: 0,
        emergencyOff: false,
      }),
      claim: {
        version: 1,
        subjectId: 'user-1',
        grants: ['cabinet-parity'],
        audiences: [],
      },
    },
  },
  error: null,
  retry: vi.fn(),
  switchTenant: vi.fn(),
} as unknown as CabinetContextValue

const conflict = () =>
  new AxiosError('locked', 'ERR_BAD_REQUEST', undefined, undefined, {
    data: { error: { code: 'BUSINESS_SETTINGS_LOCKED', message: 'locked' } },
    status: 409,
    statusText: 'Conflict',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  })

const onSaved = vi.fn()

function renderRegion(
  overrides: Partial<Tenant> = {},
  role = 'Owner',
  locale: 'uk' | 'en-GB' = 'en-GB',
) {
  return render(
    <LocaleProvider locale={locale}>
      <RegionSettings
        onSaved={onSaved}
        role={role}
        tenant={{ ...tenant, ...overrides }}
      />
    </LocaleProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet)
})

it('lets the owner change the region before the first operation, after confirming', async () => {
  const saved = {
    ...tenant,
    countryCode: 'PL' as const,
    timeZoneId: 'Europe/Warsaw',
    documentLanguage: 'pl' as const,
  }
  vi.mocked(businessApi.update).mockResolvedValue(saved)
  const user = userEvent.setup()
  renderRegion()

  expect(
    screen.getByRole('heading', { name: 'Region and documents' }),
  ).toBeVisible()
  await user.selectOptions(screen.getByLabelText('Business country'), 'PL')
  expect(screen.getByLabelText('Time zone')).toHaveValue('Europe/Warsaw')
  await user.click(screen.getByRole('button', { name: 'Polski' }))
  // The preview follows the document language: Polish date and amount.
  expect(screen.getByText('Data')).toBeVisible()
  expect(screen.getByText(/12\s480,00\sUSD/)).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'Save region' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus()
  await user.click(within(dialog).getByRole('button', { name: 'Save region' }))

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  expect(vi.mocked(businessApi.update).mock.calls[0]?.[1]).toEqual({
    countryCode: 'PL',
    timeZoneId: 'Europe/Warsaw',
    documentLanguage: 'pl',
  })
})

it('shows country and time zone read-only once locked, keeping the document language editable', async () => {
  vi.mocked(businessApi.update).mockResolvedValue({
    ...tenant,
    regionLocked: true,
    documentLanguage: 'en-GB',
  })
  const user = userEvent.setup()
  renderRegion({ regionLocked: true })

  expect(screen.getByText('Locked after the first operation')).toBeVisible()
  expect(screen.queryByLabelText('Business country')).toBeNull()
  expect(screen.getByText('Ukraine')).toBeVisible()

  await user.click(screen.getByRole('button', { name: 'English (UK)' }))
  await user.click(screen.getByRole('button', { name: 'Save region' }))
  // No confirmation: only the document language changes.
  expect(screen.queryByRole('dialog')).toBeNull()
  await waitFor(() =>
    expect(vi.mocked(businessApi.update).mock.calls[0]?.[1]).toEqual({
      documentLanguage: 'en-GB',
    }),
  )
})

it('explains that only the owner can change the region', () => {
  renderRegion({}, 'Manager')
  expect(screen.getByText(/Your role: Manager/)).toBeVisible()
  expect(
    screen.getByText(/Only the account owner can change these settings/),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Save region' })).toBeNull()
})

it('locks the block when the first operation wins the race', async () => {
  vi.mocked(businessApi.update).mockRejectedValue(conflict())
  const user = userEvent.setup()
  renderRegion()

  await user.selectOptions(screen.getByLabelText('Business country'), 'GB')
  await user.click(screen.getByRole('button', { name: 'Save region' }))
  const dialog = await screen.findByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: 'Save region' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The first operation was recorded in the meantime',
  )
  expect(screen.getByText('Locked after the first operation')).toBeVisible()
  expect(onSaved).not.toHaveBeenCalled()
})

it('says when the server does not provide region settings yet', () => {
  renderRegion(
    {
      countryCode: null,
      timeZoneId: null,
      documentLanguage: null,
      regionLocked: null,
    },
    'Owner',
    'uk',
  )
  expect(screen.getByText('Налаштування регіону недоступні')).toBeVisible()
})

it('is the #region deep-link target of the business settings page', () => {
  renderRegion()
  expect(
    screen.getByRole('region', { name: 'Region and documents' }),
  ).toHaveAttribute('id', 'region')
})

it('names what counts as the first operation before it happens', () => {
  renderRegion()
  expect(
    screen.getByText(
      /The first operation is any saved record: a car, batch, part, order, car expense or till transaction/,
    ),
  ).toBeVisible()
})

it('shows a non-owner the region and its lock state without any control', () => {
  renderRegion({ regionLocked: true, documentLanguage: 'pl' }, 'Master')
  expect(screen.getByText(/Your role: Mechanic/)).toBeVisible()
  expect(screen.getByText(/Locked after the first operation/)).toBeVisible()
  expect(screen.getByText(/till transaction/)).toBeVisible()
  expect(screen.getByText('Polski')).toHaveAttribute('lang', 'pl')
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('tells a non-owner the region is not locked yet', () => {
  renderRegion({}, 'Manager')
  expect(
    screen.getByText(
      /Not locked yet: the owner can change the country and time zone/,
    ),
  ).toBeVisible()
})
