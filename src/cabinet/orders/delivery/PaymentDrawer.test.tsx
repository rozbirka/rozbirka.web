/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { cashApi } from '@/api/cash'
import type { DeliveryOrder } from '@/api/delivery'
import { PaymentDrawer } from './PaymentDrawer'

vi.mock('@/api/cash', () => ({
  cashApi: { list: vi.fn(), transactions: vi.fn() },
}))

const delivery = (over: Partial<DeliveryOrder> = {}): DeliveryOrder => ({
  orderId: 'order-1',
  agreedTotalUah: 4600,
  appliedUah: 1000,
  outstandingUah: 3600,
  netReceivedUah: 1000,
  feesUah: 0,
  requiredDepositUah: 360,
  depositShortfallUah: 0,
  depositSatisfied: true,
  depositWaived: false,
  depositRequired: true,
  customerTrusted: false,
  dispatchedAt: null,
  receivedAt: null,
  returnedAt: null,
  awaitingCodReconciliation: false,
  payments: [],
  workflowState: 'Open',
  refundDueUah: 0,
  refundAllocations: [],
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(cashApi.list).mockResolvedValue([
    {
      id: 'cash-1',
      name: 'ФОП Nova Pay',
      type: 'bank',
      isActive: true,
      balances: { UAH: 0 },
    },
  ])
  vi.mocked(cashApi.transactions).mockResolvedValue({
    items: [
      {
        id: 'tx-1',
        type: 'manual_in',
        direction: 'in',
        amount: 3600,
        currency: 'UAH',
        note: 'оплата за двигун',
        createdAt: '2026-09-21T10:58:00Z',
        createdByName: 'Дмитро',
        referenceId: null,
      },
      {
        id: 'tx-2',
        type: 'manual_in',
        direction: 'in',
        amount: 500,
        currency: 'UAH',
        note: 'вже віднесене',
        createdAt: '2026-09-20T10:58:00Z',
        createdByName: 'Дмитро',
        referenceId: 'order-9',
      },
    ],
    page: 1,
    pageSize: 20,
    total: 2,
    totalPages: 1,
  })
})

const renderDrawer = (
  mode: 'record' | 'link' = 'record',
  over: Partial<DeliveryOrder> = {},
  options: {
    accountingCurrency?: string | null
    orderValue?: number | null
    codWaybill?: string | null
    onRecord?: (input: unknown) => Promise<void>
    onClose?: () => void
  } = {},
) => {
  const onRecord = vi.fn(options.onRecord ?? (() => Promise.resolve()))
  const onLink = vi.fn().mockResolvedValue(undefined)
  const onClose = vi.fn(options.onClose ?? (() => undefined))
  render(
    <PaymentDrawer
      accountingCurrency={options.accountingCurrency ?? null}
      orderValue={options.orderValue ?? null}
      codWaybill={options.codWaybill ?? null}
      delivery={delivery(over)}
      mode={mode}
      onClose={onClose}
      onLink={onLink}
      onRecord={onRecord}
      orderNumber={355}
    />,
  )
  return { onLink, onRecord, onClose }
}

it('uses the ordinary payment drawer without delivery gross, fee, presets or calculations', async () => {
  renderDrawer('record', {}, { accountingCurrency: 'USD', orderValue: 100 })
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(await screen.findByLabelText('Сума')).toHaveValue('')
  expect(dialog).toHaveTextContent('Вартість замовлення')
  expect(dialog).toHaveTextContent(/100,00\sUSD/)
  expect(dialog).toHaveTextContent('Фактична оплата')
  expect(dialog).not.toHaveTextContent(
    /брутто|Комісія каси|Погоджено за доставку|Залишиться|Половина/,
  )
  expect(
    screen.queryByRole('button', { name: 'Прив’язати транзакцію' }),
  ).not.toBeInTheDocument()
})

