import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  OlxAlphaScreen,
  OlxLegacyRedirect,
  OlxListingSettingsScreen,
  OlxSalesScreen,
} from './OlxAlphaScreen'
import { clearOlxPartReturn, saveOlxPartReturn } from './olx-part-oauth-return'

const mocks = vi.hoisted(() => ({
  liveAdverts: vi.fn(),
  localAdverts: vi.fn(),
  listingSettings: vi.fn(),
  completeReconciliation: vi.fn(),
  connection: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  startOAuth: vi.fn(),
  startWriteOAuth: vi.fn(),
  verifyConnection: vi.fn(),
  launchOAuth: vi.fn(),
  get: vi.fn(),
  refresh: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
  simulate: vi.fn(),
  exclude: vi.fn(),
  restore: vi.fn(),
  cabinet: {
    targetTenant: { id: 'tenant-1', slug: 'test' },
    snapshot: {
      userId: 'user-1',
      tenantId: 'tenant-1',
      generation: 1,
      permissions: new Set([
        'olx.integration.manage',
        'olx.publications.manage',
        'parts.manage',
        'parts.view',
      ]),
    },
  },
}))
vi.mock('@/api/olx', () => ({
  olxApi: mocks,
  launchOlxOAuth: mocks.launchOAuth,
}))
vi.mock('@/api/olx-listing-settings', () => ({
  olxListingSettingsApi: { get: mocks.listingSettings },
}))
vi.mock('@/api/olx-live', () => ({
  olxLiveApi: {
    adverts: mocks.liveAdverts,
    localAdverts: mocks.localAdverts,
    completeReconciliation: mocks.completeReconciliation,
  },
}))
vi.mock('./OlxCatalogPanel', () => ({
  OlxCatalogPanel: () => <p>Каталог запчастин доступний</p>,
}))
vi.mock('../CabinetContext', () => ({ useCabinet: () => mocks.cabinet }))
vi.mock('@/components/parts/PartSearchPicker', () => ({
  PartSearchPicker: ({
    onSelect,
  }: {
    onSelect: (part: { id: string; name: string }) => void
  }) => (
    <button onClick={() => onSelect({ id: 'part-1', name: 'Крило' })}>
      Вибрати крило
    </button>
  ),
}))
const publication = {
  partId: 'part-1',
  advertId: 'sim-1',
  coreStatus: 'available',
  observedStatus: 'new',
  observedAt: '2026-11-17T10:00:00Z',
  syncState: 'synced',
  error: null,
  excluded: false,
  autoRestoreBlocked: false,
  content: {
    publicDescription: '',
    categoryId: null,
    categoryConfirmed: false,
    attributes: {},
  },
  lastSent: null,
}
beforeEach(() => {
  clearOlxPartReturn()
  vi.resetAllMocks()
  mocks.liveAdverts.mockResolvedValue({
    items: [],
    page: 1,
    hasMore: false,
    checkedAt: '2026-11-18T12:00:00Z',
  })
  mocks.localAdverts.mockResolvedValue({ items: [], page: 1, hasMore: false })
  mocks.cabinet.snapshot.permissions = new Set([
    'olx.integration.manage',
    'olx.publications.manage',
    'parts.manage',
    'parts.view',
  ])
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    accountId: 'seller-1',
    mode: 'simulator',
  })
  mocks.get.mockResolvedValue(publication)
  mocks.refresh.mockResolvedValue(publication)
  mocks.simulate.mockResolvedValue(publication)
})
const show = (sales = false) =>
  render(
    <MemoryRouter>
      {sales ? <OlxSalesScreen /> : <OlxAlphaScreen />}
    </MemoryRouter>,
  )
