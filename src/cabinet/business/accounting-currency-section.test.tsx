/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AxiosError, AxiosHeaders } from 'axios'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { businessApi } from '@/api/business'
import { tenantsApi } from '@/api/tenants'
import type { Tenant } from '@/api/types'
import { LocaleProvider, type SupportedCurrency } from '@/i18n'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { AccountingCurrencySection } from './accounting-currency-section'

vi.mock('@/api/business', () => ({ businessApi: { update: vi.fn() } }))
vi.mock('@/api/tenants', () => ({ tenantsApi: { list: vi.fn() } }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const base: Tenant = {
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
  requireDeliveryDeposit: true,
}

const withCurrency = (
  accountingCurrency: SupportedCurrency | null,
  currencyLocked: boolean | null,
): Tenant => ({ ...base, accountingCurrency, currencyLocked })

const cabinet = (role = 'Owner', tenant: Tenant = base) =>
  ({
    status: 'ready',
    targetTenant: tenant,
    snapshot: {
      userId: 'user-1',
      tenantId: tenant.id,
      generation: 2,
      role,
      permissions: new Set(['team.view', 'team.manage']),
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
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) satisfies CabinetContextValue

const problem = (status: number | undefined, code?: string) => {
  const error = new AxiosError(
    'failed',
    status === undefined ? 'ERR_NETWORK' : undefined,
  )
  if (status !== undefined) {
    error.response = {
      status,
      statusText: '',
      headers: {},
      config: { headers: new AxiosHeaders() },
      data: code ? { error: { code, message: code } } : {},
    }
  }
  return error
}

function renderSection(search = '', locale: 'uk' | 'en-GB' = 'uk') {
  return render(
    <LocaleProvider locale={locale}>
      <MemoryRouter initialEntries={[`/app/koval/settings/business${search}`]}>
        <AccountingCurrencySection />
      </MemoryRouter>
    </LocaleProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
})

describe('accounting currency block', () => {
  it('shows nothing guessed while loading, then the owner chooses (1a, 1b)', async () => {
    let resolve!: (list: Tenant[]) => void
    vi.mocked(tenantsApi.list).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    vi.mocked(businessApi.update).mockResolvedValue(withCurrency('GBP', false))
    const user = userEvent.setup()
    renderSection()

    expect(screen.getByRole('status')).toHaveTextContent(
      'Завантажуємо валюту обліку…',
    )
    expect(screen.queryByText(/USD/)).toBeNull()

    resolve([withCurrency(null, false)])
    const input = await screen.findByRole('combobox', { name: 'Валюта' })
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeDisabled()

    await user.click(input)
    await user.type(input, 'фунт')
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('GBPФунт стерлінгів')
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('GBP · Фунт стерлінгів')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(businessApi.update).toHaveBeenCalledWith(
      'tenant-1',
      { accountingCurrency: 'GBP' },
      expect.objectContaining({
        signal: expect.any(AbortSignal) as AbortSignal,
      }),
    )
    expect(await screen.findByText('Валюту обліку збережено.')).toBeVisible()
    // Saved but no price yet: change stays possible with the permanent warning.
    expect(screen.getByRole('button', { name: 'Змінити' })).toBeVisible()
    expect(
      screen.getByText(/Після збереження першої ціни її не можна буде змінити/),
    ).toBeVisible()
  })

  it('moves through the list with arrows and closes with Escape', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([withCurrency(null, false)])
    const user = userEvent.setup()
    renderSection()
    const input = await screen.findByRole('combobox', { name: 'Валюта' })

    await user.click(input)
    expect(input).toHaveAttribute('aria-expanded', 'true')
    await user.keyboard('{ArrowDown}{ArrowDown}')
    const active = input.getAttribute('aria-activedescendant')
    expect(active).toMatch(/EUR$/)
    await user.keyboard('{Escape}')
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveFocus()
    expect(input).toHaveValue('')

    await user.type(input, 'xyz')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Нічого не знайдено за «xyz». Спробуйте код, наприклад GBP.',
    )
  })

  it('keeps the choice when Core refuses and says so near the block (1g)', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([withCurrency('USD', false)])
    vi.mocked(businessApi.update).mockRejectedValue(
      problem(400, 'INVALID_BUSINESS_SETTINGS'),
    )
    const user = userEvent.setup()
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Змінити' }))
    const input = screen.getByRole('combobox', { name: 'Валюта' })
    expect(input).toHaveFocus()
    await user.type(input, 'PLN{Enter}')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(
      await screen.findByText(
        'Валюту не збережено. Ваш вибір залишився, спробуйте ще раз.',
      ),
    ).toBeVisible()
    expect(input).toHaveValue('PLN · Польський злотий')
    expect(screen.getByRole('button', { name: 'Зберегти' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Скасувати' }))
    expect(screen.getByRole('button', { name: 'Змінити' })).toHaveFocus()
  })

  it('re-reads after an unknown result and reports only what Core holds', async () => {
    vi.mocked(tenantsApi.list)
      .mockResolvedValueOnce([withCurrency(null, false)])
      .mockResolvedValueOnce([withCurrency('JPY', false)])
    vi.mocked(businessApi.update).mockRejectedValue(problem(undefined))
    const user = userEvent.setup()
    renderSection()

    const input = await screen.findByRole('combobox', { name: 'Валюта' })
    await user.type(input, 'JPY{Enter}')
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText('Валюту обліку збережено.')).toBeVisible()
    expect(tenantsApi.list).toHaveBeenCalledTimes(2)
  })

  it('turns into the locked state when a first price won the race', async () => {
    vi.mocked(tenantsApi.list)
      .mockResolvedValueOnce([withCurrency('USD', false)])
      .mockResolvedValueOnce([withCurrency('USD', true)])
    vi.mocked(businessApi.update).mockRejectedValue(
      problem(409, 'BUSINESS_SETTINGS_LOCKED'),
    )
    const user = userEvent.setup()
    renderSection()

    await user.click(await screen.findByRole('button', { name: 'Змінити' }))
    await user.type(
      screen.getByRole('combobox', { name: 'Валюта' }),
      'EUR{Enter}',
    )
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(await screen.findByText(/уже збережено першу ціну/)).toBeVisible()
    expect(screen.getByText('Зафіксовано')).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('shows a locked currency as text, without a control (1d)', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([withCurrency('USD', true)])
    renderSection()

    expect(await screen.findByText('Зафіксовано')).toBeVisible()
    expect(screen.getByText('Долар США')).toBeVisible()
    expect(
      screen.getByText(/Каси можуть приймати оплату в інших валютах/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Змінити' })).toBeNull()
  })

  it('is read-only for everyone but the owner (1e)', async () => {
    vi.mocked(useCabinet).mockReturnValue(cabinet('manager'))
    vi.mocked(tenantsApi.list).mockResolvedValue([withCurrency(null, false)])
    renderSection()

    expect(await screen.findByText('Валюту обліку ще не обрано')).toBeVisible()
    expect(
      screen.getByText('Валюту обліку налаштовує власник розбірки'),
    ).toBeVisible()
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('offers a retry when the setting cannot be read (1f)', async () => {
    vi.mocked(tenantsApi.list)
      .mockRejectedValueOnce(problem(500))
      .mockResolvedValueOnce([withCurrency('EUR', true)])
    const user = userEvent.setup()
    renderSection()

    expect(
      await screen.findByText('Не вдалося завантажити валюту обліку.'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Повторити' }))
    expect(await screen.findByText('Євро')).toBeVisible()
  })

  it('links back to the price form after choosing', async () => {
    vi.mocked(tenantsApi.list).mockResolvedValue([withCurrency(null, false)])
    vi.mocked(businessApi.update).mockResolvedValue(withCurrency('UAH', false))
    const user = userEvent.setup()
    renderSection(
      `?return_to=${encodeURIComponent('/app/koval/parts/new?car_id=c1')}`,
      'en-GB',
    )

    const input = await screen.findByRole('combobox', { name: 'Currency' })
    await user.type(input, 'hryv{Enter}')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(
      await screen.findByRole('link', { name: 'Back to the form →' }),
    ).toHaveAttribute('href', '/app/koval/parts/new?car_id=c1&draft=1')
  })
})
