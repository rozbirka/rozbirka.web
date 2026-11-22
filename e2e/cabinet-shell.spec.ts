import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import {
  appOrigin,
  upstreamOrigin,
  expect,
  test,
  type APIRequestContext,
  type Page,
  type Route,
} from './fixtures'

const phone = '501112233'
const otp = '123456'

const namedUser = {
  id: 'user-1',
  phone: '+380501112233',
  displayName: 'Олена Коваль',
  role: 'owner',
  isActive: true,
  lastLoginAt: null,
}

const tenants = [
  {
    id: 'tenant-1',
    name: 'Розбірка Коваль',
    slug: 'koval',
    plan: 'active',
    planTier: 'pro',
    city: 'Львів',
    logoUrl: null,
    isActive: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    roleName: 'Власник',
  },
  {
    id: 'tenant-2',
    name: 'Розбірка Соболя',
    slug: 'sobol',
    plan: 'blocked',
    planTier: 'starter',
    city: 'Київ',
    logoUrl: null,
    isActive: true,
    createdAt: '2026-08-02T00:00:00.000Z',
    roleName: 'Менеджер',
  },
  {
    id: 'tenant-3',
    name: 'Архівна розбірка',
    slug: 'archive',
    plan: 'blocked',
    planTier: 'starter',
    city: null,
    logoUrl: null,
    isActive: false,
    createdAt: '2026-08-03T00:00:00.000Z',
    roleName: 'Власник',
  },
]

const activeSubscription = {
  source: 'mono',
  manageVia: 'web',
  state: 'active',
  planCode: 'pro',
  planName: 'Koval Pro',
  trialEndsAt: null,
  trialDaysRemaining: null,
  currentPeriodEnd: '2026-09-01T00:00:00.000Z',
  nextChargeAt: '2026-09-01T00:00:00.000Z',
  amount: 99000,
  currency: 'UAH',
  cardLast4: '1234',
  cardBrand: 'visa',
  canSubscribe: false,
  canCancel: true,
  canReactivate: false,
  canActivateTrial: false,
  usage: {
    cars: { used: 1, max: 100 },
    intakes: { used: 1, max: 100 },
    parts: { used: 1, max: 1000 },
    users: { used: 1, max: 10 },
    cashRegisters: { used: 1, max: 2 },
  },
  features: ['reports.advanced', 'team_collaboration'],
}

const blockedSubscription = {
  ...activeSubscription,
  state: 'blocked',
  planCode: 'starter',
  planName: 'Sobol Starter',
  nextChargeAt: null,
  canCancel: false,
}

const publicPlans = [
  {
    code: 'lite_monthly',
    name: 'Lite',
    amount: 29000,
    currency: 'UAH',
    interval: '1m',
    trialDays: 14,
    limits: {
      cars: 10,
      intakes: 10,
      parts: 1000,
      users: 2,
      cashRegisters: 1,
      photosPerPart: null,
    },
    features: [],
  },
]

const pendingPaymentPage = {
  items: [
    {
      id: 'payment-1',
      type: 'checkout',
      status: 'pending',
      amount: 29000,
      currency: 'UAH',
      providerInvoiceId: 'invoice-pending-1',
      checkoutUrl: 'https://pay.example/secure-checkout',
      // Keep this pending-checkout fixture valid regardless of the CI date.
      checkoutExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      createdAt: new Date(Date.now() - 3_600_000).toISOString(),
    },
  ],
  page: 1,
  pageSize: 10,
  total: 1,
  totalPages: 1,
}

interface CabinetFixtureOptions {
  olxAlpha?: boolean
  partsManage?: boolean
  cabinetParityRolledOut?: boolean
  sobolBilling?: boolean
  sobolEntitlementState?: 'active' | 'blocked'
  pendingPayment?: boolean
  overQuota?: boolean
  subscribeFailureStatus?: 403 | 409
  cancelSubscriptionFailureStatus?: 403 | 409
  cancelPaymentFailureStatus?: 403 | 409
  inventoryManage?: boolean
  businessOperations?: boolean
}

interface CabinetRequest {
  method: string
  path: string
  tenantId: string | null
}

type DelayedDeliveryOutcome =
  | { kind: 'fulfilled' }
  | { kind: 'aborted'; error: string }
  | { kind: 'failed'; error: string }

interface CabinetFixtureState {
  requests: CabinetRequest[]
  delayNextPermissions(tenantId: string): void
  waitForDelayedPermissions(): Promise<void>
  releaseDelayedPermissions(): Promise<DelayedDeliveryOutcome>
}

interface DashboardUpstreamStats {
  logoutRequests: number
  dashboardRequests: number
  dashboardAnalyticsRequests: Record<'day' | 'week' | 'month', number>
  dashboardDelayPending: boolean
}

async function fulfillData(route: Route, data: unknown, status = 200) {
  await route.fulfill({ status, json: status < 400 ? { data } : data })
}