it('keeps settings navigation and loaded data stable between account and listing tabs', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    accountId: 'seller-1',
    mode: 'oauth',
  })
  mocks.listingSettings.mockResolvedValue({
    contactName: 'Олег',
    contactPhone: null,
    cityId: null,
    districtId: null,
    descriptionSuffix: null,
  })
  render(
    <MemoryRouter initialEntries={['/app/test/settings/integrations/olx']}>
      <Routes>
        <Route
          path="/app/test/settings/integrations/olx"
          element={<OlxAlphaScreen />}
        />
        <Route
          path="/app/test/settings/integrations/olx/listing"
          element={<OlxListingSettingsScreen />}
        />
        <Route path="/app/test/olx" element={<OlxAlphaScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  const tabs = await screen.findByRole('navigation', {
    name: 'Налаштування OLX',
  })
  fireEvent.click(screen.getByRole('link', { name: 'Налаштування оголошень' }))
  expect(tabs).toBeInTheDocument()
  expect(await screen.findByLabelText('Ім’я контакту')).toHaveValue('Олег')
  fireEvent.click(screen.getByRole('link', { name: 'Акаунт' }))
  expect(tabs).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Налаштування оголошень' }))
  expect(screen.getByLabelText('Ім’я контакту')).toHaveValue('Олег')
  fireEvent.click(screen.getByRole('link', { name: 'Акаунт' }))
  fireEvent.click(screen.getByRole('link', { name: 'Відкрити розділ OLX' }))
  expect(
    screen.getByRole('navigation', { name: 'Робота з OLX' }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Налаштування OLX' }))
  expect(
    screen.getByRole('link', { name: 'Налаштування оголошень' }),
  ).toBeInTheDocument()
  expect(mocks.connection).toHaveBeenCalledOnce()
  expect(mocks.listingSettings).toHaveBeenCalledOnce()
})
it('opens the catalog immediately after reconciliation and remembers completion on return', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    accountId: 'seller-1',
    mode: 'oauth',
    reconciliationCompletedAt: null,
  })
  mocks.completeReconciliation.mockResolvedValue({
    completedAt: '2026-11-27T15:00:00Z',
  })
  render(
    <MemoryRouter initialEntries={['/app/test/olx/reconcile']}>
      <Routes>
        <Route path="/app/test/olx/reconcile" element={<OlxAlphaScreen />} />
        <Route path="/app/test/olx" element={<OlxAlphaScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  const complete = await screen.findByRole('button', {
    name: 'Завершити звірку',
  })
  await waitFor(() => expect(complete).toBeEnabled())
  fireEvent.click(complete)
  const dialog = await screen.findByRole('dialog', {
    name: 'Завершити звірку?',
  })
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Завершити звірку' }),
  )
  await screen.findByText('Звірку завершено.')
  fireEvent.click(screen.getByRole('link', { name: 'Усі запчастини' }))
  expect(
    await screen.findByText('Каталог запчастин доступний'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Прив’язування' }))
  expect(await screen.findByText('Звірку завершено.')).toBeInTheDocument()
  expect(mocks.connection).toHaveBeenCalledOnce()
})

it('shows a clearly labelled simulator and refreshes the selected advert lazily', async () => {
  show(true)
  fireEvent.click(await screen.findByRole('button', { name: 'Вибрати крило' }))
  expect(await screen.findByText('Очікує модерації')).toBeInTheDocument()
  expect(
    screen.getByText(/Справжні оголошення OLX не змінюються/),
  ).toBeInTheDocument()
  mocks.refresh.mockResolvedValueOnce({
    ...publication,
    observedStatus: 'active',
  })
  fireEvent.click(screen.getByRole('button', { name: 'Оновити статус' }))
  expect(await screen.findByText('Активне')).toBeInTheDocument()
})
it('keeps the last observed status after a simulated external change until refresh', async () => {
  show(true)
  fireEvent.click(await screen.findByRole('button', { name: 'Вибрати крило' }))
  await screen.findByText('Очікує модерації')
  fireEvent.click(screen.getByRole('button', { name: 'Пройшла модерацію' }))
  expect(await screen.findByText(/Подію застосовано/)).toBeInTheDocument()
  expect(screen.getByText('Очікує модерації')).toBeInTheDocument()
})
it('lets publication managers see statuses without integration controls', async () => {
  mocks.cabinet.snapshot.permissions = new Set([
    'olx.publications.manage',
    'parts.view',
  ])
  show(true)
  fireEvent.click(await screen.findByRole('button', { name: 'Вибрати крило' }))
  await screen.findByText('Очікує модерації')
  expect(
    screen.queryByRole('button', { name: 'Відключити акаунт' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Пройшла модерацію' }),
  ).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Оновити статус' })).toBeEnabled()
})
it('does not keep the previous business connection after switching tenant', async () => {
  const { rerender } = show()
  await screen.findByText(/seller-1/)
  mocks.connection.mockResolvedValueOnce({
    available: true,
    connected: false,
    accountId: null,
    mode: 'simulator',
  })
  mocks.cabinet.targetTenant = { id: 'tenant-2', slug: 'second' }
  rerender(
    <MemoryRouter>
      <OlxAlphaScreen />
    </MemoryRouter>,
  )
  await waitFor(() =>
    expect(screen.queryByText(/seller-1/)).not.toBeInTheDocument(),
  )
  expect(
    await screen.findByRole('button', { name: 'Підключити тестовий акаунт' }),
  ).toBeInTheDocument()
  mocks.cabinet.targetTenant = { id: 'tenant-1', slug: 'test' }
})

it('starts real OAuth without asking for client keys or exposing simulator controls', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: false,
    mode: 'oauth',
  })
  const start = {
    launchUrl: 'https://api.example.test/api/v1/integrations/olx/oauth/launch',
    ticket: 'single-use-launch',
    expiresAt: '2026-11-17T12:00:00Z',
  }
  mocks.startOAuth.mockResolvedValue(start)
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'Підключити OLX' }))
  await waitFor(() => expect(mocks.launchOAuth).toHaveBeenCalledWith(start))
  expect(mocks.connect).not.toHaveBeenCalled()
  expect(
    screen.queryByLabelText('Ідентифікатор тестового акаунта'),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Вибрати крило' }),
  ).not.toBeInTheDocument()
})

