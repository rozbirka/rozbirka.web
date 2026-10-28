/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { cashApi } from '@/api/cash'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { tenantSettings } from '@/api/tenant-settings'
import type { BillingState, Tenant } from '@/api/types'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { ToastProvider } from '@/components/app'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { NovaPoshtaConnectScreen } from './NovaPoshtaConnectScreen'

vi.mock('@/api/nova-poshta-setup', () => ({
  novaPoshtaSetupApi: {
    begin: vi.fn(),
    get: vi.fn(),
    configure: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(() => Promise.resolve()),
    senders: vi.fn(),
    senderContacts: vi.fn(),
    settlements: vi.fn(),
    divisions: vi.fn(),
  },
}))
vi.mock('@/api/cash', () => ({ cashApi: { list: vi.fn() } }))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))
vi.mock('@/auth/useTenantSettings', () => ({ useTenantSettings: vi.fn() }))

const tenant = {
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
} satisfies Tenant

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
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) as unknown as CabinetContextValue

const session = {
  id: 'session-1',
  version: 'v1',
  state: 'Pending',
  expiresAt: '2099-01-01T00:00:00Z',
  configuration: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  window.localStorage.clear()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(useTenantSettings).mockReturnValue(tenantSettings(null))
  vi.mocked(novaPoshtaSetupApi.begin).mockResolvedValue(session)
  vi.mocked(novaPoshtaSetupApi.senders).mockResolvedValue([
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
  vi.mocked(novaPoshtaSetupApi.senderContacts).mockResolvedValue([
    { ref: 'ct-1', name: 'Олег Коваль', phone: '+380672147730' },
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
      id: 'till-usd',
      name: 'Доларова',
      type: 'cash',
      isActive: true,
      balances: { USD: 0 },
    },
  ])
  vi.mocked(novaPoshtaSetupApi.settlements).mockResolvedValue({
    items: [
      {
        ref: 'kyiv',
        name: 'Київ',
        prohibitedSending: false,
        prohibitedIssuance: false,
      },
    ],
    page: 1,
    lastPage: 1,
  })
  vi.mocked(novaPoshtaSetupApi.divisions).mockResolvedValue({
    items: [
      {
        ref: 'div-12',
        name: 'Відділення №12 (до 30 кг): вул. Богатирська, 6',
        settlementRef: 'kyiv',
        countryCode: 'UA',
        sendingAllowed: true,
        receivingAllowed: true,
      },
      {
        ref: 'div-closed',
        name: 'Відділення №99',
        settlementRef: 'kyiv',
        countryCode: 'UA',
        sendingAllowed: false,
        receivingAllowed: true,
      },
    ],
    page: 1,
    lastPage: 1,
  })
  vi.mocked(novaPoshtaSetupApi.configure).mockResolvedValue({
    ...session,
    version: 'v2',
  })
  vi.mocked(novaPoshtaSetupApi.complete).mockResolvedValue({
    connectionId: 'conn-1',
    dispatchPointId: 'point-1',
    integrationVersion: 'iv',
  })
})

const renderWizard = () =>
  render(
    <MemoryRouter
      initialEntries={['/app/koval/settings/integrations/np-1/connect']}
    >
      <ToastProvider>
        <Routes>
          <Route
            element={<NovaPoshtaConnectScreen />}
            path="/app/:slug/settings/integrations/:integrationId/connect"
          />
          <Route
            element={<p>overview</p>}
            path="/app/:slug/settings/integrations/:integrationId"
          />
          <Route
            element={<p>list</p>}
            path="/app/:slug/settings/integrations"
          />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )

