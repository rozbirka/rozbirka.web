/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
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
      balances: {},
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
) => {
  const onRecord = vi.fn().mockResolvedValue(undefined)
  const onLink = vi.fn().mockResolvedValue(undefined)
  render(
    <PaymentDrawer
      delivery={delivery(over)}
      mode={mode}
      onClose={vi.fn()}
      onLink={onLink}
      onRecord={onRecord}
      orderNumber={355}
    />,
  )
  return { onLink, onRecord }
}

it('offers the whole outstanding balance as the amount to record', async () => {
  renderDrawer()

  expect(await screen.findByLabelText(/Сума, брутто/)).toHaveValue('3600')
})

it('takes the fee off a recorded payment on its way to the till', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer()

  const fee = await screen.findByLabelText(/Комісія каси/)
  await user.clear(fee)
  await user.type(fee, '60')

  expect(screen.getByText(/У касу надійде/)).toHaveTextContent('3 540')
  await user.click(screen.getByRole('button', { name: 'Зберегти платіж' }))

  expect(onRecord).toHaveBeenCalledWith({
    accountId: 'cash-1',
    amountUah: 3600,
    feeUah: 60,
    kind: 'prepayment',
  })
})

it('adds the fee to a linked receipt instead, and says so', async () => {
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
  expect(onLink).not.toHaveBeenCalled()
})

it('leaves out a receipt another order already claimed', async () => {
  renderDrawer('link')

  expect(
    await screen.findByRole('button', { name: /оплата за двигун/ }),
  ).toBeVisible()
  expect(screen.queryByRole('button', { name: /вже віднесене/ })).toBeNull()
})

it('will not send a payment larger than the balance', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer()

  const amount = await screen.findByLabelText(/Сума, брутто/)
  await user.clear(amount)
  await user.type(amount, '5000')

  expect(screen.getByText('Переплата — запис відмовить')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Зберегти платіж' })).toBeDisabled()
  expect(onRecord).not.toHaveBeenCalled()
})

it('refuses a fee that swallows the whole payment', async () => {
  const user = userEvent.setup()
  const { onRecord } = renderDrawer()

  const fee = await screen.findByLabelText(/Комісія каси/)
  await user.clear(fee)
  await user.type(fee, '3600')
  await user.click(screen.getByRole('button', { name: 'Зберегти платіж' }))

  expect(
    await screen.findByText(/Комісія не може дорівнювати сумі платежу/),
  ).toBeVisible()
  expect(onRecord).not.toHaveBeenCalled()
})