it('shows verified read-only OAuth connection and verifies only on explicit action', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
    scope: 'v2 read',
    verifiedAt: '2026-11-17T12:00:00Z',
  })
  mocks.verifyConnection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
  })
  show()
  await screen.findByText('verified-123')
  expect(screen.getByText(/Доступ до читання/)).toBeInTheDocument()
  expect(mocks.verifyConnection).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole('button', { name: 'Перевірити підключення' }),
  )
  await waitFor(() => expect(mocks.verifyConnection).toHaveBeenCalledTimes(1))
  expect(mocks.get).not.toHaveBeenCalled()
})

it('keeps connection when disconnect confirmation is cancelled', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
  })
  show()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Відключити акаунт' }),
  )
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent(
    'активні оголошення можна зняти в кабінеті OLX',
  )
  fireEvent.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(mocks.disconnect).not.toHaveBeenCalled()
})

it('does not infer OAuth success from the callback query alone', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: false,
    mode: 'oauth',
  })
  render(
    <MemoryRouter initialEntries={['/app/test/olx-alpha?olx=connected']}>
      <Routes>
        <Route path="/app/test/olx-alpha" element={<OlxLegacyRedirect />} />
        <Route
          path="/app/test/settings/integrations/olx"
          element={<OlxAlphaScreen />}
        />
      </Routes>
    </MemoryRouter>,
  )
  expect(
    await screen.findByRole('button', { name: 'Підключити OLX' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('Підключено')).not.toBeInTheDocument()
  expect(
    screen.getByText(/Розбірка не отримала підтвердження підключення/),
  ).toBeVisible()
  expect(mocks.listingSettings).not.toHaveBeenCalled()
})

it('shows verification during OAuth return and offers to retry a cancelled connection', async () => {
  let finish!: (value: unknown) => void
  mocks.connection.mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  mocks.startOAuth.mockResolvedValue({
    launchUrl: 'https://api.example.test/api/v1/integrations/olx/oauth/launch',
    ticket: 'retry',
    expiresAt: '2026-11-17T18:00:00Z',
  })
  const { unmount } = render(
    <MemoryRouter
      initialEntries={['/app/test/settings/integrations/olx?olx=connected']}
    >
      <OlxAlphaScreen />
    </MemoryRouter>,
  )
  expect(
    screen.getByRole('heading', { name: 'Завершуємо підключення' }),
  ).toBeVisible()
  finish({ available: true, connected: false, mode: 'oauth' })
  await screen.findByText(/Розбірка не отримала підтвердження/)
  unmount()
  mocks.connection.mockResolvedValueOnce({
    available: true,
    connected: false,
    mode: 'oauth',
  })
  render(
    <MemoryRouter
      initialEntries={['/app/test/settings/integrations/olx?olx=cancelled']}
    >
      <OlxAlphaScreen />
    </MemoryRouter>,
  )
  const retry = await screen.findByRole('button', { name: 'Спробувати ще раз' })
  expect(
    screen.getByText('Підключення скасовано. Ви можете почати знову.'),
  ).toBeVisible()
  fireEvent.click(retry)
  await waitFor(() => expect(mocks.launchOAuth).toHaveBeenCalledOnce())
  expect(
    screen.queryByText('Підключення скасовано. Ви можете почати знову.'),
  ).not.toBeInTheDocument()
})