it('keeps a rejected key in the field and explains it there', async () => {
  vi.mocked(novaPoshtaSetupApi.begin).mockRejectedValue({
    kind: 'validation',
    code: 'nova_poshta_unauthorized',
    message: 'Unauthorized',
  })
  const user = userEvent.setup()
  renderWizard()

  const verify = screen.getByRole('button', {
    name: 'Перевірити й продовжити',
  })
  expect(verify).toBeDisabled()
  expect(screen.getByText('Вставте ключ, щоб перевірити його.')).toBeVisible()

  const field = screen.getByLabelText('API-ключ')
  await user.type(field, 'bad-key')
  await user.click(verify)

  expect(
    await screen.findByText(/Нова пошта не прийняла ключ\. Перевірте/),
  ).toBeVisible()
  expect(field).toHaveValue('bad-key')
  expect(field).toHaveFocus()
  expect(novaPoshtaSetupApi.senders).not.toHaveBeenCalled()
})

it('walks the five steps and applies everything only at the end', async () => {
  const user = userEvent.setup()
  renderWizard()

  await user.type(screen.getByLabelText('API-ключ'), '  key-1  ')
  await user.click(
    screen.getByRole('button', { name: 'Перевірити й продовжити' }),
  )
  expect(novaPoshtaSetupApi.begin).toHaveBeenCalledWith('np-1', 'key-1')
  expect(
    await screen.findByText('Крок 2 з 5 · Відправник і контакт'),
  ).toBeVisible()
  expect(
    screen.getByRole('heading', { name: 'Відправник і контактна особа' }),
  ).toHaveFocus()

  const senderSelect = await screen.findByLabelText('Відправник')
  await screen.findByRole('option', {
    name: 'ФОП Коваль Олег Петрович · 3104512877',
  })
  await user.selectOptions(senderSelect, 'snd-1')
  const contactSelect = screen.getByLabelText('Контактна особа')
  await screen.findByRole('option', { name: 'Олег Коваль · +380672147730' })
  await user.selectOptions(contactSelect, 'ct-1')

  // Changing the sender drops the contact chosen for the old one.
  await user.selectOptions(senderSelect, 'snd-2')
  expect(
    await screen.findByText(
      /Відправника змінено, тому контактну особу скинуто/,
    ),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Продовжити' })).toBeDisabled()
  await screen.findByRole('option', { name: 'Олег Коваль · +380672147730' })
  await user.selectOptions(screen.getByLabelText('Контактна особа'), 'ct-1')
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))

  // Only hryvnia tills, the first one preselected.
  const till = await screen.findByRole('radio', { name: /Основна каса/ })
  expect(till).toBeChecked()
  expect(screen.queryByRole('radio', { name: /Доларова/ })).toBeNull()
  const progress = screen.getByRole('region', { name: 'Кроки підключення' })
  expect(within(progress).getByText('Олег Коваль · ТОВ')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))

  await user.type(screen.getByLabelText('Населений пункт'), 'Киї')
  await user.click(await screen.findByRole('button', { name: /Київ/ }))
  expect(novaPoshtaSetupApi.settlements).toHaveBeenCalledWith(
    'np-1',
    'session-1',
    'Киї',
    1,
    expect.anything(),
  )
  const branch = screen.getByLabelText('Відділення відправлення')
  await screen.findByRole('option', { name: /№12/ })
  expect(screen.queryByRole('option', { name: 'Відділення №99' })).toBeNull()
  await user.selectOptions(branch, 'div-12')
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))

  expect(
    await screen.findByRole('heading', { name: 'Перевірте дані підключення' }),
  ).toBeVisible()
  expect(screen.getByText('ТОВ «Розбірка Плюс» · 44871203')).toBeVisible()
  expect(novaPoshtaSetupApi.configure).not.toHaveBeenCalled()

  await user.click(
    screen.getByRole('button', { name: 'Завершити підключення' }),
  )

  expect(novaPoshtaSetupApi.configure).toHaveBeenCalledTimes(1)
  expect(vi.mocked(novaPoshtaSetupApi.configure).mock.calls[0]).toMatchObject([
    'np-1',
    'session-1',
    'v1',
    {
      sender: {
        name: 'Олег Коваль',
        counterpartyRef: 'snd-2',
        contactRef: 'ct-1',
        settlementRef: 'kyiv',
        warehouseRef: 'div-12',
        companyName: 'ТОВ «Розбірка Плюс»',
        companyTin: '44871203',
      },
      codCashRegisterId: 'till-1',
    },
  ])
  expect(novaPoshtaSetupApi.complete).toHaveBeenCalledWith(
    'np-1',
    'session-1',
    'v2',
  )
  expect(await screen.findByText('overview')).toBeVisible()
  expect(
    screen.getByText(
      'Нову пошту підключено. Доставку можна оформлювати із замовлень.',
    ),
  ).toBeVisible()
})

