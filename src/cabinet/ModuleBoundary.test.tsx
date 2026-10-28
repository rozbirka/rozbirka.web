import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubscriptionDto } from '../api/types'
import type { CabinetContextValue } from './CabinetContext'
import { useCabinet } from './CabinetContext'
import { ModuleBoundary, type CabinetModuleScreenProps } from './ModuleBoundary'
import { StickersModuleBoundary } from './stickers/StickersModuleBoundary'
import { stickerAccessDefinition } from './stickers/sticker-access'
import type { CabinetModuleKey } from './module-registry'

vi.mock('./CabinetContext', () => ({
  useCabinet: vi.fn(),
}))

const mockedUseCabinet = vi.mocked(useCabinet)

const renderBoundary = (
  module: CabinetModuleKey,
  screenComponent: LazyExoticComponent<ComponentType<CabinetModuleScreenProps>>,
) =>
  render(
    <MemoryRouter>
      <ModuleBoundary module={module} screen={screenComponent} />
    </MemoryRouter>,
  )

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

const cabinet = (
  permissions: string[] = ['billing.view'],
): CabinetContextValue => ({
  status: 'ready',
  targetTenant: {
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
  },
  snapshot: {
    userId: 'user-1',
    tenantId: 'tenant-1',
    generation: 1,
    role: 'owner',
    permissions: new Set(permissions),
    features: new Set(),
    entitlement: { state: subscription.state, usage: subscription.usage },
    subscription,
  },
  error: null,
  retry: vi.fn(),
  switchTenant: vi.fn(),
})

beforeEach(() => {
  mockedUseCabinet.mockReturnValue(cabinet())
})

