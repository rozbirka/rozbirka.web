/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi, type Integration } from '@/api/integrations'
import { AxiosError } from 'axios'
import { businessApi } from '@/api/business'
import { tenantsApi } from '@/api/tenants'
import type { BillingState, Tenant } from '@/api/types'
import { tenantSettings } from '@/api/tenant-settings'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { LocaleProvider } from '@/i18n'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { ToastProvider } from '@/components/app'
import { cashApi } from '@/api/cash'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { NovaPoshtaScreen } from './NovaPoshtaScreen'

vi.mock('@/api/business', () => ({ businessApi: { update: vi.fn() } }))
vi.mock('@/api/tenants', () => ({ tenantsApi: { list: vi.fn() } }))

vi.mock('@/api/integrations', () => ({
  integrationsApi: {
    dispatchPoints: vi.fn(() => Promise.resolve([])),
    webhookStatus: vi.fn(() =>
      Promise.resolve({
        enabled: true,
        pending: 0,
        deadLetters: 0,
        oldestPendingAt: null,
        deadLetterIds: [],
      }),
    ),
    getById: vi.fn(),
    trackingSubscription: vi.fn(() =>
      Promise.resolve({
        state: 'Disabled',
        reasonCode: null,
        pendingNumbers: 0,
        unconfirmedNumbers: 0,
        lastCallbackAt: null,
        publicCallbackConfigured: true,
        canRetry: false,
      }),
    ),
    connectTracking: vi.fn(),
    disconnectTracking: vi.fn(),
    retryTracking: vi.fn(),
    preferences: vi.fn(() =>
      Promise.resolve({
        codCashRegisterId: null,
        senderCounterpartyRef: null,
        senderContactRef: null,
      }),
    ),
    savePreferences: vi.fn(),
    senders: vi.fn(() => Promise.resolve([])),
    senderContacts: vi.fn(() => Promise.resolve([])),
    saveNovaPoshtaKey: vi.fn(),
    verify: vi.fn(),
    activate: vi.fn(),
    deactivate: vi.fn(),
    diagnose: vi.fn(),
  },
}))
vi.mock('@/api/nova-poshta-setup', () => ({
  novaPoshtaSetupApi: {
    begin: vi.fn(),
    configure: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(() => Promise.resolve()),
  },
}))
vi.mock('@/api/cash', () => ({
  cashApi: { list: vi.fn(() => Promise.resolve([])) },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('@/auth/useTenantSettings', () => ({ useTenantSettings: vi.fn() }))

const tenant: Tenant = {
  id: 'tenant-1',
  name: 'Koval Auto',
  slug: 'koval',
  plan: 'active',
  planTier: 'pro',
  city: 'Львів',
  logoUrl: null,
  isActive: true,
  createdAt: '2026-08-01T10:00:00Z',
  roleName: 'owner',
  requireDeliveryDeposit: true,
}

const cabinet = () =>
  ({
    status: 'ready',
    targetTenant: tenant,
    snapshot: {
      userId: 'user-1',
      tenantId: tenant.id,
      generation: 4,
      role: 'owner',
      permissions: new Set(['team.manage']),
      features: new Set(),
      entitlement: {
        state: 'active' as BillingState,
        usage: {
          cars: { used: 1, max: 10 },
          intakes: { used: 1, max: 10 },
          parts: { used: 1, max: 10 },
          users: { used: 1, max: 10 },
          cashRegisters: { used: 1, max: 10 },
        },
      },
      subscription: null,
      cabinetParityRollout: {
        configuration: JSON.stringify({
          version: 1,
          mode: 'on',
          canaryPercent: 0,
          emergencyOff: false,
        }),
        claim: {
          version: 1,
          subjectId: 'user-1',
          grants: ['cabinet-parity'],
          audiences: [],
        },
      },
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) satisfies CabinetContextValue

const integration: Integration = {
  id: 'integration-1',
  definitionId: 'definition-np',
  code: 'nova_poshta',
  displayName: 'Нова пошта',
  status: 'active',
  configured: true,
  verifiedAt: '2026-09-21T09:31:00Z',
  lastErrorCode: null,
  settings: { configured: true, activeDispatchPoints: 3 },
  deactivatedAt: null,
  deactivatedBy: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(useTenantSettings).mockReturnValue(tenantSettings(null))
  vi.mocked(integrationsApi.getById).mockResolvedValue(integration)
  vi.mocked(businessApi.update).mockResolvedValue({
    ...tenant,
    requireDeliveryDeposit: false,
  })
  vi.mocked(tenantsApi.list).mockResolvedValue([
    { ...tenant, requireDeliveryDeposit: false },
  ])
})

const renderScreen = (tab = '') =>
  render(
    <MemoryRouter
      initialEntries={[`/app/koval/settings/integrations/integration-1${tab}`]}
    >
      <ToastProvider>
        <Routes>
          <Route
            element={<NovaPoshtaScreen />}
            path="/app/:slug/settings/integrations/:integrationId"
          />
          <Route
            element={<NovaPoshtaScreen />}
            path="/app/:slug/settings/integrations/:integrationId/:tab"
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

it('never shows a stored key and sends only its replacement', async () => {
  vi.mocked(integrationsApi.saveNovaPoshtaKey).mockResolvedValue(integration)
  const user = userEvent.setup()

  renderScreen('/settings')

  expect(await screen.findByText('••••••••••••••••')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Замінити ключ' }))
  await user.type(
    screen.getByLabelText('Новий ключ доступу'),
    '  fixture-key  ',
  )
  await user.click(screen.getByRole('button', { name: 'Зберегти ключ' }))

  expect(integrationsApi.saveNovaPoshtaKey).toHaveBeenCalledWith(
    'integration-1',
    'fixture-key',
  )
  expect(await screen.findByText('••••••••••••••••')).toBeVisible()
})

it('cannot be switched on before a key is stored', async () => {
  vi.mocked(integrationsApi.getById).mockResolvedValue({
    ...integration,
    status: 'draft',
    configured: false,
    verifiedAt: null,
  })

  renderScreen('/settings')

  const toggle = await screen.findByRole('button', {
    name: 'Увімкнути інтеграцію',
  })
  expect(toggle).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Перевірити підключення' }),
  ).toBeDisabled()
  expect(screen.getByText('ключ не збережено')).toBeVisible()
})

it('names the step a failed verification stopped at', async () => {
  vi.mocked(integrationsApi.getById).mockResolvedValue({
    ...integration,
    status: 'error',
    lastErrorCode: 'integration_account_unverified',
  })
  vi.mocked(integrationsApi.verify).mockResolvedValue({
    ...integration,
    status: 'error',
    lastErrorCode: 'integration_account_unverified',
  })
  vi.mocked(integrationsApi.diagnose).mockResolvedValue({
    integrationId: 'integration-1',
    status: 'error',
    healthy: false,
    checkedAt: '2026-09-21T09:31:00Z',
    lastErrorCode: 'integration_account_unverified',
    checks: [
      { code: 'configuration', status: 'passed', errorCode: null },
      {
        code: 'authorization',
        status: 'failed',
        errorCode: 'integration_account_unverified',
      },
    ],
  })
  const user = userEvent.setup()

  renderScreen()

  await user.click(
    await screen.findByRole('button', { name: 'Перевірити ще раз' }),
  )

  expect(await screen.findByText('Ключ приймає сервіс')).toBeVisible()
  expect(screen.getByText('Ключ доступу збережено')).toBeVisible()
  expect(
    screen.getAllByText(/Сервіс відхилив ключ: він недійсний/).length,
  ).toBeGreaterThan(0)
})

it('keeps a failed verification visible and does not start diagnostics', async () => {
  vi.mocked(integrationsApi.verify).mockRejectedValue({
    kind: 'validation',
    message: 'Нова пошта не прийняла цей ключ API.',
    code: 'nova_poshta_unauthorized',
  })
  const user = userEvent.setup()

  renderScreen('/settings')

  await user.click(
    await screen.findByRole('button', { name: 'Перевірити підключення' }),
  )

  expect(
    await screen.findByText(
      'Нова пошта не прийняла ключ API. Перевірте налаштування інтеграції.',
    ),
  ).toBeVisible()
  expect(integrationsApi.diagnose).not.toHaveBeenCalled()
})

it('confirms a successful verification', async () => {
  vi.mocked(integrationsApi.verify).mockResolvedValue(integration)
  vi.mocked(integrationsApi.diagnose).mockResolvedValue({
    integrationId: 'integration-1',
    status: 'active',
    healthy: true,
    checkedAt: '2026-09-21T09:31:00Z',
    lastErrorCode: null,
    checks: [],
  })
  const user = userEvent.setup()

  renderScreen('/settings')

  await user.click(
    await screen.findByRole('button', { name: 'Перевірити підключення' }),
  )

  expect(await screen.findByText('Підключення перевірено.')).toBeVisible()
})

it('turns a live integration off with the consequence spelled out', async () => {
  vi.mocked(integrationsApi.deactivate).mockResolvedValue({
    ...integration,
    status: 'inactive',
  })
  const user = userEvent.setup()

  renderScreen('/settings')

  await user.click(
    await screen.findByRole('button', { name: 'Вимкнути інтеграцію' }),
  )

  expect(integrationsApi.deactivate).toHaveBeenCalledWith('integration-1')
  expect(
    await screen.findByRole('button', { name: 'Увімкнути інтеграцію' }),
  ).toBeVisible()
})

it('opens the tab the link points at and counts what each one holds', async () => {
  vi.mocked(integrationsApi.dispatchPoints).mockResolvedValue([])
  vi.mocked(integrationsApi.webhookStatus).mockResolvedValue({
    enabled: true,
    pending: 3,
    deadLetters: 2,
    oldestPendingAt: null,
    deadLetterIds: ['a', 'b'],
  })

  renderScreen('/webhook')

  const tabs = await screen.findByRole('navigation', {
    name: 'Розділи інтеграції',
  })
  expect(within(tabs).getByRole('link', { name: /Статуси/ })).toHaveAttribute(
    'aria-current',
    'page',
  )
  expect(within(tabs).getByText('2 з помилкою')).toBeVisible()
  // Two separate questions on one tab: whether the carrier is asked to send
  // anything, and what happened to the events that arrived.
  expect(
    await screen.findByRole('region', {
      name: 'Автоматичне оновлення доставки',
    }),
  ).toBeVisible()
  expect(
    screen.getByRole('region', { name: 'Події з вичерпаними спробами' }),
  ).toBeVisible()
  expect(within(tabs).getByRole('link', { name: /Огляд/ })).not.toHaveAttribute(
    'aria-current',
  )
})

const UNAVAILABLE_EN =
  'Nova Poshta is only available for businesses in Ukraine. Integrations for your country will come later.'

const renderInLocale = (tab = '') =>
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter
        initialEntries={[
          `/app/koval/settings/integrations/integration-1${tab}`,
        ]}
      >
        <ToastProvider>
          <Routes>
            <Route
              element={<NovaPoshtaScreen />}
              path="/app/:slug/settings/integrations/:integrationId"
            />
            <Route
              element={<NovaPoshtaScreen />}
              path="/app/:slug/settings/integrations/:integrationId/:tab"
            />
          </Routes>
        </ToastProvider>
      </MemoryRouter>
    </LocaleProvider>,
  )

it('shows the overview in British English', async () => {
  renderInLocale()

  expect(await screen.findByText('The connection is working')).toBeVisible()
  const tabs = screen.getByRole('navigation', { name: 'Integration sections' })
  expect(within(tabs).getByRole('link', { name: 'Overview' })).toBeVisible()
  expect(
    within(tabs).getByRole('link', { name: /^Dispatch points/ }),
  ).toBeVisible()
  expect(screen.getByText('On')).toBeVisible()
  // A working connection offers the change of settings, not a re-check.
  expect(screen.getByRole('link', { name: 'Change settings' })).toHaveAttribute(
    'href',
    '/app/koval/settings/integrations/integration-1/settings',
  )
  expect(screen.getByRole('link', { name: 'Integrations' })).toHaveAttribute(
    'href',
    '/app/koval/settings/integrations',
  )
})

it.each(['', '/settings', '/dispatch-points'])(
  'shows a GB business the unavailable state instead of the forms (%s)',
  async (tab) => {
    vi.mocked(useTenantSettings).mockReturnValue({
      ...tenantSettings(null),
      countryCode: 'GB',
    })

    renderInLocale(tab)

    expect(await screen.findByText(UNAVAILABLE_EN)).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('switch')).toBeNull()
    expect(screen.queryByRole('navigation')).toBeNull()
    expect(integrationsApi.getById).not.toHaveBeenCalled()
    expect(integrationsApi.dispatchPoints).not.toHaveBeenCalled()
  },
)

it('turns a 409 integration_country_unavailable into the same state', async () => {
  vi.mocked(integrationsApi.getById).mockRejectedValue({
    kind: 'conflict',
    status: 409,
    code: 'integration_country_unavailable',
    message: 'Integration is not available for tenant country.',
  })

  renderScreen('/settings')

  expect(
    await screen.findByText(
      'Нова пошта доступна лише для бізнесів в Україні. Інтеграції для вашої країни зʼявляться пізніше.',
    ),
  ).toBeVisible()
  expect(screen.queryByText(/Не вдалося відкрити інтеграцію/)).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('saves the real delivery deposit policy from Nova Poshta settings without rewriting business details', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen('/settings')
  const toggle = await screen.findByRole('switch', {
    name: 'Вимагати депозит за доставку',
  })
  expect(toggle).toHaveAttribute('aria-checked', 'true')
  const panel = within(toggle.closest('section')!)
  await user.click(toggle)
  await user.click(panel.getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(businessApi.update).toHaveBeenCalledWith(
      tenant.id,
      { requireDeliveryDeposit: false },
      expect.anything(),
    ),
  )
  expect(
    vi.mocked(businessApi.update).mock.calls[0]?.[2]?.signal,
  ).toBeInstanceOf(AbortSignal)
  expect(
    await screen.findByText('Налаштування депозиту збережено.'),
  ).toBeVisible()
  expect(currentCabinet.switchTenant).toHaveBeenCalledWith(tenant.id)
  expect(integrationsApi.savePreferences).not.toHaveBeenCalled()
})

it('does not put the delivery deposit control on other Nova Poshta tabs', async () => {
  renderScreen()
  await screen.findByRole('heading', { name: 'Нова пошта' })
  expect(
    screen.queryByRole('switch', { name: 'Вимагати депозит за доставку' }),
  ).toBeNull()
})

it('keeps the deposit draft and offers retry when saving fails', async () => {
  vi.mocked(businessApi.update).mockRejectedValue(new Error('offline'))
  const user = userEvent.setup()
  renderScreen('/settings')
  const toggle = await screen.findByRole('switch', {
    name: 'Вимагати депозит за доставку',
  })
  const panel = within(toggle.closest('section')!)
  await user.click(toggle)
  await user.click(panel.getByRole('button', { name: 'Зберегти' }))
  expect(await panel.findByRole('alert')).toHaveTextContent(
    'Не вдалося зберегти налаштування депозиту.',
  )
  expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(panel.getByRole('button', { name: 'Зберегти' })).toBeEnabled()
  expect(screen.queryByText('Налаштування депозиту збережено.')).toBeNull()
})

it('reads the persisted deposit setting back after a lost response', async () => {
  vi.mocked(businessApi.update).mockRejectedValue(
    new AxiosError('timeout', 'ECONNABORTED'),
  )
  const user = userEvent.setup()
  renderScreen('/settings')
  const toggle = await screen.findByRole('switch', {
    name: 'Вимагати депозит за доставку',
  })
  await user.click(toggle)
  await user.click(
    within(toggle.closest('section')!).getByRole('button', {
      name: 'Зберегти',
    }),
  )
  expect(
    await screen.findByText('Налаштування депозиту збережено.'),
  ).toBeVisible()
  expect(tenantsApi.list).toHaveBeenCalledTimes(1)
  expect(businessApi.update).toHaveBeenCalledTimes(1)
})

it('allows only the owner to change the tenant-wide deposit policy', async () => {
  const currentCabinet = cabinet()
  if (currentCabinet.snapshot) currentCabinet.snapshot.role = 'manager'
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  renderScreen('/settings')
  const toggle = await screen.findByRole('switch', {
    name: 'Вимагати депозит за доставку',
  })
  expect(toggle).toBeDisabled()
  expect(
    screen.getByText('Змінити вимогу депозиту може лише власник бізнесу.'),
  ).toBeVisible()
  expect(businessApi.update).not.toHaveBeenCalled()
})

it.each(['permission', 'role', 'subscription'])(
  'rechecks %s before saving a deposit change',
  async (revoked) => {
    const currentCabinet = cabinet()
    vi.mocked(useCabinet).mockReturnValue(currentCabinet)
    const user = userEvent.setup()
    renderScreen('/settings')
    const toggle = await screen.findByRole('switch', {
      name: 'Вимагати депозит за доставку',
    })
    await user.click(toggle)
    if (revoked === 'permission')
      currentCabinet.snapshot?.permissions.delete('team.manage')
    if (revoked === 'role' && currentCabinet.snapshot)
      currentCabinet.snapshot.role = 'manager'
    if (revoked === 'subscription' && currentCabinet.snapshot?.entitlement)
      currentCabinet.snapshot.entitlement.state = 'blocked'
    await user.click(
      within(toggle.closest('section')!).getByRole('button', {
        name: 'Зберегти',
      }),
    )
    expect(
      await screen.findByText(
        'Ви більше не маєте права змінювати налаштування депозиту.',
      ),
    ).toBeVisible()
    expect(businessApi.update).not.toHaveBeenCalled()
  },
)

it('ignores a deposit response after leaving the integration settings', async () => {
  let finish!: (value: Tenant) => void
  vi.mocked(businessApi.update).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  const view = renderScreen('/settings')
  const toggle = await screen.findByRole('switch', {
    name: 'Вимагати депозит за доставку',
  })
  await user.click(toggle)
  const panel = within(toggle.closest('section')!)
  await user.click(panel.getByRole('button', { name: 'Зберегти' }))
  expect(toggle).toBeDisabled()
  view.unmount()
  await act(async () => {
    finish({ ...tenant, requireDeliveryDeposit: false })
    await Promise.resolve()
  })
  expect(currentCabinet.switchTenant).not.toHaveBeenCalled()
})

const configuredDelivery = () => {
  vi.mocked(integrationsApi.preferences).mockResolvedValue({
    codCashRegisterId: 'till-1',
    senderCounterpartyRef: 'snd-1',
    senderContactRef: 'ct-1',
  })
  vi.mocked(integrationsApi.senders).mockResolvedValue([
    {
      ref: 'snd-1',
      name: 'ФОП Коваль Олег Петрович',
      tin: '3104512877',
      isOrganization: false,
    },
    {
      ref: 'snd-2',
      name: 'ТОВ «Розбірка Плюс»',
      tin: '44871203',
      isOrganization: true,
    },
  ])
  vi.mocked(integrationsApi.senderContacts).mockImplementation((_id, ref) =>
    Promise.resolve(
      ref === 'snd-1'
        ? [{ ref: 'ct-1', name: 'Олег Коваль', phone: '+380 67 214 77 30' }]
        : [{ ref: 'ct-2', name: 'Ірина Мельник', phone: '+380 50 118 42 70' }],
    ),
  )
  vi.mocked(integrationsApi.dispatchPoints).mockResolvedValue([
    {
      id: 'point-1',
      name: 'Основна',
      senderName: 'Олег Коваль',
      phone: '+380672147730',
      settlementRef: 'kyiv',
      warehouseRef: 'div-12',
      counterpartyRef: 'snd-1',
      contactRef: 'ct-1',
      warehouseName: 'Відділення №12 (до 30 кг): вул. Богатирська, 6',
      settlementName: 'Київ',
      companyTin: null,
      companyName: null,
      isActive: true,
      isDefault: true,
    },
  ])
  vi.mocked(cashApi.list).mockResolvedValue([
    {
      id: 'till-1',
      name: 'Основна каса',
      type: 'cash',
      isActive: true,
      balances: { UAH: 0 },
    },
    {
      id: 'till-2',
      name: 'Каса магазину',
      type: 'cash',
      isActive: true,
      balances: { UAH: 0 },
    },
  ])
}

it('names what new waybills are dispatched with, never the key', async () => {
  configuredDelivery()
  renderScreen()

  const shipping = await screen.findByRole('region', { name: 'Відправлення' })
  expect(
    await within(shipping).findByText('ФОП Коваль Олег Петрович'),
  ).toBeVisible()
  expect(await within(shipping).findByText('Олег Коваль')).toBeVisible()
  expect(
    within(shipping).getByText(
      'Київ · Відділення №12 (до 30 кг): вул. Богатирська, 6',
    ),
  ).toBeVisible()
  expect(within(shipping).getByText('Основна каса')).toBeVisible()
  expect(screen.getByText('••••••••••••••••')).toBeVisible()
  const rights = screen.getByRole('region', { name: 'Ваші права' })
  expect(within(rights).getByText('Налаштування інтеграцій')).toBeVisible()
  expect(within(rights).getAllByText('є')).toHaveLength(1)
})

it('explains who may change the settings instead of offering them', async () => {
  configuredDelivery()
  vi.mocked(useCabinet).mockReturnValue({
    ...cabinet(),
    snapshot: {
      ...cabinet().snapshot,
      permissions: new Set(['orders.manage']),
    },
  })
  renderScreen()

  expect(
    await screen.findByText(
      'Змінювати налаштування може власник або користувач із правом «Налаштування інтеграцій».',
    ),
  ).toBeVisible()
  expect(
    screen.queryByRole('link', { name: 'Змінити налаштування' }),
  ).toBeNull()
})

it('changes only the till in place and marks the dispatch card updated', async () => {
  configuredDelivery()
  vi.mocked(integrationsApi.savePreferences).mockResolvedValue({
    codCashRegisterId: 'till-2',
    senderCounterpartyRef: 'snd-1',
    senderContactRef: 'ct-1',
  })
  const user = userEvent.setup()
  renderScreen('/settings')

  const till = await screen.findByLabelText('Каса для післяплати')
  await screen.findByRole('option', { name: 'Каса магазину' })
  await user.selectOptions(till, 'till-2')
  // A till alone needs no key.
  expect(screen.queryByLabelText('API-ключ')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Перевірити зміни' }))

  const dialog = await screen
    .findByRole('alertdialog')
    .catch(() => screen.findByRole('dialog'))
  expect(
    within(dialog).getByText('Каса: Основна каса → Каса магазину'),
  ).toBeVisible()
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти зміни' }),
  )

  expect(integrationsApi.savePreferences).toHaveBeenCalledWith(
    'integration-1',
    {
      codCashRegisterId: 'till-2',
      senderCounterpartyRef: 'snd-1',
      senderContactRef: 'ct-1',
    },
  )
  expect(novaPoshtaSetupApi.begin).not.toHaveBeenCalled()
  expect(
    await screen.findByText(
      'Налаштування збережено. Вони діятимуть для нових накладних.',
    ),
  ).toBeVisible()
  expect(await screen.findByText('Оновлено')).toBeVisible()
})

it('checks a new sender with the key before anything is saved', async () => {
  configuredDelivery()
  vi.mocked(novaPoshtaSetupApi.begin).mockResolvedValue({
    id: 's-1',
    version: 'v1',
    state: 'Pending',
    expiresAt: '2099-01-01T00:00:00Z',
    configuration: null,
  })
  vi.mocked(novaPoshtaSetupApi.configure).mockResolvedValue({
    id: 's-1',
    version: 'v2',
    state: 'Pending',
    expiresAt: '2099-01-01T00:00:00Z',
    configuration: null,
  })
  vi.mocked(novaPoshtaSetupApi.complete).mockResolvedValue({
    connectionId: 'c-2',
    dispatchPointId: 'p-2',
    integrationVersion: 'iv',
  })
  const user = userEvent.setup()
  renderScreen('/settings')

  const sender = await screen.findByLabelText('Відправник')
  await screen.findByRole('option', { name: 'ТОВ «Розбірка Плюс» · 44871203' })
  await user.selectOptions(sender, 'snd-2')
  expect(
    screen.getByText('Змінено · було ФОП Коваль Олег Петрович'),
  ).toBeVisible()
  await screen.findByRole('option', {
    name: 'Ірина Мельник · +380 50 118 42 70',
  })
  await user.selectOptions(screen.getByLabelText('Контактна особа'), 'ct-2')

  await user.click(screen.getByRole('button', { name: 'Перевірити зміни' }))
  expect(
    await screen.findByText('Вставте ключ, щоб перевірити зміни.'),
  ).toBeVisible()
  expect(novaPoshtaSetupApi.begin).not.toHaveBeenCalled()

  await user.type(screen.getByLabelText('API-ключ'), 'key-1')
  await user.click(screen.getByRole('button', { name: 'Перевірити зміни' }))

  expect(vi.mocked(novaPoshtaSetupApi.configure).mock.calls[0]).toMatchObject([
    'integration-1',
    's-1',
    'v1',
    {
      codCashRegisterId: 'till-1',
      sender: {
        counterpartyRef: 'snd-2',
        contactRef: 'ct-2',
        warehouseRef: 'div-12',
      },
    },
  ])
  const dialog = await screen
    .findByRole('alertdialog')
    .catch(() => screen.findByRole('dialog'))
  expect(
    within(dialog).getByText(
      'Відправник: ФОП Коваль Олег Петрович → ТОВ «Розбірка Плюс»',
    ),
  ).toBeVisible()
  expect(
    within(dialog).getByText('Точка відправлення й каса не змінюються.'),
  ).toBeVisible()
  expect(novaPoshtaSetupApi.complete).not.toHaveBeenCalled()
  await user.click(
    within(dialog).getByRole('button', { name: 'Зберегти зміни' }),
  )
  expect(novaPoshtaSetupApi.complete).toHaveBeenCalledWith(
    'integration-1',
    's-1',
    'v2',
  )
})

it('keeps the current settings when the carrier refuses the new sender', async () => {
  configuredDelivery()
  vi.mocked(novaPoshtaSetupApi.begin).mockResolvedValue({
    id: 's-1',
    version: 'v1',
    state: 'Pending',
    expiresAt: '2099-01-01T00:00:00Z',
    configuration: null,
  })
  vi.mocked(novaPoshtaSetupApi.configure).mockRejectedValue({
    kind: 'validation',
    code: 'nova_poshta_rejected',
    message: 'rejected',
  })
  const user = userEvent.setup()
  renderScreen('/settings')

  const sender = await screen.findByLabelText('Відправник')
  await screen.findByRole('option', { name: 'ТОВ «Розбірка Плюс» · 44871203' })
  await user.selectOptions(sender, 'snd-2')
  await screen.findByRole('option', {
    name: 'Ірина Мельник · +380 50 118 42 70',
  })
  await user.selectOptions(screen.getByLabelText('Контактна особа'), 'ct-2')
  await user.type(screen.getByLabelText('API-ключ'), 'key-1')
  await user.click(screen.getByRole('button', { name: 'Перевірити зміни' }))

  expect(
    await screen.findByText(
      'Нова пошта не підтвердила відправника «ТОВ «Розбірка Плюс»» для цього ключа. Чинні налаштування не змінено.',
    ),
  ).toBeVisible()
  expect(novaPoshtaSetupApi.cancel).toHaveBeenCalledWith(
    'integration-1',
    's-1',
    'v1',
  )
  expect(novaPoshtaSetupApi.complete).not.toHaveBeenCalled()
})