it('confirms leaving and keeps the verified key for the next visit', async () => {
  const user = userEvent.setup()
  const first = renderWizard()

  await user.type(screen.getByLabelText('API-ключ'), 'key-1')
  await user.click(
    screen.getByRole('button', { name: 'Перевірити й продовжити' }),
  )
  await screen.findByText('Крок 2 з 5 · Відправник і контакт')

  await user.click(screen.getByRole('button', { name: 'Вийти з підключення' }))
  const dialog = await screen
    .findByRole('alertdialog')
    .catch(() => screen.findByRole('dialog'))
  expect(
    within(dialog).getByText(
      'Перевірений ключ збережено — наступного разу почнете з кроку 2.',
    ),
  ).toBeVisible()
  expect(
    within(dialog).getByRole('button', { name: 'Скасувати' }),
  ).toHaveFocus()
  await user.click(within(dialog).getByRole('button', { name: 'Вийти' }))
  expect(await screen.findByText('list')).toBeVisible()
  expect(novaPoshtaSetupApi.cancel).not.toHaveBeenCalled()
  first.unmount()

  vi.mocked(novaPoshtaSetupApi.get).mockResolvedValue(session)
  renderWizard()
  expect(
    await screen.findByText('Крок 2 з 5 · Відправник і контакт'),
  ).toBeVisible()
  expect(novaPoshtaSetupApi.get).toHaveBeenCalledWith(
    'np-1',
    'session-1',
    expect.anything(),
  )
})

it('keeps every choice when completing fails', async () => {
  vi.mocked(novaPoshtaSetupApi.complete).mockRejectedValue({
    kind: 'server',
    message: 'boom',
  })
  vi.mocked(novaPoshtaSetupApi.get).mockResolvedValue(session)
  window.localStorage.setItem('rz:np-setup:tenant-1:np-1', 'session-1')
  const user = userEvent.setup()
  renderWizard()

  await screen.findByText('Крок 2 з 5 · Відправник і контакт')
  await screen.findByRole('option', {
    name: 'ФОП Коваль Олег Петрович · 3104512877',
  })
  await user.selectOptions(screen.getByLabelText('Відправник'), 'snd-1')
  await screen.findByRole('option', { name: 'Олег Коваль · +380672147730' })
  await user.selectOptions(screen.getByLabelText('Контактна особа'), 'ct-1')
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))
  await user.click(
    await screen.findByRole('radio', { name: /Продовжити без каси/ }),
  )
  expect(
    screen.getByText(
      'Без каси післяплату потрібно буде вносити вручну в замовлення.',
    ),
  ).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))
  await user.type(screen.getByLabelText('Населений пункт'), 'Киї')
  await user.click(await screen.findByRole('button', { name: /Київ/ }))
  await screen.findByRole('option', { name: /№12/ })
  await user.selectOptions(
    screen.getByLabelText('Відділення відправлення'),
    'div-12',
  )
  await user.click(screen.getByRole('button', { name: 'Продовжити' }))
  await user.click(
    await screen.findByRole('button', { name: 'Завершити підключення' }),
  )

  expect(
    await screen.findByText(
      'Не вдалося завершити підключення. Усі введені дані збережено — спробуйте ще раз.',
    ),
  ).toBeVisible()
  expect(screen.getByText('Без каси · післяплату вносять вручну')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Завершити підключення' }),
  ).toBeEnabled()
})
