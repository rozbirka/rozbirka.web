/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { businessApi } from '@/api/business'
import { tenantsApi } from '@/api/tenants'
import type { BillingState, Tenant } from '@/api/types'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { LocaleProvider } from '@/i18n'
import { ToastProvider } from '@/components/app'
import { BUSINESS_SECTION_IDS } from './business-anchors'
import { BusinessSettingsScreen } from './business-settings-screen'

vi.mock('@/api/business', () => ({ businessApi: { update: vi.fn() } }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
// The accounting currency block re-reads the tenant; here it is locked, so it
// renders as text and adds no controls or alerts to these scenarios.
vi.mock('@/api/tenants', () => ({
  tenantsApi: {
    list: vi.fn(() =>
      Promise.resolve([
        { id: 'tenant-1', accountingCurrency: 'USD', currencyLocked: true },
      ]),
    ),
  },
}))

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
}

const cabinet = (permissions = ['team.manage']) =>
  ({
    status: 'ready',
    targetTenant: tenant,
    snapshot: {
      userId: 'user-1',
      tenantId: tenant.id,
      generation: 4,
      role: 'owner',
      permissions: new Set(permissions),
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
  }) satisfies CabinetContextValue

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(businessApi.update).mockResolvedValue(tenant)
})

it('uses accessible secondary text on the dark business surface', () => {
  const view = render(
    <MemoryRouter initialEntries={['/app/koval/settings/business']}>
      <BusinessSettingsScreen />
    </MemoryRouter>,
  )

  expect(view.container.querySelector('.text-neutral-500')).toBeNull()
})

it('round-trips trimmed business settings through the active tenant', async () => {
  const normalizedTenant = {
    ...tenant,
    name: 'Koval Parts LLC',
    city: 'Буча',
  }
  vi.mocked(businessApi.update).mockResolvedValue(normalizedTenant)
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/app/koval/settings/business']}>
        <BusinessSettingsScreen />
      </MemoryRouter>
    </ToastProvider>,
  )

  await user.clear(screen.getByLabelText('Назва бізнесу'))
  await user.type(screen.getByLabelText('Назва бізнесу'), '  Koval Parts  ')
  await user.clear(screen.getByLabelText('Місто'))
  await user.type(screen.getByLabelText('Місто'), '  Київ  ')
  await user.click(screen.getAllByRole('button', { name: 'Зберегти' })[0]!)

  const updateCall = vi.mocked(businessApi.update).mock.calls[0]
  expect(updateCall?.[0]).toBe('tenant-1')
  expect(updateCall?.[1]).toEqual({
    name: 'Koval Parts',
    city: 'Київ',
  })
  expect(updateCall?.[2]?.signal).toBeInstanceOf(AbortSignal)
  // Saving is confirmed by a toast (module 00 §5), not a notice on the page.
  expect(
    (await screen.findByText('Налаштування бізнесу збережено.')).closest(
      '.rz-toast',
    ),
  ).toHaveAttribute('role', 'status')
  expect(screen.getByLabelText('Назва бізнесу')).toHaveValue('Koval Parts LLC')
  expect(screen.getByLabelText('Місто')).toHaveValue('Буча')
  expect(currentCabinet.switchTenant).toHaveBeenCalledWith('tenant-1')
})

it('rechecks permission immediately before dispatching a business update', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/koval/settings/business']}>
      <BusinessSettingsScreen />
    </MemoryRouter>,
  )

  await user.clear(screen.getByLabelText('Назва бізнесу'))
  await user.type(screen.getByLabelText('Назва бізнесу'), 'Koval Parts')
  currentCabinet.snapshot?.permissions.delete('team.manage')
  await user.click(screen.getAllByRole('button', { name: 'Зберегти' })[0]!)

  expect(businessApi.update).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ви більше не маєте права змінювати налаштування бізнесу.',
  )
})

