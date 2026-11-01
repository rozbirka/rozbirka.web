/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi, type Integration } from '@/api/integrations'
import type { Tenant } from '../api/types'
import type { TenantAccessSnapshot } from './access-types'
import { CabinetNavigation } from './CabinetNavigation'
import { forgetNovaPoshtaPresence } from './nova-poshta-presence'

vi.mock('@/api/integrations', () => ({ integrationsApi: { list: vi.fn() } }))

const tenant = (countryCode: Tenant['countryCode'] = 'UA'): Tenant => ({
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: 'Київ',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
  countryCode,
})

const snapshot = (permissions: string[]): TenantAccessSnapshot => ({
  userId: 'user-1',
  tenantId: 'tenant-1',
  generation: 1,
  role: 'owner',
  permissions: new Set(permissions),
  features: new Set(),
  entitlement: {
    state: 'active',
    usage: {
      cars: { used: 0, max: 10 },
      intakes: { used: 0, max: 10 },
      parts: { used: 0, max: 10 },
      users: { used: 0, max: 10 },
      cashRegisters: { used: 0, max: 10 },
    },
  },
  subscription: null,
})

const renderNavigation = (
  permissions: string[],
  country?: Tenant['countryCode'],
) =>
  render(
    <MemoryRouter initialEntries={['/app/koval/orders']}>
      <CabinetNavigation
        onLogout={vi.fn()}
        onSwitchTenant={vi.fn()}
        snapshot={snapshot(permissions)}
        tenant={tenant(country)}
        tenants={[tenant(country)]}
      />
    </MemoryRouter>,
  )

const desktop = () =>
  screen.getByRole('navigation', { name: 'Навігація кабінету' })

const nova = (status: Integration['status']) =>
  ({ id: 'int-1', code: 'nova_poshta', status }) as Integration

beforeEach(() => {
  forgetNovaPoshtaPresence()
  vi.mocked(integrationsApi.list).mockReset()
})

it('shows «Накладні НП» under «Продажі» once Nova Poshta is connected', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([nova('active')])
  renderNavigation(['orders.view', 'team.manage'])

  expect(
    await within(desktop()).findByRole('link', { name: 'Накладні НП' }),
  ).toHaveAttribute('href', '/app/koval/sales/waybills')
})

it('hides it for a tenant that never connected Nova Poshta', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([nova('draft')])
  renderNavigation(['orders.view', 'team.manage'])

  await vi.waitFor(() => expect(integrationsApi.list).toHaveBeenCalled())
  await Promise.resolve()
  expect(
    within(desktop()).queryByRole('link', { name: 'Накладні НП' }),
  ).toBeNull()
})

it('hides it outside Ukraine without asking Core', () => {
  renderNavigation(['orders.view', 'team.manage'], 'PL')

  expect(
    within(desktop()).queryByRole('link', { name: 'Накладні НП' }),
  ).toBeNull()
  expect(integrationsApi.list).not.toHaveBeenCalled()
})

it('keeps it for an account that cannot list integrations', () => {
  renderNavigation(['orders.view'])

  expect(
    within(desktop()).getByRole('link', { name: 'Накладні НП' }),
  ).toBeVisible()
  expect(integrationsApi.list).not.toHaveBeenCalled()
})

it('needs the orders view right', () => {
  renderNavigation(['parts.view'])

  expect(
    within(desktop()).queryByRole('link', { name: 'Накладні НП' }),
  ).toBeNull()
})