it.each([null, '20451200987731'])(
  'records the exact UAH amount with zero fee and the appropriate payment kind (waybill=%s)',
  async (codWaybill) => {
    const user = userEvent.setup()
    const { onRecord, onClose } = renderDrawer('record', {}, { codWaybill })
    const amount = await screen.findByLabelText('Сума')
    await user.type(amount, '3 600,00')
    await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
    expect(onRecord).toHaveBeenCalledWith({
      accountId: 'cash-1',
      amountUah: 3600,
      feeUah: 0,
      kind: codWaybill === null ? 'prepayment' : 'cod',
    })
    expect(onClose).toHaveBeenCalledOnce()
  },
)

it('does not label an unknown accounting currency as UAH', async () => {
  renderDrawer()
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(dialog).toHaveTextContent('Валюту обліку ще не обрано')
  await screen.findByLabelText('Сума')
})

it('offers only UAH-capable tills including a zero UAH balance and hides foreign currencies', async () => {
  vi.mocked(cashApi.list).mockResolvedValueOnce([
    {
      id: 'foreign',
      name: 'Євро',
      type: 'cash',
      isActive: true,
      balances: { EUR: 100 },
    },
    {
      id: 'multi',
      name: 'Гривні',
      type: 'cash',
      isActive: true,
      balances: { UAH: 0, USD: 100 },
    },
    {
      id: 'archived',
      name: 'Архів',
      type: 'cash',
      isActive: false,
      balances: { UAH: 10 },
    },
  ])
  const user = userEvent.setup()
  const { onRecord } = renderDrawer()
  expect(await screen.findByRole('radio', { name: /Гривні/ })).toBeChecked()
  expect(
    screen.queryByRole('radio', { name: /Євро|Архів/ }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /USD|EUR/ }),
  ).not.toBeInTheDocument()
  await user.type(screen.getByLabelText('Сума'), '15,25')
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(onRecord).toHaveBeenCalledWith({
    accountId: 'multi',
    amountUah: 15.25,
    feeUah: 0,
    kind: 'prepayment',
  })
})

it('does not offer recording into a till without UAH', async () => {
  vi.mocked(cashApi.list).mockResolvedValueOnce([
    {
      id: 'foreign',
      name: 'Євро',
      type: 'cash',
      isActive: true,
      balances: { EUR: 0 },
    },
  ])
  renderDrawer()
  expect(
    await screen.findByText(
      'Для доставки потрібна активна каса з валютою UAH.',
    ),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Записати оплату' })).toBeDisabled()
})

it('rejects more than the payable balance before sending', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer()
  await user.type(await screen.findByLabelText('Сума'), '5000')
  expect(screen.getByLabelText('Сума')).toHaveAccessibleDescription(
    /Сума оплати не може перевищувати 3\s600,00\sUAH/,
  )
  expect(screen.getByRole('button', { name: 'Записати оплату' })).toBeDisabled()
  expect(onRecord).not.toHaveBeenCalled()
})

it('allows only the remaining required deposit when the agreed UAH total is unset', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer('record', {
    agreedTotalUah: 0,
    appliedUah: 100,
    outstandingUah: 0,
    requiredDepositUah: 360,
  })
  const amount = await screen.findByLabelText('Сума')
  await user.type(amount, '261')
  expect(screen.getByRole('button', { name: 'Записати оплату' })).toBeDisabled()
  await user.clear(amount)
  await user.type(amount, '260')
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(onRecord).toHaveBeenCalledWith({
    accountId: 'cash-1',
    amountUah: 260,
    feeUah: 0,
    kind: 'prepayment',
  })
})

