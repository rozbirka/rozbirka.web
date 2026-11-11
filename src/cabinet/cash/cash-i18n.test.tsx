import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import type { CashRegister, CashTransaction } from '@/api/cash'
import { LocaleProvider, type Locale } from '@/i18n'
import { CashCard } from './cash-card'
import { CashList } from './cash-list'

const registers: CashRegister[] = [
  {
    id: 'till-1',
    name: 'Front desk',
    type: 'cash',
    isActive: true,
    balances: { GBP: 1800, PLN: 0 },
  },
  {
    id: 'till-2',
    name: 'Bank',
    type: 'bank',
    isActive: false,
    balances: {},
  },
]

const ledger: CashTransaction[] = [
  {
    id: 'tx-1',
    type: 'manual_out',
    direction: 'out',
    amount: 25.5,
    currency: 'GBP',
    note: null,
    createdAt: '2026-09-20T09:15:00Z',
    createdByName: 'Olena',
  } as CashTransaction,
]

const inLocale = (locale: Locale, ui: React.ReactNode) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter>{ui}</MemoryRouter>
    </LocaleProvider>,
  )

it('reads the till list in English (UK)', () => {
  inLocale(
    'en-GB',
    <CashList
      canCreate
      canTransfer
      date="2026-09-20"
      feed={[]}
      feedTruncated={false}
      onTransfer={() => undefined}
      registers={registers}
      summary={null}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Tills', level: 1 })).toBeVisible()
  expect(screen.getByText('1 active · 1 closed')).toBeVisible()
  expect(screen.getByText('Showing 2 of 2 tills')).toBeVisible()
  expect(screen.getByText('1,800.00 GBP')).toBeVisible()
  expect(screen.getByText('Cash · Physical money')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Transfer between tills' }),
  ).toBeVisible()
  expect(screen.getByText('No transactions yet.')).toBeVisible()
})

it('reads a till card in Polish', () => {
  inLocale(
    'pl',
    <CashCard
      canManage
      cashHref="/app/yard/cash"
      error={null}
      filters={null}
      lastOperationAt={null}
      ledger={ledger}
      ledgerTotal={1}
      pagination={null}
      register={registers[0]!}
      totalOperations={1}
    />,
  )

  expect(screen.getByText('Nowa operacja')).toBeVisible()
  expect(screen.getByText('1 operacja łącznie')).toBeVisible()
  expect(screen.getByText('Wydatek · Olena')).toBeVisible()
  expect(screen.getByText('−25,50 GBP')).toBeVisible()
  expect(screen.getByText('Salda')).toBeVisible()
})

it.each([
  [
    'uk',
    'sale_in',
    'in',
    'Delivery order #3: prepayment',
    'Замовлення №3: передоплата',
  ],
  [
    'uk',
    'sale_in',
    'in',
    'Delivery order #3: cod',
    'Замовлення №3: післяплата',
  ],
  [
    'uk',
    'refund_out',
    'out',
    'Delivery payment refund #3',
    'Замовлення №3: повернення коштів',
  ],
  [
    'uk',
    'refund_out',
    'out',
    'Повернення коштів за замовленням #3',
    'Замовлення №3: повернення коштів',
  ],
  [
    'en-GB',
    'sale_in',
    'in',
    'Delivery order #3: prepayment',
    'Order #3: prepayment',
  ],
  [
    'pl',
    'refund_out',
    'out',
    'Повернення коштів за замовленням #3',
    'Zamówienie nr 3: zwrot środków',
  ],
] as const)(
  'localises existing system payment notes in %s (%s, %s, %s)',
  (locale, type, direction, note, expected) => {
    const entry: CashTransaction = {
      ...ledger[0]!,
      type,
      direction,
      note,
      referenceId: 'order-3',
    }
    inLocale(
      locale,
      <CashCard
        canManage
        cashHref="/app/yard/cash"
        error={null}
        filters={null}
        lastOperationAt={null}
        ledger={[entry]}
        ledgerTotal={1}
        pagination={null}
        register={registers[0]!}
        totalOperations={1}
      />,
    )
    expect(screen.getByText(expected)).toBeVisible()
    expect(entry.note).toBe(note)
  },
)

it('keeps free-form finance notes unchanged even if they mention a delivery order', () => {
  const note = 'Delivery order #3: prepayment — уточнення клієнта'
  inLocale(
    'uk',
    <CashCard
      canManage
      cashHref="/app/yard/cash"
      error={null}
      filters={null}
      lastOperationAt={null}
      ledger={[{ ...ledger[0]!, note }]}
      ledgerTotal={1}
      pagination={null}
      register={registers[0]!}
      totalOperations={1}
    />,
  )
  expect(screen.getByText(note)).toBeVisible()
})
