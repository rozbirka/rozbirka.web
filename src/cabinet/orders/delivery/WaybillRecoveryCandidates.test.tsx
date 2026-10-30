import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { DeliveryOrder } from '@/api/delivery'
import type { Shipment, ShipmentRecoveryCandidate } from '@/api/shipping'
import { WaybillReconcileSheet } from './WaybillReconcileSheet'

const contact = {
  name: 'Чернетка отримувача',
  phone: '+380671234567',
  warehouseRef: 'w1',
  settlementRef: 's1',
  warehouseName: 'Відділення чернетки',
  settlementName: 'Київ',
}
const shipment: Shipment = {
  id: 's1',
  integrationId: 'int-1',
  dispatchPointId: 'p1',
  connectionId: null,
  orderId: 'o1',
  version: 'v1',
  state: 'Unknown',
  number: null,
  sender: contact,
  draft: {
    recipient: contact,
    parcels: [],
    declaredValueUah: 500,
    payerType: 'Recipient',
    description: 'Автозапчастини',
  },
  quoteUah: null,
  returnEstimateUah: 0,
  codUah: 500,
  quoteAt: null,
  trackingCode: null,
  trackingStatus: null,
  lastTrackedAt: null,
  relatedNumbers: [],
  events: [],
  dispatchedAt: null,
  receivedAt: null,
  paymentState: null,
  syncProblem: null,
  trackingEnabled: true,
}
const delivery: DeliveryOrder = {
  orderId: 'o1',
  agreedTotalUah: 500,
  appliedUah: 0,
  outstandingUah: 500,
  netReceivedUah: 0,
  feesUah: 0,
  requiredDepositUah: 100,
  depositShortfallUah: 100,
  depositSatisfied: false,
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
}
const candidate = (
  over: Partial<ShipmentRecoveryCandidate> = {},
): ShipmentRecoveryCandidate => ({
  number: '20450011872209',
  createdAt: '2026-10-30T10:00:00Z',
  sender: {
    ...contact,
    name: 'Відправник НП',
    warehouseName: 'Відділення №77',
  },
  recipient: {
    ...contact,
    name: 'Отримувач НП',
    warehouseName: 'Відділення №88',
    settlementName: 'Львів',
  },
  codUah: 321,
  fingerprint: 'fp-provider',
  canConfirm: true,
  ...over,
})
const response = (candidates = [candidate()], status = 'Found') => ({
  data: { shipmentVersion: 'v7', status, candidates },
})
function mount(state = shipment) {
  const onResolved = vi.fn()
  const onWaiting = vi.fn()
  render(
    <WaybillReconcileSheet
      delivery={delivery}
      integrationId="int-1"
      orderId="o1"
      orderNumber={7}
      shipment={state}
      onClose={vi.fn()}
      onResolved={onResolved}
      onWaiting={onWaiting}
    />,
  )
  return { user: userEvent.setup(), onResolved, onWaiting }
}
afterEach(() => vi.restoreAllMocks())

it('shows provider candidates without resolving, then confirms only the explicitly chosen candidate', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(
    response([
      candidate(),
      candidate({ number: '20450011872210', fingerprint: 'fp2' }),
    ]),
  )
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    data: { ...shipment, state: 'Created', number: '20450011872210' },
  })
  const { user, onResolved } = mount()
  const card = await screen.findByRole('region', { name: 'ТТН 20450011872210' })
  expect(card).toHaveTextContent('Отримувач НП')
  expect(card).toHaveTextContent('Відділення №88')
  expect(card).toHaveTextContent('321')
  expect(screen.queryByText(/Чернетка отримувача/)).toBeNull()
  expect(onResolved).not.toHaveBeenCalled()
  expect(post).not.toHaveBeenCalled()
  within(card).getByRole('button', { name: 'Підтвердити цю ТТН' }).focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  expect(post).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/orders/o1/recovery-candidates/confirm',
    { number: '20450011872210', shipmentVersion: 'v7', fingerprint: 'fp2' },
  )
})

it('previews a manual number after no hits and waits for a separate confirmation', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(response([], 'NotFound'))
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue(response())
  const { user, onResolved } = mount()
  expect(await screen.findByText(/Накладну не знайдено/)).toBeVisible()
  await user.type(
    screen.getByLabelText('Номер ТТН із кабінету НП'),
    '2045 0011 8722 09',
  )
  await user.click(screen.getByRole('button', { name: 'Перевірити номер' }))
  expect(
    await screen.findByRole('region', { name: 'ТТН 20450011872209' }),
  ).toBeVisible()
  expect(post).toHaveBeenCalledTimes(1)
  expect(post).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/orders/o1/recovery-candidates/preview',
    { number: '20450011872209' },
  )
  expect(onResolved).not.toHaveBeenCalled()
})