it('preserves the amount and does not claim a definite refusal after a timeout', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer(
    'record',
    {},
    {
      onRecord: vi
        .fn()
        .mockRejectedValue({ kind: 'timeout', message: 'Timeout' }),
    },
  )
  const amount = await screen.findByLabelText('Сума')
  await user.type(amount, '120')
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(
    await screen.findByText(
      'Не вдалося зберегти оплату. Дані збережено — спробуйте ще раз.',
    ),
  ).toBeVisible()
  expect(screen.queryByText('Оплату не записано')).not.toBeInTheDocument()
  expect(amount).toHaveValue('120')
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(onRecord).toHaveBeenCalledTimes(2)
})

it('keeps the drawer open and prevents duplicate saves while a payment is pending', async () => {
  let complete!: () => void
  const promise = new Promise<void>((resolve) => {
    complete = resolve
  })
  const user = userEvent.setup()
  const { onRecord, onClose } = renderDrawer(
    'record',
    {},
    { onRecord: () => promise },
  )
  await user.type(await screen.findByLabelText('Сума'), '120')
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(screen.getByRole('button', { name: 'Записуємо…' })).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  expect(onRecord).toHaveBeenCalledOnce()
  await act(async () => {
    complete()
    await promise
  })
  expect(onClose).toHaveBeenCalledOnce()
})

it('keeps receipt linking separate, adds its fee and refuses an overpayment', async () => {
  const user = userEvent.setup()
  const { onLink } = renderDrawer('link')
  await user.click(
    await screen.findByRole('button', { name: /оплата за двигун/ }),
  )
  const fee = screen.getByLabelText(/Комісія транзакції/)
  await user.clear(fee)
  await user.type(fee, '12')
  expect(screen.getByText('Переплата — запис відмовить')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Зберегти прив’язку' }),
  ).toBeDisabled()
  expect(
    screen.queryByRole('button', { name: 'Внести оплату' }),
  ).not.toBeInTheDocument()
  expect(onLink).not.toHaveBeenCalled()
})

it('leaves out a receipt another order already claimed', async () => {
  renderDrawer('link')
  expect(
    await screen.findByRole('button', { name: /оплата за двигун/ }),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: /вже віднесене/ })).toBeNull()
})

it('keeps a definite permission refusal visible without losing entered data', async () => {
  const user = userEvent.setup()
  renderDrawer(
    'record',
    {},
    {
      onRecord: vi
        .fn()
        .mockRejectedValue({ kind: 'forbidden', message: 'Forbidden' }),
    },
  )
  const amount = await screen.findByLabelText('Сума')
  await user.type(amount, '120')
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(
    await screen.findByText('Немає права на цю дію. Зверніться до власника.'),
  ).toBeVisible()
  expect(screen.getByText('Оплату не записано')).toBeVisible()
  expect(amount).toHaveValue('120')
})

it('still links an existing UAH receipt through the delivery callback', async () => {
  const user = userEvent.setup()
  const { onLink, onRecord } = renderDrawer('link')
  await user.click(
    await screen.findByRole('button', { name: /оплата за двигун/ }),
  )
  await user.click(screen.getByRole('button', { name: 'Зберегти прив’язку' }))
  expect(onLink).toHaveBeenCalledWith({
    cashTransactionId: 'tx-1',
    feeUah: 0,
    kind: 'prepayment',
  })
  expect(onRecord).not.toHaveBeenCalled()
})

it('compares a fractional deposit remainder in kopecks without rejecting its exact amount', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer('record', {
    agreedTotalUah: 0,
    appliedUah: 0.1,
    outstandingUah: 0,
    requiredDepositUah: 400.2,
  })
  const amount = await screen.findByLabelText('Сума')
  await user.type(amount, '400.11')
  expect(screen.getByRole('button', { name: 'Записати оплату' })).toBeDisabled()
  await user.clear(amount)
  await user.type(amount, '400.10')
  expect(screen.getByRole('button', { name: 'Записати оплату' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Записати оплату' }))
  expect(onRecord).toHaveBeenCalledWith({
    accountId: 'cash-1',
    amountUah: 400.1,
    feeUah: 0,
    kind: 'prepayment',
  })
})
