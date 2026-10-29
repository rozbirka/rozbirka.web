import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { expect, it, vi } from 'vitest'
import type { Tenant } from '../api/types'
import { TenantSwitcher } from './TenantSwitcher'

const tenant = (id: string, name: string): Tenant => ({
  id,
  name,
  slug: id,
  plan: 'active',
  planTier: 'pro',
  city: 'Київ',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
})

const tenants = [tenant('koval', 'Koval Auto'), tenant('luxe', 'Luxe Parts')]
const activeTenant = tenants[0]!

const deferred = () => {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

it('exposes tenant names and awaits one switch before accepting another', async () => {
  const pending = deferred()
  const onSwitch = vi.fn(() => pending.promise)

  render(
    <TenantSwitcher
      tenant={activeTenant}
      tenants={tenants}
      onSwitch={onSwitch}
    />,
    { wrapper: MemoryRouter },
  )

  const switcher = screen.getByRole('combobox', {
    name: 'Перемкнути розбірку',
  })
  expect(switcher).toHaveAccessibleName('Перемкнути розбірку')
  expect(screen.getByRole('option', { name: 'Koval Auto' })).toBeVisible()
  expect(screen.getByRole('option', { name: 'Luxe Parts' })).toBeVisible()
  // Role and plan stay out of the select's accessible name.
  expect(switcher.closest('[title="owner · pro"]')).not.toBeNull()

  fireEvent.change(switcher, { target: { value: 'luxe' } })
  fireEvent.change(switcher, { target: { value: 'luxe' } })

  expect(onSwitch).toHaveBeenCalledOnce()
  expect(onSwitch).toHaveBeenCalledWith('luxe')
  expect(switcher).toBeDisabled()

  pending.resolve()

  await waitFor(() => expect(switcher).toBeEnabled())
})

it('settles the guard after a rejected switch without leaking the rejection', async () => {
  const rejected = deferred()
  const onSwitch = vi
    .fn<(tenantId: string) => Promise<void>>()
    .mockReturnValueOnce(rejected.promise)
    .mockResolvedValueOnce()
  const unhandledRejection = vi.fn()
  window.addEventListener('unhandledrejection', unhandledRejection)

  try {
    render(
      <TenantSwitcher
        tenant={activeTenant}
        tenants={tenants}
        onSwitch={onSwitch}
      />,
      { wrapper: MemoryRouter },
    )
    const switcher = screen.getByRole('combobox', {
      name: 'Перемкнути розбірку',
    })

    fireEvent.change(switcher, { target: { value: 'luxe' } })
    expect(switcher).toBeDisabled()

    rejected.reject(new Error('switch failed'))

    await waitFor(() => expect(switcher).toBeEnabled())
    fireEvent.change(switcher, { target: { value: 'luxe' } })
    await waitFor(() => expect(onSwitch).toHaveBeenCalledTimes(2))
    await Promise.resolve()

    expect(unhandledRejection).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('unhandledrejection', unhandledRejection)
  }
})

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>
}

it.each([{}, { compact: true }, { framed: true }])(
  'lets an owner with one yard open an invitation in the %j switcher',
  async (presentation) => {
    const user = userEvent.setup()
    const onSwitch = vi.fn()
    render(
      <MemoryRouter initialEntries={['/app/koval/dashboard']}>
        <TenantSwitcher
          tenant={activeTenant}
          tenants={[activeTenant]}
          onSwitch={onSwitch}
          {...presentation}
        />
        <LocationProbe />
      </MemoryRouter>,
    )

    const switcher = screen.getByRole('combobox', {
      name: 'Перемкнути розбірку',
    })
    expect(switcher).toBeEnabled()
    await user.selectOptions(switcher, '')
    expect(
      screen.getByRole('dialog', { name: 'Приєднатися до іншої розбірки' }),
    ).toBeVisible()
    const next = screen.getByRole('button', { name: 'Переглянути запрошення' })
    expect(next).toBeDisabled()
    const input = screen.getByRole('textbox', { name: 'Код запрошення' })
    await user.type(input, '   ')
    expect(next).toBeDisabled()
    await user.clear(input)
    await user.type(input, ' AB/CD ')
    await user.click(next)

    expect(screen.getByTestId('location')).toHaveTextContent('/invite/AB%2FCD')
    expect(onSwitch).not.toHaveBeenCalled()
  },
)

it('cancels joining without switching yards and restores focus to the picker', async () => {
  const user = userEvent.setup()
  const onSwitch = vi.fn()
  render(
    <TenantSwitcher
      tenant={activeTenant}
      tenants={tenants}
      onSwitch={onSwitch}
    />,
    { wrapper: MemoryRouter },
  )
  const switcher = screen.getByRole('combobox', { name: 'Перемкнути розбірку' })
  await user.selectOptions(switcher, '')
  await user.type(
    screen.getByRole('textbox', { name: 'Код запрошення' }),
    'OLD',
  )
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(switcher).toHaveFocus()
  expect(switcher).toHaveValue('koval')
  await user.selectOptions(switcher, '')
  expect(screen.getByRole('textbox', { name: 'Код запрошення' })).toHaveValue(
    '',
  )
  expect(onSwitch).not.toHaveBeenCalled()
})