it('keeps a search failure distinct from no hits and permits another read-only search', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValueOnce({ kind: 'network', message: 'offline' })
    .mockResolvedValueOnce(response([], 'NotFound'))
  const { user, onResolved, onWaiting } = mount()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося перевірити створення ТТН',
  )
  expect(screen.queryByText(/Накладну не знайдено/)).toBeNull()
  expect(onWaiting).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Повторити пошук' }))
  expect(await screen.findByText(/Накладну не знайдено/)).toBeVisible()
  expect(get).toHaveBeenCalledTimes(2)
  expect(onResolved).not.toHaveBeenCalled()
})

it('makes unavailable facts explicit and disables a candidate that cannot be confirmed', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(
    response(
      [
        candidate({
          createdAt: null,
          sender: null,
          recipient: null,
          codUah: null,
          canConfirm: false,
        }),
      ],
      'Incomplete',
    ),
  )
  mount()
  const card = await screen.findByRole('region', { name: 'ТТН 20450011872209' })
  expect(
    within(card).getAllByText('НП не надала дані').length,
  ).toBeGreaterThanOrEqual(4)
  expect(card).toHaveTextContent('Підтвердження недоступне')
  expect(
    within(card).getByRole('button', { name: 'Підтвердити цю ТТН' }),
  ).toBeDisabled()
  expect(screen.queryByText(/Чернетка отримувача/)).toBeNull()
})

it('rejecting a candidate preserves the unknown result and manual fallback', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(response())
  const { user, onResolved, onWaiting } = mount()
  const card = await screen.findByRole('region', { name: 'ТТН 20450011872209' })
  await user.click(within(card).getByRole('button', { name: 'Не ця накладна' }))
  expect(
    screen.queryByRole('region', { name: 'ТТН 20450011872209' }),
  ).toBeNull()
  expect(
    screen.getByText(/Результат створення залишається невідомим/),
  ).toBeVisible()
  await waitFor(() =>
    expect(screen.getByLabelText('Номер ТТН із кабінету НП')).toHaveFocus(),
  )
  expect(onResolved).not.toHaveBeenCalled()
  expect(onWaiting).not.toHaveBeenCalled()
})

it('locks confirmation and dismissal while pending, and requires a new review after a stale confirmation', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(response())
  let reject!: (error: unknown) => void
  const post = vi.spyOn(apiClient, 'post').mockReturnValue(
    new Promise((_resolve, fail) => {
      reject = fail
    }),
  )
  const { user, onResolved } = mount()
  const card = await screen.findByRole('region', { name: 'ТТН 20450011872209' })
  await user.click(
    within(card).getByRole('button', { name: 'Підтвердити цю ТТН' }),
  )
  expect(
    screen
      .getAllByRole('button', { name: 'Закрити' })
      .every((button) => (button as HTMLButtonElement).disabled),
  ).toBe(true)
  expect(within(card).getByRole('button', { name: /Підтвердж/ })).toBeDisabled()
  reject({
    kind: 'conflict',
    status: 409,
    code: 'shipment_preview_stale',
    message: 'stale',
  })
  expect(await screen.findByRole('alert')).toHaveTextContent('Дані змінилися')
  expect(
    screen.queryByRole('button', { name: 'Підтвердити цю ТТН' }),
  ).toBeNull()
  expect(post).toHaveBeenCalledTimes(1)
  expect(onResolved).not.toHaveBeenCalled()
})

it('preserves cancellation reconciliation on the existing route', async () => {
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ data: { ...shipment, state: 'Cancelled' } })
  const get = vi.spyOn(apiClient, 'get')
  const { onResolved } = mount({
    ...shipment,
    state: 'CancelUnknown',
    number: '20450011872209',
  })
  await waitFor(() => expect(onResolved).toHaveBeenCalledTimes(1))
  expect(post).toHaveBeenCalledWith(
    '/integrations/int-1/shipping/orders/o1/reconcile',
    {},
  )
  expect(get).not.toHaveBeenCalled()
})

it('labels a missing provider contact name explicitly instead of silently showing only its phone', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue(
    response([candidate({ sender: { ...contact, name: '' } })]),
  )
  mount()
  const card = await screen.findByRole('region', { name: 'ТТН 20450011872209' })
  expect(
    within(card).getByText('Відправник').nextElementSibling,
  ).toHaveTextContent('НП не надала дані · +380 67 123 45 67')
})
