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
