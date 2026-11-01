/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi, type Integration } from '@/api/integrations'
import { shippingApi } from '@/api/shipping'
import { useTenantSettings } from '@/auth/useTenantSettings'
import type { TenantSettings } from '@/api/tenant-settings'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { WaybillsScreen } from './WaybillsScreen'

vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('@/auth/useTenantSettings', () => ({ useTenantSettings: vi.fn() }))
vi.mock('@/api/integrations', () => ({ integrationsApi: { list: vi.fn() } }))
vi.mock('@/api/shipping', () => ({
  shippingApi: {
    list: vi.fn().mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    }),
  },
}))

const cabinet = (permissions: string[]) =>
  ({
    status: 'ready',
    targetTenant: { slug: 'koval' },
    snapshot: {
      permissions: new Set(permissions),
      features: new Set(),
      entitlement: { state: 'active', usage: {} },
    },
  }) as unknown as ReturnType<typeof useCabinet>

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/app/koval/sales/waybills']}>
      <Routes>
        <Route
          element={<WaybillsScreen definition={cabinetModules.waybills} />}
          path="/app/koval/sales/waybills"
        />
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['orders.view', 'team.manage']))
  vi.mocked(useTenantSettings).mockReturnValue({
    countryCode: 'UA',
  } as TenantSettings)
  vi.mocked(integrationsApi.list).mockReset()
})

it('lists the waybills of the tenant’s Nova Poshta integration', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([
    { id: 'int-np', code: 'nova_poshta', status: 'active' } as Integration,
  ])
  renderScreen()

  expect(await screen.findByText('Накладних ще немає')).toBeVisible()
  expect(shippingApi.list).toHaveBeenCalledWith(
    'int-np',
    expect.anything(),
    expect.anything(),
  )
})

it('says Nova Poshta is not connected and links to integrations', async () => {
  vi.mocked(integrationsApi.list).mockResolvedValue([])
  renderScreen()

  expect(await screen.findByText('Нову пошту не підключено.')).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Відкрити інтеграції' }),
  ).toHaveAttribute('href', '/app/koval/settings/integrations')
})

it('says Nova Poshta serves Ukraine only, without asking Core', () => {
  vi.mocked(useTenantSettings).mockReturnValue({
    countryCode: 'PL',
  } as TenantSettings)
  renderScreen()

  expect(
    screen.getByText(
      'Доставка Новою поштою доступна лише для бізнесів в Україні.',
    ),
  ).toBeVisible()
  expect(integrationsApi.list).not.toHaveBeenCalled()
})