function fulfillOlxCallback(route: Route, outcome: 'connected' | 'cancelled') {
  // Playwright cannot fulfill an intercepted navigation with a redirect on WebKit.
  return route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><meta http-equiv="refresh" content="0;url=/app/koval/olx-alpha?olx=${outcome}">`,
  })
}

const isPaymentCancellationPath = (path: string) =>
  /^\/api\/v1\/billing\/payments\/[^/]+\/cancel$/.test(path)

const isRecognizedBillingPath = (path: string) =>
  [
    '/api/v1/billing/subscription',
    '/api/v1/billing/plans',
    '/api/v1/billing/payments',
    '/api/v1/billing/subscribe',
    '/api/v1/billing/cancel',
  ].includes(path) || isPaymentCancellationPath(path)

const isRecognizedDashboardPath = (path: string) =>
  path === '/api/v1/dashboard' || path === '/api/v1/dashboard/analytics'

const isRecognizedTeamPath = (path: string) =>
  path === '/api/v1/team/members' ||
  path === '/api/v1/team/roles' ||
  path === '/api/v1/team/invitations' ||
  /^\/api\/v1\/team\/(?:members|roles|invitations)\/[^/]+(?:\/(?:role|activate|deactivate))?$/.test(
    path,
  ) ||
  /^\/api\/v1\/team\/users\/[^/]+\/permissions$/.test(path)

const isRecognizedReportsPath = (path: string) =>
  path === '/api/v1/reports' ||
  /^\/api\/v1\/reports\/[^/]+(?:\/download)?$/.test(path)

const isRecognizedInventoryPath = (path: string) =>
  path === '/api/v1/warehouses' ||
  path === '/api/v1/inventory/sections' ||
  path === '/api/v1/inventory/shelves' ||
  path === '/api/v1/inventory/sessions' ||
  /^\/api\/v1\/inventory\/sessions\/[^/]+(?:\/(?:results|audit))?$/.test(path)

async function installCabinetApiBoundary(
  page: Page,
  options: CabinetFixtureOptions = {},
): Promise<CabinetFixtureState> {
  const cabinetParityRolledOut = options.cabinetParityRolledOut ?? true
  const cabinetParityRollout = {
    configuration: JSON.stringify({
      version: 1,
      mode: cabinetParityRolledOut ? 'on' : 'off',
      canaryPercent: cabinetParityRolledOut ? 100 : 0,
      emergencyOff: !cabinetParityRolledOut,
    }),
    claim: {
      version: 1,
      subjectId: namedUser.id,
      grants: ['cabinet-parity'],
      audiences: [],
    },
  }
  const requests: CabinetRequest[] = []
  let delayedTenantId: string | null = null
  let resolveStarted: () => void = () => undefined
  let resolveRelease: () => void = () => undefined
  let resolveDelivery: (outcome: DelayedDeliveryOutcome) => void = () =>
    undefined
  let started = new Promise<void>((resolve) => {
    resolveStarted = resolve
  })
  let release = new Promise<void>((resolve) => {
    resolveRelease = resolve
  })
  let delivery = new Promise<DelayedDeliveryOutcome>((resolve) => {
    resolveDelivery = resolve
  })

  // Only API calls belong to this fixture. Documents and static files must
  // reach the real Worker without pausing WebKit's navigation in Playwright.
  const apiRequest = (url: URL) =>
    url.pathname === '/auth/me' ||
    url.pathname === '/api/v1' ||
    url.pathname.startsWith('/api/v1/')
  await page.route(apiRequest, async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const path = requestUrl.pathname
    const tenantId = request.headers()['x-tenant-id'] ?? null

    if (path === '/auth/me' && request.method() === 'GET') {
      await fulfillData(route, namedUser)
      return
    }
    if (path === '/api/v1/tenants' && request.method() === 'GET') {
      await fulfillData(route, tenants)
      return
    }
    if (path === '/api/v1' || path.startsWith('/api/v1/')) {
      requests.push({ method: request.method(), path, tenantId })
    }

    const isTenantScoped =
      path === '/api/v1/shipping/tracking-attention' ||
      path === '/api/v1/me/permissions' ||
      path === '/api/v1/billing/subscription' ||
      path === '/api/v1/billing/payments' ||
      path === '/api/v1/billing/subscribe' ||
      path === '/api/v1/billing/cancel' ||
      isRecognizedDashboardPath(path) ||
      isRecognizedTeamPath(path) ||
      isRecognizedReportsPath(path) ||
      isRecognizedInventoryPath(path) ||
      isPaymentCancellationPath(path)
    if (isTenantScoped) {
      if (tenantId === null) {
        await fulfillData(
          route,
          { error: { code: 'TENANT_REQUIRED', message: 'Tenant required' } },
          400,
        )
        return
      }
      const tenant = tenants.find(({ id }) => id === tenantId)
      if (!tenant) {
        await fulfillData(
          route,
          {
            error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
          },
          404,
        )
        return
      }
      if (!tenant.isActive) {
        await fulfillData(
          route,
          {
            error: { code: 'TENANT_INACTIVE', message: 'Tenant inactive' },
          },
          403,
        )
        return
      }
    }

    if (
      path === '/api/v1/shipping/tracking-attention' &&
      request.method() === 'GET'
    ) {
      await fulfillData(route, {
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
        pausedCount: 0,
        delayedCount: 0,
      })
      return
    }

    if (path === '/api/v1/me/permissions' && request.method() === 'GET') {
      const wasDelayed =
        delayedTenantId !== null && tenantId === delayedTenantId
      if (wasDelayed) {
        delayedTenantId = null
        resolveStarted()
        await release
      }
      const accessByTenant: Record<
        string,
        {
          role: string
          permissions: string[]
          features: string[]
          entitlement: {
            state: string
            usage: typeof activeSubscription.usage
          }
          cabinetParityRollout: typeof cabinetParityRollout
        }
      > = {
        'tenant-1': {
          role: 'owner',
          permissions: [
            ...(options.olxAlpha
              ? [
                  'olx.integration.manage',
                  'olx.publications.manage',
                  'parts.view',
                  'parts.manage',
                ]
              : []),
            'cars.view',
            'cars.manage',
            ...(options.businessOperations
              ? [
                  'orders.view',
                  'orders.manage',
                  'customers.view',
                  'customers.manage',
                  'finance.view',
                  'finance.manage',
                ]
              : []),
            ...(options.partsManage ? ['parts.view', 'parts.manage'] : []),
            'billing.view',
            'billing.manage',
            'team.view',
            'team.manage',
            'reports.view',
            'reports.manage',
            'inventory.view',
            'inventory.zones.manage',
            'inventory.adjust',
            ...(options.inventoryManage === false ? [] : ['inventory.manage']),
          ],
          features: ['reports.advanced', 'team_collaboration'],
          entitlement: {
            state: activeSubscription.state,
            usage: activeSubscription.usage,
          },
          cabinetParityRollout,
        },
        'tenant-2': {
          role: 'manager',
          permissions: [
            'cars.view',
            'cars.manage',
            'parts.view',
            'parts.manage',
            'orders.view',
            'orders.manage',
            'customers.view',
            'customers.manage',
            'finance.view',
            'team.view',
            'intakes.view',
            'intakes.manage',
            'stickers.manage',
            'reports.view',
            'reports.manage',
            ...(options.sobolBilling ? ['billing.view'] : []),
          ],
          features: [],
          entitlement: {
            state: options.sobolEntitlementState ?? blockedSubscription.state,
            usage: blockedSubscription.usage,
          },
          cabinetParityRollout,
        },
      }
      const access = tenantId ? accessByTenant[tenantId] : undefined
      if (!access) {
        throw new Error(`Missing permission fixture for ${tenantId}`)
      }
      if (wasDelayed) {
        const failure = request.failure()
        if (failure) {
          resolveDelivery({ kind: 'aborted', error: failure.errorText })
          return
        }
      }
      try {
        await fulfillData(route, access)
      } catch (error) {
        if (!wasDelayed) throw error
        const failure = request.failure()
        resolveDelivery(
          failure
            ? { kind: 'aborted', error: failure.errorText }
            : {
                kind: 'failed',
                error: error instanceof Error ? error.message : String(error),
              },
        )
        return
      }
      if (wasDelayed) {
        const failure = request.failure()
        resolveDelivery(
          failure
            ? { kind: 'aborted', error: failure.errorText }
            : { kind: 'fulfilled' },
        )
      }
      return
    }
    if (isRecognizedDashboardPath(path)) {
      const authorization = request.headers().authorization
      const upstreamResponse = await fetch(
        `${upstreamOrigin()}${path}${requestUrl.search}`,
        {
          method: request.method(),
          headers: {
            ...(authorization ? { Authorization: authorization } : {}),
            ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
          },
        },
      )
      const body = await upstreamResponse.text()
      await route.fulfill({
        status: upstreamResponse.status,
        body,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type':
            upstreamResponse.headers.get('Content-Type') ??
            'application/json; charset=utf-8',
        },
      })
      return
    }
    if (path === '/api/v1/team/members' && request.method() === 'GET') {
      await fulfillData(route, [
        {
          id: 'member-1',
          userId: 'user-2',
          name: 'Іван Менеджер',
          phone: '+380671112233',
          role: {
            id: 'role-manager',
            name: 'Менеджер',
            isSystem: false,
            permissions: ['team.view', 'reports.view'],
            membersCount: 1,
          },
          isActive: true,
          joinedAt: '2026-08-10T09:00:00.000Z',
        },
      ])
      return
    }
    if (path === '/api/v1/team/roles' && request.method() === 'GET') {
      await fulfillData(route, [
        {
          id: 'role-owner',
          name: 'Власник',
          isSystem: true,
          permissions: ['team.view', 'team.manage'],
          membersCount: 1,
        },
        {
          id: 'role-manager',
          name: 'Менеджер',
          isSystem: false,
          permissions: ['team.view', 'reports.view'],
          membersCount: 1,
        },
      ])
      return
    }
    if (path === '/api/v1/team/invitations' && request.method() === 'GET') {
      await fulfillData(route, [
        {
          id: 'invitation-1',
          code: 'TEAM-2026',
          role: {
            id: 'role-manager',
            name: 'Менеджер',
            isSystem: false,
            permissions: ['team.view', 'reports.view'],
            membersCount: 1,
          },
          expiresAt: '2026-09-30T00:00:00.000Z',
          createdAt: '2026-08-20T00:00:00.000Z',
          isUsed: false,
          isRevoked: false,
          isExpired: false,
        },
      ])
      return
    }
    if (
      path === '/api/v1/team/users/user-2/permissions' &&
      request.method() === 'GET'
    ) {
      await fulfillData(route, {
        userId: 'user-2',
        roleName: 'Менеджер',
        permissions: ['team.view', 'reports.view'],
      })
      return
    }
    if (isRecognizedTeamPath(path)) {
      await fulfillData(
        route,
        {
          error: {
            code: 'FIXTURE_METHOD_NOT_ALLOWED',
            message: 'Team fixture method not allowed',
          },
        },
        405,
      )
      return
    }
    if (path === '/api/v1/reports' && request.method() === 'GET') {
      await fulfillData(route, {
        items: [
          {
            id: 'report-1',
            type: 'carSales',
            status: 'completed',
            stage: 'completed',
            progress: 100,
            itemsTotal: 12,
            itemsProcessed: 12,
            requestedAt: '2026-08-20T10:00:00.000Z',
            startedAt: '2026-08-20T10:00:01.000Z',
            completedAt: '2026-08-20T10:00:03.000Z',
            // A ready-report fixture must not expire as calendar time advances.
            expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
            errorMessage: null,
            fileSizeBytes: 2048,
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      })
      return
    }
    if (isRecognizedReportsPath(path)) {
      await fulfillData(
        route,
        {
          error: {
            code: 'FIXTURE_METHOD_NOT_ALLOWED',
            message: 'Reports fixture method not allowed',
          },
        },
        405,
      )
      return
    }
    if (path === '/api/v1/warehouses' && request.method() === 'GET') {
      await fulfillData(route, [
        {
          id: 'warehouse-1',
          tenantId,
          name: 'Основний склад',
          code: 'main',
          isSystemDefault: true,
          isActive: true,
          zoneCount: 4,
          createdAt: '2026-09-02T09:00:00.000Z',
          updatedAt: '2026-09-02T09:00:00.000Z',
        },
      ])
      return
    }
    if (
      (path === '/api/v1/inventory/sections' ||
        path === '/api/v1/inventory/shelves') &&
      request.method() === 'GET'
    ) {
      await fulfillData(route, [])
      return
    }
    if (path === '/api/v1/inventory/sessions' && request.method() === 'GET') {
      // The list carries the same shape as the detail endpoint: a session
      // always knows its own preview counts.
      await fulfillData(route, [
        {
          id: 'session-1',
          number: 'INV-001',
          status: 'inProgress',
          createdBy: namedUser.id,
          startedBy: namedUser.id,
          completedBy: null,
          createdAt: '2026-09-02T10:00:00.000Z',
          startedAt: '2026-09-02T10:05:00.000Z',
          completedAt: null,
          cancelledAt: null,
          cancellationReason: null,
          preview: {
            includedPartCount: 12,
            coverageWarningPartCount: 0,
            conflictingPartCount: 2,
          },
          zones: [
            {
              zoneId: 'zone-1',
              warehouseId: 'warehouse-1',
              warehouseName: 'Основний склад',
              zoneName: 'Стелаж A1',
              zoneCode: 'A1',
              status: 'counting',
              leaseOwnerUserId: null,
              leaseExpiresAt: null,
              completedAt: null,
            },
          ],
        },
        {
          id: 'session-0',
          number: 'INV-000',
          status: 'completed',
          createdBy: namedUser.id,
          startedBy: namedUser.id,
          completedBy: namedUser.id,
          createdAt: '2026-08-28T10:00:00.000Z',
          startedAt: '2026-08-28T10:05:00.000Z',
          completedAt: '2026-08-28T15:40:00.000Z',
          cancelledAt: null,
          cancellationReason: null,
          preview: {
            includedPartCount: 240,
            coverageWarningPartCount: 0,
            conflictingPartCount: 3,
          },
          zones: [
            {
              zoneId: 'zone-1',
              warehouseId: 'warehouse-1',
              warehouseName: 'Основний склад',
              zoneName: 'Стелаж A1',
              zoneCode: 'A1',
              status: 'completed',
              leaseOwnerUserId: null,
              leaseExpiresAt: null,
              completedAt: '2026-08-28T15:40:00.000Z',
            },
          ],
        },
      ])
      return
    }
    if (
      path === '/api/v1/inventory/sessions/session-1' &&
      request.method() === 'GET'
    ) {
      await fulfillData(route, {
        id: 'session-1',
        number: 'INV-001',
        status: 'review',
        createdBy: namedUser.id,
        startedBy: namedUser.id,
        completedBy: null,
        createdAt: '2026-09-02T10:00:00.000Z',
        startedAt: '2026-09-02T10:05:00.000Z',
        completedAt: null,
        cancelledAt: null,
        cancellationReason: null,
        preview: {
          includedPartCount: 12,
          coverageWarningPartCount: 0,
          conflictingPartCount: 0,
        },
        zones: [
          {
            zoneId: 'zone-1',
            warehouseId: 'warehouse-1',
            warehouseName: 'Основний склад',
            zoneName: 'Стелаж A1',
            zoneCode: 'A1',
            status: 'completed',
            leaseOwnerUserId: null,
            leaseExpiresAt: null,
            completedAt: '2026-09-02T10:30:00.000Z',
          },
        ],
      })
      return
    }
    if (
      path === '/api/v1/inventory/sessions/session-1/results' &&
      request.method() === 'GET'
    ) {
      await fulfillData(route, {
        inventorySessionId: 'session-1',
        number: 'INV-001',
        parts: [
          {
            partId: 'part-1',
            partName: 'Крило',
            partQrCode: 'QR-1',
            expectedQuantity: 2,
            actualQuantity: 1,
            delta: -1,
            result: 'Shortage',
            hasCoverageWarning: false,
            unselectedZoneIds: [],
          },
        ],
      })
      return
    }
    if (
      path === '/api/v1/inventory/sessions/session-1/audit' &&
      request.method() === 'GET'
    ) {
      await fulfillData(route, [])
      return
    }
    if (isRecognizedInventoryPath(path)) {
      await fulfillData(
        route,
        {
          error: {
            code: 'FIXTURE_METHOD_NOT_ALLOWED',
            message: 'Inventory fixture method not allowed',
          },
        },
        405,
      )
      return
    }
    if (path === '/api/v1/billing/subscription' && request.method() === 'GET') {
      const kovalSubscription = options.overQuota
        ? {
            ...activeSubscription,
            usage: {
              ...activeSubscription.usage,
              cars: { used: 101, max: 100 },
            },
          }
        : activeSubscription
      await fulfillData(
        route,
        tenantId === 'tenant-2' ? blockedSubscription : kovalSubscription,
      )
      return
    }
    if (path === '/api/v1/billing/plans' && request.method() === 'GET') {
      await fulfillData(route, publicPlans)
      return
    }
    if (path === '/api/v1/billing/payments' && request.method() === 'GET') {
      await fulfillData(
        route,
        options.pendingPayment
          ? pendingPaymentPage
          : {
              items: [],
              page: 1,
              pageSize: 10,
              total: 0,
              totalPages: 0,
            },
      )
      return
    }
    if (path === '/api/v1/billing/subscribe' && request.method() === 'POST') {
      if (options.subscribeFailureStatus) {
        await fulfillData(
          route,
          {
            error: {
              code: 'BILLING_DENIED',
              message: 'Raw fixture billing denial',
            },
          },
          options.subscribeFailureStatus,
        )
      } else {
        await fulfillData(route, {
          checkoutUrl: 'https://pay.example/new-checkout',
        })
      }
      return
    }
    if (path === '/api/v1/billing/cancel' && request.method() === 'POST') {
      if (options.cancelSubscriptionFailureStatus) {
        await fulfillData(
          route,
          {
            error: {
              code: 'SUBSCRIPTION_STATUS_CHANGED',
              message: 'Raw fixture subscription conflict',
            },
          },
          options.cancelSubscriptionFailureStatus,
        )
      } else {
        await fulfillData(route, null)
      }
      return
    }
    if (isPaymentCancellationPath(path) && request.method() === 'POST') {
      if (options.cancelPaymentFailureStatus) {
        await fulfillData(
          route,
          {
            error: {
              code: 'PAYMENT_STATUS_CHANGED',
              message: 'Raw fixture payment conflict',
            },
          },
          options.cancelPaymentFailureStatus,
        )
      } else {
        await fulfillData(route, null)
      }
      return
    }
    if (isRecognizedBillingPath(path)) {
      await fulfillData(
        route,
        {
          error: {
            code: 'FIXTURE_METHOD_NOT_ALLOWED',
            message: 'Billing fixture method not allowed',
          },
        },
        405,
      )
      return
    }

    if (path === '/api/v1' || path.startsWith('/api/v1/')) {
      await fulfillData(
        route,
        {
          error: {
            code: 'FIXTURE_ROUTE_NOT_IMPLEMENTED',
            message: 'API fixture route not implemented',
          },
        },
        501,
      )
      return
    }

    await route.continue()
  })

  return {
    requests,
    delayNextPermissions: (tenantId) => {
      delayedTenantId = tenantId
      started = new Promise<void>((resolve) => {
        resolveStarted = resolve
      })
      release = new Promise<void>((resolve) => {
        resolveRelease = resolve
      })
      delivery = new Promise<DelayedDeliveryOutcome>((resolve) => {
        resolveDelivery = resolve
      })
    },
    waitForDelayedPermissions: () => started,
    releaseDelayedPermissions: async () => {
      resolveRelease()
      return delivery
    },
  }
}

async function resetUpstream(request: APIRequestContext) {
  const response = await request.post(`${upstreamOrigin()}/_test/reset`, {
    data: {},
  })
  expect(response.ok()).toBeTruthy()
}

async function upstreamStats(
  request: APIRequestContext,
): Promise<DashboardUpstreamStats> {
  const response = await request.get(`${upstreamOrigin()}/_test/stats`)
  expect(response.ok()).toBeTruthy()
  return (await response.json()) as DashboardUpstreamStats
}

async function resetDashboardUpstream(
  request: APIRequestContext,
  options: {
    dashboardSummaryFailures?: number
    dashboardAnalyticsFailures?: Partial<
      Record<'day' | 'week' | 'month', number>
    >
  } = {},
) {
  const response = await request.post(
    `${upstreamOrigin()}/_test/dashboard/reset`,
    { data: options },
  )
  expect(response.ok()).toBeTruthy()
}

async function armDelayedDashboard(
  request: APIRequestContext,
  tenantId: string,
) {
  const response = await request.post(
    `${upstreamOrigin()}/_test/dashboard/delay`,
    { data: { tenantId } },
  )
  expect(response.ok()).toBeTruthy()
}

async function releaseDelayedDashboard(request: APIRequestContext) {
  const response = await request.post(
    `${upstreamOrigin()}/_test/dashboard/release`,
  )
  expect(response.ok()).toBeTruthy()
}

async function armDelayedLogout(request: APIRequestContext) {
  const response = await request.post(`${upstreamOrigin()}/_test/logout/delay`)
  expect(response.ok()).toBeTruthy()
}

async function releaseDelayedLogout(request: APIRequestContext) {
  const response = await request.post(
    `${upstreamOrigin()}/_test/logout/release`,
  )
  expect(response.ok()).toBeTruthy()
}

async function fixtureGet(page: Page, path: string, tenantId?: string) {
  return page.evaluate(
    async ({ requestPath, requestedTenant }) => {
      const response = await fetch(requestPath, {
        headers: requestedTenant
          ? { 'X-Tenant-Id': requestedTenant }
          : undefined,
      })
      return {
        status: response.status,
        body: await response.json(),
      }
    },
    { requestPath: path, requestedTenant: tenantId },
  )
}

async function fixtureRequest(
  page: Page,
  {
    path,
    method,
    tenantId,
  }: { path: string; method: string; tenantId?: string },
) {
  return page.evaluate(
    async ({ requestPath, requestMethod, requestedTenant }) => {
      const response = await fetch(requestPath, {
        method: requestMethod,
        headers: requestedTenant
          ? { 'X-Tenant-Id': requestedTenant }
          : undefined,
      })
      const text = await response.text()
      let body: unknown = text
      try {
        body = JSON.parse(text) as unknown
      } catch {
        // Preserve the non-JSON body so an escaped fixture route fails clearly.
      }
      return { status: response.status, body }
    },
    {
      requestPath: path,
      requestMethod: method,
      requestedTenant: tenantId,
    },
  )
}

async function completeOtpLogin(page: Page) {
  await page.getByLabel('Номер телефону').fill(phone)
  await page.getByRole('button', { name: 'Отримати код' }).click()
  for (const [index, digit] of [...otp].entries()) {
    await page.getByLabel(`Цифра ${index + 1}`).fill(digit)
  }
  await page.getByRole('button', { name: 'Підтвердити' }).click()
}

async function loginFrom(page: Page) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await completeOtpLogin(page)
  await expect(page).toHaveURL('/app/koval/dashboard')
  await expect(
    page.getByLabel('Розбірка і розділ').filter({ hasText: 'Розбірка Коваль' }),
  ).toBeVisible()
}

async function selectVisibleTenant(page: Page, tenantId: string) {
  let switcher = page
    .getByRole('combobox', { name: 'Перемкнути розбірку' })
    .filter({ visible: true })
  if ((await switcher.count()) === 0) {
    await page.getByRole('button', { name: 'Ще', exact: true }).click()
    switcher = page
      .getByRole('dialog', { name: 'Меню кабінету' })
      .getByRole('combobox', { name: 'Перемкнути розбірку' })
  }
  await switcher.selectOption(tenantId)
}

async function clickVisibleCabinetLink(page: Page, name: string) {
  let link = page
    .locator('nav')
    .filter({ visible: true })
    .getByRole('link', { name, exact: true })
  if ((await link.count()) === 0) {
    await page.getByRole('button', { name: 'Ще', exact: true }).click()
    link = page
      .getByRole('dialog', { name: 'Меню кабінету' })
      .getByRole('link', { name, exact: true })
  }
  await link.click()
}

/**
 * The board greets the person the summary names, so the greeting is what says
 * "this tenant's summary has arrived" — and it says which tenant.
 */
const dashboardGreeting = (page: Page) =>
  page.getByRole('heading', { level: 1 })

/** The analytics half of the board: it names the period it just loaded. */
const revenueChart = (page: Page) =>
  page.getByRole('region', { name: 'Фактичні надходження' })

async function expectPopulatedDashboard(page: Page) {
  await expect(dashboardGreeting(page)).toContainText('Олена')
  await expect(revenueChart(page)).toContainText(
    'Фактичні надходження · Тиждень',
  )
}

const releasedAccessPaths = [
  '/app/koval/team',
  '/app/koval/reports',
  '/app/koval/settings/profile',
  '/app/koval/settings/business',
  '/app/koval/settings/billing/overview',
  '/app/koval/settings/billing/plans',
  '/app/koval/settings/billing/payments',
] as const

async function expectReleasedScreenSettled(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  if (path.endsWith('/team')) {
    await expect(page.getByText('Іван Менеджер')).toBeVisible()
    await expect(page.getByText('TEAM-2026', { exact: true })).toBeVisible()
    return
  }
  if (path.endsWith('/reports')) {
    // Reports are a table now: the state reads as a pill, not a card heading.
    await expect(
      page.getByRole('table', { name: 'Список звітів' }),
    ).toBeVisible()
    await expect(page.getByText('Готовий', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Завантажити PDF' }),
    ).toBeVisible()
    return
  }
  if (path === '/app/koval/settings/profile') {
    await expect(page.getByLabel('Ім’я та прізвище')).toHaveValue(
      'Олена Коваль',
    )
    return
  }
  if (path === '/app/koval/settings/business') {
    await expect(page.getByLabel('Назва бізнесу')).toHaveValue(
      'Розбірка Коваль',
    )
    return
  }
  if (path === '/app/koval/settings/billing/overview') {
    await expect(
      page.getByRole('heading', { name: 'Підписка', level: 1 }),
    ).toBeVisible()
    await expect(page.getByText('Koval Pro', { exact: true })).toBeVisible()
    return
  }
  if (path === '/app/koval/settings/billing/plans') {
    await expect(
      page.getByRole('heading', { name: 'Тарифи', level: 1 }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('table', { name: 'Тарифи', exact: true })
        .getByRole('rowheader', { name: /^Lite/ }),
    ).toBeVisible()
    return
  }
  if (path === '/app/koval/settings/billing/payments') {
    await expect(
      page.getByRole('heading', { name: 'Платежі', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Історія платежів', level: 2 }),
    ).toBeVisible()
    await expect(page.getByText('Платежів ще не було.')).toBeVisible()
    return
  }
  throw new Error(`Missing settled-screen assertion for ${path}`)
}

test.beforeEach(async ({ request }) => {
  await resetUpstream(request)
})

test('tenant fixture rejects missing tenant headers for every scoped endpoint', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await page.goto('/login')

  for (const path of [
    '/api/v1/me/permissions',
    '/api/v1/billing/subscription',
    '/api/v1/dashboard',
    '/api/v1/dashboard/analytics?period=week',
  ]) {
    expect(await fixtureGet(page, path), path).toEqual({
      status: 400,
      body: {
        error: { code: 'TENANT_REQUIRED', message: 'Tenant required' },
      },
    })
  }
})

test('tenant fixture rejects unknown and inactive tenant headers', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await page.goto('/login')

  for (const path of [
    '/api/v1/me/permissions',
    '/api/v1/billing/subscription',
    '/api/v1/dashboard',
    '/api/v1/dashboard/analytics?period=week',
  ]) {
    expect(await fixtureGet(page, path, 'tenant-unknown'), path).toEqual({
      status: 404,
      body: {
        error: { code: 'TENANT_NOT_FOUND', message: 'Tenant not found' },
      },
    })
    expect(await fixtureGet(page, path, 'tenant-3'), path).toEqual({
      status: 403,
      body: {
        error: { code: 'TENANT_INACTIVE', message: 'Tenant inactive' },
      },
    })
  }
})

test('billing fixture fails closed for every unsupported recognized method', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await page.goto('/login')

  for (const request of [
    {
      path: '/api/v1/billing/subscription',
      method: 'POST',
      tenantId: 'tenant-1',
    },
    { path: '/api/v1/billing/plans', method: 'POST' },
    {
      path: '/api/v1/billing/payments',
      method: 'POST',
      tenantId: 'tenant-1',
    },
    {
      path: '/api/v1/billing/subscribe',
      method: 'GET',
      tenantId: 'tenant-1',
    },
    {
      path: '/api/v1/billing/cancel',
      method: 'GET',
      tenantId: 'tenant-1',
    },
    {
      path: '/api/v1/billing/payments/payment-1/cancel',
      method: 'GET',
      tenantId: 'tenant-1',
    },
  ]) {
    expect(
      await fixtureRequest(page, request),
      `${request.method} ${request.path}`,
    ).toEqual({
      status: 405,
      body: {
        error: {
          code: 'FIXTURE_METHOD_NOT_ALLOWED',
          message: 'Billing fixture method not allowed',
        },
      },
    })
  }
})

test('billing fixture handles subscription cancellation without route escape', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, {
    cancelSubscriptionFailureStatus: 409,
  })
  await page.goto('/login')

  expect(
    await fixtureRequest(page, {
      path: '/api/v1/billing/cancel',
      method: 'POST',
      tenantId: 'tenant-1',
    }),
  ).toEqual({
    status: 409,
    body: {
      error: {
        code: 'SUBSCRIPTION_STATUS_CHANGED',
        message: 'Raw fixture subscription conflict',
      },
    },
  })
})

test('cabinet fixture fails closed for every unexpected API route', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await page.goto('/login')

  for (const path of [
    '/api/v1',
    '/api/v1/unexpected',
    '/api/v1/team/members/member-1/unexpected',
    '/api/v1/reports/report-1/download/unexpected',
  ]) {
    expect(await fixtureGet(page, path, 'tenant-1'), path).toEqual({
      status: 501,
      body: {
        error: {
          code: 'FIXTURE_ROUTE_NOT_IMPLEMENTED',
          message: 'API fixture route not implemented',
        },
      },
    })
  }
})

test('same-slug Back aborts a pending tenant selection before it can commit @cabinet-smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const fixture = await installCabinetApiBoundary(page, {
    sobolEntitlementState: 'active',
  })
  await loginFrom(page)
  await selectVisibleTenant(page, 'tenant-2')
  await expect(page).toHaveURL('/app/sobol/dashboard')
  await expect(
    page.getByLabel('Розбірка і розділ').filter({ hasText: 'Розбірка Соболя' }),
  ).toBeVisible()
  await clickVisibleCabinetLink(page, 'Профіль')
  await expect(page).toHaveURL('/app/sobol/settings/profile')

  fixture.delayNextPermissions('tenant-1')
  const formerAccessRequestFailed = page.waitForEvent('requestfailed', {
    predicate: (request) =>
      new URL(request.url()).pathname === '/api/v1/me/permissions' &&
      request.headers()['x-tenant-id'] === 'tenant-1',
  })
  await selectVisibleTenant(page, 'tenant-1')
  await fixture.waitForDelayedPermissions()
  await page.goBack()
  await expect(page).toHaveURL('/app/sobol/dashboard')
  await expect(
    page.getByLabel('Розбірка і розділ').filter({ hasText: 'Розбірка Соболя' }),
  ).toBeVisible()
  const abortedRequest = await formerAccessRequestFailed
  expect(abortedRequest.failure()?.errorText).toMatch(/aborted|cancelled/i)

  const formerTenantHeadingAppeared = page
    .getByLabel('Розбірка і розділ')
    .filter({ hasText: 'Розбірка Коваль' })
    .waitFor({ state: 'visible', timeout: 1_000 })
    .then(
      () => true,
      () => false,
    )
  const formerTenantAccessAppeared = page
    .getByRole('link', { name: 'Підписка' })
    .filter({ visible: true })
    .waitFor({ state: 'visible', timeout: 1_000 })
    .then(
      () => true,
      () => false,
    )
  const deliveryOutcome: unknown = await fixture.releaseDelayedPermissions()
  expect(deliveryOutcome).toMatchObject({ kind: 'aborted' })
  expect(await formerTenantHeadingAppeared).toBe(false)
  expect(await formerTenantAccessAppeared).toBe(false)
  await expect(
    page.getByLabel('Розбірка і розділ').filter({ hasText: 'Розбірка Коваль' }),
  ).not.toBeVisible()
  await expect(page.getByRole('link', { name: 'Підписка' })).not.toBeVisible()
  await page.setViewportSize({ width: 320, height: 900 })
  const mobileMore = page.getByRole('button', { name: 'Ще', exact: true })
  await expect(mobileMore).toBeVisible()
  await mobileMore.click()
  await expect(
    page
      .getByRole('dialog', { name: 'Меню кабінету' })
      .getByRole('link', { name: 'Підписка' }),
  ).toHaveCount(0)
  await page.keyboard.press('Escape')
  expect(
    fixture.requests.filter(
      ({ path, tenantId }) =>
        path === '/api/v1/me/permissions' && tenantId === 'tenant-2',
    ).length,
  ).toBeGreaterThan(0)
})

test('loads tenant-specific subscription data from tenant-scoped requests @cabinet-smoke', async ({
  page,
}) => {
  const fixture = await installCabinetApiBoundary(page, { sobolBilling: true })
  await loginFrom(page)
  await clickVisibleCabinetLink(page, 'Підписка')
  await expect(page.getByText('Koval Pro', { exact: true })).toBeVisible()

  await selectVisibleTenant(page, 'tenant-2')
  await expect(page).toHaveURL('/app/sobol/settings/billing/overview')
  await expect(page.getByText('Доступ закрито').first()).toBeVisible()
  expect(fixture.requests).toEqual(
    expect.arrayContaining([
      {
        method: 'GET',
        path: '/api/v1/billing/subscription',
        tenantId: 'tenant-1',
      },
      {
        method: 'GET',
        path: '/api/v1/billing/subscription',
        tenantId: 'tenant-2',
      },
    ]),
  )
})

test('falls back to the target dashboard when its policy denies the current module @cabinet-smoke', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, {
    sobolEntitlementState: 'active',
  })
  await loginFrom(page)
  await clickVisibleCabinetLink(page, 'Підписка')
  await expect(page).toHaveURL('/app/koval/settings/billing/overview')

  await selectVisibleTenant(page, 'tenant-2')

  await expect(page).toHaveURL('/app/sobol/dashboard')
  await expect(
    page.getByLabel('Розбірка і розділ').filter({ hasText: 'Розбірка Соболя' }),
  ).toBeVisible()
})

test('blocked tenant dashboard shows renewal without requesting business data @cabinet-smoke', async ({
  page,
}) => {
  const fixture = await installCabinetApiBoundary(page)
  await loginFrom(page)
  await selectVisibleTenant(page, 'tenant-2')

  await expect(page).toHaveURL('/app/sobol/dashboard')
  await expect(
    page.getByRole('combobox', { name: 'Перемкнути розбірку' }),
  ).toHaveValue('tenant-2')
  await expect(
    page.getByRole('heading', { name: 'Доступ призупинено', level: 1 }),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Керування підпискою недоступне для ваших прав. Зверніться до власника розбірки або підтримки.',
    ),
  ).toBeVisible()
  expect(
    fixture.requests.filter(
      ({ path, tenantId }) =>
        tenantId === 'tenant-2' &&
        (path === '/api/v1/dashboard' ||
          path === '/api/v1/dashboard/analytics'),
    ),
  ).toHaveLength(0)
})

test('boots an active Manager entitlement without requesting detailed billing @cabinet-smoke', async ({
  page,
}) => {
  const fixture = await installCabinetApiBoundary(page, {
    sobolEntitlementState: 'active',
  })
  await loginFrom(page)

  await selectVisibleTenant(page, 'tenant-2')

  await expect(page).toHaveURL('/app/sobol/dashboard')
  await expect(
    page.getByLabel('Розбірка і розділ').filter({ hasText: 'Розбірка Соболя' }),
  ).toBeVisible()
  expect(
    fixture.requests.filter(
      ({ path, tenantId }) =>
        path === '/api/v1/me/permissions' && tenantId === 'tenant-2',
    ).length,
  ).toBeGreaterThan(0)
  expect(
    fixture.requests.filter(
      ({ path, tenantId }) =>
        path === '/api/v1/billing/subscription' && tenantId === 'tenant-2',
    ),
  ).toHaveLength(0)
})

test('loads a direct week dashboard once, navigates month and Back, and traverses periods by keyboard @cabinet-smoke', async ({
  page,
  request,
}, testInfo) => {
  const fixture = await installCabinetApiBoundary(page)
  await loginFrom(page)
  await expect(dashboardGreeting(page)).toContainText('Олена')
  await resetDashboardUpstream(request)

  await page.goto('/app/koval/dashboard?period=week')
  await expect(page).toHaveURL('/app/koval/dashboard?period=week')
  await expect(dashboardGreeting(page)).toContainText('Олена')
  await expect(revenueChart(page)).toContainText(
    'Фактичні надходження · Тиждень',
  )
  await expect(page.getByRole('button', { name: 'Тиждень' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect
    .poll(async () => {
      const stats = await upstreamStats(request)
      return {
        summary: stats.dashboardRequests,
        analytics: stats.dashboardAnalyticsRequests,
      }
    })
    .toEqual({
      summary: 1,
      analytics: { day: 0, week: 1, month: 0 },
    })

  await page.getByRole('button', { name: 'Місяць' }).click()
  await expect(page).toHaveURL('/app/koval/dashboard?period=month')
  await expect(revenueChart(page)).toContainText(
    'Фактичні надходження · Місяць',
  )
  await expect
    .poll(async () => (await upstreamStats(request)).dashboardAnalyticsRequests)
    .toEqual({ day: 0, week: 1, month: 1 })

  await page.goBack()
  await expect(page).toHaveURL('/app/koval/dashboard?period=week')
  await expect(revenueChart(page)).toContainText(
    'Фактичні надходження · Тиждень',
  )
  await expect
    .poll(async () => (await upstreamStats(request)).dashboardAnalyticsRequests)
    .toEqual({ day: 0, week: 2, month: 1 })

  const day = page.getByRole('button', { name: 'День', exact: true })
  const week = page.getByRole('button', { name: 'Тиждень', exact: true })
  const month = page.getByRole('button', { name: 'Місяць', exact: true })
  await day.focus()
  if (testInfo.project.name === 'webkit' || testInfo.project.name === 'ios') {
    // Playwright WebKit follows the host's full-keyboard-access setting, so
    // Tab cannot traverse native buttons reliably in this engine. Keep the
    // engine's native button eligibility and keyboard activation covered.
    await expect(day).toBeFocused()
    await expect(week).toHaveJSProperty('tabIndex', 0)
    await expect(month).toHaveJSProperty('tabIndex', 0)
    await month.focus()
  } else {
    await page.keyboard.press('Tab')
    await expect(week).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(month).toBeFocused()
  }
  await month.press('Enter')
  await expect(page).toHaveURL('/app/koval/dashboard?period=month')
  expect(
    fixture.requests.filter(
      ({ path, tenantId }) =>
        path === '/api/v1/dashboard' && tenantId === 'tenant-1',
    ).length,
  ).toBeGreaterThan(0)
})

test('retries failed dashboard summary and analytics independently', async ({
  page,
  request,
}) => {
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  await expect(dashboardGreeting(page)).toContainText('Олена')
  await resetDashboardUpstream(request, {
    dashboardSummaryFailures: 1,
    dashboardAnalyticsFailures: { week: 1 },
  })

  await page.goto('/app/koval/dashboard?period=week')
  const summaryError = page
    .getByRole('alert')
    .filter({ hasText: 'Не вдалося завантажити зведення.' })
  const analyticsError = page
    .getByRole('alert')
    .filter({ hasText: 'Не вдалося завантажити аналітику.' })
  await expect(summaryError).toBeVisible()
  await expect(analyticsError).toBeVisible()
  await expect
    .poll(async () => {
      const stats = await upstreamStats(request)
      return {
        summary: stats.dashboardRequests,
        week: stats.dashboardAnalyticsRequests.week,
      }
    })
    .toEqual({ summary: 1, week: 1 })

  await summaryError.getByRole('button', { name: 'Спробувати ще раз' }).click()
  await expect(dashboardGreeting(page)).toContainText('Олена')
  await analyticsError
    .getByRole('button', { name: 'Спробувати ще раз' })
    .click()
  await expect(revenueChart(page)).toContainText(
    'Фактичні надходження · Тиждень',
  )
  await expect
    .poll(async () => {
      const stats = await upstreamStats(request)
      return {
        summary: stats.dashboardRequests,
        week: stats.dashboardAnalyticsRequests.week,
      }
    })
    .toEqual({ summary: 2, week: 2 })
})

test('clears stale dashboard totals while the next tenant summary is pending', async ({
  page,
  request,
}) => {
  // Both tenants need active access: a blocked subscription correctly skips
  // business-data requests and renders the renewal entry instead.
  const fixture = await installCabinetApiBoundary(page, {
    sobolEntitlementState: 'active',
  })
  await loginFrom(page)
  await expect(dashboardGreeting(page)).toContainText('Олена')
  await armDelayedDashboard(request, 'tenant-2')
  let delayReleased = false

  try {
    await selectVisibleTenant(page, 'tenant-2')
    await expect
      .poll(async () => (await upstreamStats(request)).dashboardDelayPending)
      .toBe(true)

    await expect(page).toHaveURL('/app/sobol/dashboard')
    await expect(page.getByLabel('Завантаження зведення')).toBeVisible()
    await expect(dashboardGreeting(page)).not.toContainText('Олена')

    await releaseDelayedDashboard(request)
    delayReleased = true
    await expect(dashboardGreeting(page)).toContainText('Максим')
  } finally {
    if (!delayReleased) await releaseDelayedDashboard(request)
  }
  expect(
    fixture.requests.filter(({ path }) => path === '/api/v1/dashboard'),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ tenantId: 'tenant-1' }),
      expect.objectContaining({ tenantId: 'tenant-2' }),
    ]),
  )
})

for (const width of [320, 768, 1024, 1440]) {
  test(`has no document overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await installCabinetApiBoundary(page)
    await loginFrom(page)
    await expectPopulatedDashboard(page)

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test('uses mobile, tablet, and desktop cabinet presentations at their breakpoints @cabinet-smoke', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)

  for (const [width, visibleNavigation] of [
    [320, 'Мобільна навігація'],
    [768, 'Навігація планшета'],
    [1024, 'Навігація кабінету'],
    [1440, 'Навігація кабінету'],
  ] as const) {
    await page.setViewportSize({ width, height: 900 })
    if (page.url() === 'about:blank') await loginFrom(page)
    await expect(
      page.getByRole('navigation', { name: visibleNavigation }),
    ).toBeVisible()
  }
})

