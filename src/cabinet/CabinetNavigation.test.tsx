import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
import type { SubscriptionDto, Tenant } from '../api/types'
import type { TenantAccessSnapshot } from './access-types'
import { CabinetNavigation } from './CabinetNavigation'

const activeTenant: Tenant = {
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: 'Київ',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
}

const otherTenant: Tenant = {
  ...activeTenant,
  id: 'tenant-2',
  name: 'Luxe Parts',
  slug: 'luxe',
}

const subscription: SubscriptionDto = {
  state: 'active',
  planCode: 'pro',
  planName: 'Pro',
  trialEndsAt: null,
  trialDaysRemaining: null,
  currentPeriodEnd: null,
  nextChargeAt: null,
  amount: 4900,
  currency: 'UAH',
  cardLast4: '4242',
  cardBrand: 'visa',
  canSubscribe: false,
  canCancel: true,
  canReactivate: false,
  canActivateTrial: false,
  usage: {
    cars: { used: 1, max: 10 },
    intakes: { used: 1, max: 10 },
    parts: { used: 1, max: 10 },
    users: { used: 1, max: 10 },
    cashRegisters: { used: 1, max: 10 },
  },
  features: [],
}

const snapshot = (permissions: string[]): TenantAccessSnapshot => ({
  userId: 'user-1',
  tenantId: activeTenant.id,
  generation: 1,
  role: 'owner',
  permissions: new Set(permissions),
  features: new Set(),
  entitlement: { state: subscription.state, usage: subscription.usage },
  subscription,
})

const renderNavigation = (
  permissions = ['billing.view'],
  onLogout = vi.fn<() => Promise<void>>(),
  path = '/app/koval/settings/billing/overview',
) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <CabinetNavigation
        tenant={activeTenant}
        tenants={[activeTenant, otherTenant]}
        snapshot={snapshot(permissions)}
        onSwitchTenant={vi.fn()}
        onLogout={onLogout}
      />
    </MemoryRouter>,
  )

it('shows only released and allowed links with current-route semantics', () => {
  renderNavigation()

  const desktop = screen.getByRole('navigation', {
    name: 'Навігація кабінету',
  })
  expect(within(desktop).getByRole('link', { name: 'Головна' })).toBeVisible()
  expect(
    within(desktop).getByRole('link', { name: 'Підписка' }),
  ).toHaveAttribute('aria-current', 'page')
  expect(
    within(desktop).queryByRole('link', { name: 'Автомобілі' }),
  ).not.toBeInTheDocument()

  expect(
    screen
      .getByRole('navigation', { name: 'Навігація планшета' })
      .querySelectorAll('a.rz-nav-item'),
  ).not.toHaveLength(0)
  // The tab bar's targets are 48px tall (`.rz-tabbar a`, h-12 on "Ще").
  expect(screen.getByRole('button', { name: 'Ще' })).toHaveClass('h-12')
})

it('omits released links denied by the shared cabinet policy', () => {
  renderNavigation([])

  const desktop = screen.getByRole('navigation', {
    name: 'Навігація кабінету',
  })
  expect(
    within(desktop).queryByRole('link', { name: 'Підписка' }),
  ).not.toBeInTheDocument()
  expect(within(desktop).getByRole('link', { name: 'Профіль' })).toBeVisible()
})

it('shows and restores every tablet rail label on focus and hover', async () => {
  const user = userEvent.setup()
  renderNavigation()
  const tabletNavigation = screen.getByRole('navigation', {
    name: 'Навігація планшета',
  })
  const rail = tabletNavigation.closest('aside')
  if (rail === null) throw new Error('Tablet rail was not rendered')

  const controls = [
    ...['Головна', 'Підписка', 'Профіль'].map(
      (label) =>
        [
          within(tabletNavigation).getByRole('link', { name: label }),
          label,
        ] as const,
    ),
    [
      within(rail).getByRole('combobox', { name: 'Перемкнути розбірку' }),
      'Перемкнути розбірку',
    ] as const,
    [within(rail).getByRole('button', { name: 'Вийти' }), 'Вийти'] as const,
  ]

  for (const [control, label] of controls) {
    const tooltip = within(rail).getByText(label, {
      selector: '[role="tooltip"]',
    })
    expect(control).not.toHaveAttribute('title')
    expect(tooltip).not.toBeVisible()

    fireEvent.focus(control)
    expect(tooltip).toBeVisible()
    fireEvent.blur(control)
    expect(tooltip).not.toBeVisible()

    await user.hover(control)
    expect(tooltip).toBeVisible()
    await user.unhover(control)
    expect(tooltip).not.toBeVisible()
  }
})

