import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import type { DeliveryOrder } from '@/api/delivery'
import { LocaleProvider } from '@/i18n'
import { DeliveryConfigureCard } from './DeliveryConfigureCard'
import type { DeliveryOrderState } from './use-delivery-order'

const configure = vi.hoisted(() => vi.fn())
vi.mock('@/api/delivery', () => ({ deliveryApi: { configure } }))

const connection = (
  over: Partial<DeliveryOrderState> = {},
): Pick<DeliveryOrderState, 'integrationId' | 'carrier' | 'disconnected'> => ({
  integrationId: null,
  carrier: { status: 'missing', errorCode: null },
  disconnected: null,
  ...over,
})

const props = () => ({
  connection: connection(),
  integrationsPath: '/app/garage/settings/integrations' as string | null,
  mutationsAllowed: true,
  onConfigured: vi.fn(),
  orderId: 'order-1',
})

beforeEach(() => vi.clearAllMocks())

it.each(['missing', 'draft'])(
  'offers connection instead of configuring an order when NP is %s',
  (status) => {
    const value = props()
    value.connection = connection({ carrier: { status, errorCode: null } })
    render(
      <MemoryRouter>
        <DeliveryConfigureCard {...value} />
      </MemoryRouter>,
    )

    const card = screen.getByRole('region', { name: 'Доставка Новою поштою' })
    expect(card).toHaveTextContent(
      'Підключіть інтеграцію, щоб створювати накладні із замовлення.',
    )
    expect(
      within(card).getByRole('link', { name: 'Підключити' }),
    ).toHaveAttribute('href', '/app/garage/settings/integrations')
    expect(
      screen.queryByRole('button', { name: 'Оформити доставку' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Прив’язати накладну/ }),
    ).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(configure).not.toHaveBeenCalled()
  },
)

it('explains who can connect NP without offering settings access', () => {
  render(
    <MemoryRouter>
      <DeliveryConfigureCard {...props()} integrationsPath={null} />
    </MemoryRouter>,
  )
  expect(
    screen.getByText('Для підключення зверніться до адміністратора розбірки.'),
  ).toBeVisible()
  expect(screen.queryByRole('link')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})

it('preserves the carrier failure instead of presenting it as a missing setup', () => {
  const value = props()
  value.connection = connection({
    carrier: { status: 'error', errorCode: 'integration_account_unverified' },
  })
  render(
    <MemoryRouter>
      <DeliveryConfigureCard {...value} />
    </MemoryRouter>,
  )
  expect(screen.getByText(/Нова пошта недоступна/)).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Відкрити інтеграції' }),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: 'Оформити доставку' })).toBeNull()
})

it('does not offer Nova Poshta setup outside Ukraine', () => {
  render(
    <MemoryRouter>
      <DeliveryConfigureCard {...props()} novaPoshtaAvailable={false} />
    </MemoryRouter>,
  )
  expect(screen.queryByRole('link', { name: 'Підключити' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Оформити доставку' })).toBeNull()
  expect(screen.getByRole('region', { name: 'Доставка' })).toBeVisible()
})

it.each(['form', 'attach'] as const)(
  'continues active delivery booking through %s',
  async (action) => {
    const value = props()
    value.connection = connection({ integrationId: 'int-1', carrier: null })
    const money = { orderId: 'order-1' } as DeliveryOrder
    configure.mockResolvedValue(money)
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <DeliveryConfigureCard {...value} />
      </MemoryRouter>,
    )
    await user.click(
      screen.getByRole('button', {
        name:
          action === 'form'
            ? 'Оформити доставку'
            : 'Прив’язати накладну з кабінету НП',
      }),
    )
    expect(value.onConfigured).toHaveBeenCalledWith(money, action)
    expect(configure).toHaveBeenCalledWith('order-1')
  },
)

it.each([
  ['en-GB', 'Delivery with Nova Poshta', 'Connect'],
  ['pl', 'Dostawa przez Nova Poshta', 'Połącz'],
] as const)('localizes the connection entry in %s', (locale, title, action) => {
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter>
        <DeliveryConfigureCard {...props()} />
      </MemoryRouter>
    </LocaleProvider>,
  )
  expect(screen.getByRole('region', { name: title })).toBeVisible()
  expect(screen.getByRole('link', { name: action })).toBeVisible()
})
