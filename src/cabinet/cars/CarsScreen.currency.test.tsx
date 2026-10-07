import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { carsApi } from '@/api/cars'
import { tenantsApi } from '@/api/tenants'
import type { Tenant } from '@/api/types'
import type { SupportedCurrency } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { CarsScreen } from './CarsScreen'

/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */

vi.mock('@/api/cars', () => ({
  isCarStatus: (value: unknown) => value === 'active' || value === 'archived',
  carsApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    createExpense: vi.fn(),
  },
}))
vi.mock('@/api/media', () => ({
  mediaApi: { upload: vi.fn(), remove: vi.fn() },
}))
vi.mock('@/api/tenants', () => ({ tenantsApi: { list: vi.fn() } }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const tenant = (
  accountingCurrency: SupportedCurrency | null,
  currencyLocked: boolean,
): Tenant => ({
  id: 'tenant-1',
  name: 'Demo Yard',
  slug: 'demo',
  plan: 'active',
  planTier: 'pro',
  city: null,
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T00:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
  accountingCurrency,
  currencyLocked,
})

const cabinet = (current: Tenant, role: string) => ({
  status: 'ready' as const,
  targetTenant: current,
  snapshot: {
    userId: 'user-1',
    tenantId: 'tenant-1',
    generation: 1,
    role,
    permissions: new Set([
      'cars.view',
      'cars.manage',
      'finance.view',
      'finance.manage',
      'team.view',
    ]),
    features: new Set<string>(),
    entitlement: {
      state: 'active' as const,
      usage: {
        cars: { used: 0, max: 5 },
        intakes: { used: 0, max: 5 },
        parts: { used: 0, max: 5 },
        users: { used: 0, max: 5 },
        cashRegisters: { used: 0, max: 5 },
      },
    },
    subscription: null,
  },
  error: null,
  retry: vi.fn(),
  switchTenant: vi.fn(),
})

const renderNewCar = () =>
  render(
    <MemoryRouter initialEntries={['/app/demo/cars/new']}>
      <Routes>
        <Route path="/app/:tenant/cars/new" element={<CarsScreen />} />
        <Route path="/app/:tenant/cars/:id" element={<p>Сторінка авто</p>} />
      </Routes>
    </MemoryRouter>,
  )

const fillCar = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole('textbox', { name: 'Код' }), 'CAR-001')
  await user.click(screen.getByRole('button', { name: 'Марка' }))
  await user.click(await screen.findByRole('option', { name: 'BMW' }))
  await user.click(screen.getByRole('button', { name: 'Модель' }))
  await user.click(await screen.findByRole('option', { name: 'X5' }))
  await user.type(screen.getByRole('textbox', { name: 'Рік' }), '2020')
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(carsApi.create).mockResolvedValue({ id: 'car-9' } as never)
  vi.stubGlobal(
    'fetch',
    vi.fn((input: string | URL | Request) => {
      const href =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            href.includes('GetModels')
              ? { Results: [{ Model_ID: 1719, Model_Name: 'X5' }] }
              : { Results: [{ MakeId: 452, MakeName: 'BMW' }] },
          ),
      })
    }),
  )
})

describe('car purchase price and the accounting currency', () => {
  it('asks a worker to turn to the owner when no currency is chosen', () => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(tenant(null, false), 'manager'),
    )
    renderNewCar()

    expect(
      screen.getByRole('textbox', { name: 'Ціна придбання' }),
    ).toBeDisabled()
    expect(
      screen.getByText('Перед збереженням ціни оберіть валюту обліку'),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Зверніться до власника розбірки, щоб він обрав валюту.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('link', { name: /Обрати валюту обліку/ }),
    ).toBeNull()
  })

  it('links the owner to the setting and back to this form', () => {
    vi.mocked(useCabinet).mockReturnValue(cabinet(tenant(null, false), 'Owner'))
    renderNewCar()

    expect(
      screen.getByRole('link', { name: 'Обрати валюту обліку →' }),
    ).toHaveAttribute(
      'href',
      `/app/demo/settings/business?return_to=${encodeURIComponent('/app/demo/cars/new')}`,
    )
  })

  it('shows the code and warns that the first price, even 0, locks it', async () => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(tenant('PLN', false), 'Owner'),
    )
    const user = userEvent.setup()
    renderNewCar()

    const price = screen.getByRole('textbox', { name: 'Ціна придбання' })
    expect(price).toHaveAccessibleDescription(
      'У валюті обліку: PLN, Польський злотий',
    )
    expect(screen.queryByText(/буде зафіксовано/)).toBeNull()

    await user.type(price, '0')
    expect(
      screen.getByText(
        'Після збереження цієї ціни валюту обліку PLN буде зафіксовано.',
      ),
    ).toBeVisible()

    await user.clear(price)
    expect(screen.queryByText(/буде зафіксовано/)).toBeNull()
  })

  it('does not warn once the currency is locked', async () => {
    vi.mocked(useCabinet).mockReturnValue(cabinet(tenant('USD', true), 'Owner'))
    const user = userEvent.setup()
    renderNewCar()

    await user.type(
      screen.getByRole('textbox', { name: 'Ціна придбання' }),
      '10',
    )
    expect(screen.queryByText(/буде зафіксовано/)).toBeNull()
  })

  it('stops on a currency changed meanwhile and saves only when confirmed', async () => {
    vi.mocked(useCabinet).mockReturnValue(
      cabinet(tenant('USD', false), 'Owner'),
    )
    vi.mocked(tenantsApi.list).mockResolvedValue([tenant('EUR', false)])
    const user = userEvent.setup()
    renderNewCar()

    await fillCar(user)
    await user.type(
      screen.getByRole('textbox', { name: 'Ціна придбання' }),
      '180',
    )
    await user.click(
      screen.getAllByRole('button', { name: 'Створити автомобіль' })[0]!,
    )

    expect(
      await screen.findByText('Ціну не збережено: валюта обліку змінилася'),
    ).toBeVisible()
    expect(
      screen.getByText(/змінено з USD на EUR\. Перевірте суму/),
    ).toBeVisible()
    expect(carsApi.create).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Ціна придбання' })).toHaveValue(
      '180',
    )

    await user.click(screen.getByRole('button', { name: 'Зберегти в EUR' }))
    expect(await screen.findByText('Сторінка авто')).toBeVisible()
    expect(carsApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ purchasePrice: 180 }),
      expect.anything(),
    )
  })
})