it('rechecks subscription access immediately before dispatching a business update', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <MemoryRouter initialEntries={['/app/koval/settings/business']}>
      <BusinessSettingsScreen />
    </MemoryRouter>,
  )

  await user.clear(screen.getByLabelText('Назва бізнесу'))
  await user.type(screen.getByLabelText('Назва бізнесу'), 'Koval Parts')
  if (currentCabinet.snapshot?.entitlement) {
    const entitlement = currentCabinet.snapshot.entitlement as {
      state: BillingState
    }
    entitlement.state = 'blocked'
  }
  await user.click(screen.getAllByRole('button', { name: 'Зберегти' })[0]!)

  expect(businessApi.update).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Ви більше не маєте права змінювати налаштування бізнесу.',
  )
})

it('only shows supported business settings and leaves delivery policy to Nova Poshta', async () => {
  render(
    <MemoryRouter initialEntries={['/app/koval/settings/business']}>
      <BusinessSettingsScreen />
    </MemoryRouter>,
  )

  expect(screen.getByLabelText('Назва бізнесу')).toBeEnabled()
  expect(screen.getByLabelText('Місто')).toBeEnabled()
  expect(screen.queryByRole('heading', { name: 'Склади' })).toBeNull()
  expect(screen.queryByText('Складів')).toBeNull()
  expect(screen.queryByRole('link', { name: 'Додати склад' })).toBeNull()
  for (const label of ['ЄДРПОУ / ІПН', 'Телефон', 'Адреса'])
    expect(screen.queryByLabelText(label)).toBeNull()
  for (const label of [
    'ФОП',
    'Експорт усіх даних',
    'Видалити кабінет',
    'Розподіл за вагою',
    'Вручну',
  ])
    expect(screen.queryByRole('button', { name: label })).toBeNull()
  expect(
    screen.queryByRole('switch', { name: 'Вимагати депозит за доставку' }),
  ).toBeNull()
  for (const label of [
    'Дані кабінету',
    'Облік',
    'Собівартість',
    'Контролювати мінімальний залишок',
    'Вимагати VIN при додаванні авто',
    'Дозволити відʼємний залишок',
  ])
    expect(screen.queryByText(label)).toBeNull()
  // Locked settings are real persisted values, so they remain visible as facts.
  expect(await screen.findByText('Зафіксовано')).toBeVisible()
})

it('numbers the sections and anchors region and accounting currency', async () => {
  const view = render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter initialEntries={['/app/koval/settings/business']}>
        <BusinessSettingsScreen />
      </MemoryRouter>
    </LocaleProvider>,
  )

  const region = view.container.querySelector(`#${BUSINESS_SECTION_IDS.region}`)
  const currency = await waitFor(() => {
    const found = view.container.querySelector(
      `#${BUSINESS_SECTION_IDS.accountingCurrency}`,
    )
    expect(found).not.toBeNull()
    return found
  })
  expect(region).toHaveTextContent('02')
  expect(currency).toHaveTextContent('03')
  expect(screen.queryByRole('heading', { name: 'Warehouses' })).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Accounting' })).toBeNull()
  expect(screen.queryByText('Require a delivery deposit')).toBeNull()
  expect(screen.queryByText('Валюти й облік')).toBeNull()
})

it('reads the business back after a lost answer before saying it was not saved', async () => {
  vi.mocked(businessApi.update).mockRejectedValue(
    new AxiosError('timeout', 'ECONNABORTED'),
  )
  vi.mocked(tenantsApi.list).mockResolvedValue([
    {
      ...tenant,
      name: 'Koval Parts',
      accountingCurrency: 'USD',
      currencyLocked: true,
    },
  ])
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter initialEntries={['/app/koval/settings/business']}>
        <BusinessSettingsScreen />
      </MemoryRouter>
    </ToastProvider>,
  )

  await user.clear(screen.getByLabelText('Назва бізнесу'))
  await user.type(screen.getByLabelText('Назва бізнесу'), 'Koval Parts')
  await user.click(screen.getAllByRole('button', { name: 'Зберегти' })[0]!)

  expect(
    (await screen.findByText('Налаштування бізнесу збережено.')).closest(
      '.rz-toast',
    ),
  ).toHaveAttribute('role', 'status')
  expect(businessApi.update).toHaveBeenCalledTimes(1)
  expect(currentCabinet.switchTenant).toHaveBeenCalledWith('tenant-1')
})