it('stays on the account after OAuth when a city is already saved', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
  })
  mocks.listingSettings.mockResolvedValue({ cityId: 17 })
  function Account() {
    const location = useLocation()
    return (
      <>
        <output data-testid="location">
          {location.pathname + location.search}
        </output>
        <OlxAlphaScreen />
      </>
    )
  }
  render(
    <MemoryRouter
      initialEntries={['/app/test/settings/integrations/olx?olx=connected']}
    >
      <Routes>
        <Route
          path="/app/test/settings/integrations/olx"
          element={<Account />}
        />
        <Route
          path="/app/test/settings/integrations/olx/listing"
          element={<p>Location setup</p>}
        />
      </Routes>
    </MemoryRouter>,
  )
  await waitFor(() =>
    expect(screen.getByTestId('location').textContent).toBe(
      '/app/test/settings/integrations/olx',
    ),
  )
  expect(mocks.listingSettings).toHaveBeenCalledOnce()
  expect(screen.queryByText('Location setup')).not.toBeInTheDocument()
})

it('offers reconnect immediately after a failed token refresh', async () => {
  const current = {
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
  }
  mocks.connection
    .mockResolvedValueOnce(current)
    .mockResolvedValue({ ...current, reconnectRequired: true })
  mocks.verifyConnection.mockRejectedValue({
    kind: 'server',
    code: 'OLX_UNAVAILABLE',
    message: 'Failed',
  })
  show()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Перевірити підключення' }),
  )
  expect(
    await screen.findByRole('button', { name: 'Підключити повторно' }),
  ).toBeEnabled()
  expect(mocks.connection).toHaveBeenCalledTimes(2)
  expect(
    screen.queryByRole('button', { name: 'Перевірити підключення' }),
  ).not.toBeInTheDocument()
})

it('allows disconnecting an existing account when server OAuth configuration is unavailable', async () => {
  mocks.connection.mockResolvedValue({
    available: false,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
  })
  show()
  expect(
    await screen.findByRole('button', { name: 'Відключити акаунт' }),
  ).toBeEnabled()
  expect(
    screen.queryByRole('button', { name: 'Перевірити підключення' }),
  ).not.toBeInTheDocument()
})

it('requests an explicit write upgrade while retaining the connected account', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
    scope: 'v2 read',
    writesAvailable: true,
  })
  const start = {
    launchUrl: 'https://api.example.test/api/v1/integrations/olx/oauth/launch',
    ticket: 'write-upgrade',
    expiresAt: '2026-11-18T15:00:00Z',
  }
  mocks.startWriteOAuth.mockResolvedValue(start)
  show()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Дозволити публікацію в OLX' }),
  )
  await waitFor(() => expect(mocks.launchOAuth).toHaveBeenCalledWith(start))
  expect(mocks.disconnect).not.toHaveBeenCalled()
  expect(mocks.startOAuth).not.toHaveBeenCalled()
})

it('offers the write upgrade in Sales before preparing an advert', async () => {
  const start = {
    launchUrl: 'https://api.example.test/api/v1/integrations/olx/oauth/launch',
    ticket: 'sales-write-upgrade',
    expiresAt: '2026-11-18T15:00:00Z',
  }
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
    scope: 'v2 read',
    writesAvailable: true,
  })
  mocks.startWriteOAuth.mockResolvedValue(start)
  show(true)
  const grant = await screen.findByRole('button', {
    name: 'Дозволити публікацію в OLX',
  })
  expect(mocks.startWriteOAuth).not.toHaveBeenCalled()
  fireEvent.click(grant)
  await waitFor(() => expect(mocks.launchOAuth).toHaveBeenCalledWith(start))
  expect(mocks.startWriteOAuth).toHaveBeenCalledTimes(1)
})