test('warehouses and stocktake remain separate at mobile and desktop widths @cabinet-smoke', async ({
  page,
}, testInfo) => {
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  const stocktakeRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/v1/inventory/sessions')
      stocktakeRequests.push(request.url())
  })

  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/app/koval/inventory')
    await expect(
      page.getByRole('heading', { name: 'Інвентаризація' }),
    ).toBeVisible()
    await expect(page.getByRole('region', { name: 'Склади' })).toHaveCount(0)
    await expect(page.getByText('INV-001')).toBeVisible()
    if (width === 1440)
      await page.screenshot({
        path: testInfo.outputPath('stocktake-separated.png'),
        animations: 'disabled',
      })
    const requestsBeforeWarehouses = stocktakeRequests.length
    const activeNavigation = page.getByRole('navigation', {
      name:
        width < 768
          ? 'Мобільна навігація'
          : width < 1024
            ? 'Навігація планшета'
            : 'Навігація кабінету',
    })
    await activeNavigation
      .getByRole('link', { name: 'Склади', exact: true })
      .click()
    await expect(page).toHaveURL('/app/koval/warehouses')
    await expect(
      page.getByRole('heading', { level: 1, name: 'Склади' }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Склади' }).getByText('Основний склад'),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Сесії інвентаризації' }),
    ).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Нова сесія' })).toHaveCount(0)
    expect(stocktakeRequests).toHaveLength(requestsBeforeWarehouses)
    await expect(page.getByText('Перевірка триває')).toHaveCount(0)
    if (width === 1440) {
      const navigation = page.getByRole('navigation', {
        name: 'Навігація кабінету',
      })
      await expect(
        navigation.getByRole('link', { name: 'Склади', exact: true }),
      ).toHaveAttribute('aria-current', 'page')
      await expect(
        navigation.getByRole('link', { name: 'Інвентаризація', exact: true }),
      ).not.toHaveAttribute('aria-current')
    }
    if (width === 1440)
      await page.screenshot({
        path: testInfo.outputPath('warehouses-separated.png'),
        animations: 'disabled',
      })
    // Font swapping changes intrinsic text widths after the content is visible.
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      fonts: document.fonts.status,
      overflowing: [...document.querySelectorAll('body *')]
        .map((element) => ({
          tag: element.tagName,
          classes: element.getAttribute('class'),
          text: element.textContent?.slice(0, 80),
          left: element.getBoundingClientRect().left,
          right: element.getBoundingClientRect().right,
        }))
        .filter(
          (element) =>
            element.right > window.innerWidth + 0.5 || element.left < -0.5,
        ),
    }))
    expect(
      layout.scrollWidth,
      JSON.stringify(layout, null, 2),
    ).toBeLessThanOrEqual(layout.width)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/koval/inventory/warehouses/warehouse-1?labels=1#queue')
  await expect(page).toHaveURL(
    '/app/koval/stickers?type=locations&kind=zone&parent=warehouse-1&select=all',
  )
  await page.goto('/app/koval/inventory/sessions/session-1')
  await expect(page.getByRole('heading', { name: 'INV-001' })).toBeVisible()
  await expect(page.getByText(/увімкнути камеру/i)).toHaveCount(0)
  await page.getByRole('link', { name: 'Результати' }).click()
  await expect(
    page.getByRole('heading', { name: 'Результати сесії' }),
  ).toBeVisible()
  await expect(page.getByText('Крило')).toBeVisible()
})

test('directory searches retain spaces and rapid typing @search-spaces', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { businessOperations: true })
  const pageOf = (items: unknown[]) => ({
    items,
    page: 1,
    pageSize: 30,
    total: items.length,
    totalPages: 1,
  })
  await page.route('**/api/v1/customers*', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path !== '/api/v1/customers' && path !== '/api/v1/customers/directory')
      return route.fallback()
    return fulfillData(
      route,
      pageOf([
        {
          id: 'customer-search',
          name: 'Тестовий клієнт',
          phone: null,
          ordersCount: 1,
          totalAmount: 100,
          averageAmount: 100,
          firstOrderAt: null,
          lastOrderAt: null,
          isActive: true,
          createdAt: '2026-09-02T10:00:00Z',
        },
      ]),
    )
  })
  await page.route('**/api/v1/orders*', (route) => {
    if (new URL(route.request().url()).pathname !== '/api/v1/orders')
      return route.fallback()
    return fulfillData(
      route,
      pageOf([
        {
          id: 'order-search',
          number: 1,
          status: 'pending',
          customerName: 'Тестовий клієнт',
          totalAmount: 100,
          currency: 'USD',
          createdAt: '2026-09-02T10:00:00Z',
          itemsCount: 1,
          paymentAccountNames: [],
          partNames: ['Тестова деталь'],
        },
      ]),
    )
  })
  await loginFrom(page)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    for (const [route, label] of [
      ['customers', 'Пошук клієнта'],
      ['orders', 'Пошук замовлень'],
    ]) {
      await page.goto(`/app/koval/${route}`)
      const search = page.getByRole('searchbox', { name: label, exact: true })
      await search.pressSequentially('Тест ')
      await expect(search).toHaveValue('Тест ')
      await search.pressSequentially('пошук ')
      await expect(search).toHaveValue('Тест пошук ')
      await expect
        .poll(() => new URL(page.url()).searchParams.get('q'))
        .toBe('Тест пошук ')
      await search.fill('  Довга назва  ')
      await expect(search).toHaveValue('  Довга назва  ')
      await search.clear()
      await expect(search).toHaveValue('')
      await expect
        .poll(() => new URL(page.url()).searchParams.has('q'))
        .toBe(false)
    }
  }
})

test('compact location browser searches and pages large shelf lists @location-browser', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await installCabinetApiBoundary(page, { partsManage: true })
  const sections = Array.from({ length: 21 }, (_, index) => ({
    id: `section-${index}`,
    zoneId: 'zone-1',
    zoneName: 'Зона А',
    warehouseId: 'warehouse-1',
    warehouseName: 'Основний склад',
    name: `Секція ${index + 1}`,
    code: `S${index + 1}`,
    qrCode: `inventory-section:${index}`,
    isActive: true,
    partCount: 100,
  }))
  const shelves = sections.flatMap((section) =>
    Array.from({ length: 100 }, (_, index) => ({
      id: `${section.id}-shelf-${index}`,
      sectionId: section.id,
      sectionName: section.name,
      zoneId: section.zoneId,
      zoneName: section.zoneName,
      warehouseId: section.warehouseId,
      warehouseName: section.warehouseName,
      name: `Полиця ${index + 1}`,
      code: `${section.code}-P${index + 1}`,
      qrCode: `inventory-shelf:${index}`,
      isActive: true,
      partCount: index,
    })),
  )
  await page.route('**/api/v1/warehouses/warehouse-1', (route) =>
    fulfillData(route, {
      id: 'warehouse-1',
      name: 'Основний склад',
      code: 'main',
      qrCode: 'inventory-warehouse:1',
      isActive: true,
      isSystemDefault: true,
      unassignedPartCount: 0,
      zones: [
        {
          id: 'zone-1',
          name: 'Зона А',
          code: 'A',
          isActive: true,
          isSystemUnassigned: false,
        },
      ],
    }),
  )
  await page.route('**/api/v1/inventory/zones/zone-1', (route) =>
    fulfillData(route, {
      id: 'zone-1',
      warehouseId: 'warehouse-1',
      warehouseName: 'Основний склад',
      name: 'Зона А',
      code: 'A',
      qrCode: 'inventory-zone:1',
      isActive: true,
      isSystemUnassigned: false,
    }),
  )
  await page.route('**/api/v1/inventory/sections*', (route) =>
    fulfillData(route, sections),
  )
  await page.route('**/api/v1/inventory/sections/*', (route) =>
    fulfillData(
      route,
      sections.find(
        (item) => item.id === route.request().url().split('/').at(-1),
      ),
    ),
  )
  await page.route('**/api/v1/inventory/shelves*', (route) => {
    const params = new URL(route.request().url()).searchParams
    return fulfillData(
      route,
      shelves.filter((item) => item.sectionId === params.get('sectionId')),
    )
  })
  await page.route('**/api/v1/inventory/shelves/*', (route) =>
    fulfillData(
      route,
      shelves.find(
        (item) => item.id === route.request().url().split('/').at(-1),
      ),
    ),
  )
  await page.route('**/api/v1/parts/search/facets', (route) =>
    fulfillData(route, {
      statuses: [{ id: 'available', name: 'available', count: 50 }],
      warehouses: [{ id: 'warehouse-1', name: 'Основний склад', count: 50 }],
      zones: [{ id: 'zone-1', name: 'Зона А', count: 50 }],
      conditions: [],
      equipmentTypes: [],
      makes: [],
      models: [],
      generations: [],
      origins: [],
      qualityFlags: [],
      inventoryLocks: [],
      discrepancies: [],
    }),
  )
  const contentRequests: Record<string, unknown>[] = []
  const contentsParts = Array.from({ length: 50 }, (_, index) => ({
    id: `contents-part-${index + 1}`,
    name:
      index === 0
        ? 'Тестова фара'
        : `Запчастина ${index + 1} — корпус фари з кріпленнями та довгою назвою для перевірки перенесення`,
    quantity: 1 + (index % 5),
    quantityTotal: 1 + (index % 5),
    quantityAvailable: 1 + (index % 5),
    quantityReserved: 0,
    status: index % 3 === 0 ? 'reserved' : 'available',
    thumbnailUrl: null,
    car: { make: 'Tesla', model: 'Y', year: 2023 },
  }))
  await page.route('**/api/v1/parts/search', (route) => {
    const request = route.request().postDataJSON() as Record<string, unknown>
    contentRequests.push(request)
    const partPage = Number(request.page ?? 1)
    const partPageSize = Number(request.pageSize ?? 30)
    return fulfillData(route, {
      items: contentsParts.slice(
        (partPage - 1) * partPageSize,
        partPage * partPageSize,
      ),
      page: partPage,
      pageSize: partPageSize,
      total: contentsParts.length,
      totalPages: Math.ceil(contentsParts.length / partPageSize),
    })
  })
  await page.route('**/api/v1/warehouses', (route) =>
    fulfillData(route, [
      {
        id: 'warehouse-1',
        name: 'Основний склад',
        code: 'main',
        isActive: true,
      },
    ]),
  )
  await page.route('**/api/v1/inventory/zones?*', (route) =>
    fulfillData(route, [
      {
        id: 'zone-1',
        warehouseId: 'warehouse-1',
        name: 'Зона А',
        code: 'A',
        isActive: true,
      },
    ]),
  )
  await loginFrom(page)
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/app/koval/warehouses/warehouse-1')
    await page.getByRole('link', { name: 'Зона А', exact: true }).click()
    await expect(
      page.getByRole('link', { name: 'Секція 1, S1', exact: true }),
    ).toBeVisible()
    const sectionPager = page.getByRole('navigation', {
      name: 'Сторінки секцій',
    })
    await sectionPager.getByRole('button', { name: /Наступна/ }).click()
    await expect(
      page.getByRole('link', { name: 'Секція 16, S16', exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('link', { name: 'Секція 16, S16', exact: true }),
    ).toBeVisible()
    const sectionSearch = page.getByRole('searchbox', { name: 'Пошук секції' })
    await sectionSearch.pressSequentially('Секція ')
    await expect(sectionSearch).toHaveValue('Секція ')
    await sectionSearch.fill('S7')
    await page.getByRole('link', { name: 'Секція 7, S7', exact: true }).click()
    await expect(page).toHaveURL(/warehouses\/sections\/section-6$/)
    const table = page.getByRole('table', { name: 'Полиці: Секція 7' })
    await expect(table.getByRole('row')).toHaveCount(16)
    await page
      .getByRole('navigation', { name: 'Сторінки полиць' })
      .getByRole('button', { name: /Наступна/ })
      .click()
    await expect(page.getByText('S7-P16', { exact: true })).toBeVisible()
    const shelfSearch = page.getByRole('searchbox', { name: 'Пошук полиці' })
    await shelfSearch.pressSequentially('Полиця ')
    await expect(shelfSearch).toHaveValue('Полиця ')
    await shelfSearch.fill('S7-P100')
    await page
      .getByRole('link', {
        name: 'Переглянути запчастини: Полиця 100',
        exact: true,
      })
      .click()
    await expect(page).toHaveURL(
      /\/parts\?warehouse=warehouse-1&zone=zone-1&section=section-6&shelf=section-6-shelf-99$/,
    )
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(
      page.getByRole('table', { name: 'Деталі на складі' }).getByRole('row'),
    ).toHaveCount(31)
    // Shared location pickers live in the "Склад" filter popover.
    await page.getByRole('button', { name: /^Склад:/ }).click()
    await expect(
      page.getByRole('button', { name: 'Склад', exact: true }),
    ).toHaveText('Основний склад')
    await expect(
      page.getByRole('button', { name: 'Зона', exact: true }),
    ).toHaveText('Зона А')
    await expect(
      page.getByRole('button', { name: 'Секція', exact: true }),
    ).toHaveText('Секція 7')
    await expect(
      page.getByRole('button', { name: 'Полиця', exact: true }),
    ).toHaveText('Полиця 100')
    await expect
      .poll(() => contentRequests.at(-1))
      .toMatchObject({
        warehouseIds: ['warehouse-1'],
        zoneIds: ['zone-1'],
        sectionIds: ['section-6'],
        shelfIds: ['section-6-shelf-99'],
        pageSize: 30,
      })
    await page.getByRole('button', { name: /^Склад:/ }).click()
    const pager = page.getByRole('navigation', { name: 'Пагінація деталей' })
    await pager.getByRole('button', { name: 'Наступна сторінка' }).click()
    await expect(
      pager.getByText('Сторінка 2 з 2', { exact: true }),
    ).toBeVisible()
    await expect(
      pager.getByRole('button', { name: 'Наступна сторінка' }),
    ).toBeDisabled()
    await expect(
      page.getByRole('link', { name: /Запчастина 50/ }),
    ).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: /^Склад:/ }).click()
    await expect(
      page.getByRole('button', { name: 'Полиця', exact: true }),
    ).toHaveText('Полиця 100')
    await page.getByRole('button', { name: 'Полиця', exact: true }).click()
    await page.getByRole('option', { name: 'Полиця 99', exact: true }).click()
    await expect(page).toHaveURL(/shelf=section-6-shelf-98/)
    await expect
      .poll(() => contentRequests.at(-1))
      .toMatchObject({
        shelfIds: ['section-6-shelf-98'],
        page: 1,
        pageSize: 30,
      })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    // Direct "without shelf / without section" rows were removed from the
    // location lists (3928f0c); the section's all-parts link stays.
    await page.goto('/app/koval/warehouses/sections/section-6')
    await page
      .getByRole('link', { name: 'Усі запчастини секції', exact: true })
      .click()
    await page.getByRole('button', { name: /^Склад:/ }).click()
    await expect(
      page.getByRole('button', { name: 'Полиця', exact: true }),
    ).toHaveText('Усі полиці')
    await expect
      .poll(() => {
        const request = contentRequests.at(-1)
        return {
          sectionIds: request?.sectionIds,
          hasMissingShelf: Object.hasOwn(request ?? {}, 'missingShelf'),
        }
      })
      .toEqual({ sectionIds: ['section-6'], hasMissingShelf: false })
  }
})

test('inventory hides management actions when manage permission is absent @cabinet-smoke', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { inventoryManage: false })
  await loginFrom(page)
  await page.goto('/app/koval/inventory')

  await expect(
    page.getByRole('heading', { name: 'Інвентаризація' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Нова сесія' })).toHaveCount(0)
})

test('opens More by keyboard, traps focus, and restores it on close @cabinet-smoke', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)

  const more = page.getByRole('button', { name: 'Ще', exact: true })
  const tabKey = ['webkit', 'ios'].includes(testInfo.project.name)
    ? 'Alt+Tab'
    : 'Tab'
  let reachedMore = false
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press(tabKey)
    if (await more.evaluate((node) => node === document.activeElement)) {
      reachedMore = true
      break
    }
  }
  expect(reachedMore).toBe(true)
  await expect(more).toBeFocused()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Меню кабінету' })
  await expect(dialog).toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'Закрити меню' }),
  ).toBeFocused()

  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab')
    expect(
      await dialog.evaluate((node) => node.contains(document.activeElement)),
      `Tab traversal ${index + 1}`,
    ).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(more).toBeFocused()
})

test('direct cabinet URL matches visible navigation state @cabinet-smoke', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  const subscriptionLink = page
    .getByRole('navigation', { name: 'Навігація кабінету' })
    .getByRole('link', { name: 'Підписка' })
  await subscriptionLink.click()
  await expect(page).toHaveURL('/app/koval/settings/billing/overview')
  await expect(page.getByRole('heading', { name: 'Підписка' })).toBeVisible()

  await page.goto('/app/koval/settings/billing/overview')
  await expect(page.getByRole('heading', { name: 'Підписка' })).toBeVisible()
  await expect(subscriptionLink).toHaveAttribute('aria-current', 'page')
})

test('canonical tenant roots reach the private SPA and redirect to the dashboard @cabinet-smoke', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await loginFrom(page)

  for (const path of ['/app/koval', '/app/koval/']) {
    const response = await page.goto(path)

    expect(response?.status(), path).toBe(200)
    expect(response?.headers()['x-robots-tag'], path).toBe('noindex')
    await expect(page, path).toHaveURL('/app/koval/dashboard')
    await expect(
      page
        .getByLabel('Розбірка і розділ')
        .filter({ hasText: 'Розбірка Коваль' }),
    ).toBeVisible()
  }
})

test('opens permitted modules despite legacy rollout switches', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { cabinetParityRolledOut: false })
  await loginFrom(page)
  await page.goto('/app/koval/team')
  await expect(
    page.getByRole('heading', { name: 'Команда', exact: true }),
  ).toBeVisible()
})

test('denies a released module without its tenant permission', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  await selectVisibleTenant(page, 'tenant-2')
  await page.goto('/app/sobol/settings/billing/overview')
  await expect(
    page.getByRole('heading', { name: 'Недостатньо прав' }),
  ).toBeVisible()
})

test('rejects an unknown tenant before loading tenant access', async ({
  page,
}) => {
  const fixture = await installCabinetApiBoundary(page)
  await loginFrom(page)
  const before = fixture.requests.length
  await page.goto('/app/unknown/dashboard')
  const unavailable = page.getByRole('alert')
  await expect(
    unavailable.getByText('Розбірку не знайдено', { exact: true }),
  ).toBeVisible()
  await expect(
    unavailable.getByRole('link', { name: 'До активної розбірки' }),
  ).toHaveAttribute('href', '/app/koval/dashboard')
  expect(fixture.requests.slice(before)).not.toContainEqual(
    expect.objectContaining({ path: '/api/v1/me/permissions' }),
  )
})

test('rejects an inactive tenant before loading tenant access', async ({
  page,
}) => {
  const fixture = await installCabinetApiBoundary(page)
  await loginFrom(page)
  const before = fixture.requests.length
  await page.goto('/app/archive/dashboard')
  const unavailable = page.getByRole('alert')
  await expect(
    unavailable.getByText('Розбірка неактивна', { exact: true }),
  ).toBeVisible()
  await expect(
    unavailable.getByRole('link', { name: 'До активної розбірки' }),
  ).toHaveAttribute('href', '/app/koval/dashboard')
  expect(fixture.requests.slice(before)).not.toContainEqual(
    expect.objectContaining({ path: '/api/v1/me/permissions' }),
  )
})

test('renders an unknown cabinet route inside the branded shell', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  const response = await page.goto('/app/koval/not-a-page')

  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', { name: 'Сторінку не знайдено' }),
  ).toBeVisible()
  await expect(
    page.getByRole('navigation', { name: 'Навігація кабінету' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'На головну', exact: true }),
  ).toHaveAttribute('href', '/app/koval/dashboard')
})