describe('ModuleBoundary', () => {
  it('holds a local preview until released, preserving the other URL filters', () => {
    function ActualScreen() {
      const location = useLocation()
      return <p>Actual screen {location.search}</p>
    }
    render(
      <MemoryRouter
        initialEntries={[
          '/app/koval/billing?loadingPreview=hold&filter=active',
        ]}
      >
        <ModuleBoundary module="billing" screen={ActualScreen} />
      </MemoryRouter>,
    )
    expect(screen.queryByText(/Actual screen/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Показати екран' }))
    expect(screen.getByText('Actual screen ?filter=active')).toBeVisible()
  })

  it('releases a timed preview and cleans up its timer', () => {
    vi.useFakeTimers()
    try {
      render(
        <MemoryRouter
          initialEntries={['/app/koval/billing?loadingPreview=3000']}
        >
          <ModuleBoundary
            module="billing"
            screen={() => <p>Actual screen</p>}
          />
        </MemoryRouter>,
      )
      expect(screen.queryByText('Actual screen')).not.toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(2999)
      })
      expect(screen.queryByText('Actual screen')).not.toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(1)
      })
      expect(screen.getByText('Actual screen')).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it('cannot use preview mode to bypass module permissions', () => {
    mockedUseCabinet.mockReturnValue(cabinet([]))
    const actual = vi.fn(() => <p>Actual screen</p>)
    render(
      <MemoryRouter initialEntries={['/app/koval/billing?loadingPreview=hold']}>
        <ModuleBoundary module="billing" screen={actual} />
      </MemoryRouter>,
    )
    expect(
      screen.getByRole('heading', { name: 'Недостатньо прав' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Показати екран' }),
    ).not.toBeInTheDocument()
    expect(actual).not.toHaveBeenCalled()
  })

  it('does not show the preview in a deployed build', () => {
    vi.stubEnv('DEV', false)
    try {
      render(
        <MemoryRouter
          initialEntries={['/app/koval/billing?loadingPreview=hold']}
        >
          <ModuleBoundary
            module="billing"
            screen={() => <p>Actual screen</p>}
          />
        </MemoryRouter>,
      )
      expect(screen.getByText('Actual screen')).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'Показати екран' }),
      ).not.toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('loads an allowed released module screen lazily', async () => {
    const load = vi.fn(() =>
      Promise.resolve({
        default: ({ definition }: CabinetModuleScreenProps) => (
          <h1>{definition.navigation?.label}</h1>
        ),
      }),
    )
    const Screen = lazy(load)

    renderBoundary('billing', Screen)

    expect(
      await screen.findByRole('heading', { name: 'Підписка' }),
    ).toBeVisible()
    expect(load).toHaveBeenCalledOnce()
  })

  it('maps a policy denial to the access state without loading module code', () => {
    mockedUseCabinet.mockReturnValue(cabinet([]))
    const load = vi.fn(() =>
      Promise.resolve({
        default: (_props: CabinetModuleScreenProps) => (
          <p>Billing module code</p>
        ),
      }),
    )
    const Screen = lazy(load)

    renderBoundary('billing', Screen)

    expect(
      screen.getByRole('heading', { name: 'Недостатньо прав' }),
    ).toBeVisible()
    expect(screen.queryByText('Billing module code')).not.toBeInTheDocument()
    expect(load).not.toHaveBeenCalled()
  })

  it('shows a truthful plan state for a released feature-gated module without loading its code', () => {
    mockedUseCabinet.mockReturnValue(cabinet(['reports.view']))
    const load = vi.fn(() =>
      Promise.resolve({
        default: (_props: CabinetModuleScreenProps) => (
          <p>Reports module code</p>
        ),
      }),
    )
    const Screen = lazy(load)

    renderBoundary('reports', Screen)

    expect(
      screen.getByRole('heading', {
        name: 'Розділ «Звіти» не входить у ваш тариф',
      }),
    ).toBeVisible()
    expect(screen.getByText(/Недоступно у .*тариф/i)).toBeVisible()
    // The paywall points at the catalogue, not at the dashboard: the reader
    // came here to open the module, not to leave.
    expect(
      screen.getByRole('link', { name: 'Порівняти тарифи' }),
    ).toHaveAttribute('href', '/app/koval/settings/billing/plans')
    expect(
      screen.queryByRole('heading', { name: 'Розділ поки недоступний' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Reports module code')).not.toBeInTheDocument()
    expect(load).not.toHaveBeenCalled()
  })

  it('reads the blocked-subscription access list from the module registry', () => {
    mockedUseCabinet.mockReturnValue({
      ...cabinet(['parts.view', 'billing.view']),
      snapshot: {
        ...cabinet(['parts.view', 'billing.view']).snapshot!,
        entitlement: { state: 'blocked', usage: subscription.usage },
        subscription: { ...subscription, state: 'blocked' },
      },
    })
    const load = vi.fn(() =>
      Promise.resolve({
        default: (_props: CabinetModuleScreenProps) => <p>Parts module code</p>,
      }),
    )

    renderBoundary('parts', lazy(load))

    expect(
      screen.getByRole('heading', {
        name: 'Підписка неактивна — дані лише для читання',
      }),
    ).toBeVisible()
    // Запчастини are closed while blocked; Підписка stays open. Both come from
    // `allowedSubscriptionStates`, the same table the router checks.
    expect(screen.getAllByLabelText('закритий').length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText('доступний').length).toBeGreaterThan(0)
    expect(load).not.toHaveBeenCalled()
  })
})

describe('sticker mode boundary', () => {
  it('accepts a trusted access definition and passes it to the screen', () => {
    mockedUseCabinet.mockReturnValue(cabinet(['inventory.view']))
    render(
      <MemoryRouter>
        <ModuleBoundary
          module="stickers"
          definition={stickerAccessDefinition('locations')}
          screen={({ definition }) => (
            <p>Permission {definition.viewPermission}</p>
          )}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Permission inventory.view')).toBeVisible()
  })

  it('mounts locations for inventory-only access before the screen can request data', () => {
    mockedUseCabinet.mockReturnValue(cabinet(['inventory.view']))
    render(
      <MemoryRouter initialEntries={['/app/koval/stickers?type=locations']}>
        <StickersModuleBoundary
          screen={({ definition }) => (
            <p>Permission {definition.viewPermission}</p>
          )}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Permission inventory.view')).toBeVisible()
  })

  it.each([
    [[], '?type=locations&permission=inventory.view'],
    [['parts.view'], '?type=locations'],
    [['inventory.view'], '?type=parts'],
  ] as const)(
    'does not mount an inaccessible sticker mode for %j and %s',
    (permissions, query) => {
      mockedUseCabinet.mockReturnValue(cabinet([...permissions]))
      const requestData = vi.fn(() =>
        Promise.resolve({ default: () => <p>Sticker data</p> }),
      )
      render(
        <MemoryRouter initialEntries={[`/app/koval/stickers${query}`]}>
          <StickersModuleBoundary screen={lazy(requestData)} />
        </MemoryRouter>,
      )
      expect(
        screen.getByRole('heading', { name: 'Недостатньо прав' }),
      ).toBeVisible()
      expect(requestData).not.toHaveBeenCalled()
    },
  )

  it.each(['loading', 'error'] as const)(
    'does not mount locations while access is %s',
    (status) => {
      mockedUseCabinet.mockReturnValue({
        ...cabinet(),
        status,
        snapshot: null,
        error: status === 'error' ? new Error('offline') : null,
      })
      const requestData = vi.fn(() =>
        Promise.resolve({ default: () => <p>Sticker data</p> }),
      )
      render(
        <MemoryRouter initialEntries={['/app/koval/stickers?type=locations']}>
          <StickersModuleBoundary screen={lazy(requestData)} />
        </MemoryRouter>,
      )
      expect(screen.queryByText('Sticker data')).not.toBeInTheDocument()
      expect(requestData).not.toHaveBeenCalled()
    },
  )

  it('defaults a bare sticker bookmark to locations for inventory-only access', async () => {
    mockedUseCabinet.mockReturnValue(cabinet(['inventory.view']))
    function Content({ definition }: CabinetModuleScreenProps) {
      const location = useLocation()
      return (
        <p>
          {definition.viewPermission} {location.search}
        </p>
      )
    }
    render(
      <MemoryRouter initialEntries={['/app/koval/stickers']}>
        <StickersModuleBoundary screen={Content} />
      </MemoryRouter>,
    )
    expect(
      await screen.findByText('inventory.view ?type=locations'),
    ).toBeVisible()
  })
})
