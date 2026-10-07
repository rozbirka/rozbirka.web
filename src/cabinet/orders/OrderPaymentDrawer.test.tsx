import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { OrderPaymentDrawer, type PaymentOutcome } from './OrderPaymentDrawer'

const cashApi = vi.hoisted(() => ({ list: vi.fn() }))
vi.mock('@/api/cash', () => ({ cashApi }))

beforeEach(() => {
  vi.resetAllMocks()
  cashApi.list.mockResolvedValue([
    {
      id: 'main',
      name: 'Основна',
      type: 'safe',
      isActive: true,
      balances: { EUR: 30, UAH: 142300, USD: 0 },
    },
    {
      id: 'privat',
      name: 'Privat 24',
      type: 'bank',
      isActive: true,
      balances: { UAH: 44100 },
    },
  ])
})

const renderDrawer = (
  outcome: PaymentOutcome | null = null,
  onSave = vi.fn(),
) =>
  render(
    <OrderPaymentDrawer
      accountingCurrency="USD"
      busy={false}
      existing={[]}
      onOpenChange={vi.fn()}
      onSave={onSave}
      open
      orderNumber={355}
      orderValue={100}
      outcome={outcome}
    />,
  )

it('records 4 200 UAH against a 100 USD order without a rate (AC-11)', async () => {
  const onSave = vi.fn()
  const user = userEvent.setup()
  renderDrawer(null, onSave)
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })

  const value = within(dialog)
    .getByRole('heading', { name: 'Вартість замовлення' })
    .closest('section')
  expect(value).toHaveTextContent(/100,00\sUSD/)
  expect(
    await within(dialog).findByRole('radio', { name: /Основна/ }),
  ).toBeChecked()
  // Three currencies: a choice, not a guess.
  expect(
    within(dialog).getByRole('button', { name: 'Записати оплату' }),
  ).toBeDisabled()
  await user.click(
    within(dialog).getByRole('button', { name: 'UAH (Українська гривня)' }),
  )
  await user.type(within(dialog).getByLabelText('Сума'), '4 200')
  expect(
    within(dialog).getByText(/^Каса Основна · 4\s200,00\sUAH$/),
  ).toBeVisible()
  expect(within(dialog).queryByText(/курс|залиш|борг|переплат/i)).toBeNull()

  await user.click(
    within(dialog).getByRole('button', { name: 'Записати оплату' }),
  )
  const added = { accountId: 'main', amount: 4200, currency: 'UAH' }
  expect(onSave).toHaveBeenCalledWith([added], added)
})

it('resets a currency the new till does not take and keeps the amount', async () => {
  const user = userEvent.setup()
  renderDrawer()
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })

  await user.click(
    await within(dialog).findByRole('button', { name: 'EUR (Євро)' }),
  )
  await user.type(within(dialog).getByLabelText('Сума'), '30')
  await user.click(within(dialog).getByRole('radio', { name: /Privat 24/ }))

  expect(
    within(dialog).getByText(
      /Каса «Privat 24» не приймає EUR\. Оберіть валюту оплати ще раз\./,
    ),
  ).toBeVisible()
  expect(
    within(dialog).getByText(/Суму 30 не змінено й не перераховано/),
  ).toBeVisible()
  expect(within(dialog).getByLabelText('Сума')).toHaveValue('30')
  expect(
    within(dialog).getByRole('button', { name: 'Записати оплату' }),
  ).toBeDisabled()

  await user.click(
    within(dialog).getByRole('button', { name: 'UAH (Українська гривня)' }),
  )
  expect(within(dialog).queryByText(/не приймає/)).toBeNull()
  expect(
    within(dialog).getByRole('button', { name: 'Записати оплату' }),
  ).toBeEnabled()
})

it('explains a refusal and keeps the typed sum (3c)', async () => {
  renderDrawer({
    kind: 'refused',
    message: 'Каса «Privat 24» закрита на зведення. Оберіть іншу касу.',
  })
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(within(dialog).getByText('Оплату не записано')).toBeVisible()
  expect(within(dialog).getByText(/закрита на зведення/)).toBeVisible()
})

it('does not offer a retry while an unknown result is being checked', async () => {
  renderDrawer({ kind: 'checking' })
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  expect(
    within(dialog).getByText('Не знаємо, чи записано оплату'),
  ).toBeVisible()
  expect(within(dialog).getByText('Оновлюємо…')).toBeVisible()
  expect(
    within(dialog).getByRole('button', { name: 'Записати оплату' }),
  ).toBeDisabled()
})

it('refuses a third decimal before saving, as Core would', async () => {
  const onSave = vi.fn()
  const user = userEvent.setup()
  renderDrawer(null, onSave)
  const dialog = await screen.findByRole('dialog', { name: 'Додати платіж' })
  await within(dialog).findByRole('radio', { name: /Основна/ })
  await user.click(
    within(dialog).getByRole('button', { name: 'UAH (Українська гривня)' }),
  )
  await user.type(within(dialog).getByLabelText('Сума'), '10,555')

  expect(
    within(dialog).getByText('Для UAH — не більше двох знаків після коми.'),
  ).toBeVisible()
  expect(
    within(dialog).getByRole('button', { name: 'Записати оплату' }),
  ).toBeDisabled()
  expect(onSave).not.toHaveBeenCalled()
})