test('cabinet meets automated WCAG 2.2 AA checks', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  await expectPopulatedDashboard(page)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

for (const width of [320, 768, 1024, 1440]) {
  test(`released access screens avoid horizontal overflow at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await installCabinetApiBoundary(page)
    await loginFrom(page)

    for (const path of releasedAccessPaths) {
      await expectReleasedScreenSettled(page, path)
      await page.evaluate(() => document.fonts.ready)
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }))
      expect(dimensions.content, `${path} at ${width}px`).toBeLessThanOrEqual(
        dimensions.viewport,
      )
    }
  })
}

for (const path of releasedAccessPaths) {
  test(`released access screen ${path} meets automated WCAG 2.2 AA checks`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await installCabinetApiBoundary(page)
    await loginFrom(page)
    await expectReleasedScreenSettled(page, path)
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}

test('released Team dialogs and Reports actions keep 44px targets', async ({
  page,
}, testInfo) => {
  // v2 (OPEN-QUESTIONS ?3): 44px targets apply to coarse pointers.
  test.skip(!testInfo.project.use.hasTouch, 'touch target applies to touch')
  await page.setViewportSize({ width: 320, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)

  await expectReleasedScreenSettled(page, '/app/koval/team')
  await page
    .getByRole('button', { name: 'Дії з учасником Іван Менеджер' })
    .click()
  await page.getByRole('menuitem', { name: 'Права' }).click()
  const permissions = page.getByRole('dialog', {
    name: 'Права: Іван Менеджер',
  })
  await expect(permissions).toBeVisible()
  const permissionLabels = permissions.locator(
    'label:has(input[type="checkbox"])',
  )
  const permissionBoxes = await permissionLabels.evaluateAll((labels) =>
    labels.map((label) => {
      const rect = label.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }),
  )
  expect(permissionBoxes.length).toBeGreaterThan(0)
  expect(
    permissionBoxes.every(
      ({ width, height }) =>
        Math.round(width) >= 44 && Math.round(height) >= 44,
    ),
  ).toBe(true)
  // Roles are assigned inline; the permissions sheet is the Team dialog.
  const roleActions = permissions.getByRole('button')
  for (let index = 0; index < (await roleActions.count()); index += 1) {
    const action = roleActions.nth(index)
    // Sheet's close icon is visually 34px, with a pseudo-element extending
    // its pointer target to 44px. Bounding boxes omit that interactive area.
    const has44pxTarget = await action.evaluate((button) => {
      const rect = button.getBoundingClientRect()
      const centerX = rect.x + rect.width / 2
      const centerY = rect.y + rect.height / 2
      return [-21.5, 0, 21.5].every((dx) =>
        [-21.5, 0, 21.5].every((dy) => {
          const hit = document.elementFromPoint(centerX + dx, centerY + dy)
          return hit !== null && button.contains(hit)
        }),
      )
    })
    expect(
      has44pxTarget,
      (await action.getAttribute('aria-label')) ?? (await action.innerText()),
    ).toBe(true)
  }
  const closeBox = await permissions
    .getByRole('button', { name: 'Закрити', exact: true })
    .boundingBox()
  expect(closeBox).not.toBeNull()
  // Click inside the extended target, outside the visible 34px square.
  await page.mouse.click(closeBox!.x - 4, closeBox!.y + closeBox!.height / 2)
  await expect(permissions).not.toBeVisible()

  await expectReleasedScreenSettled(page, '/app/koval/reports')
  const reportActions = page
    .getByRole('button', { name: 'Завантажити PDF' })
    .or(page.getByRole('button', { name: 'Друкувати' }))
  for (let index = 0; index < (await reportActions.count()); index += 1) {
    const action = reportActions.nth(index)
    const box = await action.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44)
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44)
  }
})

test('visible mobile cabinet controls meet the 44px target minimum', async ({
  page,
}, testInfo) => {
  // v2 (OPEN-QUESTIONS ?3): 44px targets apply to coarse pointers.
  test.skip(!testInfo.project.use.hasTouch, 'touch target applies to touch')
  await page.setViewportSize({ width: 320, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  await page.getByRole('button', { name: 'Ще', exact: true }).click()

  const controls = page
    .getByRole('navigation', { name: 'Мобільна навігація' })
    .getByRole('button')
    .or(
      page
        .getByRole('navigation', { name: 'Мобільна навігація' })
        .getByRole('link'),
    )
    .or(page.getByRole('dialog').getByRole('button'))
    .or(page.getByRole('dialog').getByRole('link'))
    .or(page.getByRole('dialog').getByRole('combobox'))
  const boxes = await controls.evaluateAll((elements) =>
    elements
      .filter((element) => {
        const style = getComputedStyle(element)
        return style.visibility !== 'hidden' && style.display !== 'none'
      })
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
  )
  expect(boxes.length).toBeGreaterThan(0)
  expect(
    boxes.every(
      ({ width, height }) =>
        Math.round(width) >= 44 && Math.round(height) >= 44,
    ),
  ).toBe(true)
})

for (const width of [320, 768]) {
  test(`over-quota upgrade keeps a 44px computed target at ${width}px`, async ({
    page,
  }, testInfo) => {
    // v2 (OPEN-QUESTIONS ?3): 44px targets apply to coarse pointers.
    test.skip(!testInfo.project.use.hasTouch, 'touch target applies to touch')
    await page.setViewportSize({ width, height: 900 })
    await installCabinetApiBoundary(page, { overQuota: true })
    await loginFrom(page)
    await page.goto('/app/koval/settings/billing/overview')

    const upgrade = page.getByRole('button', { name: 'Підвищити тариф' })
    await expect(upgrade).toBeVisible()
    const box = await upgrade.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.width)).toBeGreaterThanOrEqual(44)
    expect(Math.round(box!.height)).toBeGreaterThanOrEqual(44)
  })

  test(`pending payment wraps without overflow and keeps 44px actions at ${width}px`, async ({
    page,
  }, testInfo) => {
    // v2 (OPEN-QUESTIONS ?3): 44px targets apply to coarse pointers.
    test.skip(!testInfo.project.use.hasTouch, 'touch target applies to touch')
    await page.setViewportSize({ width, height: 900 })
    await installCabinetApiBoundary(page, { pendingPayment: true })
    await loginFrom(page)
    await page.goto('/app/koval/settings/billing/payments')

    const checkout = page.getByRole('link', { name: 'Продовжити оплату' })
    const cancel = page.getByRole('button', { name: 'Скасувати' })
    await expect(checkout).toBeVisible()
    await expect(cancel).toBeVisible()
    await expect(checkout).toHaveAttribute(
      'href',
      'https://pay.example/secure-checkout',
    )
    await expect(checkout).toHaveAttribute('target', '_blank')
    await expect(checkout).toHaveAttribute('rel', 'noopener noreferrer')

    const actionBoxes = await checkout.or(cancel).evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return { width: rect.width, height: rect.height }
      }),
    )
    expect(actionBoxes).toHaveLength(2)
    expect(
      actionBoxes.every(({ width: boxWidth, height }) =>
        Boolean(boxWidth >= 44 && height >= 44),
      ),
    ).toBe(true)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

test('billing mutation failures stay truthful and handled in Chromium', async ({
  page,
}) => {
  const pageErrors: Error[] = []
  page.on('pageerror', (error) => pageErrors.push(error))
  const fixture = await installCabinetApiBoundary(page, {
    pendingPayment: true,
    subscribeFailureStatus: 403,
    cancelSubscriptionFailureStatus: 409,
    cancelPaymentFailureStatus: 409,
  })
  await loginFrom(page)

  await page.goto('/app/koval/settings/billing/plans')
  await page.getByRole('button', { name: 'Обрати' }).click()
  const checkoutAlert = page.getByRole('alert')
  await expect(checkoutAlert).toContainText(
    'У вас більше немає права змінювати підписку.',
  )
  await expect(checkoutAlert).not.toContainText('Raw fixture billing denial')

  await page.goto('/app/koval/settings/billing/payments')
  await page.getByRole('button', { name: 'Скасувати' }).click()
  const paymentAlert = page.getByRole('alert')
  await expect(paymentAlert).toContainText(
    'Статус платежу вже змінився. Оновіть список платежів.',
  )
  await expect(paymentAlert).not.toContainText('Raw fixture payment conflict')

  await page.goto('/app/koval/settings/billing/overview')
  // Cancelling now confirms through the shared dialog, not a native prompt.
  await page
    .getByRole('button', { name: 'Скасувати підписку', exact: true })
    .click()
  await page.getByRole('button', { name: 'Так, скасувати підписку' }).click()
  const subscriptionAlert = page.getByRole('alert')
  await expect(subscriptionAlert).toContainText(
    'Підписка вже змінилася. Оновіть сторінку та спробуйте ще раз.',
  )
  await expect(subscriptionAlert).not.toContainText(
    'Raw fixture subscription conflict',
  )
  expect(
    fixture.requests.filter(({ path }) =>
      [
        '/api/v1/billing/subscribe',
        '/api/v1/billing/payments/payment-1/cancel',
        '/api/v1/billing/cancel',
      ].includes(path),
    ),
  ).toEqual([
    {
      method: 'POST',
      path: '/api/v1/billing/subscribe',
      tenantId: 'tenant-1',
    },
    {
      method: 'POST',
      path: '/api/v1/billing/payments/payment-1/cancel',
      tenantId: 'tenant-1',
    },
    {
      method: 'POST',
      path: '/api/v1/billing/cancel',
      tenantId: 'tenant-1',
    },
  ])
  expect(pageErrors).toEqual([])
})

test('logs out normally from the cabinet shell @cabinet-smoke', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await installCabinetApiBoundary(page)
  await loginFrom(page)
  await armDelayedLogout(request)
  let delayReleased = false
  try {
    let logoutSettled = false
    const logoutResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/session/logout',
    )
    void logoutResponse.then(() => {
      logoutSettled = true
    })
    await page
      .locator('#cabinet-navigation')
      .getByRole('button', { name: 'Олена Коваль' })
      .click()
    await page.getByRole('menuitem', { name: 'Вийти' }).click()

    await expect(page).toHaveURL('/')
    await expect
      .poll(async () => (await upstreamStats(request)).logoutRequests)
      .toBe(1)
    expect(logoutSettled).toBe(false)
    await releaseDelayedLogout(request)
    delayReleased = true
    await logoutResponse
    expect((await upstreamStats(request)).logoutRequests).toBe(1)
    await page.goto('/app/koval/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  } finally {
    if (!delayReleased) await releaseDelayedLogout(request)
  }
})

test('requires a source before creating a part', async ({ page }) => {
  await installCabinetApiBoundary(page, { partsManage: true })
  await page.route('**/api/v1/cars?*', (route) =>
    fulfillData(route, {
      items: [
        {
          id: 'car-1',
          code: 'CAR-01',
          brand: 'Ford',
          model: 'Focus',
          year: 2018,
          status: 'active',
        },
      ],
      page: 1,
      pageSize: 100,
      total: 1,
    }),
  )
  await page.route('**/api/v1/equipment-types*', (route) =>
    fulfillData(route, []),
  )
  await loginFrom(page)
  await page.goto('/app/koval/parts/new')
  const drawer = page.getByRole('region', { name: 'Нова деталь', exact: true })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByRole('button', { name: /Вільна/ })).toHaveCount(0)
  await drawer.getByLabel('Назва', { exact: true }).fill('Фара')
  await drawer.getByRole('button', { name: 'Створити деталь' }).click()
  await expect(drawer.getByRole('alert')).toContainText('Деталь не створено')
  const source = drawer.getByLabel('Автомобіль-джерело', { exact: true })
  await expect(source).toBeVisible()
  await source.click()
  await page.getByRole('option', { name: /Ford Focus/ }).click()
  await expect(source).toContainText('Ford Focus')
  await source.focus()
  await expect(source).toBeFocused()
  await page.setViewportSize({ width: 375, height: 812 })
  await expect(source).toBeVisible()
  await expect(
    drawer.getByRole('button', { name: 'Створити деталь' }),
  ).toBeVisible()
})

test('clears a stale command result while the next browser search is pending @hardening', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { partsManage: true })
  await page.route('**/api/v1/parts/search', async (route) => {
    const body = route.request().postDataJSON() as { query?: string }
    const query = body.query ?? ''
    if (query.includes('нова')) return
    await fulfillData(route, {
      items: [
        {
          id: 'part-7',
          name: 'Фара ліва',
          oemCode: 'OEM-1',
          car: null,
        },
      ],
      page: 1,
      pageSize: 5,
      total: 1,
      totalPages: 1,
    })
  })
  await loginFrom(page)

  await page.keyboard.press('Control+K')
  const search = page.getByRole('combobox', { name: 'Пошук по кабінету' })
  await search.fill('фара')
  await expect(page.getByRole('option', { name: /Фара ліва/ })).toBeVisible()

  await search.fill('фара нова')
  await expect(page.getByRole('option', { name: /Фара ліва/ })).toHaveCount(0)
  await expect(page.getByText('Шукаємо…')).toBeVisible()
})

test('shows settlement loading before a delayed catalogue response @hardening', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  await page.route('**/api/v1/integrations/integration-1**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/dispatch-points')) return fulfillData(route, [])
    if (path.endsWith('/shipping/senders')) return fulfillData(route, [])
    if (path.endsWith('/shipping/settlements')) return
    if (path === '/api/v1/integrations/integration-1')
      return fulfillData(route, {
        id: 'integration-1',
        definitionId: 'definition-np',
        code: 'nova_poshta',
        displayName: 'Нова пошта',
        status: 'active',
        configured: true,
        verifiedAt: '2026-09-21T09:31:00Z',
        lastErrorCode: null,
        settings: { configured: true, activeDispatchPoints: 0 },
      })
    await route.fallback()
  })
  await loginFrom(page)
  await page.goto(
    '/app/koval/settings/integrations/integration-1/dispatch-points',
  )
  await page.getByRole('button', { name: 'Додати точку' }).first().click()
  const settlement = page.getByLabel(/Населений пункт/)
  await settlement.fill('Жито')

  await expect(page.getByText('Шукаємо…')).toBeVisible()
  await expect(page.getByText('без збігів')).toHaveCount(0)
  await expect(
    page.getByText(/немає населеного пункту з такою назвою/),
  ).toHaveCount(0)
})

test('reuses the browser payment key after a network failure and reports one error @hardening', async ({
  page,
}) => {
  const delivery = {
    orderId: 'order-1',
    agreedTotalUah: 4600,
    appliedUah: 3400,
    outstandingUah: 1200,
    netReceivedUah: 3400,
    feesUah: 0,
    requiredDepositUah: 360,
    depositShortfallUah: 0,
    depositSatisfied: true,
    depositWaived: false,
    depositRequired: true,
    customerTrusted: false,
    dispatchedAt: null,
    receivedAt: null,
    returnedAt: null,
    awaitingCodReconciliation: false,
    payments: [],
  }
  const paymentKeys: string[] = []
  let paymentAttempts = 0
  await installCabinetApiBoundary(page, { businessOperations: true })
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/orders/order-1' && request.method() === 'GET')
      return fulfillData(route, {
        id: 'order-1',
        number: 1,
        status: 'pending',
        // Core omits these fields for an order without a customer.
        notes: null,
        items: [],
        payments: [],
        history: [],
        totalAmount: 4600,
        totalPaid: 3400,
        paymentCurrency: 'UAH',
        createdAt: '2026-09-21T10:00:00Z',
        createdByName: 'Олена',
      })
    if (
      path === '/api/v1/orders/order-1/delivery' &&
      request.method() === 'GET'
    )
      return fulfillData(route, delivery)
    if (path === '/api/v1/integrations' && request.method() === 'GET')
      return fulfillData(route, [])
    if (path === '/api/v1/cash' && request.method() === 'GET')
      return fulfillData(route, [
        {
          id: 'cash-1',
          name: 'Сейф',
          type: 'safe',
          isActive: true,
          balances: { UAH: 5000 },
        },
      ])
    if (
      path === '/api/v1/orders/order-1/delivery/payments' &&
      request.method() === 'POST'
    ) {
      paymentAttempts += 1
      paymentKeys.push(request.headers()['idempotency-key'] ?? '')
      if (paymentAttempts === 1) return route.abort('failed')
      return fulfillData(route, delivery)
    }
    await route.fallback()
  })
  await loginFrom(page)
  await page.goto('/app/koval/orders/order-1')
  await expect(page.getByText('Клієнта не вказано')).toBeVisible()
  const pay = page.getByRole('button', { name: 'Внести оплату' }).first()
  await pay.click()
  const drawer = page.getByRole('dialog', { name: 'Додати платіж' })
  await drawer.getByLabel('Сума', { exact: true }).fill('1200')
  await drawer.getByRole('button', { name: 'Записати оплату' }).click()
  await expect(drawer.getByRole('alert')).toHaveCount(1)

  await drawer.getByRole('button', { name: 'Записати оплату' }).click()
  await expect(drawer).toHaveCount(0)
  await pay.click()
  await drawer.getByLabel('Сума', { exact: true }).fill('1200')
  await drawer.getByRole('button', { name: 'Записати оплату' }).click()

  await expect.poll(() => paymentKeys.length).toBe(3)
  expect(paymentKeys[0]).toBe(paymentKeys[1])
  expect(paymentKeys[2]).not.toBe(paymentKeys[1])
})

test('keeps a pending confirmation open after Escape in the browser @hardening', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  let release: () => void = () => undefined
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/api/v1/billing/cancel', async (route) => {
    await pending
    await fulfillData(route, { code: 'CONFLICT' }, 409)
  })
  await loginFrom(page)
  await page.goto('/app/koval/settings/billing/overview')
  await page
    .getByRole('button', { name: 'Скасувати підписку', exact: true })
    .click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Так, скасувати підписку' }).click()
  await expect(
    dialog.getByRole('button', { name: 'Так, скасувати підписку' }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  release()
})

test('contains a long inventory QR at mobile width in the browser @hardening', async ({
  page,
}) => {
  const qrCode =
    '3870f3f5ecb1dbab378027dd9299c57988085d4d7b80054a7a8156cf523e87db'
  await page.setViewportSize({ width: 320, height: 900 })
  await installCabinetApiBoundary(page, { partsManage: true })
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/v1/parts/part-long')
      return fulfillData(route, {
        id: 'part-long',
        name: 'Крило',
        qrCode,
        unit: 'шт',
        quantityTotal: 2,
      })
    if (path === '/api/v1/parts/part-long/inventory-zones')
      return fulfillData(route, [])
    if (path === '/api/v1/inventory/zones') return fulfillData(route, [])
    await route.fallback()
  })
  await loginFrom(page)
  await page.goto('/app/koval/parts/part-long/inventory')
  await expect(page.getByText('Розміщення на складі')).toBeVisible()

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

test('creates and places a zone from an empty warehouse without QR scanning @hardening', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  let zones: Record<string, unknown>[] = []
  let placement: string[] = []
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/inventory/zones') {
      if (request.method() === 'POST') {
        const input = request.postDataJSON() as {
          warehouseId: string
          name: string
          code: string
        }
        zones = [
          {
            id: 'zone-new',
            tenantId: 'tenant-1',
            warehouseId: input.warehouseId,
            warehouseName: 'Основний склад',
            name: input.name,
            code: input.code,
            qrCode: 'ZONE-NEW',
            isActive: true,
            isSystemUnassigned: false,
            createdAt: '2026-10-14T10:00:00Z',
            updatedAt: '2026-10-14T10:00:00Z',
          },
        ]
        return fulfillData(route, zones[0], 201)
      }
      return fulfillData(route, zones)
    }
    if (path === '/api/v1/parts/part-empty/inventory-zones') {
      if (request.method() === 'PUT') {
        placement = (request.postDataJSON() as { zoneIds: string[] }).zoneIds
        return fulfillData(route, [])
      }
      return fulfillData(
        route,
        placement.map((zoneId) => ({
          zoneId,
          warehouseId: 'warehouse-1',
          warehouseName: 'Основний склад',
          zoneName: 'Стелаж A1',
          zoneCode: 'A1',
          zoneQrCode: 'ZONE-NEW',
          isSystemUnassigned: false,
        })),
      )
    }
    await route.fallback()
  })
  await loginFrom(page)
  await page.goto('/app/koval/parts/part-empty/inventory')

  await expect(
    page.getByRole('radio', { name: /Основний склад/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Сканувати зону' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Додати зону' }).click()
  const dialog = page.getByRole('dialog', { name: 'Нова зона' })
  await dialog.getByRole('textbox', { name: 'Назва' }).fill('Стелаж A1')
  await dialog.getByRole('textbox', { name: 'Код' }).fill('A1')
  await dialog.getByRole('button', { name: 'Додати зону' }).click()
  await expect(
    page.getByRole('radio', { name: 'Основний склад · Стелаж A1' }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Зберегти розміщення' }).click()
  await expect.poll(() => placement).toEqual(['zone-new'])
  await expect(page.getByText('Розміщення збережено')).toBeVisible()
})

test('creates a warehouse before a zone when placement has no warehouses @hardening', async ({
  page,
}) => {
  await installCabinetApiBoundary(page)
  let warehouse: Record<string, unknown> | null = null
  let zone: Record<string, unknown> | null = null
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/v1/warehouses') {
      if (request.method() === 'POST') {
        const input = request.postDataJSON() as { name: string; code: string }
        warehouse = {
          id: 'warehouse-new',
          tenantId: 'tenant-1',
          name: input.name,
          code: input.code,
          isActive: true,
          isSystemDefault: true,
          zoneCount: 0,
          createdAt: '2026-10-14T10:00:00Z',
          updatedAt: '2026-10-14T10:00:00Z',
        }
        return fulfillData(route, warehouse, 201)
      }
      return fulfillData(route, warehouse ? [warehouse] : [])
    }
    if (path === '/api/v1/inventory/zones') {
      if (request.method() === 'POST') {
        const input = request.postDataJSON() as {
          name: string
          code: string
          warehouseId: string
        }
        zone = {
          id: 'zone-new',
          tenantId: 'tenant-1',
          warehouseId: input.warehouseId,
          warehouseName: 'Новий склад',
          name: input.name,
          code: input.code,
          qrCode: 'ZONE-NEW',
          isActive: true,
          isSystemUnassigned: false,
          createdAt: '2026-10-14T10:00:00Z',
          updatedAt: '2026-10-14T10:00:00Z',
        }
        return fulfillData(route, zone, 201)
      }
      return fulfillData(route, zone ? [zone] : [])
    }
    if (path === '/api/v1/parts/part-no-house/inventory-zones')
      return fulfillData(route, [])
    await route.fallback()
  })
  await loginFrom(page)
  await page.goto('/app/koval/parts/part-no-house/inventory')

  await page.getByRole('button', { name: 'Додати склад' }).click()
  const warehouseDialog = page.getByRole('dialog', { name: 'Новий склад' })
  await warehouseDialog
    .getByRole('textbox', { name: 'Назва' })
    .fill('Новий склад')
  await warehouseDialog.getByRole('textbox', { name: 'Код' }).fill('NEW')
  await warehouseDialog.getByRole('button', { name: 'Додати склад' }).click()

  const zoneDialog = page.getByRole('dialog', { name: 'Нова зона' })
  await zoneDialog.getByRole('textbox', { name: 'Назва' }).fill('Полиця A1')
  await zoneDialog.getByRole('textbox', { name: 'Код' }).fill('A1')
  await zoneDialog.getByRole('button', { name: 'Додати зону' }).click()
  await expect(
    page.getByRole('radio', { name: 'Новий склад · Полиця A1' }),
  ).toBeChecked()
})

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 375, height: 812 },
]) {
  test(`car photos stay bounded and edits save the selected cover at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await installCabinetApiBoundary(page, { businessOperations: true })
    const portrait =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="1000"><rect width="400" height="1000" fill="#367ca1"/></svg>',
      )
    const photos = Array.from({ length: 10 }, (_, index) => ({
      id: `photo-${index}`,
      storageKey: `cars/photo-${index}`,
      url: index === 9 ? '/missing-car-photo.jpg' : portrait,
      thumbnailUrl: portrait,
      sortOrder: index,
    }))
    let car = {
      id: 'car-1',
      code: 'CAR-001',
      brand: 'BMW',
      model: 'X5',
      year: 2020,
      color: null,
      vin: null,
      notes: null,
      status: 'active',
      acquiredAt: '2026-08-01',
      createdAt: '2026-08-01T12:00:00Z',
      purchasePrice: 1000,
      photos,
      expenses: [],
      profitability: null,
    }
    const writes: { photoKeys?: string[] }[] = []
    await page.route('**/api/v1/cars**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as { photoKeys?: string[] }
        writes.push(body)
        car = {
          ...car,
          photos: (body.photoKeys ?? []).map((key, index) => ({
            ...photos.find((photo) => photo.storageKey === key)!,
            sortOrder: index,
          })),
        }
        await fulfillData(route, car)
      } else if (path.endsWith('/parts')) {
        await fulfillData(route, {
          items: [],
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
        })
      } else if (path.endsWith('/car-1')) {
        await fulfillData(route, car)
      } else {
        await fulfillData(route, {
          items: [
            {
              ...car,
              coverPhotoUrl: portrait,
              partsCount: 0,
              soldPartsCount: 0,
            },
          ],
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        })
      }
    })
    await page.route('**/missing-car-photo.jpg', (route) =>
      route.fulfill({ status: 404, body: '' }),
    )
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await loginFrom(page)
    await page.goto('/app/koval/cars')
    // v2: the list is a table without covers; photos live on the record.
    const card = page
      .getByRole('table')
      .getByRole('link', { name: /BMW X5/ })
      .first()
    await expect(card).toBeVisible()
    await card.click()
    const opener = page.getByRole('button', { name: /відкрити на весь екран/ })
    await opener.click()
    const dialog = page.getByRole('dialog')
    const full = await dialog.locator('img').first().boundingBox()
    expect(full!.y).toBeGreaterThanOrEqual(0)
    expect(full!.y + full!.height).toBeLessThanOrEqual(viewport.height)
    const strip = dialog.getByRole('tablist', { name: 'Мініатюри' })
    const firstReachable = await strip.evaluate(
      (element) =>
        element.firstElementChild!.getBoundingClientRect().left >=
        element.getBoundingClientRect().left,
    )
    expect(firstReachable).toBe(true)
    await dialog.getByRole('tab', { name: /^Фото 10 з 10:/ }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'Не вдалося завантажити фото',
    )
    await page.keyboard.press('Escape')
    await expect(opener).toBeFocused()
    await page.goto('/app/koval/cars/car-1/edit')
    await expect(page.getByLabel('Додати фото')).toBeEnabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page
      .getByRole('button', { name: 'Зробити обкладинкою фото 2', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'Прибрати фото 2', exact: true })
      .click()
    expect(writes).toHaveLength(0)
    await page
      .getByRole('button', { name: 'Зберегти зміни', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL('/app/koval/cars/car-1')
    expect(writes).toHaveLength(1)
    expect(writes[0].photoKeys).toEqual([
      'cars/photo-1',
      ...photos.slice(2).map((photo) => photo.storageKey),
    ])
    expect(errors).toEqual([])
  })
}