it('tells Sales users without integration management who can grant access', async () => {
  mocks.cabinet.snapshot.permissions.delete('olx.integration.manage')
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    mode: 'oauth',
    accountId: 'verified-123',
    scope: 'v2 read',
    writesAvailable: true,
  })
  show(true)
  expect(
    await screen.findByText(/Попросіть працівника з правом керування OLX/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Дозволити публікацію в OLX' }),
  ).not.toBeInTheDocument()
})

it('keeps the account controls and the adverts on separate routes', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: true,
    accountId: 'connected-123',
    mode: 'oauth',
  })
  render(
    <MemoryRouter initialEntries={['/app/test/settings/integrations/olx']}>
      <Routes>
        <Route
          path="/app/test/settings/integrations/olx"
          element={<OlxAlphaScreen />}
        />
        <Route path="/app/test/olx" element={<OlxSalesScreen />} />
      </Routes>
    </MemoryRouter>,
  )
  const workspace = await screen.findByRole('link', {
    name: 'Відкрити розділ OLX',
  })
  expect(workspace).toHaveAttribute('href', '/app/test/olx')
  expect(mocks.liveAdverts).not.toHaveBeenCalled()
  fireEvent.click(workspace)
  expect(
    await screen.findByRole('heading', { name: 'Оголошень поки немає' }),
  ).toBeVisible()
  expect(mocks.liveAdverts).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('button', { name: 'Відключити акаунт' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Налаштування OLX' }))
  expect(
    await screen.findByRole('button', { name: 'Відключити акаунт' }),
  ).toBeVisible()
  expect(mocks.liveAdverts).toHaveBeenCalledTimes(1)
})

it('shows a settings link for a disconnected sales bookmark without reading adverts', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: false,
    mode: 'oauth',
  })
  show(true)
  expect(
    await screen.findByRole('heading', { name: 'OLX не підключено' }),
  ).toBeVisible()
  expect(
    screen.getByRole('link', { name: 'Налаштування OLX' }),
  ).toHaveAttribute('href', '/app/test/settings/integrations/olx')
  expect(mocks.liveAdverts).not.toHaveBeenCalled()
})

it('forwards the outcome of the existing OAuth return to the account route', async () => {
  mocks.connection.mockResolvedValue({
    available: true,
    connected: false,
    mode: 'oauth',
  })
  function Account() {
    const location = useLocation()
    return (
      <>
        <output data-testid="location">
          {location.pathname + location.search}
        </output>
        <OlxAlphaScreen />
      </>
    )
  }
  render(
    <MemoryRouter
      initialEntries={['/app/test/olx-alpha?olx=cancelled&view=adverts']}
    >
      <Routes>
        <Route path="/app/test/olx-alpha" element={<OlxLegacyRedirect />} />
        <Route
          path="/app/test/settings/integrations/olx"
          element={<Account />}
        />
      </Routes>
    </MemoryRouter>,
  )
  await screen.findByRole('button', { name: 'Спробувати ще раз' })
  expect(screen.getByTestId('location')).toHaveTextContent(
    '/app/test/settings/integrations/olx',
  )
  expect(screen.getByText(/Підключення скасовано/)).toBeVisible()
  expect(mocks.liveAdverts).not.toHaveBeenCalled()
})

it.each([
  { userId: 'other-user', tenantId: 'tenant-1' },
  { userId: 'user-1', tenantId: 'other-tenant' },
])(
  'ignores a pending part return from another user or business (%j)',
  async (scope) => {
    saveOlxPartReturn(
      scope,
      'part-1',
      'seller-1',
      null,
      new Date(Date.now() + 600_000).toISOString(),
    )
    render(
      <MemoryRouter initialEntries={['/app/test/olx-alpha?olx=cancelled']}>
        <Routes>
          <Route path="/app/test/olx-alpha" element={<OlxLegacyRedirect />} />
          <Route
            path="/app/test/settings/integrations/olx"
            element={<p>Account settings</p>}
          />
          <Route path="/app/test/parts/part-1/olx" element={<p>Part OLX</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('Account settings')).toBeVisible()
    expect(screen.queryByText('Part OLX')).toBeNull()
  },
)
