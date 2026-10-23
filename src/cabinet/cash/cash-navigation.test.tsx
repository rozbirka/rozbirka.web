import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { expect, it } from 'vitest'
import type { CashRegister, CashTransaction } from '@/api/cash'
import { CashList } from './cash-list'
import { CashCard } from './cash-card'

const register: CashRegister = {
  id: 'cash-1',
  name: 'Каса тесту',
  type: 'cash',
  isActive: true,
  balances: { USD: 100 },
}
const transaction = (
  overrides: Partial<CashTransaction> = {},
): CashTransaction => ({
  id: 'tx-1',
  type: 'sale_in',
  direction: 'in',
  amount: 100,
  currency: 'USD',
  note: 'Оплата тесту',
  referenceId: 'order-1',
  createdByName: 'Олена',
  createdAt: '2026-10-22T10:00:00Z',
  ...overrides,
})
function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output aria-label="Маршрут">{location.pathname}</output>
      <button onClick={() => void navigate(-1)}>Назад у тесті</button>
    </>
  )
}
function renderList(
  entry = transaction(),
  ordersPath: string | null = '/app/yard/orders',
) {
  render(
    <MemoryRouter initialEntries={['/app/yard/cash']}>
      <CashList
        cashHref="/app/yard/cash"
        ordersPath={ordersPath}
        registers={[register]}
        summary={null}
        feed={[
          { ...entry, registerId: register.id, registerName: register.name },
        ]}
        feedTruncated={false}
        date="2026-10-22"
        canCreate={false}
        canTransfer={false}
        onTransfer={() => undefined}
      />
      <LocationProbe />
    </MemoryRouter>,
  )
}
function renderCard(
  entry = transaction(),
  ordersPath: string | null = '/app/yard/orders',
) {
  render(
    <MemoryRouter initialEntries={['/app/yard/cash/cash-1']}>
      <CashCard
        cashHref="/app/yard/cash"
        ordersPath={ordersPath}
        register={register}
        ledger={[entry]}
        ledgerTotal={1}
        totalOperations={1}
        lastOperationAt={null}
        canManage={false}
        error={null}
        filters={null}
        pagination={null}
      />
      <LocationProbe />
    </MemoryRouter>,
  )
}

it('opens a till from the free space in its list row', async () => {
  const user = userEvent.setup()
  renderList()
  const row = within(screen.getByRole('table', { name: 'Каси' }))
    .getByRole('rowheader', { name: /Каса тесту/ })
    .closest('tr')!
  await user.click(row)
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/cash/cash-1',
  )
})

it('opens an order from a recent transaction but keeps its till link and history independent', async () => {
  const user = userEvent.setup()
  renderList()
  const row = screen.getByText('Оплата тесту').closest('tr')!
  await user.click(row)
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/orders/order-1',
  )
  await user.click(screen.getByRole('button', { name: 'Назад у тесті' }))
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent('/app/yard/cash')
  await user.click(within(row).getByRole('link', { name: 'Каса тесту' }))
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/cash/cash-1',
  )
  await user.click(screen.getByRole('button', { name: 'Назад у тесті' }))
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent('/app/yard/cash')
})

it.each(['transfer_in', 'manual_out', 'unknown'])(
  'opens the till for a %s feed entry instead of treating its reference as an order',
  async (type) => {
    const user = userEvent.setup()
    renderList(transaction({ type, referenceId: 'not-an-order' }))
    await user.click(screen.getByText('Оплата тесту').closest('tr')!)
    expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
      '/app/yard/cash/cash-1',
    )
  },
)

it.each(['sale_in', 'refund_out', 'manual_in'])(
  'opens the referenced order for a %s entry in a till ledger',
  async (type) => {
    const user = userEvent.setup()
    renderCard(transaction({ type }))
    await user.click(screen.getByText('Оплата тесту').closest('tr')!)
    expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
      '/app/yard/orders/order-1',
    )
  },
)

it('lets keyboard users open a ledger order once and return with Back', async () => {
  const user = userEvent.setup()
  renderCard()
  const link = screen.getByRole('link', { name: 'Оплата тесту' })
  link.focus()
  await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/orders/order-1',
  )
  await user.click(screen.getByRole('button', { name: 'Назад у тесті' }))
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/cash/cash-1',
  )
})

it.each([
  transaction({ type: 'transfer_out' }),
  transaction({ referenceId: null }),
])('keeps non-order ledger entries inert', async (entry) => {
  const user = userEvent.setup()
  renderCard(entry)
  await user.click(screen.getByText('Оплата тесту').closest('tr')!)
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/cash/cash-1',
  )
  expect(
    screen.queryByRole('link', { name: 'Оплата тесту' }),
  ).not.toBeInTheDocument()
})

it('keeps order navigation unavailable without access to orders', async () => {
  const user = userEvent.setup()
  renderCard(transaction(), null)
  await user.click(screen.getByText('Оплата тесту').closest('tr')!)
  expect(screen.getByLabelText('Маршрут')).toHaveTextContent(
    '/app/yard/cash/cash-1',
  )
  expect(
    screen.queryByRole('link', { name: 'Оплата тесту' }),
  ).not.toBeInTheDocument()
})