test.describe('placement picker viewport regression', () => {
  test.beforeEach(async ({ context }, testInfo) => {
    if (testInfo.project.name === 'ios')
      await context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true,
      })
  })
  test.afterEach(async ({ context }, testInfo) => {
    if (testInfo.project.name === 'ios') {
      const path = testInfo.outputPath('placement-trace.zip')
      await context.tracing.stop({ path })
      await testInfo.attach('trace', { path, contentType: 'application/zip' })
    }
  })

  for (const width of [1440, 390, 320]) {
    test(`placement drawer searches large section and shelf choices without moving the page at ${width}px @placement-picker`, async ({
      page,
    }) => {
      await installCabinetApiBoundary(page, { partsManage: true })
      const sectionData = Array.from({ length: 100 }, (_, index) => ({
        id: `section-${index + 1}`,
        zoneId: 'zone-1',
        zoneName: 'Зона А',
        warehouseId: 'warehouse-1',
        warehouseName: 'Основний склад',
        name: `Секція ${index + 1}`,
        code: `S${index + 1}`,
        isActive: true,
        qrCode: `section:${index}`,
      }))
      const shelfData = Array.from({ length: 100 }, (_, index) => ({
        id: `shelf-${index + 1}`,
        sectionId: 'section-100',
        sectionName: 'Секція 100',
        zoneId: 'zone-1',
        zoneName: 'Зона А',
        warehouseId: 'warehouse-1',
        warehouseName: 'Основний склад',
        name: `Полиця ${index + 1}`,
        code: `P${index + 1}`,
        isActive: true,
        qrCode: `shelf:${index}`,
      }))
      let saved: Record<string, unknown> | null = null
      await page.route('**/api/v1/**', async (route) => {
        const request = route.request()
        const path = new URL(request.url()).pathname
        if (path === '/api/v1/parts/part-picker')
          return fulfillData(route, {
            id: 'part-picker',
            name: 'Тестова фара',
            qrCode: 'part:picker',
            unit: 'шт',
            quantityTotal: 1,
            quantityAvailable: 1,
            quantityReserved: 0,
            quantitySold: 0,
            status: 'available',
            condition: 'good',
            photos: [],
            source: 'batch',
            car: null,
            intake: null,
            desiredSalePrice: null,
            createdAt: '2026-10-16T10:00:00Z',
            createdBy: { name: 'Тест' },
          })
        if (path === '/api/v1/parts/part-picker/history')
          return fulfillData(route, { events: [] })
        if (path === '/api/v1/parts/part-picker/inventory-zones') {
          if (request.method() === 'PUT')
            saved = request.postDataJSON() as Record<string, unknown>
          return fulfillData(route, [
            {
              zoneId: 'zone-1',
              zoneName: 'Зона А',
              warehouseId: 'warehouse-1',
              warehouseName: 'Основний склад',
              zoneCode: 'A',
              zoneQrCode: 'zone:1',
              isSystemUnassigned: false,
            },
          ])
        }
        if (path === '/api/v1/inventory/zones')
          return fulfillData(route, [
            {
              id: 'zone-1',
              name: 'Зона А',
              code: 'A',
              warehouseId: 'warehouse-1',
              warehouseName: 'Основний склад',
              qrCode: 'zone:1',
              isActive: true,
              isSystemUnassigned: false,
            },
          ])
        if (path === '/api/v1/inventory/sections')
          return fulfillData(route, sectionData)
        if (path === '/api/v1/inventory/shelves')
          return fulfillData(route, shelfData)
        if (path === '/api/v1/parts/facets')
          return fulfillData(route, {
            zones: [],
            warehouses: [],
            origins: [],
            makes: [],
            models: [],
            statuses: [],
            conditions: [],
          })
        await route.fallback()
      })
      const scenarioStarted = Date.now()
      await loginFrom(page)
      await test.step(`placement choices at ${width}px`, async () => {
        console.info(
          `[placement-picker] ${width}px start ${Date.now() - scenarioStarted}ms`,
        )
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/app/koval/parts/part-picker')
        await page
          .getByRole('button', { name: 'Перемістити', exact: true })
          .click()
        const drawer = page.getByRole('dialog', {
          name: 'Розміщення на складі',
        })
        const sectionTrigger = drawer.getByRole('searchbox', {
          name: 'Пошук секції',
        })
        await expect(sectionTrigger).toBeVisible()
        const pageScroll = await page.evaluate(() => scrollY)
        await expect(page.getByRole('option')).toHaveCount(0)
        await sectionTrigger.click()
        const initialList = page.locator('[data-search-picker-scroll]')
        const initialMetrics = await initialList.evaluate((el) => ({
          height: el.clientHeight,
          scrollHeight: el.scrollHeight,
        }))
        expect(initialMetrics.height).toBeLessThanOrEqual(460)
        expect(initialMetrics.scrollHeight).toBeGreaterThan(
          initialMetrics.height,
        )
        const sectionSearch = page.getByRole('searchbox', {
          name: 'Пошук секції',
        })
        await sectionSearch.fill('s100')
        await expect(page.getByRole('option')).toHaveCount(2)
        await page.getByRole('option', { name: /Секція 100/ }).click()
        await drawer.getByRole('searchbox', { name: 'Пошук полиці' }).click()
        await page.getByRole('searchbox', { name: 'Пошук полиці' }).fill('p100')
        await expect(page.getByRole('option')).toHaveCount(2)
        const popup = page.getByRole('listbox')
        const bounds = await popup.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.width).toBeLessThanOrEqual(width)
        expect(bounds!.height).toBeLessThanOrEqual(460)
        await page.keyboard.press('Escape')
        await expect(drawer).toBeVisible()
        await expect(page.getByRole('listbox')).toHaveCount(0)
        await drawer.getByRole('searchbox', { name: 'Пошук полиці' }).click()
        await page.getByRole('searchbox', { name: 'Пошук полиці' }).fill('p100')
        await page.keyboard.press('Enter')
        await expect(
          drawer.getByRole('searchbox', { name: 'Пошук полиці' }),
        ).toHaveValue('Полиця 100')
        const overflow = await page.evaluate(() => ({
          width: innerWidth,
          scroll: document.documentElement.scrollWidth,
          nodes: [...document.querySelectorAll('body *')]
            .filter((el) => {
              const r = el.getBoundingClientRect()
              return r.width > 0 && r.right > innerWidth + 1
            })
            .slice(-12)
            .map((el) => ({
              tag: el.tagName,
              class: el.className,
              right: el.getBoundingClientRect().right,
              text: el.textContent?.slice(0, 60),
            })),
        }))
        expect(overflow.scroll, JSON.stringify(overflow)).toBeLessThanOrEqual(
          width,
        )
        expect(await page.evaluate(() => scrollY)).toBe(pageScroll)
        await drawer
          .getByRole('button', { name: 'Зберегти розміщення' })
          .click()
        await expect(drawer).toHaveCount(0)
        expect(saved).toEqual({
          zoneIds: ['zone-1'],
          sectionId: 'section-100',
          shelfId: 'shelf-100',
        })
        await expect(page).toHaveURL(/\/parts\/part-picker$/)
        console.info(
          `[placement-picker] ${width}px complete ${Date.now() - scenarioStarted}ms`,
        )
      })
    })
  }
})