it('opens the mobile More dialog by keyboard and restores trigger focus', async () => {
  const user = userEvent.setup()
  renderNavigation()
  const more = screen.getByRole('button', { name: 'Ще' })

  more.focus()
  await user.keyboard('{Enter}')

  const dialog = screen.getByRole('dialog', { name: 'Меню кабінету' })
  expect(dialog).toBeVisible()
  expect(within(dialog).getByRole('link', { name: 'Підписка' })).toBeVisible()
  expect(
    within(dialog).getByRole('combobox', { name: 'Перемкнути розбірку' }),
  ).toBeVisible()

  await user.keyboard('{Escape}')

  expect(
    screen.queryByRole('dialog', { name: 'Меню кабінету' }),
  ).not.toBeInTheDocument()
  expect(more).toHaveFocus()
})

it('exposes logout in the keyboard-accessible mobile menu', async () => {
  const onLogout = vi.fn<() => Promise<void>>().mockResolvedValue()
  const user = userEvent.setup()
  renderNavigation(['billing.view'], onLogout)

  screen.getByRole('button', { name: 'Ще' }).focus()
  await user.keyboard('{Enter}')
  const dialog = screen.getByRole('dialog', { name: 'Меню кабінету' })
  const logout = within(dialog).getByRole('button', { name: 'Вийти' })
  logout.focus()
  await user.keyboard('{Enter}')

  expect(onLogout).toHaveBeenCalledOnce()
})

it('groups the sidebar by the work the modules belong to', () => {
  renderNavigation([
    'cars.view',
    'parts.view',
    'orders.view',
    'finance.view',
    'billing.view',
  ])

  const desktop = screen.getByRole('navigation', { name: 'Навігація кабінету' })
  const sections = within(desktop).getAllByRole('list')

  expect(
    within(desktop).getByText('Склад', { selector: 'p' }),
  ).toBeInTheDocument()
  expect(
    within(desktop).getByText('Продажі', { selector: 'p' }),
  ).toBeInTheDocument()
  expect(
    within(desktop).getByText('Гроші', { selector: 'p' }),
  ).toBeInTheDocument()
  expect(
    within(desktop).getByText('Налаштування', { selector: 'p' }),
  ).toBeInTheDocument()
  // Overview stays unlabelled: a single-item heading is noise.
  expect(
    within(sections[0]!).getByRole('link', { name: 'Головна' }),
  ).toBeVisible()
})

it('fills the mobile tab bar by declared priority, not registry order', async () => {
  const user = userEvent.setup()
  renderNavigation([
    'cars.view',
    'parts.view',
    'orders.view',
    'finance.view',
    'intakes.view',
    'customers.view',
    'billing.view',
  ])

  const mobile = screen.getByRole('navigation', { name: 'Мобільна навігація' })
  expect(
    within(mobile)
      .getAllByRole('link')
      .map((link) => link.textContent),
  ).toEqual(['Головна', 'Запчастини', 'Замовлення', 'Фінанси'])

  // Everything past the four highest priorities stays reachable under "Ще".
  await user.click(screen.getByRole('button', { name: 'Ще' }))
  const dialog = screen.getByRole('dialog', { name: 'Меню кабінету' })
  expect(within(dialog).getByRole('link', { name: 'Автомобілі' })).toBeVisible()
  expect(within(dialog).getByRole('link', { name: 'Клієнти' })).toBeVisible()
})

