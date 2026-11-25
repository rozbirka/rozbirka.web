/* eslint-disable @typescript-eslint/unbound-method -- Vitest spies are asserted directly. */
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { LocaleProvider } from '@/i18n'
import type { DeliveryOrder } from '@/api/delivery'
import { deliveryApi } from '@/api/delivery'
import { shippingApi, type ExternalShipmentPreview } from '@/api/shipping'
import { ExternalWaybillSheet } from './ExternalWaybillSheet'
import { DeliveryConfigureCard } from './DeliveryConfigureCard'

vi.mock('@/api/shipping', () => ({
  shippingApi: { previewExternal: vi.fn(), confirmExternal: vi.fn() },
}))
vi.mock('@/api/delivery', () => ({ deliveryApi: { configure: vi.fn() } }))
const number = '20451200987731'
const contact = {
  name: 'Новий отримувач',
  phone: '+380672145508',
  warehouseRef: 'branch',
  settlementRef: 'town',
  warehouseName: 'Відділення №5',
  settlementName: 'Львів',
}
const preview = (
  over: Partial<ExternalShipmentPreview> = {},
): ExternalShipmentPreview => ({
  number,
  fingerprint: 'fp',
  shipmentVersion: null,
  agreedTotalUah: 1000,
  providerStatus: '1',
  sender: { ...contact, name: 'Відправник' },
  recipient: contact,
  codAmountUah: 700,
  recordsDispatch: false,
  recordsReceipt: false,
  importedDetails: {
    recipient: contact,
    parcels: null,
    declaredValueUah: null,
    payerType: null,
    description: null,
    weightKg: 12,
    seatsAmount: 2,
  },
  ...over,
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(shippingApi.previewExternal).mockResolvedValue(preview())
})
const show = () => {
  const onAttached = vi.fn()
  const onClose = vi.fn()
  const rendered = render(
    <ExternalWaybillSheet
      delivery={null}
      integrationId="int-1"
      orderId="order-1"
      orderNumber={361}
      shipment={null}
      onAttached={onAttached}
      onClose={onClose}
    />,
  )
  return {
    unmount: rendered.unmount,
    user: userEvent.setup(),
    onAttached,
    onClose,
    sheet: screen.getByRole('dialog'),
  }
}
const enter = async (
  user: ReturnType<typeof userEvent.setup>,
  amount = '1000',
) => {
  await user.type(screen.getByLabelText(/Номер накладної/), number)
  await user.type(screen.getByLabelText(/Погоджена сума замовлення/), amount)
  await user.click(screen.getByRole('button', { name: 'Перевірити накладну' }))
  await screen.findByText('Попередній перегляд')
}
it('requires a manually entered total on an ordinary order, previews facts and confirms only explicitly', async () => {
  const { user, onAttached, sheet } = show()
  await user.type(screen.getByLabelText(/Номер накладної/), number)
  expect(
    screen.getByRole('button', { name: 'Перевірити накладну' }),
  ).toBeDisabled()
  expect(screen.getByLabelText(/Погоджена сума замовлення/)).toHaveValue('')
  await user.type(screen.getByLabelText(/Погоджена сума замовлення/), '1000,00')
  await user.keyboard('{Enter}')
  await screen.findByText('Попередній перегляд')
  expect(shippingApi.previewExternal).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    number,
    1000,
  )
  expect(sheet).toHaveTextContent('Новий отримувач')
  expect(sheet).toHaveTextContent('2 місця · 12 кг')
  expect(sheet).toHaveTextContent('Немає даних')
  expect(sheet).toHaveTextContent('Створено')
  expect(shippingApi.confirmExternal).not.toHaveBeenCalled()
  // Existing ordinary-order payments are authoritative in Core; COD need not equal the total.
  vi.mocked(shippingApi.confirmExternal).mockResolvedValue({
    orderId: 'order-1',
  } as DeliveryOrder)
  await user.click(
    screen.getByRole('button', { name: 'Прив’язати до замовлення' }),
  )
  expect(shippingApi.confirmExternal).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    preview(),
  )
  expect(onAttached).toHaveBeenCalled()
})
it.each(['amount', 'number'])(
  'invalidates the reviewed snapshot after editing %s',
  async (field) => {
    const { user } = show()
    await enter(user)
    const input = screen.getByLabelText(
      field === 'amount' ? /Погоджена сума замовлення/ : /Номер накладної/,
    )
    await user.clear(input)
    await user.type(input, field === 'amount' ? '1200' : '20451200987732')
    expect(screen.queryByText('Попередній перегляд')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Прив’язати до замовлення' }),
    ).not.toBeInTheDocument()
    expect(shippingApi.confirmExternal).not.toHaveBeenCalled()
  },
)
it('supports an explicitly entered zero and refuses amounts above Core ceiling', async () => {
  const { user } = show()
  await user.type(screen.getByLabelText(/Номер накладної/), number)
  const amount = screen.getByLabelText(/Погоджена сума замовлення/)
  await user.type(amount, '99999999999')
  expect(
    screen.getByRole('button', { name: 'Перевірити накладну' }),
  ).toBeDisabled()
  await user.clear(amount)
  await user.type(amount, '0')
  await user.click(screen.getByRole('button', { name: 'Перевірити накладну' }))
  expect(shippingApi.previewExternal).toHaveBeenCalledWith(
    'int-1',
    'order-1',
    number,
    0,
  )
})
it.each([
  ['shipment_cod_mismatch', /Післяплата НП не збігається/],
  ['shipment_payment_currency_mismatch', /є оплати в іншій валюті/],
  ['shipment_identity_unverified', /НП не надала повних даних/],
])(
  'explains %s and focuses the error without changing entered values',
  async (code, message) => {
    vi.mocked(shippingApi.previewExternal).mockRejectedValueOnce({
      kind: 'conflict',
      code,
      message: String(code),
      status: 409,
    })
    const { user, onAttached } = show()
    await user.type(screen.getByLabelText(/Номер накладної/), number)
    await user.type(screen.getByLabelText(/Погоджена сума замовлення/), '1000')
    await user.click(
      screen.getByRole('button', { name: 'Перевірити накладну' }),
    )
    const error = await screen.findByText(message)
    await waitFor(() => expect(error.closest('[tabindex="-1"]')).toHaveFocus())
    expect(screen.getByLabelText(/Погоджена сума замовлення/)).toHaveValue(
      '1000',
    )
    expect(onAttached).not.toHaveBeenCalled()
    expect(shippingApi.confirmExternal).not.toHaveBeenCalled()
  },
)
it('refreshes a stale preview and requires a second explicit confirmation', async () => {
  const { user, onAttached } = show()
  vi.mocked(shippingApi.confirmExternal).mockRejectedValueOnce({
    kind: 'conflict',
    code: 'shipment_preview_stale',
    message: 'shipment_preview_stale',
    status: 409,
  })
  await enter(user)
  vi.mocked(shippingApi.previewExternal).mockResolvedValueOnce(
    preview({ fingerprint: 'fresh', recordsDispatch: true }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Прив’язати до замовлення' }),
  )
  await screen.findByText('Стан ТТН змінився')
  expect(shippingApi.confirmExternal).toHaveBeenCalledTimes(1)
  expect(onAttached).not.toHaveBeenCalled()
  vi.mocked(shippingApi.confirmExternal).mockResolvedValue({
    orderId: 'order-1',
  } as DeliveryOrder)
  await user.click(
    screen.getByRole('button', { name: 'Прив’язати до замовлення' }),
  )
  expect(shippingApi.confirmExternal).toHaveBeenLastCalledWith(
    'int-1',
    'order-1',
    expect.objectContaining({ fingerprint: 'fresh' }),
  )
})
it('blocks duplicate preview requests and closing while checking, then preserves focus and entered values on error', async () => {
  const { user, onClose } = show()
  let reject!: (reason: unknown) => void
  vi.mocked(shippingApi.previewExternal).mockReturnValue(
    new Promise((_, fail) => {
      reject = fail
    }),
  )
  await user.type(screen.getByLabelText(/Номер накладної/), number)
  await user.type(screen.getByLabelText(/Погоджена сума замовлення/), '1000')
  await user.keyboard('{Enter}{Enter}')
  expect(shippingApi.previewExternal).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  reject({
    kind: 'conflict',
    code: 'shipment_cod_mismatch',
    message: 'shipment_cod_mismatch',
    status: 409,
  })
  const error = await screen.findByText(/Післяплата НП не збігається/)
  await waitFor(() => expect(error.closest('[tabindex="-1"]')).toHaveFocus())
  expect(screen.getByLabelText(/Погоджена сума замовлення/)).toHaveValue('1000')
})
it('opens ordinary-order attachment without configuring delivery', async () => {
  const onAttach = vi.fn()
  render(
    <MemoryRouter>
      <DeliveryConfigureCard
        connection={{
          integrationId: 'int-1',
          carrier: null,
          disconnected: null,
        }}
        integrationsPath={null}
        mutationsAllowed
        onAttach={onAttach}
        onConfigured={vi.fn()}
        orderId="order-1"
      />
    </MemoryRouter>,
  )
  await userEvent
    .setup()
    .click(
      within(screen.getByRole('region', { name: /Доставка/ })).getByRole(
        'button',
        { name: 'Прив’язати накладну з кабінету НП' },
      ),
    )
  expect(onAttach).toHaveBeenCalledTimes(1)
  expect(deliveryApi.configure).not.toHaveBeenCalled()
})

it.each([
  [
    'uk',
    'Вкажіть погоджену з покупцем суму товарів. Оплати залишаться без змін.',
  ],
  [
    'en-GB',
    'Enter the goods total agreed with the customer. Existing payments stay unchanged.',
  ],
  [
    'pl',
    'Podaj kwotę towarów uzgodnioną z kupującym. Dotychczasowe płatności pozostaną bez zmian.',
  ],
] as const)('localizes the manual total guidance in %s', (locale, hint) => {
  render(
    <LocaleProvider locale={locale}>
      <ExternalWaybillSheet
        delivery={null}
        integrationId="int-1"
        orderId="order-1"
        orderNumber={361}
        shipment={null}
        onAttached={vi.fn()}
        onClose={vi.fn()}
      />
    </LocaleProvider>,
  )
  expect(screen.getByText(hint)).toBeVisible()
})

it('does not publish a late attachment result into an order screen that has unmounted', async () => {
  const { user, unmount, onAttached } = show()
  await enter(user)
  let resolve!: (value: DeliveryOrder) => void
  vi.mocked(shippingApi.confirmExternal).mockReturnValue(
    new Promise((accept) => {
      resolve = accept
    }),
  )
  await user.click(
    screen.getByRole('button', { name: 'Прив’язати до замовлення' }),
  )
  unmount()
  resolve({ orderId: 'order-1' } as DeliveryOrder)
  await waitFor(() =>
    expect(shippingApi.confirmExternal).toHaveBeenCalledTimes(1),
  )
  expect(onAttached).not.toHaveBeenCalled()
})