for (const width of [375, 1440]) {
  test(`permission save errors remain visible at the drawer footer at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await installCabinetApiBoundary(page)
    await page.route(
      '**/api/v1/team/users/user-2/permissions',
      async (route) => {
        if (route.request().method() !== 'PUT') return route.fallback()
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Cannot change own permissions.',
              details: null,
            },
          }),
        })
      },
    )
    await loginFrom(page)
    await page.goto('/app/koval/team')
    await page
      .getByRole('button', { name: 'Дії з учасником Іван Менеджер' })
      .click()
    await page.getByRole('menuitem', { name: 'Права' }).click()
    const dialog = page.getByRole('dialog', { name: 'Права: Іван Менеджер' })
    await dialog.getByRole('checkbox').last().scrollIntoViewIfNeeded()
    const save = dialog.getByRole('button', { name: 'Зберегти права' })
    await save.click()
    const alert = dialog.getByRole('alert')
    await expect(alert).toHaveText(
      'Ви не можете змінювати власні права. Зверніться до власника розбірки.',
    )
    await expect(
      dialog.locator('.rz-sheet__foot').getByRole('alert'),
    ).toBeVisible()
    const bounds = await alert.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900)
    await expect(save).toBeEnabled()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath('permission-error-footer.png'),
    })
  })
}

test('unassigned quantity and status columns stay compact at the right edge', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await installCabinetApiBoundary(page, { partsManage: true })
  await page.route('**/api/v1/warehouses/warehouse-1', (route) =>
    fulfillData(route, {
      id: 'warehouse-1',
      name: 'Основний склад',
      code: 'main',
      isActive: true,
      isSystemDefault: true,
      unassignedPartCount: 40,
      zones: [
        {
          id: 'system-zone-1',
          name: 'Без зони',
          code: 'unassigned',
          isActive: true,
          isSystemUnassigned: true,
        },
      ],
    }),
  )
  await page.route('**/api/v1/parts/search', (route) =>
    fulfillData(route, {
      items: Array.from({ length: 20 }, (_, index) => ({
        id: `part-${index}`,
        name: `Запчастина ${index + 1}`,
        oemCode: `OEM-${index + 1}`,
        externalCode: null,
        quantity: index === 1 ? 7 : 1,
        quantityAvailable: index === 10 ? 0 : 1,
        quantityReserved: index === 10 ? 1 : 0,
        unit: 'шт',
        condition: 'used',
        sourceType: 'manual',
        status: index === 10 ? 'reserved' : 'available',
        createdAt: '2026-10-26T08:00:00Z',
        isInventoryLocked: false,
        hasDiscrepancy: false,
        thumbnailUrl: null,
        car: null,
      })),
      page: 1,
      pageSize: 20,
      total: 40,
      totalPages: 2,
    }),
  )
  await loginFrom(page)
  await page.goto('/app/koval/warehouses/warehouse-1/unassigned')
  const table = page.locator('.location-parts--unassigned .rz-table')
  await expect(
    table.getByRole('link', { name: 'Запчастина 1', exact: true }),
  ).toBeVisible()
  const row = table.locator('tbody tr').first()
  await expect(row.getByRole('button')).toHaveCount(0)
  const cell = row.locator('td').last()
  const badge = cell.locator('.rz-pill')
  const cellBounds = await cell.boundingBox()
  const badgeBounds = await badge.boundingBox()
  expect(cellBounds).not.toBeNull()
  expect(badgeBounds).not.toBeNull()
  expect(cellBounds!.width).toBeLessThanOrEqual(160)
  expect(
    cellBounds!.x + cellBounds!.width - badgeBounds!.x - badgeBounds!.width,
  ).toBeLessThanOrEqual(20)
  await expect(table.getByRole('columnheader', { name: 'Статус' })).toHaveCSS(
    'text-align',
    'right',
  )
  await page.screenshot({ path: testInfo.outputPath('unassigned-columns.png') })
})

/** Storage-sticker acceptance uses intercepted Core records and a fake popup.
 * It verifies browser UI and emitted label HTML, not a real printer or Core. */
async function installStorageStickerFixture(page: Page, inventoryOnly = false) {
  const fixture = await installCabinetApiBoundary(page, {
    inventoryManage: false,
  })
  const zones = Array.from({ length: 25 }, (_, index) => ({
    id: `storage-zone-${index + 1}`,
    warehouseId: 'warehouse-1',
    warehouseName: 'Основний склад',
    name: `Зона ${String(index + 1).padStart(2, '0')}`,
    code: `Z${String(index + 1).padStart(2, '0')}`,
    qrCode: `fixture-storage-zone:${index + 1}`,
    isActive: true,
    isSystemUnassigned: false,
    partCount: 0,
  }))
  const section = {
    id: 'storage-section-1',
    zoneId: zones[0].id,
    zoneName: zones[0].name,
    warehouseId: 'warehouse-1',
    warehouseName: 'Основний склад',
    name: 'Секція 01',
    code: 'S01',
    qrCode: 'fixture-storage-section:1',
    isActive: true,
    partCount: 0,
  }
  const shelf = {
    id: 'storage-shelf-1',
    sectionId: section.id,
    sectionName: section.name,
    zoneId: zones[0].id,
    zoneName: zones[0].name,
    warehouseId: 'warehouse-1',
    warehouseName: 'Основний склад',
    name: 'Полиця 01',
    code: 'P01',
    qrCode: 'fixture-storage-shelf:1',
    isActive: true,
    partCount: 0,
  }
  await page.route('**/api/v1/warehouses/warehouse-1', (route) =>
    fulfillData(route, {
      id: 'warehouse-1',
      name: 'Основний склад',
      code: 'main',
      qrCode: 'fixture-storage-warehouse:1',
      isActive: true,
      isSystemDefault: true,
      unassignedPartCount: 0,
      zones,
    }),
  )
  await page.route('**/api/v1/inventory/zones*', (route) =>
    fulfillData(route, zones),
  )
  await page.route('**/api/v1/inventory/zones/*', (route) =>
    fulfillData(
      route,
      zones.find(
        ({ id }) =>
          id === new URL(route.request().url()).pathname.split('/').at(-1),
      ),
    ),
  )
  await page.route('**/api/v1/inventory/sections*', (route) =>
    fulfillData(route, [section]),
  )
  await page.route('**/api/v1/inventory/sections/*', (route) =>
    fulfillData(route, section),
  )
  await page.route('**/api/v1/inventory/shelves*', (route) =>
    fulfillData(route, [shelf]),
  )
  await page.route('**/api/v1/inventory/shelves/*', (route) =>
    fulfillData(route, shelf),
  )
  if (inventoryOnly)
    await page.route('**/api/v1/me/permissions', (route) =>
      fulfillData(route, {
        role: 'member',
        permissions: ['inventory.view'],
        features: [],
        entitlement: { state: 'active', usage: activeSubscription.usage },
      }),
    )
  const partsRequests: string[] = []
  page.on('request', (request) => {
    if (
      /^\/api\/v1\/(?:parts|stickers)(?:\/|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      partsRequests.push(request.url())
  })
  return { fixture, zones, partsRequests }
}

async function installStoragePrintPopup(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as Window & { __storagePrintHtml: string[] }
    state.__storagePrintHtml = []
    window.open = () => {
      let html = ''
      return {
        opener: null,
        document: {
          write: (chunk: string) => {
            html += chunk
          },
          close: () => undefined,
        },
        focus: () => undefined,
        close: () => undefined,
        print: () => state.__storagePrintHtml.push(html),
      } as unknown as Window
    }
  })
}

async function storagePrintedCodes(page: Page) {
  return page.evaluate(() => {
    const html =
      (
        window as unknown as Window & { __storagePrintHtml: string[] }
      ).__storagePrintHtml.at(-1) ?? ''
    return [
      ...new DOMParser()
        .parseFromString(html, 'text/html')
        .querySelectorAll('.label .code'),
    ].map((element) => element.textContent)
  })
}

for (const target of [
  {
    path: 'warehouse-1',
    menu: 'Інші дії зі складом',
    action: 'Друк стікерів зон',
    kind: 'zone',
    parent: 'warehouse-1',
    count: 25,
  },
  {
    path: 'zones/storage-zone-1',
    menu: 'Дії із зоною Зона 01',
    action: 'Друк стікерів секцій',
    kind: 'section',
    parent: 'storage-zone-1',
    count: 1,
  },
  {
    path: 'sections/storage-section-1',
    menu: 'Дії з секцією Секція 01',
    action: 'Друк стікерів полиць',
    kind: 'shelf',
    parent: 'storage-section-1',
    count: 1,
  },
]) {
  test(`storage stickers: ${target.kind} top menu opens canonical direct-child selection (fixture)`, async ({
    page,
  }) => {
    await installStorageStickerFixture(page, true)
    await loginFrom(page)
    await page.goto(`/app/koval/warehouses/${target.path}`)
    const menu = page.getByRole('button', { name: target.menu, exact: true })
    await expect(
      page
        .locator('.rz-topbar__actions')
        .getByRole('button', { name: target.menu, exact: true }),
    ).toBeVisible()
    await menu.focus()
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('menuitem', { name: target.action }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: target.action }).click()
    await expect(page).toHaveURL(
      `/app/koval/stickers?type=locations&kind=${target.kind}&parent=${target.parent}`,
    )
    await expect(
      page.getByRole('radio', { name: 'Місця зберігання', exact: true }),
    ).toBeChecked()
    await expect(
      page.getByText(
        `Вибрано ${target.count} обʼєктів · ${target.count} стікерів`,
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: `Підготувати ${target.count}`,
        exact: true,
      }),
    ).toBeEnabled()
    await expect(
      page.getByRole('region', { name: 'Активна черга', exact: true }),
    ).toHaveCount(0)
    const list = page.getByRole('list', {
      name: 'Місця зберігання',
      exact: true,
    })
    await expect(list.getByRole('checkbox')).toHaveCount(
      Math.min(target.count, 10),
    )
    const prefixes = { zone: 'Зона', section: 'Секція', shelf: 'Полиця' }
    for (const [kind, prefix] of Object.entries(prefixes)) {
      if (kind !== target.kind)
        await expect(
          list.getByRole('checkbox', {
            name: new RegExp(`^Обрати: ${prefix}`),
          }),
        ).toHaveCount(0)
    }
  })
}

test('storage stickers: 25 queued, 20 printed, arbitrary 7 confirmed, reload leaves 18 (fixture)', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000)
  await installStorageStickerFixture(page, true)
  await installStoragePrintPopup(page)
  await loginFrom(page)
  await page.goto(
    '/app/koval/stickers?type=locations&kind=zone&parent=warehouse-1&select=all',
  )
  await page
    .getByRole('button', { name: 'Підготувати 25', exact: true })
    .click()
  await expect(
    page.getByText('0 з 25 надруковано · 25 залишилось', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Друк наступних 20', exact: true })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Підтвердити результат друку',
      exact: true,
    }),
  ).toBeVisible()
  expect(await storagePrintedCodes(page)).toEqual(
    Array.from(
      { length: 20 },
      (_, index) => `Z${String(index + 1).padStart(2, '0')}`,
    ),
  )
  await expect(
    page.getByText('0 з 25 надруковано · 25 залишилось', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Частково', exact: true }).click()
  const confirmation = page.getByRole('dialog', {
    name: 'Що вдалося надрукувати?',
    exact: true,
  })
  for (const number of [1, 3, 6, 9, 12, 15, 20])
    await confirmation
      .getByRole('checkbox', {
        name: `Зона ${String(number).padStart(2, '0')}`,
        exact: true,
      })
      .check()
  await confirmation
    .getByRole('button', { name: 'Підтвердити · 7', exact: true })
    .click()
  await expect(confirmation).not.toBeVisible()
  await expect(
    page.getByText('7 з 25 надруковано · 18 залишилось', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('7 з 25 надруковано · 18 залишилось', { exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: 'Аркуш стікерів', exact: true })
      .getByRole('img', { name: /^QR-код Зона / }),
  ).toHaveCount(6)
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  const layout = await page.evaluate(() => ({
    width: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(
    layout.width,
  )
  await page.screenshot({
    path: testInfo.outputPath('storage-stickers-18-remaining.png'),
    animations: 'disabled',
    fullPage: true,
  })
  await page
    .getByRole('button', { name: 'Друк наступних 18', exact: true })
    .click()
  await expect(
    page.getByRole('region', {
      name: 'Підтвердити результат друку',
      exact: true,
    }),
  ).toBeVisible()
  expect(await storagePrintedCodes(page)).toEqual([
    'Z02',
    'Z04',
    'Z05',
    'Z07',
    'Z08',
    'Z10',
    'Z11',
    'Z13',
    'Z14',
    'Z16',
    'Z17',
    'Z18',
    'Z19',
    'Z21',
    'Z22',
    'Z23',
    'Z24',
    'Z25',
  ])
  await page
    .getByRole('button', { name: 'Усі надруковано', exact: true })
    .click()
  await expect(
    page.getByText('Чергу надруковано.', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Активна черга', exact: true }),
  ).toHaveCount(0)
  await page.reload()
  await expect(
    page.getByRole('region', { name: 'Активна черга', exact: true }),
  ).toHaveCount(0)
})

test('storage stickers: PDF opens a 20-label document and leaves the queue unchanged (fixture)', async ({
  page,
}) => {
  await installStorageStickerFixture(page, true)
  await installStoragePrintPopup(page)
  await loginFrom(page)
  await page.goto(
    '/app/koval/stickers?type=locations&kind=zone&parent=warehouse-1&select=all',
  )
  await page
    .getByRole('button', { name: 'Підготувати 25', exact: true })
    .click()
  await page
    .getByRole('button', { name: 'PDF наступних 20', exact: true })
    .click()
  await expect
    .poll(async () => (await storagePrintedCodes(page)).length)
    .toBe(20)
  await expect(
    page.getByRole('region', {
      name: 'Підтвердити результат друку',
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    page.getByText('0 з 25 надруковано · 25 залишилось', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('0 з 25 надруковано · 25 залишилось', { exact: true }),
  ).toBeVisible()
})

test('storage stickers: inventory.view-only navigation opens locations and never requests parts (fixture)', async ({
  page,
}) => {
  const fixture = await installStorageStickerFixture(page, true)
  await loginFrom(page)
  await clickVisibleCabinetLink(page, 'Стікери')
  await expect(page).toHaveURL(
    '/app/koval/stickers?type=locations&kind=warehouse&parent=warehouse-1',
  )
  await expect(
    page.getByRole('radio', { name: 'Запчастини', exact: true }),
  ).toBeDisabled()
  await expect(
    page.getByRole('radio', { name: 'Місця зберігання', exact: true }),
  ).toBeChecked()
  await expect(
    page.getByRole('list', { name: 'Місця зберігання', exact: true }),
  ).toBeVisible()
  await page.goto('/app/koval/stickers')
  await expect(page).toHaveURL(
    '/app/koval/stickers?type=locations&kind=warehouse&parent=warehouse-1',
  )
  await expect(
    page.getByRole('radio', { name: 'Місця зберігання', exact: true }),
  ).toBeChecked()
  await page.goto('/app/koval/stickers?type=parts&permission=parts.view')
  await expect(
    page.getByRole('heading', { name: 'Недостатньо прав', exact: true }),
  ).toBeVisible()
  expect(fixture.partsRequests).toEqual([])
})

async function installStickerFileSharing(page: Page) {
  await page.addInitScript(() => {
    const state = window as unknown as Window & {
      __stickerSharedFiles: string[]
    }
    state.__stickerSharedFiles = []
    Object.defineProperty(navigator, 'canShare', {
      configurable: true,
      value: () => true,
    })
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        for (const file of data.files ?? [])
          state.__stickerSharedFiles.push(await file.text())
      },
    })
  })
}
async function emittedStickerCount(page: Page, selector: string) {
  return page.evaluate((className) => {
    const html =
      (
        window as unknown as Window & { __storagePrintHtml: string[] }
      ).__storagePrintHtml.at(-1) ?? ''
    return new DOMParser()
      .parseFromString(html, 'text/html')
      .querySelectorAll(className).length
  }, selector)
}
async function downloadStickerCount(
  page: Page,
  className: 'label' | 'sticker',
) {
  const ready = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Завантажити', exact: true }).click()
  const download = await ready
  expect(download.suggestedFilename()).toBe('rozbirka-stickers.html')
  const path = await download.path()
  expect(path).not.toBeNull()
  const html = await readFile(path, 'utf8')
  return (html.match(new RegExp(`class="${className}"`, 'g')) ?? []).length
}
for (const mode of ['parts', 'locations'] as const) {
  test(`unified sticker files: ${mode} selection, batch, partial confirmation and restore (fixture)`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000)
    if (mode === 'locations') await installStorageStickerFixture(page, true)
    else {
      await installCabinetApiBoundary(page, { partsManage: true })
      await page.route('**/api/v1/me/permissions', (route) =>
        fulfillData(route, {
          role: 'owner',
          permissions: ['parts.view', 'stickers.manage'],
          features: [],
          entitlement: {
            state: 'active',
            usage: activeSubscription.usage,
          },
        }),
      )
      await page.route('**/api/v1/parts**', (route) => {
        const path = new URL(route.request().url()).pathname
        if (path === '/api/v1/parts')
          return fulfillData(route, {
            items: [
              {
                id: 'sticker-part-1',
                name: 'Деталь для стікерів',
                externalCode: 'F-1',
                quantityAvailable: 25,
                quantityTotal: 25,
                quantityReserved: 0,
                quantitySoldTotal: 0,
                status: 'available',
                car: null,
                photos: [],
                order: null,
              },
              {
                id: 'sticker-part-2',
                name: 'Інша деталь',
                externalCode: 'F-2',
                quantityAvailable: 2,
                quantityTotal: 2,
                quantityReserved: 0,
                quantitySoldTotal: 0,
                status: 'available',
                car: null,
                photos: [],
                order: null,
              },
            ],
            page: 1,
            pageSize: 10,
            total: 2,
            totalPages: 1,
          })
        if (path === '/api/v1/parts/batch-sticker')
          return fulfillData(route, {
            items: [
              {
                id: 'sticker-part-1',
                name: 'Деталь для стікерів',
                qrCode: 'fixture-part:1',
                quantity: 25,
                carCode: null,
                carBrand: null,
                carModel: null,
                carYear: null,
                carId: null,
                createdAt: '2026-10-01T00:00:00Z',
              },
              {
                id: 'sticker-part-2',
                name: 'Інша деталь',
                qrCode: 'fixture-part:2',
                quantity: 2,
                carCode: null,
                carBrand: null,
                carModel: null,
                carYear: null,
                carId: null,
                createdAt: '2026-10-01T00:00:00Z',
              },
            ],
          })
        return route.fallback()
      })
    }
    await installStoragePrintPopup(page)
    await installStickerFileSharing(page)
    await loginFrom(page)
    await page.goto(
      mode === 'locations'
        ? '/app/koval/stickers?type=locations&kind=zone&parent=warehouse-1&select=all'
        : '/app/koval/stickers?part=sticker-part-1',
    )
    if (mode === 'parts') {
      const increase = page.getByRole('button', {
        name: 'Збільшити кількість Деталь для стікерів',
        exact: true,
      })
      for (let i = 1; i < 25; i++) await increase.click()
    }
    const className = mode === 'parts' ? 'sticker' : 'label'
    const selector = `.${className}`
    await expect(
      page.getByText(
        'QR-стікери для запчастин і місць зберігання. Оберіть потрібні та підготуйте до друку.',
        { exact: true },
      ),
    ).toBeVisible()
    await expect(
      page.getByText('Вибрані стікери · 25', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'PDF · 25', exact: true }).click()
    await expect.poll(() => emittedStickerCount(page, selector)).toBe(25)
    expect(await downloadStickerCount(page, className)).toBe(25)
    await page.getByRole('button', { name: 'Поділитися', exact: true }).click()
    await expect
      .poll(() =>
        page.evaluate((className) => {
          const html =
            (
              window as unknown as Window & { __stickerSharedFiles: string[] }
            ).__stickerSharedFiles.at(-1) ?? ''
          return new DOMParser()
            .parseFromString(html, 'text/html')
            .querySelectorAll(className).length
        }, selector),
      )
      .toBe(25)
    await expect(
      page.getByRole('region', { name: 'Активна черга', exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Підготувати 25', exact: true })
      .click()
    await expect(
      page.getByText('0 з 25 надруковано · 25 залишилось', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText('Наступна партія черги · 20', { exact: true }),
    ).toBeVisible()
    expect(await downloadStickerCount(page, className)).toBe(20)
    if (mode === 'parts') {
      await expect(
        page.getByRole('checkbox', {
          name: 'Деталь для стікерів',
          exact: true,
        }),
      ).toHaveCount(0)
      await page
        .getByRole('checkbox', { name: 'Інша деталь', exact: true })
        .check()
      await page
        .getByRole('button', {
          name: 'Збільшити кількість Інша деталь',
          exact: true,
        })
        .click()
    } else {
      await expect(
        page.getByRole('checkbox', { name: 'Обрати: Зона 01', exact: true }),
      ).toHaveCount(0)
      await expect(
        page
          .getByRole('list', { name: 'Місця зберігання', exact: true })
          .getByRole('checkbox'),
      ).toHaveCount(0)
      await page.goto(
        '/app/koval/stickers?type=locations&kind=warehouse&parent=warehouse-1',
      )
      await page
        .getByRole('checkbox', { name: 'Обрати: Секція 01', exact: true })
        .check()
      await page
        .getByRole('checkbox', { name: 'Обрати: Полиця 01', exact: true })
        .check()
    }
    await page.getByRole('button', { name: 'PDF · 2', exact: true }).click()
    await expect.poll(() => emittedStickerCount(page, selector)).toBe(2)
    await expect(
      page.getByText('0 з 25 надруковано · 25 залишилось', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Зняти', exact: true }).click()
    await page
      .getByRole('button', { name: 'Друк наступних 20', exact: true })
      .click()
    await expect.poll(() => emittedStickerCount(page, selector)).toBe(20)
    const allPrinted = page.getByRole('button', {
      name: 'Усі надруковано',
      exact: true,
    })
    await expect(allPrinted).toBeVisible()
    expect(await downloadStickerCount(page, className)).toBe(20)
    await expect(allPrinted).toBeVisible()
    await page.getByRole('button', { name: 'Частково', exact: true }).click()
    const editor = page.getByRole('dialog', {
      name: 'Що вдалося надрукувати?',
      exact: true,
    })
    for (const number of [1, 3, 5, 8, 11, 14, 20])
      await editor
        .getByRole('checkbox', {
          name:
            mode === 'parts'
              ? `Деталь для стікерів · Копія ${number}`
              : `Зона ${String(number).padStart(2, '0')}`,
          exact: true,
        })
        .check()
    await editor
      .getByRole('button', { name: 'Підтвердити · 7', exact: true })
      .click()
    await expect(
      page.getByText('7 з 25 надруковано · 18 залишилось', { exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByText('7 з 25 надруковано · 18 залишилось', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'Друк наступних 18', exact: true })
      .click()
    await expect.poll(() => emittedStickerCount(page, selector)).toBe(18)
    await page
      .getByRole('button', { name: 'Усі надруковано', exact: true })
      .click()
    await expect(
      page
        .locator('.rz-toast')
        .getByText('Чергу надруковано.', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'Активна черга', exact: true }),
    ).toHaveCount(0)
    const overflow = await page.evaluate(() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.width)
    await page.screenshot({
      path: testInfo.outputPath(`unified-stickers-${mode}-complete.png`),
      fullPage: true,
    })
  })
}

test('OLX local alpha publishes and observes simulated moderation only on explicit refresh', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { olxAlpha: true })
  let connected = false
  let provider = 'new'
  let view = {
    partId: '11111111-1111-1111-1111-111111111111',
    advertId: null as string | null,
    coreStatus: 'available',
    observedStatus: null as string | null,
    observedAt: null as string | null,
    syncState: 'draft',
    error: null,
    excluded: false,
    autoRestoreBlocked: false,
    content: {
      publicDescription: '',
      categoryId: null as string | null,
      categoryConfirmed: false,
      attributes: {},
    },
    lastSent: null,
  }
  let refreshes = 0
  await page.route('**/api/v1/integrations/olx/connection', (route) =>
    fulfillData(route, {
      available: true,
      connected,
      accountId: connected ? 'alpha-seller-1' : null,
      mode: 'simulator',
    }),
  )
  await page.route('**/api/v1/olx-alpha/**', async (route) => {
    const request = route.request()
    expect(request.headers()['x-tenant-id']).toBe('tenant-1')
    const path = new URL(request.url()).pathname
    if (path.endsWith('/connection')) {
      if (request.method() === 'POST') connected = true
      return fulfillData(route, {
        available: true,
        connected,
        accountId: connected ? 'alpha-seller-1' : null,
        mode: 'simulator',
      })
    }
    if (path.endsWith('/content'))
      view = { ...view, content: request.postDataJSON() as typeof view.content }
    if (path.endsWith('/publish'))
      view = {
        ...view,
        advertId: 'sim-1',
        observedStatus: 'new',
        observedAt: new Date().toISOString(),
        syncState: 'synced',
      }
    if (path.endsWith('/simulate'))
      provider = (request.postDataJSON() as { status: string }).status
    if (path.endsWith('/refresh')) {
      refreshes++
      view = {
        ...view,
        observedStatus: provider,
        observedAt: new Date().toISOString(),
      }
    }
    return fulfillData(route, view)
  })
  await page.route('**/api/v1/parts/search', (route) =>
    fulfillData(route, {
      items: [
        {
          id: view.partId,
          name: 'Крило тестове',
          quantity: 1,
          quantityReserved: 0,
          quantityAvailable: 1,
          status: 'available',
          thumbnailUrl: null,
          car: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 6,
      totalPages: 1,
    }),
  )
  await page.route(
    '**/api/v1/parts/11111111-1111-1111-1111-111111111111',
    (route) =>
      fulfillData(route, {
        id: view.partId,
        name: 'Крило тестове',
        effectiveSalePrice: 250,
      }),
  )
  await loginFrom(page)
  await page.goto('/app/koval/settings/integrations/olx')
  await page.getByRole('button', { name: 'Підключити тестовий акаунт' }).click()
  await page.getByRole('link', { name: 'Відкрити розділ OLX' }).click()
  await expect(page).toHaveURL(/\/app\/koval\/olx$/)
  await page.getByRole('searchbox', { name: 'Пошук запчастини' }).fill('Крило')
  await page.getByRole('option', { name: /Крило тестове/ }).click()
  await page.getByLabel('Публічний опис').fill('Тестовий публічний опис')
  await page
    .getByLabel('Категорія тестового каталогу')
    .selectOption('car-parts')
  await page.getByLabel('Підтверджую категорію').check()
  await page.getByLabel('Стан для оголошення').selectOption('used')
  await page.getByRole('button', { name: 'Зберегти дані OLX' }).click()
  await page.getByRole('button', { name: 'Опублікувати', exact: true }).click()
  await expect(
    page.getByText('Очікує модерації', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Пройшла модерацію' }).click()
  await expect(
    page.getByText('Очікує модерації', { exact: true }),
  ).toBeVisible()
  expect(refreshes).toBe(0)
  await page.getByRole('button', { name: 'Оновити статус' }).click()
  await expect(page.getByText('Активне', { exact: true })).toBeVisible()
  expect(refreshes).toBe(1)
  await expect(
    page.getByRole('button', { name: 'Опублікувати', exact: true }),
  ).toBeDisabled()
  await page.screenshot({
    path: '/tmp/olx-alpha-cabinet-desktop.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    page.getByRole('button', { name: 'Оновити статус' }),
  ).toBeVisible()
  await page.screenshot({
    path: '/tmp/olx-alpha-cabinet-mobile.png',
    fullPage: true,
  })
})

test('OLX listing settings and searchable part status work from the cabinet', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { olxAlpha: true })
  let settings = {
    contactName: 'Склад',
    contactPhone: null,
    cityId: null,
    districtId: null,
    descriptionSuffix: 'Самовивіз зі складу.',
  }
  await page.route('**/api/v1/integrations/olx/connection', (route) =>
    fulfillData(route, {
      available: true,
      connected: true,
      accountId: 'synthetic-seller-123',
      mode: 'oauth',
      scope: 'v2 write',
      reconnectRequired: false,
    }),
  )
  await page.route('**/api/v1/integrations/olx/listing-settings', (route) => {
    expect(route.request().headers()['x-tenant-id']).toBe('tenant-1')
    if (route.request().method() === 'PUT')
      settings = route.request().postDataJSON() as typeof settings
    return fulfillData(route, settings)
  })

  await page.route('**/api/v1/parts/search/facets', (route) =>
    fulfillData(route, {
      statuses: [],
      warehouses: [],
      zones: [],
      conditions: [],
      equipmentTypes: [],
      makes: [],
      models: [],
      generations: [],
      origins: [],
      qualityFlags: [],
      inventoryLocks: [],
      discrepancies: [],
    }),
  )
  let lastSearch: { olxStatus?: string } | undefined
  await page.route('**/api/v1/parts/search', (route) => {
    lastSearch = route.request().postDataJSON() as { olxStatus?: string }
    return fulfillData(route, {
      items: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Фара для перевірки статусу',
          quantity: 1,
          quantityAvailable: 1,
          quantityReserved: 0,
          status: 'available',
          olx: {
            advertId: '123',
            state: 'linked',
            observedStatus: 'moderated',
            needsAttention: true,
          },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 30,
      totalPages: 1,
      olxConnected: true,
    })
  })

  await loginFrom(page)
  await page.goto('/app/koval/settings/integrations/olx')
  await page.getByRole('link', { name: 'Налаштування оголошень' }).click()
  await expect(page).toHaveURL(/\/settings\/integrations\/olx\/listing$/)
  const suffix = page.getByRole('textbox', { name: 'Текст наприкінці опису' })
  await expect(suffix).toHaveValue('Самовивіз зі складу.')
  await suffix.fill('Самовивіз і відправлення.')
  await page
    .locator('.rz-topbar')
    .getByRole('button', { name: 'Зберегти', exact: true })
    .click()
  await expect(page.getByText('Налаштування збережено.')).toBeVisible()
  await page.reload()
  await expect(suffix).toHaveValue('Самовивіз і відправлення.')

  const olxRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/integrations/olx/'))
      olxRequests.push(request.url())
  })
  await page.goto('/app/koval/parts')
  const part = page.getByRole('row', { name: /Фара для перевірки статусу/ })
  await expect(part.getByTitle('OLX · Відхилено модерацією')).toBeVisible()
  await page.getByRole('button', { name: 'Майданчики' }).click()
  await page.getByText('Потребують уваги', { exact: true }).click()
  await expect.poll(() => lastSearch?.olxStatus).toBe('attention')
  await expect(part).toBeVisible()
  expect(olxRequests).toEqual([])
})

test('OLX bulk category and publication from the parts list separate ready and blocked parts', async ({
  page,
}, testInfo) => {
  await installCabinetApiBoundary(page, { olxAlpha: true, partsManage: true })
  const seller = 'synthetic-batch-seller'
  const parts = [
    'Передня ліва фара Volkswagen',
    'Передня права фара Volkswagen',
    'Задній ліхтар Volkswagen',
    'Протитуманна фара Volkswagen',
    'Додаткова фара Volkswagen',
  ].map((name, index) => ({
    id: `11111111-1111-1111-1111-11111111111${index}`,
    name,
    quantity: 1,
    quantityAvailable: 1,
    quantityReserved: 0,
    status: 'available',
  }))
  const drafts = new Map<string, { content: unknown; revision: string }>()
  const submitted: string[][] = []
  const jobId = 'd38ad12c-780f-4dc3-9a8f-f05b9b3945f0'
  const retryId = '3b0f64e0-a2b1-46dc-9f44-f227c0df4ee3'
  const retryRequests: { operationId: string; partIds: string[] }[] = []
  let jobReads = 0
  let stopped = false
  let reviewCount = 0
  await page.route('**/api/v1/parts/search/facets', (route) =>
    fulfillData(route, {
      statuses: [{ id: 'available', name: 'available', count: parts.length }],
      warehouses: [],
      zones: [],
      conditions: [],
      equipmentTypes: [],
      makes: [],
      models: [],
      generations: [],
      origins: [],
      qualityFlags: [],
      inventoryLocks: [],
      discrepancies: [],
    }),
  )
  await page.route('**/api/v1/parts/search', (route) =>
    fulfillData(route, {
      items: parts,
      total: parts.length,
      page: 1,
      pageSize: 30,
      totalPages: 1,
      olxConnected: true,
    }),
  )
  await page.route('**/api/v1/integrations/olx/connection', (route) =>
    fulfillData(route, {
      available: true,
      connected: true,
      mode: 'oauth',
      accountId: seller,
      scope: 'v2 read write',
      writesAvailable: true,
      reconnectRequired: false,
    }),
  )
  await page.route('**/api/v1/integrations/olx/live/**', async (route) => {
    const segments = new URL(route.request().url()).pathname.split('/')
    const action = segments.at(-1)
    if (action === 'categories') {
      return fulfillData(route, [
        { id: 2544, name: 'Фари', path: 'Запчастини / Фари', photosLimit: 13 },
      ])
    }
    if (segments.includes('publication-jobs')) {
      const queued = [parts[0], parts[1], parts[4]].map(({ id }) => ({
        partId: id,
        revision: drafts.get(id)?.revision,
      }))
      const job = {
        id: jobId,
        status: stopped ? 'stopped' : 'running',
        error: stopped ? 'OLX_RATE_LIMITED' : null,
        createdAt: '2026-11-20T12:00:00Z',
        updatedAt: '2026-11-20T12:00:00Z',
        parts: queued,
        partNames: Object.fromEntries(parts.map(({ id, name }) => [id, name])),
        results: [
          { partId: parts[0].id, status: 'submitted', advertId: '4501' },
          ...(stopped
            ? [
                {
                  partId: parts[1].id,
                  status: 'pending',
                  error: 'OLX_RATE_LIMITED',
                },
                { partId: parts[4].id, status: 'skipped' },
              ]
            : []),
        ],
      }
      const retry = {
        ...job,
        id: retryId,
        retryOfJobId: jobId,
        status: 'completed',
        error: null,
        parts: queued.filter(({ partId }) => partId === parts[4].id),
        results: [
          { partId: parts[4].id, status: 'submitted', advertId: '4502' },
        ],
      }
      if (action === 'retry' && segments.at(-2) === jobId) {
        const body = route.request().postDataJSON() as {
          operationId: string
          partIds: string[]
        }
        expect(typeof body.operationId).toBe('string')
        expect(body.partIds).toEqual([parts[4].id])
        retryRequests.push(body)
        if (retryRequests.length === 1)
          return route.fulfill({ status: 503, json: { success: false } })
        return fulfillData(route, retry, 202)
      }
      if (action === retryId) return fulfillData(route, retry)
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as {
          operationId: string
          accountId: string
          parts: { partId: string; revision: string }[]
        }
        expect(typeof body.operationId).toBe('string')
        expect(body).toEqual({
          operationId: body.operationId,
          accountId: seller,
          parts: queued,
        })
        submitted.push(body.parts.map(({ partId }) => partId))
        return fulfillData(route, { ...job, status: 'queued', results: [] })
      }
      if (action === jobId) {
        jobReads++
        return fulfillData(route, job)
      }
      return fulfillData(route, retryRequests.length > 0 ? [retry, job] : [job])
    }
    const part = parts.find(({ id }) => id === segments.at(-2))
    if (!part)
      throw new Error(`Unexpected OLX batch route: ${route.request().url()}`)
    const draft = drafts.get(part.id)
    if (action === 'publication')
      return fulfillData(route, {
        ...draft,
        partId: part.id,
        canWrite: true,
        state: part.id === parts[3].id ? 'linked' : 'draft',
        advertId: part.id === parts[3].id ? '4480' : null,
        content: draft?.content ?? {
          advertiserType: 'business',
          attributes: {},
          categoryConfirmed: false,
          contactName: 'Склад',
          contactPhone: '',
          publicDescription: 'Тестовий опис запчастини.',
          cityId: 1,
        },
      })
    if (action === 'draft') {
      const body = route.request().postDataJSON() as { content: unknown }
      expect(body).toMatchObject({
        expectedAccountId: seller,
        expectedRevision: draft?.revision ?? null,
        content: { categoryId: 2544, categoryConfirmed: true },
      })
      const revision = `draft-${part.id}-${draft ? '2' : '1'}`
      drafts.set(part.id, { content: body.content, revision })
      return fulfillData(route, {
        partId: part.id,
        revision,
        canWrite: true,
        state: 'draft',
      })
    }
    if (action === 'preview') {
      reviewCount++
      expect(route.request().postDataJSON()).toMatchObject({
        categoryId: 2544,
        categoryConfirmed: true,
        advertiserType: 'business',
      })
      return fulfillData(route, {
        part: {
          partId: part.id,
          title: part.name,
          photos: [],
          status: 'available',
        },
        issues:
          part.id === parts[2].id
            ? [{ field: 'price', code: 'price_required' }]
            : [],
      })
    }
    throw new Error(`Unexpected OLX batch action: ${action}`)
  })

  await loginFrom(page)
  await page.goto('/app/koval/parts')
  for (const part of parts) {
    await page.getByRole('checkbox', { name: `Обрати: ${part.name}` }).check()
  }
  const toolbar = page.getByRole('region', { name: 'Дії над обраними' })
  await toolbar.getByRole('button', { name: 'Майданчики' }).click()
  await page.getByRole('menuitem', { name: 'Призначити категорію…' }).click()
  const categorySheet = page.getByRole('dialog', {
    name: 'Категорія на майданчику',
  })
  await categorySheet.getByRole('button', { name: 'Категорія OLX' }).click()
  await page.getByRole('option', { name: /Фари/ }).click()
  await expect(
    categorySheet.getByRole('textbox', { name: 'Майданчик' }),
  ).toHaveValue('OLX')
  expect((await categorySheet.boundingBox())?.width).toBe(
    Math.min(480, page.viewportSize()?.width ?? 480),
  )
  await page.screenshot({ path: testInfo.outputPath('olx-bulk-category.png') })
  await categorySheet
    .getByRole('button', { name: 'Призначити', exact: true })
    .click()
  const assigned = page.getByRole('dialog', {
    name: 'Результат призначення категорії',
  })
  await expect(
    assigned
      .getByRole('region', { name: 'Категорію призначено · 4' })
      .getByRole('listitem'),
  ).toHaveCount(4)
  expect(drafts.size).toBe(4)
  expect(submitted).toEqual([])

  await assigned.getByRole('button', { name: 'Перейти до публікації' }).click()
  const publicationSheet = page.getByRole('dialog', {
    name: 'Опублікувати на майданчику',
    exact: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(
    publicationSheet.getByText('Готові 3 · Очікують даних 1'),
  ).toBeVisible()
  await expect(
    publicationSheet.getByRole('button', { name: 'Тип продавця' }),
  ).toHaveCount(0)
  await expect(
    publicationSheet.getByText('Вкажіть ціну більше нуля.'),
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('olx-bulk-preflight.png') })
  await publicationSheet
    .getByRole('button', { name: 'Опублікувати', exact: true })
    .click()
  expect(submitted).toEqual([])
  await page
    .getByRole('dialog', { name: 'Опублікувати готові запчастини на OLX?' })
    .getByRole('button', { name: 'Опублікувати', exact: true })
    .click()
  const result = page.getByRole('dialog', {
    name: 'Результат публікації на OLX',
  })
  await expect(
    page.getByRole('dialog', {
      name: 'Опублікувати готові запчастини на OLX?',
    }),
  ).toHaveCount(0)
  await expect(result.getByText('Опрацьовано 1 з 3')).toBeVisible()
  expect(jobReads).toBe(1)
  const queuedPositions = result.getByRole('region', { name: 'У черзі · 2' })
  await expect(queuedPositions.getByText(parts[4].name)).toBeVisible()
  stopped = true
  await result.getByRole('button', { name: 'Оновити стан завдання' }).click()
  await expect(result.getByText('Опрацьовано 2 з 3')).toBeVisible()
  await expect(result.getByText('Зупинено', { exact: true })).toBeVisible()
  const accepted = result.getByRole('region', {
    name: 'Прийнято в обробку · 1',
  })
  await expect(accepted.getByText('Оголошення № 4501')).toBeVisible()
  const blocked = result.getByRole('region', { name: 'Очікують даних · 1' })
  await expect(blocked.getByRole('link', { name: /Виправити/ })).toBeVisible()
  await expect(
    result
      .getByRole('region', { name: 'Уже пов’язані · 1' })
      .getByText('Оголошення № 4480'),
  ).toBeVisible()
  const uncertain = result.getByRole('region', {
    name: 'Потрібно перевірити статус · 1',
  })
  const skipped = result.getByRole('region', { name: 'Не опрацьовано · 1' })
  await expect(uncertain.getByText(parts[1].name)).toBeVisible()
  await expect(skipped.getByText(parts[4].name)).toBeVisible()
  expect((await result.boundingBox())?.width).toBe(390)
  await page.screenshot({
    path: testInfo.outputPath('olx-bulk-result-mobile.png'),
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.screenshot({
    path: testInfo.outputPath('olx-bulk-result-desktop.png'),
  })
  expect(reviewCount).toBe(4)
  await result.getByRole('button', { name: 'Готово' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Завдання OLX' }).click()
  const history = page.getByRole('dialog', { name: 'Завдання OLX' })
  await history.getByRole('button', { name: /Зупинено.*2\/3/ }).click()
  await expect(result.getByText('Оголошення № 4501')).toBeVisible()
  await expect(result.getByText('Опрацьовано 2 з 3')).toBeVisible()
  await expect(uncertain.getByText(parts[1].name)).toBeVisible()
  await expect(skipped.getByText(parts[4].name)).toBeVisible()
  expect(jobReads).toBe(3)
  expect(submitted).toEqual([[parts[0].id, parts[1].id, parts[4].id]])

  const retryAction = result.getByRole('button', { name: /Повторити вибране/ })
  await expect(retryAction).toBeDisabled()
  await expect(accepted.getByRole('checkbox')).toHaveCount(0)
  await expect(
    uncertain.getByRole('checkbox', { name: /Вибрати для звірки/ }),
  ).not.toBeChecked()
  await skipped.getByRole('checkbox', { name: /Вибрати для повтору/ }).check()
  await retryAction.click()
  const confirmation = page.getByRole('dialog', {
    name: 'Опрацювати вибрані позиції ще раз?',
  })
  expect(retryRequests).toHaveLength(0)
  const confirm = confirmation.getByRole('button', {
    name: 'Повторити вибране',
  })
  await confirm.click()
  await expect(
    confirmation.getByText(/Не вдалося підтвердити запуск/),
  ).toBeVisible()
  await confirm.click()
  await expect(result.getByText('Оголошення № 4502')).toBeVisible()
  expect(retryRequests).toHaveLength(2)
  expect(retryRequests[1]).toEqual(retryRequests[0])

  await result.getByRole('button', { name: 'Назад' }).click()
  await expect(
    history.getByRole('button', { name: /Опрацювання завершено.*Повтор/ }),
  ).toBeVisible()
  await history.getByRole('button', { name: /Зупинено.*2\/3/ }).click()
  await expect(result.getByText('Оголошення № 4501')).toBeVisible()
  await expect(skipped.getByText(parts[4].name)).toBeVisible()
})

test('OLX reconciliation manually links the existing ID and saves completion', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { olxAlpha: true, partsManage: true })
  const partId = '11111111-1111-1111-1111-111111111111'
  let linked = false
  let completedAt: string | null = null
  let advertReads = 0
  let links = 0
  await page.route('**/api/v1/integrations/olx/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/connection'))
      return fulfillData(route, {
        available: true,
        connected: true,
        accountId: 'reconcile-account',
        mode: 'oauth',
        scope: 'v2 read write',
        reconciliationCompletedAt: completedAt,
      })
    if (path.endsWith('/adverts')) {
      advertReads++
      if (new URL(route.request().url()).searchParams.get('page') === '2')
        return fulfillData(route, {
          items: [
            { id: '789', title: 'Бампер зі сторінки 2', status: 'active' },
          ],
          page: 2,
          hasMore: false,
          checkedAt: '2026-11-19T12:00:00Z',
        })
      return fulfillData(route, {
        items: [
          {
            id: '123',
            title: 'Фара зі звірки',
            status: 'active',
            linkedPart: linked ? { partId, partName: 'Фара ліва' } : null,
          },
          {
            id: '456',
            title: 'Раніше пов’язаний диск',
            status: 'active',
            linkedPart: { partName: 'Диск R17' },
          },
        ],
        page: 1,
        hasMore: true,
        checkedAt: '2026-11-19T12:00:00Z',
      })
    }
    if (path.endsWith('/publication'))
      return fulfillData(route, {
        partId,
        state: 'draft',
        canLinkExisting: true,
        revision: null,
      })
    if (path.endsWith('/link')) {
      expect(route.request().method()).toBe('POST')
      expect(route.request().postDataJSON()).toMatchObject({
        advertId: '123',
        expectedRevision: null,
        expectedAccountId: 'reconcile-account',
      })
      links++
      linked = true
      return fulfillData(route, {
        partId,
        advertId: '123',
        state: 'update_pending',
      })
    }
    if (path.endsWith('/reconciliation/complete')) {
      expect(route.request().postDataJSON()).toEqual({
        accountId: 'reconcile-account',
      })
      completedAt = '2026-11-19T12:00:00Z'
      return fulfillData(route, { completedAt })
    }
    throw new Error(`Unexpected OLX request: ${path}`)
  })
  await page.route('**/api/v1/parts/search', (route) =>
    fulfillData(route, {
      items: [
        {
          id: partId,
          name: 'Фара ліва',
          quantity: 1,
          quantityAvailable: 1,
          quantityReserved: 0,
          status: 'available',
          thumbnailUrl: null,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 6,
      totalPages: 1,
    }),
  )
  await page.route(`**/api/v1/parts/${partId}`, (route) =>
    fulfillData(route, { id: partId, effectiveSalePrice: 1200 }),
  )
  await loginFrom(page)
  await page.goto('/app/koval/olx')
  await page.getByRole('link', { name: 'Прив’язування' }).click()
  await expect(page).toHaveURL(/\/olx\/reconcile$/)
  await expect(page.getByText('Диск R17', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('columnheader', { name: 'Стан на OLX' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Не прив’язані', exact: true }).click()
  await expect(page.getByText('Раніше пов’язаний диск')).toHaveCount(0)
  await page.getByRole('button', { name: /Фара зі звірки/ }).click()
  await page.getByRole('searchbox', { name: 'Пошук запчастини' }).fill('Фара')
  await page.getByRole('option', { name: /Фара ліва/ }).click()
  await expect(
    page.getByRole('option', { name: /Фара ліва/, selected: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Прив’язати', exact: true }).click()
  const confirm = page.getByRole('dialog', { name: 'Прив’язати оголошення?' })
  await expect(confirm.getByText(/123/)).toBeVisible()
  await confirm.getByRole('button', { name: 'Прив’язати', exact: true }).click()
  await expect(page.getByText('Оголошення прив’язано.')).toBeVisible()
  expect(links).toBe(1)
  expect(advertReads).toBe(2)
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByRole('searchbox', { name: 'Назва або номер оголошення' })
    .fill('№ 789')
  await expect(
    page.getByText('Серед завантажених оголошень збігів немає.'),
  ).toBeVisible()
  expect(advertReads).toBe(2)
  await page.getByRole('button', { name: 'Завантажити ще' }).click()
  await expect(
    page.getByRole('button', { name: /Бампер зі сторінки 2/ }),
  ).toBeVisible()
  expect(advertReads).toBe(3)
  await page
    .getByRole('button', { name: 'Завершити звірку', exact: true })
    .click()
  await page
    .getByRole('dialog', { name: 'Завершити звірку?' })
    .getByRole('button', { name: 'Завершити звірку', exact: true })
    .click()
  await expect(
    page.getByText('Звірку завершено.', { exact: true }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('Звірку завершено.', { exact: true }),
  ).toBeVisible()
})

// Synthetic provider boundary: exercises the actual cabinet and top-level launch form.
test('OLX OAuth connection reuses cabinet UI and completes a one-time launch without polling', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { olxAlpha: true })
  let connected = false
  let canWrite = false
  let verified = 0
  let starts = 0
  let writeStarts = 0
  const city = { id: 17, name: 'Львів', region: 'Львівська область' }
  let settings = {
    cityId: null as number | null,
    districtId: null as number | null,
    contactName: 'Склад',
    contactPhone: '+380671234567',
    descriptionSuffix: null,
  }
  let saves = 0
  await page.route('**/api/v1/integrations/olx/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path.endsWith('/oauth/write/start')) {
      writeStarts++
      expect(request.headers()['x-tenant-id']).toBe('tenant-1')
      return fulfillData(route, {
        launchUrl: `${appOrigin()}/api/v1/integrations/olx/oauth/launch`,
        ticket: 'synthetic-write-ticket',
        expiresAt: '2026-11-17T18:00:00Z',
      })
    }
    if (path.endsWith('/oauth/start')) {
      starts++
      expect(request.headers()['x-tenant-id']).toBe('tenant-1')
      return fulfillData(route, {
        launchUrl: `${appOrigin()}/api/v1/integrations/olx/oauth/launch`,
        ticket: 'synthetic-one-time-ticket',
        expiresAt: '2026-11-17T18:00:00Z',
      })
    }
    if (path.endsWith('/oauth/launch')) {
      expect(request.method()).toBe('POST')
      expect(request.postData()).toBe(
        writeStarts
          ? 'ticket=synthetic-write-ticket'
          : 'ticket=synthetic-one-time-ticket',
      )
      expect(request.url()).not.toContain('ticket=')
      connected = true
      canWrite = writeStarts > 0
      return fulfillOlxCallback(route, 'connected')
    }
    if (path.endsWith('/listing-settings')) {
      if (request.method() === 'PUT') {
        saves++
        const next = request.postDataJSON() as typeof settings
        expect(next).toEqual({ ...settings, cityId: city.id, districtId: 51 })
        settings = next
      }
      return fulfillData(route, settings)
    }
    if (path.endsWith('/listing-settings/cities'))
      return fulfillData(route, [city])
    if (path.endsWith('/listing-settings/cities/17'))
      return fulfillData(route, city)
    if (path.endsWith('/listing-settings/cities/17/districts'))
      return fulfillData(route, [{ id: 51, name: 'Франківський' }])
    if (path.endsWith('/live/adverts'))
      return fulfillData(route, {
        items: [],
        page: 1,
        hasMore: false,
        checkedAt: '2026-11-18T12:00:00Z',
      })
    if (path.endsWith('/verify')) verified++
    return fulfillData(route, {
      available: true,
      connected,
      accountId: connected ? 'synthetic-seller-123' : null,
      mode: 'oauth',
      scope: canWrite ? 'v2 read write' : 'v2 read',
      writesAvailable: true,
      verifiedAt: connected ? '2026-11-17T12:00:00Z' : null,
      reconnectRequired: false,
    })
  })
  await page.setViewportSize({ width: 1440, height: 960 })
  await loginFrom(page)
  await page.goto('/app/koval/settings/integrations/olx')
  const connect = page.getByRole('button', {
    name: 'Підключити OLX',
    exact: true,
  })
  await expect(connect).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Підключіть акаунт OLX' }),
  ).toBeVisible()
  await expect(page.getByLabel('Ідентифікатор тестового акаунта')).toHaveCount(
    0,
  )
  await page.screenshot({
    path: '/tmp/olx-oauth-disconnected-desktop.png',
    fullPage: true,
  })
  await connect.focus()
  await expect(connect).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/olx\/listing\?setup=location$/)
  await expect(
    page.getByText('Оберіть місто для нових оголошень'),
  ).toBeVisible()
  const allowPublication = page.getByRole('button', {
    name: 'Дозволити публікацію в OLX',
  })
  await expect(allowPublication).toBeVisible()
  expect(writeStarts).toBe(0)
  const citySearch = page.getByRole('searchbox', {
    name: 'Введіть від двох літер назви міста',
  })
  await expect(citySearch).toBeFocused()
  await page.screenshot({ path: '/tmp/olx-oauth-city-setup.png' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(citySearch).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({ path: '/tmp/olx-oauth-city-setup-mobile.png' })
  await citySearch.fill('Львів')
  await page.getByRole('option', { name: 'Львів · Львівська область' }).click()
  const saveLocation = page.getByRole('button', {
    name: 'Зберегти',
    exact: true,
  })
  await expect(saveLocation).toBeDisabled()
  await page.getByRole('combobox', { name: 'Район' }).selectOption('51')
  await saveLocation.click()
  await expect(page).toHaveURL(/\/olx\/listing$/)
  await expect(page.getByText('Оберіть місто для нових оголошень')).toHaveCount(
    0,
  )
  await expect(
    page.getByRole('button', { name: 'Місто', exact: true }),
  ).toContainText('Львів')
  expect(saves).toBe(1)
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('link', { name: 'Акаунт', exact: true }).click()
  await expect(
    page.getByText('synthetic-seller-123', { exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/app\/koval\/settings\/integrations\/olx$/)
  expect(starts).toBe(1)
  expect(verified).toBe(0)
  await expect(
    page.getByText('Доступ до читання', { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Опублікувати', exact: true }),
  ).toHaveCount(0)
  const accessibility = await new AxeBuilder({ page })
    .include('main')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(accessibility.violations).toEqual([])
  await page.screenshot({
    path: '/tmp/olx-oauth-connected-desktop.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Перевірити підключення' }).click()
  await expect.poll(() => verified).toBe(1)
  await page
    .getByRole('button', { name: 'Відключити акаунт', exact: true })
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Скасувати', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 375, height: 860 })
    await page.evaluate((value) => {
      document.documentElement.setAttribute('data-theme', value)
      document
        .querySelectorAll('[data-theme]')
        .forEach((element) => element.setAttribute('data-theme', value))
    }, theme)
    await page.evaluate(async () => {
      await Promise.all(
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      )
    })
    await expect(
      page.getByText('synthetic-seller-123', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const themedAccessibility = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze()
    expect(themedAccessibility.violations).toEqual([])
    await page.screenshot({
      path: `/tmp/olx-oauth-connected-mobile-${theme}.png`,
      fullPage: true,
    })
  }
  await page.getByRole('link', { name: 'Налаштування оголошень' }).click()
  await allowPublication.click()
  await expect(
    page.getByText('Доступ до читання та публікації', { exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/app\/koval\/settings\/integrations\/olx$/)
  await expect(
    page.getByText('synthetic-seller-123', { exact: true }),
  ).toBeVisible()
  await expect(allowPublication).toHaveCount(0)
  expect(writeStarts).toBe(1)
  await page.getByRole('link', { name: 'Налаштування оголошень' }).click()
  await expect(page.getByText('Доступ до публікації надано.')).toBeVisible()
})

test('OLX returns to the same part with unsaved fields after consent and cancellation', async ({
  page,
}) => {
  await installCabinetApiBoundary(page, { olxAlpha: true })
  const id = '11111111-1111-1111-1111-111111111111'
  const path = `/app/koval/parts/${id}/olx`
  let canWrite = false
  let launches = 0
  await page.route(`**/api/v1/parts/${id}`, (route) =>
    fulfillData(route, {
      id,
      name: 'Передня фара Volkswagen Golf',
      status: 'available',
      condition: 'good',
      quantityTotal: 1,
      quantityAvailable: 1,
      quantityReserved: 0,
      quantitySoldTotal: 0,
      effectiveSalePrice: 1200,
      photos: [],
    }),
  )
  await page.route('**/api/v1/integrations/olx/**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith('/oauth/write/start'))
      return fulfillData(route, {
        launchUrl: `${appOrigin()}/api/v1/integrations/olx/oauth/launch`,
        ticket: 'synthetic-part-return-ticket',
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      })
    if (pathname.endsWith('/oauth/launch')) {
      launches++
      canWrite = launches === 2
      return fulfillOlxCallback(route, canWrite ? 'connected' : 'cancelled')
    }
    if (pathname.endsWith('/connection')) {
      return fulfillData(route, {
        available: true,
        connected: true,
        accountId: 'synthetic-part-seller',
        mode: 'oauth',
        scope: canWrite ? 'v2 read write' : 'v2 read',
        writesAvailable: true,
        reconnectRequired: false,
      })
    }
    if (pathname.endsWith('/publication'))
      return fulfillData(route, {
        partId: id,
        state: 'draft',
        revision: null,
        canWrite,
      })
    if (pathname.endsWith('/preparation'))
      return fulfillData(route, {
        part: {
          partId: id,
          title: 'Передня фара Volkswagen Golf',
          status: 'available',
          price: 1200,
          currency: 'UAH',
          photos: [],
        },
        suggestions: [],
      })
    if (pathname.endsWith('/categories')) return fulfillData(route, [])
    throw new Error(`Unexpected OLX request: ${request.method()} ${pathname}`)
  })
  await loginFrom(page)
  await page.goto(path)
  const description = page.getByRole('textbox', { name: 'Публічний опис' })
  const contact = page.getByRole('textbox', { name: 'Ім’я контактної особи' })
  const grant = page.getByRole('button', { name: 'Дозволити публікацію в OLX' })
  await description.fill('Введений опис до підтвердження доступу.')
  await contact.fill('Контакт чернетки')

  await grant.click()
  await expect(page.getByText(/Підтвердження доступу скасовано/)).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
  await expect(description).toHaveValue(
    'Введений опис до підтвердження доступу.',
  )
  await expect(contact).toHaveValue('Контакт чернетки')

  await description.fill('Опис, оновлений після скасування.')
  await grant.click()
  await expect(page.getByText('Доступ до публікації надано.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
  await expect(description).toHaveValue('Опис, оновлений після скасування.')
  await expect(contact).toHaveValue('Контакт чернетки')
  await expect(grant).toHaveCount(0)
  expect(launches).toBe(2)
})

for (const { writeAccess, partCard, linkExisting } of [
  { writeAccess: false, partCard: false, linkExisting: false },
  { writeAccess: true, partCard: false, linkExisting: false },
  { writeAccess: true, partCard: true, linkExisting: false },
  { writeAccess: true, partCard: true, linkExisting: true },
])
  test(`OLX live ${linkExisting ? 'links an existing advert from the part card' : `preparation and publication ${partCard ? 'from the part card' : writeAccess ? 'with write access' : 'without write access'}`}`, async ({
    page,
  }, testInfo) => {
    await installCabinetApiBoundary(page, { olxAlpha: true })
    const id = '11111111-1111-1111-1111-111111111111'
    const editsPrice = partCard && !linkExisting
    if (editsPrice)
      await page.route('**/api/v1/tenants', (route) =>
        fulfillData(
          route,
          tenants.map((tenant) =>
            tenant.id === 'tenant-1'
              ? { ...tenant, accountingCurrency: 'UAH', currencyLocked: true }
              : tenant,
          ),
        ),
      )
    const part = {
      partId: id,
      title: editsPrice ? 'Цапфа RL Rivian' : 'Передня фара Volkswagen Golf',
      status: 'available',
      price: (editsPrice ? null : 1200) as number | null,
      currency: 'UAH',
      photos: editsPrice ? [] : ['https://images.example.test/a.jpg'],
    }
    const category = {
      id: 2544,
      name: 'Фари',
      path: 'Запчастини / Фари',
      photosLimit: 13,
    }
    const categories = editsPrice
      ? [
          category,
          {
            ...category,
            id: 2545,
            name: 'Ліхтарі',
            path: 'Запчастини / Ліхтарі',
          },
          ...Array.from({ length: 24 }, (_, index) => ({
            ...category,
            id: 2600 + index,
            name: `Категорія ${index + 1}`,
            path: `Запчастини / Категорія ${index + 1}`,
          })),
        ]
      : [category]
    let priceSaves = 0
    let nameSaves = 0
    let releasePreparation: () => void = () => undefined
    const preparationReady = new Promise<void>((resolve) => {
      releasePreparation = resolve
    })
    let releasePublish: () => void = () => undefined
    const publishReady = new Promise<void>((resolve) => {
      releasePublish = resolve
    })
    let attributeReads = 0
    let reads = 0
    let previews = 0
    let creates = 0
    let links = 0
    let refreshes = 0
    let publication = {
      partId: id,
      revision: null as string | null,
      state: 'draft',
      advertId: null as string | null,
      observedStatus: null as string | null,
      url: null as string | null,
      checkedAt: null as string | null,
      error: null as string | null,
      errorFields: [] as string[],
      removeRequested: false,
      content: null as unknown,
      canWrite: writeAccess,
      canLinkExisting: linkExisting,
    }
    await page.route('https://images.example.test/**', (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lHkAAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    )
    await page.route('**/api/v1/integrations/olx/**', async (route) => {
      expect(route.request().headers()['x-tenant-id']).toBe('tenant-1')
      const path = new URL(route.request().url()).pathname
      if (path.endsWith('/connection'))
        return fulfillData(route, {
          available: true,
          connected: true,
          accountId: 'synthetic-seller-live',
          mode: 'oauth',
          scope: writeAccess ? 'v2 read write' : 'v2 read',
          writesAvailable: true,
          verifiedAt: '2026-11-18T12:00:00Z',
          reconnectRequired: false,
        })
      if (path.endsWith('/adverts')) {
        reads++
        return fulfillData(route, {
          items: [
            {
              id: '123',
              title: 'Фара на OLX',
              status: publication.advertId === '123' ? 'active' : 'new',
              linkedPart:
                publication.advertId === '123'
                  ? { partId: id, partName: 'Фара тестова' }
                  : null,
              url: 'https://www.olx.ua/d/uk/obyavlenie/test.html',
              price: 1200,
              currency: 'UAH',
            },
          ],
          page: 1,
          hasMore: false,
          checkedAt: '2026-11-18T12:00:00Z',
        })
      }
      if (path.endsWith('/publication')) return fulfillData(route, publication)
      if (path.endsWith('/link') && linkExisting) {
        links++
        expect(route.request().method()).toBe('POST')
        expect(route.request().postDataJSON()).toEqual({
          advertId: '123',
          expectedRevision: publication.revision,
        })
        publication = {
          ...publication,
          revision: '33333333-3333-3333-3333-333333333333',
          state: 'update_pending',
          advertId: '123',
          observedStatus: 'new',
          canLinkExisting: false,
        }
        return fulfillData(route, publication)
      }
      if (path.endsWith('/draft')) {
        publication = {
          ...publication,
          state: publication.advertId ? 'update_pending' : 'draft',
          error: null,
          errorFields: [],
          revision: '22222222-2222-2222-2222-222222222222',
          content: (route.request().postDataJSON() as { content: unknown })
            .content,
        }
        return fulfillData(route, publication)
      }
      if (path.endsWith('/publish')) {
        creates++
        expect(
          (route.request().postDataJSON() as { expectedRevision: string })
            .expectedRevision,
        ).toBe(publication.revision)
        if (editsPrice) await publishReady
        if (editsPrice && creates === 1) {
          expect(publication.content).toMatchObject({
            publicDescription: expect.stringContaining(
              'https://example.invalid',
            ),
          })
          publication = {
            ...publication,
            state: 'rejected',
            error: 'OLX_WRITE_REJECTED',
            errorFields: ['description:contact_links'],
          }
          return fulfillData(route, publication)
        }
        publication = {
          ...publication,
          revision: '33333333-3333-3333-3333-333333333333',
          state: 'linked',
          advertId: '456',
          observedStatus: editsPrice ? 'disabled' : 'new',
          checkedAt: '2026-11-19T11:50:00Z',
          url: 'https://www.olx.ua/d/uk/obyavlenie/test-456.html',
        }
        return fulfillData(route, publication)
      }
      if (path.endsWith('/remove')) {
        publication = {
          ...publication,
          revision: '44444444-4444-4444-4444-444444444444',
          state: 'remove_pending',
          removeRequested: true,
        }
        return fulfillData(route, publication)
      }
      if (path.endsWith('/refresh')) {
        refreshes++
        publication = {
          ...publication,
          revision: '55555555-5555-5555-5555-555555555555',
          state: publication.removeRequested ? 'removed' : 'linked',
          observedStatus: publication.removeRequested
            ? 'removed_by_user'
            : 'active',
          checkedAt: publication.removeRequested
            ? '2026-11-19T12:10:00Z'
            : '2026-11-19T12:00:00Z',
        }
        return fulfillData(route, publication)
      }
      if (path.endsWith('/preparation')) {
        if (editsPrice) await preparationReady
        return fulfillData(route, { part, suggestions: categories.slice(0, 2) })
      }
      if (path.endsWith('/categories')) return fulfillData(route, categories)
      if (path.endsWith('/attributes')) {
        attributeReads++
        if (editsPrice && attributeReads === 1)
          return route.fulfill({
            status: 503,
            json: {
              error: { code: 'OLX_UNAVAILABLE', message: 'Temporary outage' },
            },
          })
        return fulfillData(route, [
          {
            code: 'state',
            label: 'Стан',
            required: true,
            numeric: false,
            multiple: false,
            values: [{ code: 'used', label: 'Вживане' }],
          },
          {
            code: 'car_brand',
            label: 'Підходить для авто',
            required: false,
            numeric: false,
            multiple: true,
            values: [
              { code: 'vw', label: 'Volkswagen' },
              { code: 'audi', label: 'Audi' },
            ],
          },
          {
            code: 'compatibility_list',
            label: 'Список сумісності',
            required: false,
            numeric: false,
            multiple: false,
            values: [],
          },
        ])
      }
      if (path.endsWith('/cities'))
        return fulfillData(
          route,
          editsPrice
            ? [
                {
                  id: 2,
                  name: 'Дубляни',
                  region: 'Львівська область',
                  municipality: 'Самбірський',
                },
                {
                  id: 1,
                  name: 'Дубляни',
                  region: 'Львівська область',
                  municipality: 'Львівський',
                },
              ]
            : [{ id: 1, name: 'Київ', region: 'Київська область' }],
        )
      if (path.endsWith('/districts')) return fulfillData(route, [])
      if (path.endsWith('/preview')) {
        previews++
        expect(route.request().postDataJSON()).toMatchObject({
          categoryId: 2544,
          categoryConfirmed: true,
          attributes: editsPrice
            ? { state: ['used'], car_brand: ['vw', 'audi'] }
            : { state: ['used'] },
          cityId: 1,
          contactName: 'Synthetic seller',
        })
        return fulfillData(route, { part, category, issues: [] })
      }
      throw new Error(`Unexpected OLX route: ${path}`)
    })
    await page.route('**/api/v1/parts/search', (route) =>
      fulfillData(route, {
        items: [
          {
            id,
            name: 'Фара тестова',
            quantity: 1,
            quantityReserved: 0,
            quantityAvailable: 1,
            status: 'available',
            thumbnailUrl: 'https://images.example.test/a.jpg',
            car: null,
            externalCode: '5G1941006',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 6,
        totalPages: 1,
      }),
    )
    await page.route(`**/api/v1/parts/${id}`, (route) => {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON() as object
        if ('name' in body) {
          expect(body).toEqual({ name: 'Передня ліва фара Volkswagen Golf' })
          nameSaves++
          part.title = 'Передня ліва фара Volkswagen Golf'
        } else {
          expect(body).toEqual({ desiredSalePrice: 1350.5 })
          priceSaves++
          part.price = 1350.5
        }
      }
      return fulfillData(route, {
        id,
        name: editsPrice ? part.title : 'Фара тестова',
        effectiveSalePrice: part.price,
        desiredSalePrice: part.price,
        status: 'available',
        condition: 'good',
        oemCode: '5G1941006',
        quantityTotal: 1,
        quantityAvailable: 1,
        quantityReserved: 0,
        quantitySoldTotal: 0,
        photos: part.photos.map((url) => ({
          id: 'part-photo',
          url,
          sortOrder: 0,
        })),
      })
    })
    await page.route(`**/api/v1/parts/${id}/history`, (route) =>
      fulfillData(route, { events: [] }),
    )
    await page.route(`**/api/v1/parts/${id}/inventory-zones`, (route) =>
      fulfillData(route, []),
    )
    await page.route(`**/api/v1/parts/${id}/compatibilities`, (route) =>
      fulfillData(route, {
        items: [
          {
            id: 'verified-fitment',
            makeName: 'Rivian',
            modelName: 'R1T',
            yearFrom: 2022,
            yearTo: 2023,
            verificationStatus: 'verified',
          },
          {
            id: 'unverified-fitment',
            makeName: 'Ford',
            modelName: 'Fiesta',
            verificationStatus: 'unverified',
          },
        ],
      }),
    )
    await page.setViewportSize({ width: 1440, height: 1000 })
    await loginFrom(page)
    const overview = page.getByRole('link', { name: 'Огляд', exact: true })
    const olxTab = page
      .getByRole('navigation', { name: 'Розділи картки запчастини' })
      .getByRole('link', { name: 'OLX', exact: true })
    const sheet = page.getByRole(partCard ? 'region' : 'dialog', {
      name: 'Публікація OLX',
      exact: true,
    })
    if (partCard) {
      await page.goto(`/app/koval/parts/${id}`)
      await expect(overview).toHaveAttribute('aria-current', 'page')
      await expect(olxTab).toHaveAttribute('href', `/app/koval/parts/${id}/olx`)
      await page.setViewportSize({ width: 390, height: 1000 })
      await olxTab.click()
      await expect(page).toHaveURL(`/app/koval/parts/${id}/olx`)
      await expect(olxTab).toHaveAttribute('aria-current', 'page')
      await expect(
        page.getByRole('heading', {
          level: 1,
          name: editsPrice ? part.title : 'Фара тестова',
        }),
      ).toBeVisible()
      await expect(sheet).toBeVisible()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      if (linkExisting) {
        expect(reads).toBe(0)
        await sheet
          .getByRole('button', { name: 'Прив’язати оголошення OLX' })
          .click()
        const linkPage = page.getByRole('region', {
          name: 'Прив’язати оголошення OLX',
        })
        const confirm = linkPage.getByRole('button', {
          name: 'Підтвердити прив’язування',
        })
        await expect(confirm).toBeDisabled()
        await linkPage.getByRole('radio', { name: /Фара на OLX/ }).check()
        await expect(linkPage.getByText(/Телефон і місто/)).toBeVisible()
        const linkAccessibility = await new AxeBuilder({ page })
          .include('.rz-page')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
        expect(linkAccessibility.violations).toEqual([])
        await page.screenshot({ path: '/tmp/olx-part-link-mobile.png' })
        await confirm.click()
        await expect(linkPage).not.toBeVisible()
        await expect(sheet.getByText('№ 123', { exact: true })).toBeVisible()
        await expect(
          sheet.getByRole('button', { name: 'Прив’язати оголошення OLX' }),
        ).toHaveCount(0)
        await expect(sheet.getByText('Очікує оновлення OLX')).toBeVisible()
        await expect(page.getByRole('dialog')).toHaveCount(0)
        expect({ reads, links, creates, refreshes }).toEqual({
          reads: 1,
          links: 1,
          creates: 0,
          refreshes: 0,
        })
        await page.goto('/app/koval/olx')
        const row = page.getByRole('row', { name: /Фара тестова/ })
        await expect(row).toContainText(/1\s200,00\sUAH/)
        await row.getByText('Активне', { exact: true }).click()
        const advertSheet = page.getByRole('dialog', {
          name: 'Оголошення OLX',
          exact: true,
        })
        await expect(
          advertSheet.getByText('№ 123', { exact: true }),
        ).toBeVisible()
        await expect(
          advertSheet.getByText('Активне', { exact: true }),
        ).toBeVisible()
        await expect(
          advertSheet.getByRole('link', { name: 'Відкрити запчастину' }),
        ).toHaveAttribute('href', `/app/koval/parts/${id}`)
        await advertSheet
          .getByRole('button', { name: 'Редагувати опис' })
          .click()
        const description =
          'Опис оголошення, відредагований зі списку OLX. '.repeat(3)
        await advertSheet
          .getByRole('textbox', { name: 'Публічний опис' })
          .fill(description)
        await advertSheet
          .getByRole('button', { name: 'Зберегти зміни' })
          .click()
        await expect(
          advertSheet.getByText('Зміни збережено й передано на оновлення OLX.'),
        ).toBeVisible()
        expect(publication.content).toMatchObject({
          publicDescription: description,
        })
        await advertSheet
          .getByRole('button', { name: 'Інші дії з оголошенням OLX' })
          .click()
        await page.getByRole('menuitem', { name: 'Зняти з публікації' }).click()
        await page
          .getByRole('dialog', { name: 'Зняти оголошення з OLX' })
          .getByRole('button', { name: 'Зняти з публікації' })
          .click()
        await expect(
          advertSheet.getByText('Зняття очікує підтвердження OLX'),
        ).toBeVisible()
        await advertSheet
          .getByRole('button', { name: 'Оновити статус' })
          .click()
        await expect(
          advertSheet.getByText('Знято з публікації', { exact: true }),
        ).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(
          row.getByText('Зняте користувачем', { exact: true }),
        ).toBeVisible()
        await expect(
          row.getByRole('button', { name: /Фара тестова/ }),
        ).toBeFocused()
        expect(creates).toBe(0)
        return
      }
      const loadingForm = sheet.getByRole('region', {
        name: 'Завантажуємо форму публікації OLX',
      })
      try {
        await expect(loadingForm).toHaveAttribute('aria-busy', 'true')
        await expect(loadingForm.locator('.rz-skel').first()).toBeVisible()
        await expect(
          sheet.getByRole('button', { name: 'Перевірити дані' }),
        ).toHaveCount(0)
      } finally {
        releasePreparation()
      }
      await expect(loadingForm).toHaveCount(0)
      await expect(
        sheet.getByRole('heading', { level: 3 }).filter({
          hasText:
            /Назва запчастини|Категорія та характеристики|Продавець і місцезнаходження|Ціна та фото/,
        }),
      ).toHaveText([
        'Назва запчастини',
        'Категорія та характеристики',
        'Продавець і місцезнаходження',
        'Ціна та фото',
      ])
      await expect(
        sheet.getByRole('alert').filter({ hasText: 'Бракує ще 1.' }),
      ).toBeVisible()
      const pricingPanel = sheet.getByRole('region', { name: 'Ціна та фото' })
      await expect(
        pricingPanel.getByText('Не вказано', { exact: true }),
      ).toBeVisible()
      await expect(
        sheet.locator('.rz-card__foot').getByRole('status'),
      ).toHaveText('Чернетка')
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.screenshot({
        path: '/tmp/olx-part-draft-redesign-desktop.png',
      })
      await page.setViewportSize({ width: 390, height: 1000 })
      const categoryPicker = sheet.getByRole('button', {
        name: 'Категорія OLX',
        exact: true,
      })
      const checklist = sheet.getByRole('region', {
        name: 'Залишилося заповнити',
      })
      await checklist.getByRole('button', { name: 'Оберіть категорію' }).click()
      await expect(categoryPicker).toBeFocused()
      await categoryPicker.click()
      const categoryOptions = page.getByRole('listbox').locator('..')
      if (testInfo.project.use.hasTouch) {
        await categoryOptions
          .getByRole('option')
          .last()
          .scrollIntoViewIfNeeded()
      } else {
        await categoryOptions.hover()
        await page.mouse.wheel(0, 420)
      }
      await expect
        .poll(() => categoryOptions.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)
      await page.keyboard.press('Escape')
      await expect(categoryPicker).toBeFocused()
      await expect(
        sheet.getByRole('button', { name: 'Перевірити дані' }),
      ).toBeVisible()
      await checklist.getByRole('button', { name: 'Додайте ціну' }).click()
      const priceInput = sheet.getByRole('textbox', { name: 'Ціна продажу' })
      await expect(priceInput).toBeFocused()
      await expect(
        sheet.getByRole('button', { name: 'Перевірити дані' }),
      ).toBeDisabled()
      await priceInput.fill('1350,50')
      await sheet.getByRole('button', { name: 'Зберегти', exact: true }).click()
      await expect(priceInput).toHaveCount(0)
      await expect(
        checklist.getByRole('button', { name: 'Додайте ціну' }),
      ).toHaveCount(0)
      expect(priceSaves).toBe(1)
      const descriptionInput = sheet.getByRole('textbox', {
        name: 'Публічний опис',
        exact: true,
      })
      const fillDescription = sheet.getByRole('button', {
        name: 'Заповнити з картки',
      })
      await fillDescription.click()
      await expect(descriptionInput).toHaveValue(
        'Цапфа RL Rivian\nСтан — Хороший.\nOEM 5G1941006\n\nПідтверджена сумісність\nRivian R1T (2022 – 2023)',
      )
      await expect(descriptionInput).toBeFocused()
      await expect(fillDescription).toHaveCount(0)
      await descriptionInput.clear()
      await checklist.getByRole('button', { name: 'Заповніть опис' }).click()
      await expect(descriptionInput).toBeFocused()
      await descriptionInput.fill('Опис, який уже введено у чернетці.')
      await checklist.getByRole('button', { name: 'Виправте назву' }).click()
      const nameInput = sheet.getByRole('textbox', { name: 'Назва запчастини' })
      await expect(nameInput).toBeFocused()
      await nameInput.fill('Фара')
      await expect(nameInput).toHaveAccessibleDescription(/Бракує ще 12\./)
      const saveName = sheet.getByRole('button', {
        name: 'Зберегти',
        exact: true,
      })
      await expect(saveName).toBeDisabled()
      expect(nameSaves).toBe(0)
      await expect(nameInput).toBeVisible()
      await nameInput.fill('Передня ліва фара Volkswagen Golf')
      await expect(nameInput).not.toHaveAccessibleDescription(/Бракує/)
      await saveName.click()
      await expect(nameInput).toHaveCount(0)
      await expect(
        checklist.getByRole('button', { name: 'Виправте назву' }),
      ).toHaveCount(0)
      expect(nameSaves).toBe(1)
      await expect(descriptionInput).toHaveValue(
        'Опис, який уже введено у чернетці.',
      )
      await expect(
        sheet.getByText('Оголошення можна опублікувати без фото.'),
      ).toBeVisible()
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      )
      await page.screenshot({ path: '/tmp/olx-part-compact-mobile.png' })
      await page.setViewportSize({ width: 1440, height: 1000 })
    } else {
      await page.goto('/app/koval/settings/integrations/olx')
      const workspaceLink = page.getByRole('link', {
        name: 'Відкрити розділ OLX',
      })
      await expect(workspaceLink).toHaveAttribute('href', '/app/koval/olx')
      expect(reads).toBe(0)
      await workspaceLink.click()
      await expect(page).toHaveURL(/\/app\/koval\/olx$/)
      await expect(
        page.getByRole('button', { name: 'Відключити акаунт' }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('link', { name: '№ 123', exact: true }),
      ).toBeVisible()
      if (!writeAccess) {
        await page
          .getByRole('button', { name: 'Фара на OLX', exact: true })
          .click()
        const advertSheet = page.getByRole('dialog', {
          name: 'Оголошення OLX',
          exact: true,
        })
        await expect(
          advertSheet.getByRole('link', { name: 'Перейти до прив’язування' }),
        ).toBeVisible()
        await expect(
          advertSheet.getByRole('button', {
            name: 'Інші дії з оголошенням OLX',
          }),
        ).toHaveCount(0)
        await page.keyboard.press('Escape')
      }
      if (writeAccess) {
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 1000 })
          await expect(
            page.getByRole('table', { name: 'Оголошення цього акаунта' }),
          ).toBeVisible()
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
          ).toBe(true)
          await page.screenshot({
            path: `/tmp/olx-redesign-adverts-${width}.png`,
          })
        }
        await page.setViewportSize({ width: 1440, height: 1000 })
      }
      await page
        .getByRole('button', { name: 'Підготувати публікацію', exact: true })
        .click()
      const partPicker = page.getByRole('dialog', {
        name: 'Підготовка запчастини',
        exact: true,
      })
      const partSearch = partPicker.getByRole('searchbox', {
        name: 'Пошук запчастини',
      })
      await partSearch.fill('Фара')
      const partResults = partPicker.getByRole('dialog', {
        name: 'Результати пошуку запчастин',
      })
      const matchingPart = partResults.getByRole('option', {
        name: /Фара тестова/,
      })
      await expect(matchingPart).toBeVisible()
      await expect(matchingPart).toContainText('В наявності')
      await expect(matchingPart).toContainText('5G1941006')
      await expect(matchingPart.locator('img')).toHaveCount(0)
      if (writeAccess) {
        await page.screenshot({
          path: '/tmp/olx-order-part-picker-desktop.png',
        })
        await page.setViewportSize({ width: 390, height: 844 })
        expect((await partSearch.boundingBox())?.y).toBeLessThan(
          (await matchingPart.boundingBox())!.y,
        )
        await expect(partResults).toBeInViewport({ ratio: 1 })
        await page.screenshot({ path: '/tmp/olx-order-part-picker-mobile.png' })
      }
      await matchingPart.click()
      if (writeAccess) {
        await sheet
          .getByRole('button', { name: 'Підготовка запчастини' })
          .click()
        await expect(partSearch).toHaveValue('Фара')
        await expect(partSearch).toBeFocused()
        await expect(matchingPart).toBeVisible()
        await matchingPart.click()
        await page.setViewportSize({ width: 1440, height: 1000 })
      }
    }
    await expect(
      editsPrice
        ? sheet
            .getByRole('region', { name: 'Назва запчастини' })
            .getByText(part.title, { exact: true })
        : sheet.getByRole('heading', { name: part.title, exact: true }),
    ).toBeVisible()
    const suggestedCategory = sheet.getByRole('button', {
      name: /^Фари.*Запчастини/,
    })
    await suggestedCategory.click()
    if (editsPrice) {
      await expect(
        sheet.getByText(/Не вдалося завантажити характеристики/),
      ).toBeVisible()
      await sheet.getByRole('button', { name: 'Спробувати ще раз' }).click()
      await expect(suggestedCategory).toHaveAttribute('aria-pressed', 'true')
      const otherCategory = sheet.getByRole('button', {
        name: /^Ліхтарі.*Запчастини/,
      })
      await expect(otherCategory).toHaveAttribute('aria-pressed', 'false')
      const unselectedBorder = await otherCategory.evaluate(
        (item) => getComputedStyle(item).borderTopColor,
      )
      await expect(suggestedCategory).not.toHaveCSS(
        'border-top-color',
        unselectedBorder,
      )
    }
    await sheet.getByRole('button', { name: 'Стан', exact: true }).click()
    await page.getByRole('option', { name: 'Вживане', exact: true }).click()
    const compatibility = sheet.getByRole('textbox', {
      name: 'Список сумісності',
    })
    await expect(compatibility).toHaveValue('')
    await expect(compatibility).toHaveAttribute('readonly', '')
    await expect(compatibility).toHaveAccessibleDescription(
      /Залиште поле порожнім.*публічному описі/,
    )
    if (editsPrice) {
      const brands = sheet.getByRole('button', { name: 'Підходить для авто' })
      await brands.click()
      const vw = page.getByRole('option', { name: 'Volkswagen', exact: true })
      const audi = page.getByRole('option', { name: 'Audi', exact: true })
      await vw.click()
      await audi.click()
      await expect(vw).toHaveAttribute('aria-selected', 'true')
      await expect(audi).toHaveAttribute('aria-selected', 'true')
      await brands.click()
      await expect(brands).toContainText('Volkswagen, Audi')
    }
    await page
      .getByRole('textbox', { name: 'Публічний опис', exact: true })
      .fill(
        'Передня фара Volkswagen Golf. Вживана оригінальна запчастина. Стан і комплектність перевіряйте за фотографіями.' +
          (editsPrice ? ' Більше інформації на https://example.invalid.' : ''),
      )
    await sheet
      .getByRole('button', { name: 'Тип продавця', exact: true })
      .click()
    await page.getByRole('option', { name: 'Бізнес', exact: true }).click()
    await page
      .getByLabel('Ім’я контактної особи', { exact: true })
      .fill('Synthetic seller')
    await page.getByRole('button', { name: 'Місто OLX', exact: true }).click()
    await page
      .getByRole('searchbox', { name: 'Введіть від двох літер назви міста' })
      .fill(editsPrice ? 'Дубляни' : 'Київ')
    if (editsPrice) {
      await expect(
        page.getByRole('option', {
          name: 'Дубляни · Самбірський · Львівська область',
        }),
      ).toBeVisible()
      await page.screenshot({ path: '/tmp/olx-drawer-city-choices.png' })
    }
    await page
      .getByRole('option', {
        name: editsPrice
          ? 'Дубляни · Львівський · Львівська область'
          : 'Київ · Київська область',
      })
      .click()
    await expect(
      sheet.getByRole('region', { name: 'Залишилося заповнити' }),
    ).toHaveCount(0)
    await page
      .getByRole('button', { name: 'Перевірити дані', exact: true })
      .click()
    await expect(
      page.getByText('Структурна перевірка пройшла', { exact: true }),
    ).toBeVisible()
    expect(reads).toBe(partCard ? 0 : 1)
    expect(previews).toBe(1)
    if (editsPrice) {
      const identity = sheet
        .getByRole('region', { name: 'Категорія та характеристики' })
        .locator('..')
      const seller = sheet.getByRole('region', {
        name: 'Продавець і місцезнаходження',
      })
      const pricing = sheet.getByRole('region', { name: 'Ціна та фото' })
      const description = sheet.getByRole('region', {
        name: 'Дані для публікації',
      })

      const left = (await identity.boundingBox())!
      const right = (await seller.locator('..').boundingBox())!
      const sellerBox = (await seller.boundingBox())!
      const priceBox = (await pricing.boundingBox())!
      const descriptionBox = (await description.boundingBox())!
      expect(right.x).toBeGreaterThan(left.x + left.width)
      expect(right.width).toBeCloseTo(left.width)
      expect(right.y).toBeCloseTo(left.y)
      expect(priceBox.y).toBeCloseTo(sellerBox.y + sellerBox.height)
      expect(descriptionBox.y).toBeCloseTo(priceBox.y + priceBox.height)

      await page.setViewportSize({ width: 390, height: 1000 })
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      )
      let previousBottom = 0
      for (const panel of [identity, seller, pricing, description]) {
        const box = (await panel.boundingBox())!
        expect(box.y).toBeGreaterThanOrEqual(previousBottom)
        previousBottom = box.y + box.height
      }
      await page.setViewportSize({ width: 1440, height: 1000 })
      await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: 'instant' }),
      )
      await page.screenshot({ path: '/tmp/olx-part-compact-desktop.png' })
      expect(attributeReads).toBe(2)
    }
    await expect(
      page.getByRole('button', { name: 'Опублікувати', exact: true }),
    ).toHaveCount(0)
    if (writeAccess) {
      await page
        .getByRole('button', { name: 'Опублікувати на OLX', exact: true })
        .click()
      expect(creates).toBe(0)
      const publishDialog = page.getByRole('dialog', {
        name: 'Створити оголошення в OLX',
      })
      await expect(publishDialog).toContainText(part.title)
      if (editsPrice) await expect(publishDialog).toContainText(/1\s?350[,.]50/)
      await publishDialog
        .getByRole('button', { name: 'Опублікувати на OLX', exact: true })
        .click()
      if (editsPrice) {
        try {
          await expect(
            publishDialog.getByText('Надсилаємо оголошення в OLX…'),
          ).toBeVisible()
          await expect(
            publishDialog.getByRole('button', {
              name: 'Опублікувати на OLX',
              exact: true,
            }),
          ).toBeDisabled()
        } finally {
          releasePublish()
        }
        const description = sheet.getByRole('textbox', {
          name: 'Публічний опис',
          exact: true,
        })
        await expect(publishDialog).not.toBeVisible()
        await expect(description).toHaveAttribute('aria-invalid', 'true')
        await expect(description).toHaveAccessibleDescription(
          /Приберіть посилання/,
        )
        expect(creates).toBe(1)
        await description.fill(
          'Вживана оригінальна передня фара Volkswagen Golf. Стан і комплектність перевіряйте за фотографіями.',
        )
        await expect(description).not.toHaveAttribute('aria-invalid', 'true')
        await sheet.getByRole('button', { name: 'Перевірити дані' }).click()
        await expect(
          sheet.getByText('Структурна перевірка пройшла'),
        ).toBeVisible()
        await sheet
          .getByRole('button', { name: 'Опублікувати на OLX', exact: true })
          .click()
        await publishDialog
          .getByRole('button', { name: 'Опублікувати на OLX', exact: true })
          .click()
        expect(previews).toBe(2)
      }
      const advertStatus = sheet.getByRole('region', {
        name: 'Статус оголошення OLX',
      })
      await expect(
        advertStatus.getByText(editsPrice ? 'Вимкнене' : 'На модерації', {
          exact: true,
        }),
      ).toBeVisible()
      await expect(advertStatus.getByText('Остання перевірка')).toBeVisible()
      await expect(advertStatus.locator('time')).toHaveAttribute(
        'datetime',
        '2026-11-19T11:50:00Z',
      )
      expect(refreshes).toBe(0)
      await advertStatus.getByRole('button', { name: 'Оновити статус' }).click()
      await expect(
        advertStatus.getByText('Активне', { exact: true }),
      ).toBeVisible()
      await expect(advertStatus.locator('time')).toHaveAttribute(
        'datetime',
        '2026-11-19T12:00:00Z',
      )
      expect(refreshes).toBe(1)
      await expect(sheet.getByText('№ 456', { exact: true })).toBeVisible()
      await expect(
        sheet.getByRole('link', { name: 'Відкрити на OLX' }),
      ).toBeVisible()
      await expect(
        sheet.getByRole('button', { name: 'Перевірити дані' }),
      ).toHaveCount(0)
      if (editsPrice) {
        await page.screenshot({ path: '/tmp/olx-publication-result.png' })
      }
      expect(creates).toBe(editsPrice ? 2 : 1)
      await sheet.getByRole('button', { name: 'Редагувати опис' }).click()
      const changedDescription = 'Оновлений публічний опис запчастини. '.repeat(
        4,
      )
      await expect(
        page.getByRole('textbox', { name: 'Публічний опис', exact: true }),
      ).toBeEnabled()
      await page
        .getByRole('textbox', { name: 'Публічний опис', exact: true })
        .fill(changedDescription)
      await page
        .getByRole('button', { name: 'Зберегти зміни', exact: true })
        .click()
      await expect(
        page.getByText('Зміни збережено й передано на оновлення OLX.', {
          exact: true,
        }),
      ).toBeVisible()
      expect(publication.content).toMatchObject({
        publicDescription: changedDescription,
      })
      expect(creates).toBe(editsPrice ? 2 : 1)
      await expect(
        page.getByRole('button', { name: 'Опублікувати на OLX', exact: true }),
      ).toHaveCount(0)
      if (partCard)
        await expect(
          sheet.getByRole('button', { name: 'Редагувати опис' }),
        ).toBeVisible()
      await page
        .getByRole('button', { name: 'Інші дії з оголошенням OLX' })
        .click()
      await page
        .getByRole('menuitem', { name: 'Зняти з публікації', exact: true })
        .click()
      await page
        .getByRole('dialog', { name: 'Зняти оголошення з OLX' })
        .getByRole('button', { name: 'Зняти з публікації', exact: true })
        .click()
      await expect(
        sheet.getByText('Зняття очікує підтвердження OLX', {
          exact: true,
        }),
      ).toBeVisible()
      expect(refreshes).toBe(1)
      await page
        .getByRole('button', {
          name: 'Оновити статус',
          exact: true,
        })
        .click()
      await expect(
        sheet.getByText('Знято з публікації', { exact: true }),
      ).toBeVisible()
      expect(creates).toBe(editsPrice ? 2 : 1)
    } else
      await expect(
        page.getByRole('button', { name: 'Опублікувати на OLX', exact: true }),
      ).toBeDisabled()
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      if (partCard) await expect(sheet).toBeVisible()
      else
        await expect(
          page.getByRole('heading', { name: part.title, exact: true }),
        ).toBeVisible()
      const a11y = await new AxeBuilder({ page })
        .include(partCard ? '.rz-page' : '.rz-sheet')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
      expect(a11y.violations).toEqual([])
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      await page.screenshot({
        path: `/tmp/olx-live-${partCard ? 'part-card' : 'preparation'}-${writeAccess}-${width}.png`,
        fullPage: true,
      })
    }
    if (partCard) {
      await overview.click()
      await expect(page).toHaveURL(`/app/koval/parts/${id}`)
      await expect(
        page.getByRole('region', { name: 'Фото', exact: true }),
      ).toBeVisible()
      await page.goBack()
      await expect(olxTab).toHaveAttribute('aria-current', 'page')
      await expect(
        sheet.getByText('Знято з публікації', { exact: true }),
      ).toBeVisible()
      await page.reload()
      await expect(
        sheet.getByText('Знято з публікації', { exact: true }),
      ).toBeVisible()
    } else {
      await page.keyboard.press('Escape')
      await expect(sheet).toHaveCount(0)
      await expect(
        page.getByRole('button', {
          name: 'Підготувати публікацію',
          exact: true,
        }),
      ).toBeFocused()
    }
  })
