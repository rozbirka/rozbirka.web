import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { CustomerDetail } from '@/api/customers'
import { LocaleProvider } from '@/i18n'
import { CustomerDeliveryTrust } from './customer-delivery-trust'

const customer = {
  id: 'customer-1',
  name: 'Ірина',
  isActive: true,
  isTrustedForDelivery: false,
} as CustomerDetail

it('requires a reason and waits for server confirmation before closing', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockResolvedValue(undefined)
  render(
    <LocaleProvider locale="uk">
      <CustomerDeliveryTrust customer={customer} canManage onSave={onSave} />
    </LocaleProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Надати довіру' }))
  expect(screen.getByRole('button', { name: 'Зберегти' })).toBeDisabled()
  await user.type(screen.getByLabelText(/Причина/), 'Перевірені доставки')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith(true, 'Перевірені доставки'),
  )
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  )
})

it('keeps the reason and old trust state visible when saving fails', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn().mockRejectedValue(new Error('Rejected'))
  render(
    <LocaleProvider locale="uk">
      <CustomerDeliveryTrust customer={customer} canManage onSave={onSave} />
    </LocaleProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Надати довіру' }))
  await user.type(screen.getByLabelText(/Причина/), 'Перевірені доставки')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося зберегти',
  )
  expect(screen.getByLabelText(/Причина/)).toHaveValue('Перевірені доставки')
  expect(screen.getByText('Передоплата за правилом розбірки')).toBeVisible()
})

it('does not offer changing trust without permission or for an inactive customer', () => {
  render(
    <LocaleProvider locale="uk">
      <CustomerDeliveryTrust
        customer={customer}
        canManage={false}
        onSave={vi.fn()}
      />
    </LocaleProvider>,
  )
  expect(
    screen.queryByRole('button', { name: 'Надати довіру' }),
  ).not.toBeInTheDocument()
})