it('folds the desktop menu away and back from the seam between it and the page', async () => {
  const user = userEvent.setup()
  renderNavigation()

  const toggle = screen.getByRole('button', { name: 'Сховати меню' })
  expect(toggle).toHaveAttribute('aria-expanded', 'true')
  expect(document.getElementById('cabinet-navigation')).toBeVisible()

  await user.click(toggle)
  // Folded away, the desktop menu becomes the 56px rail, and the way back
  // sits at its foot.
  const restore = screen.getByRole('button', { name: 'Показати меню' })
  expect(restore).toHaveAttribute('aria-expanded', 'false')
  expect(document.getElementById('cabinet-navigation')).toBeNull()
  expect(
    screen.getAllByRole('navigation', { name: 'Навігація кабінету' }),
  ).toHaveLength(1)

  await user.click(restore)
  expect(screen.getByRole('button', { name: 'Сховати меню' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )
})

it('names sections, groups and controls in English (UK)', () => {
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter initialEntries={['/app/koval/dashboard']}>
        <CabinetNavigation
          tenant={activeTenant}
          tenants={[activeTenant, otherTenant]}
          snapshot={snapshot(['parts.view', 'orders.view', 'billing.view'])}
          onSwitchTenant={vi.fn()}
          onLogout={vi.fn()}
        />
      </MemoryRouter>
    </LocaleProvider>,
  )

  const desktop = screen.getByRole('navigation', {
    name: 'Cabinet navigation',
  })
  expect(within(desktop).getByRole('link', { name: 'Home' })).toBeVisible()
  expect(within(desktop).getByRole('link', { name: 'Parts' })).toBeVisible()
  expect(
    within(desktop).getByRole('link', { name: 'Subscription' }),
  ).toBeVisible()
  expect(within(desktop).getByText('Stock')).toBeVisible()
  expect(within(desktop).getByText('Sales')).toBeVisible()
  expect(within(desktop).getByText('Settings')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Hide menu' })).toBeInTheDocument()
  expect(
    screen.getAllByRole('combobox', { name: 'Switch business' }).length,
  ).toBeGreaterThan(0)
  expect(
    screen.getByRole('navigation', { name: 'Mobile navigation' }),
  ).toHaveTextContent('More')
})

it('keeps billing sub-pages under Підписка and offers search in the sidebar', async () => {
  const user = userEvent.setup()
  const open = vi.fn()
  window.addEventListener('cabinet:open-command-palette', open)
  renderNavigation()
  const desktop = screen.getByRole('navigation', { name: 'Навігація кабінету' })

  expect(within(desktop).getByRole('link', { name: 'Підписка' })).toBeVisible()
  expect(within(desktop).queryByRole('link', { name: 'Тарифи' })).toBeNull()
  expect(within(desktop).queryByRole('link', { name: 'Платежі' })).toBeNull()

  await user.click(
    within(document.getElementById('cabinet-navigation')!).getByRole('button', {
      name: /Пошук/,
    }),
  )
  expect(open).toHaveBeenCalledOnce()
  window.removeEventListener('cabinet:open-command-palette', open)
})

it('provides separate warehouse and stocktake links for inventory viewers', () => {
  renderNavigation(['inventory.view'])
  const navigation = screen.getByRole('navigation', {
    name: 'Навігація кабінету',
  })
  expect(
    within(navigation).getByRole('link', { name: 'Склади' }),
  ).toHaveAttribute('href', '/app/koval/warehouses')
  expect(
    within(navigation).getByRole('link', { name: 'Інвентаризація' }),
  ).toHaveAttribute('href', '/app/koval/inventory')
})

it.each([
  ['/app/koval/warehouses/wh-1', 'Склади', 'Інвентаризація'],
  ['/app/koval/warehouses/zones/zone-1', 'Склади', 'Інвентаризація'],
  ['/app/koval/inventory/sessions/session-1', 'Інвентаризація', 'Склади'],
])('keeps its own navigation entry active at %s', (path, active, inactive) => {
  renderNavigation(['inventory.view'], vi.fn(), path)
  const navigation = screen.getByRole('navigation', {
    name: 'Навігація кабінету',
  })
  expect(
    within(navigation).getByRole('link', { name: active }),
  ).toHaveAttribute('aria-current', 'page')
  expect(
    within(navigation).getByRole('link', { name: inactive }),
  ).not.toHaveAttribute('aria-current')
})

it.each([
  [['inventory.view'], '/app/koval/stickers?type=locations'],
  [['parts.view'], '/app/koval/stickers'],
  [['parts.view', 'inventory.view'], '/app/koval/stickers'],
] as const)(
  'opens an allowed sticker mode for %j',
  (permissions, destination) => {
    renderNavigation([...permissions])
    const desktop = screen.getByRole('navigation', {
      name: 'Навігація кабінету',
    })
    expect(
      within(desktop).getByRole('link', { name: 'Стікери' }),
    ).toHaveAttribute('href', destination)
  },
)

it('omits stickers when neither mode is allowed', () => {
  renderNavigation([])
  expect(
    screen.queryByRole('link', { name: 'Стікери' }),
  ).not.toBeInTheDocument()
})
