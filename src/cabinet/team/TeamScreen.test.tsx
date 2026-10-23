/* eslint-disable @typescript-eslint/unbound-method -- Vitest resolves object methods into typed mocks. */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import { LocaleProvider, type Locale } from '@/i18n'
import { ALL_PERMISSIONS } from '../access-types'
import {
  teamApi,
  type InvitationDto,
  type RoleDto,
  type TeamMemberDto,
} from '@/api/team'
import { useCabinet, type CabinetContextValue } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { tenantRequestScope } from '../tenant-request-scope'
import { roleLabel } from './messages'
import { TeamScreen } from './TeamScreen'

vi.mock('@/api/team', () => ({
  teamApi: {
    listMembers: vi.fn(),
    getMember: vi.fn(),
    changeRole: vi.fn(),
    deactivateMember: vi.fn(),
    activateMember: vi.fn(),
    deleteMember: vi.fn(),
    listRoles: vi.fn(),
    getRole: vi.fn(),
    createRole: vi.fn(),
    updateRole: vi.fn(),
    deleteRole: vi.fn(),
    getUserPermissions: vi.fn(),
    updateUserPermissions: vi.fn(),
    listInvitations: vi.fn(),
    createInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  },
}))
vi.mock('../CabinetContext', () => ({ useCabinet: vi.fn() }))

const ownerRole: RoleDto = {
  id: 'role-owner',
  name: 'Owner',
  isSystem: true,
  permissions: ['team.view', 'team.manage'],
  membersCount: 1,
}

const mechanicRole: RoleDto = {
  id: 'role-mechanic',
  name: 'Механік',
  isSystem: false,
  permissions: ['parts.view'],
  membersCount: 1,
}

const managerRole: RoleDto = {
  id: 'role-manager',
  name: 'Менеджер',
  isSystem: true,
  permissions: ['team.view'],
  membersCount: 0,
}

const member: TeamMemberDto = {
  id: 'member-1',
  userId: 'user-1',
  name: 'Олена',
  phone: '+380501112233',
  role: mechanicRole,
  isActive: true,
  joinedAt: '2026-08-01T10:00:00Z',
}

const invitation = (overrides: Partial<InvitationDto> = {}): InvitationDto => ({
  id: 'invite-1',
  code: 'INVITE-1',
  role: mechanicRole,
  expiresAt: '2026-09-01T10:00:00Z',
  createdAt: '2026-08-01T10:00:00Z',
  isUsed: false,
  isRevoked: false,
  isExpired: false,
  ...overrides,
})

const cabinet = (permissions = ['team.view', 'team.manage']) =>
  ({
    status: 'ready',
    targetTenant: {
      id: 'tenant-1',
      name: 'Koval Auto',
      slug: 'koval',
      plan: 'trial',
      planTier: 'pro',
      city: null,
      logoUrl: null,
      isActive: true,
      createdAt: '2026-08-01T10:00:00Z',
      roleName: 'owner',
      requireDeliveryDeposit: true,
    },
    snapshot: {
      userId: 'user-owner',
      tenantId: 'tenant-1',
      generation: 1,
      role: 'owner',
      permissions: new Set(permissions),
      features: new Set<string>(),
      entitlement: null,
      subscription: null,
    },
    error: null,
    retry: vi.fn(),
    switchTenant: vi.fn(),
  }) satisfies CabinetContextValue

/** `useOperation` reports through the toast api the cabinet shell provides. */
const teamScreen = () => (
  <MemoryRouter initialEntries={['/app/garage/team']}>
    <ToastProvider>
      <TeamScreen definition={cabinetModules.team} />
    </ToastProvider>
  </MemoryRouter>
)
const renderScreen = () => render(teamScreen())

afterEach(() => vi.restoreAllMocks())

/** The member row keeps its actions in a menu, as the design has it. */
const openMemberMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  name: string,
) => {
  await user.click(
    await screen.findByRole('button', { name: `Дії з учасником ${name}` }),
  )
  return within(await screen.findByRole('menu'))
}

const chooseRole = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  roleName: string,
) => {
  await user.click(await screen.findByRole('button', { name: label }))
  await user.click(screen.getByRole('option', { name: roleName }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
}

const openRoleEditor = async (
  user: ReturnType<typeof userEvent.setup>,
  name = 'Олена',
) => {
  await user.click(
    (await openMemberMenu(user, name)).getByRole('menuitem', {
      name: 'Змінити роль',
    }),
  )
  return within(await screen.findByRole('dialog', { name: 'Змінити роль' }))
}

const assignRole = async (
  user: ReturnType<typeof userEvent.setup>,
  roleName: string,
) => {
  const editor = await openRoleEditor(user)
  await chooseRole(user, 'Роль для Олена', roleName)
  await user.click(editor.getByRole('button', { name: 'Зберегти' }))
}

const openInvitationMenu = async (
  user: ReturnType<typeof userEvent.setup>,
  code = 'INVITE-1',
) => {
  await user.click(
    await screen.findByRole('button', {
      name: `Дії із запрошенням ${code}`,
    }),
  )
  return within(await screen.findByRole('menu'))
}

/** The verb at the end of the confirmation's footer: «Вимкнути», «Відкликати»… */
const confirmButton = () => {
  const buttons = within(screen.getByRole('dialog')).getAllByRole('button')
  return buttons[buttons.length - 1]!
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.clearAllMocks()
  tenantRequestScope.rotate()
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(teamApi.listMembers).mockResolvedValue([member])
  vi.mocked(teamApi.listRoles).mockResolvedValue([
    ownerRole,
    mechanicRole,
    managerRole,
  ])
  vi.mocked(teamApi.listInvitations).mockResolvedValue([invitation()])
  vi.mocked(teamApi.changeRole).mockResolvedValue({
    ...member,
    role: managerRole,
  })
  vi.mocked(teamApi.deactivateMember).mockResolvedValue(undefined)
  vi.mocked(teamApi.activateMember).mockResolvedValue(undefined)
  vi.mocked(teamApi.deleteMember).mockResolvedValue(undefined)
  vi.mocked(teamApi.createRole).mockResolvedValue(mechanicRole)
  vi.mocked(teamApi.updateRole).mockResolvedValue(mechanicRole)
  vi.mocked(teamApi.deleteRole).mockResolvedValue(undefined)
  vi.mocked(teamApi.getUserPermissions).mockResolvedValue({
    userId: 'user-1',
    roleName: 'Механік',
    permissions: ['parts.view'],
  })
  vi.mocked(teamApi.updateUserPermissions).mockResolvedValue({
    userId: 'user-1',
    roleName: 'Механік',
    permissions: ['parts.view'],
  })
  vi.mocked(teamApi.createInvitation).mockResolvedValue(invitation())
  vi.mocked(teamApi.revokeInvitation).mockResolvedValue(undefined)
})

it('opens billing from the team seat limit link', async () => {
  const router = createMemoryRouter(
    [
      {
        path: '/app/:tenant',
        children: [
          {
            path: 'team',
            element: <TeamScreen definition={cabinetModules.team} />,
          },
          {
            path: 'settings/billing/overview',
            element: <p>Екран підписки</p>,
          },
        ],
      },
    ],
    { initialEntries: ['/app/koval/team'] },
  )
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
  )

  await user.click(await screen.findByRole('link', { name: 'Збільшити ліміт' }))

  await waitFor(() =>
    expect(router.state.location.pathname).toBe(
      '/app/koval/settings/billing/overview',
    ),
  )
  expect(screen.getByText('Екран підписки')).toBeVisible()
})

it('loads the member, role, and invitation lifecycle with tenant cancellation', async () => {
  renderScreen()

  expect(
    await screen.findByRole('heading', { name: 'Команда' }),
  ).toBeInTheDocument()
  expect(await screen.findByText('Олена')).toBeInTheDocument()
  const memberRow = screen
    .getByRole('rowheader', { name: /Олена/ })
    .closest('tr')!
  expect(within(memberRow).getByText('Механік')).toBeVisible()
  expect(
    within(memberRow).queryByRole('button', { name: 'Роль для Олена' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('Активне')).toBeInTheDocument()
  expect(teamApi.listMembers).toHaveBeenCalledWith({
    signal: tenantRequestScope.signal,
  })
  expect(teamApi.listRoles).toHaveBeenCalledWith({
    signal: tenantRequestScope.signal,
  })
  expect(teamApi.listInvitations).toHaveBeenCalledWith({
    signal: tenantRequestScope.signal,
  })

  const options = vi.mocked(teamApi.listMembers).mock.calls[0]?.[0]
  tenantRequestScope.rotate()
  expect(options?.signal?.aborted).toBe(true)
})

it.each(['code', 'icon', 'keyboard'])(
  'copies the exact invitation code using the %s',
  async (target) => {
    const user = userEvent.setup()
    const writeText = vi
      .spyOn(navigator.clipboard, 'writeText')
      .mockResolvedValue()
    renderScreen()
    const button = await screen.findByRole('button', {
      name: 'Копіювати код запрошення INVITE-1',
    })
    if (target === 'code')
      await user.click(within(button).getByText('INVITE-1'))
    else if (target === 'icon') await user.click(button.querySelector('svg')!)
    else {
      button.focus()
      await user.keyboard('{Enter}')
    }
    expect(writeText).toHaveBeenCalledWith('INVITE-1')
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Код запрошення скопійовано.',
    )
  },
)

it('shows a clipboard failure without claiming that the invitation was copied', async () => {
  const user = userEvent.setup()
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
    new Error('Denied'),
  )
  renderScreen()
  await user.click(
    await screen.findByRole('button', {
      name: 'Копіювати код запрошення INVITE-1',
    }),
  )
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося скопіювати код запрошення.',
  )
  expect(
    screen.queryByText('Код запрошення скопійовано.'),
  ).not.toBeInTheDocument()
})

it('shows actual last activity instead of the join date', async () => {
  vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-21T12:00:00Z'))
  vi.mocked(teamApi.listMembers).mockResolvedValue([
    { ...member, lastActiveAt: '2026-10-21T08:00:00Z' },
    {
      ...member,
      id: 'yesterday',
      userId: 'yesterday',
      name: 'Учора',
      lastActiveAt: '2026-10-20T08:00:00Z',
    },
    {
      ...member,
      id: 'old',
      userId: 'old',
      name: 'Давно',
      lastActiveAt: '2026-09-01T08:00:00Z',
    },
  ])
  renderScreen()
  expect(await screen.findByText('Сьогодні')).toBeVisible()
  expect(screen.getByText('Вчора')).toBeVisible()
  expect(screen.getByText('01.09.2026')).toBeVisible()
  expect(screen.queryByText(/У команді з/)).not.toBeInTheDocument()
})

it('paginates members and resets the page when filtering by role or search', async () => {
  const user = userEvent.setup()
  vi.mocked(teamApi.listMembers).mockResolvedValue(
    Array.from({ length: 25 }, (_, i) => ({
      ...member,
      id: `member-${i}`,
      userId: `user-${i}`,
      name: `Учасник ${i + 1}`,
      role: i === 24 ? managerRole : mechanicRole,
    })),
  )
  renderScreen()
  expect(await screen.findByText('Учасник 1')).toBeVisible()
  expect(screen.queryByText('Учасник 21')).not.toBeInTheDocument()
  const pager = screen.getByRole('navigation', { name: 'Пагінація учасників' })
  await user.click(
    within(pager).getByRole('button', { name: 'Наступна сторінка' }),
  )
  expect(screen.getByText('Учасник 21')).toBeVisible()
  await chooseRole(user, 'Фільтр за роллю', 'Менеджер')
  expect(screen.getByText('Учасник 25')).toBeVisible()
  expect(screen.queryByText('Учасник 21')).not.toBeInTheDocument()
  expect(within(pager).getByText('1–1 з 1')).toBeVisible()
  await chooseRole(user, 'Фільтр за роллю', 'Усі ролі')
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук учасників' }),
    'Учасник 25',
  )
  expect(screen.getByText('Учасник 25')).toBeVisible()
  expect(within(pager).getByText('1–1 з 1')).toBeVisible()
})

it('marks invitation lifecycle states and only allows revoking active invitations', async () => {
  const longCode =
    '3870f3f5ecb1dbab378027dd9299c57988085d4d7b80054a7a8156cf523e87db'
  vi.mocked(teamApi.listInvitations).mockResolvedValue([
    invitation({ id: 'active' }),
    invitation({ id: 'used', code: longCode, isUsed: true }),
    invitation({ id: 'revoked', isRevoked: true }),
    invitation({ id: 'expired', isExpired: true }),
  ])

  const user = userEvent.setup()
  renderScreen()

  await user.click(
    await screen.findByRole('button', { name: 'Історія запрошень (3)' }),
  )
  expect(screen.getByText('Використано')).toBeInTheDocument()
  expect(screen.getByText('Відкликано')).toBeInTheDocument()
  expect(screen.getByText('Прострочено')).toBeInTheDocument()
  expect(
    screen.getAllByRole('button', { name: /^Дії із запрошенням/ }),
  ).toHaveLength(1)
  const longCodeLabel = screen.getByText(longCode)
  expect(longCodeLabel).toHaveClass('truncate')
  expect(longCodeLabel).toHaveAttribute('title', longCode)
  expect(longCodeLabel.closest('li')).toHaveClass('max-w-full', 'min-w-0')
})

it('removes role management from the team screen', async () => {
  renderScreen()

  expect(await screen.findByText('Олена')).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Ролі й доступи' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Створити роль' })).toBeNull()
})

it('keeps completed invitations collapsed until their history is opened', async () => {
  vi.mocked(teamApi.listInvitations).mockResolvedValue([
    invitation({ id: 'active', code: 'ACTIVE-CODE' }),
    invitation({ id: 'used', code: 'USED-CODE', isUsed: true }),
    invitation({ id: 'expired', code: 'OLD-CODE', isExpired: true }),
  ])
  const user = userEvent.setup()
  renderScreen()

  expect(await screen.findByText('ACTIVE-CODE')).toBeVisible()
  expect(screen.queryByText('USED-CODE')).toBeNull()
  expect(screen.queryByText('OLD-CODE')).toBeNull()

  await user.click(
    screen.getByRole('button', { name: 'Історія запрошень (2)' }),
  )

  expect(screen.getByText('USED-CODE')).toBeVisible()
  expect(screen.getByText('OLD-CODE')).toBeVisible()
})

it('hides every mutation control without team.manage', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['team.view']))

  renderScreen()

  expect(await screen.findByText('Олена')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', {
      name: /Вимкнути|Активувати|Видалити|Права|Створити|Відкликати/,
    }),
  ).toBeNull()
  expect(screen.queryByLabelText('Роль для Олена')).toBeNull()
  expect(screen.queryByLabelText('Назва нової ролі')).toBeNull()
})

it('revalidates team.manage immediately before creating an invitation', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await screen.findByText('Олена')
  await user.click(screen.getByRole('button', { name: 'Запросити' }))
  const createInvitation = screen.getByRole('button', {
    name: 'Створити запрошення',
  })
  currentCabinet.snapshot?.permissions.delete('team.manage')

  await user.click(createInvitation)

  expect(teamApi.createInvitation).not.toHaveBeenCalled()
})

it('confirms and completes member, role, permission, and invitation mutations', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await screen.findByText('Олена')
  await assignRole(user, 'Менеджер')
  await waitFor(() =>
    expect(teamApi.changeRole).toHaveBeenCalledWith(
      'member-1',
      'role-manager',
      {
        signal: tenantRequestScope.signal,
      },
    ),
  )

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Права',
    }),
  )
  await screen.findByRole('dialog', { name: 'Права: Олена' })
  await user.click(screen.getByRole('button', { name: 'Зберегти права' }))
  expect(teamApi.updateUserPermissions).toHaveBeenCalledWith(
    'user-1',
    ['parts.view'],
    { signal: tenantRequestScope.signal },
  )

  await user.click(
    (await openInvitationMenu(user)).getByRole('menuitem', {
      name: 'Відкликати',
    }),
  )
  expect(screen.getByRole('dialog')).toHaveTextContent('Відкликати запрошення')
  await user.click(confirmButton())
  expect(teamApi.revokeInvitation).toHaveBeenCalledWith('invite-1', {
    signal: tenantRequestScope.signal,
  })
  expect(currentCabinet.retry).toHaveBeenCalledTimes(3)
})

it('does not load or render team data without team.view', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet(['parts.view']))

  renderScreen()

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Недостатньо прав для перегляду команди.',
  )
  expect(teamApi.listMembers).not.toHaveBeenCalled()
  expect(teamApi.listRoles).not.toHaveBeenCalled()
  expect(teamApi.listInvitations).not.toHaveBeenCalled()
  expect(screen.queryByText('Олена')).toBeNull()
})

it('clears old tenant data, aborts stale work, and starts a new load on tenant generation change', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const secondMember = { ...member, id: 'member-2', name: 'Іван' }
  vi.mocked(teamApi.listMembers)
    .mockResolvedValueOnce([member])
    .mockResolvedValueOnce([secondMember])
  vi.mocked(teamApi.listRoles)
    .mockResolvedValueOnce([ownerRole, mechanicRole])
    .mockResolvedValueOnce([ownerRole, mechanicRole])
  vi.mocked(teamApi.listInvitations)
    .mockResolvedValueOnce([invitation()])
    .mockResolvedValueOnce([invitation({ id: 'invite-2' })])
  const view = renderScreen()

  expect(await screen.findByText('Олена')).toBeInTheDocument()
  const previousSignal = vi.mocked(teamApi.listMembers).mock.calls[0]?.[0]
  currentCabinet.targetTenant = {
    ...currentCabinet.targetTenant,
    id: 'tenant-2',
    slug: 'other-garage',
  }
  currentCabinet.snapshot = {
    ...currentCabinet.snapshot,
    tenantId: 'tenant-2',
    generation: 2,
  }
  tenantRequestScope.rotate()
  view.rerender(teamScreen())

  expect(previousSignal?.signal?.aborted).toBe(true)
  expect(screen.queryByText('Олена')).toBeNull()
  expect(await screen.findByText('Іван')).toBeInTheDocument()
  expect(teamApi.listMembers).toHaveBeenCalledTimes(2)
})

it('refreshes authoritative cabinet access after an access-changing direct mutation', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await assignRole(user, 'Менеджер')

  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())
  expect(screen.getByRole('status')).toHaveTextContent(
    'Роль учасника оновлено.',
  )
})

it('does not read team data before an access-changing mutation retry settles', async () => {
  const currentCabinet = cabinet()
  const accessRetry = deferred<void>()
  currentCabinet.retry = vi.fn(() => accessRetry.promise)
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await assignRole(user, 'Менеджер')
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())

  const readsBeforeAccessSettles = [
    vi.mocked(teamApi.listMembers).mock.calls.length,
    vi.mocked(teamApi.listRoles).mock.calls.length,
    vi.mocked(teamApi.listInvitations).mock.calls.length,
  ]
  accessRetry.resolve(undefined)

  expect(readsBeforeAccessSettles).toEqual([1, 1, 1])
  await waitFor(() => expect(teamApi.listMembers).toHaveBeenCalledTimes(2))
  expect(teamApi.listRoles).toHaveBeenCalledTimes(2)
  expect(teamApi.listInvitations).toHaveBeenCalledTimes(2)
})

it('reloads only the current cabinet identity after a retry changes generation', async () => {
  const currentCabinet = cabinet()
  const accessRetry = deferred<void>()
  const currentIdentityReload = deferred<TeamMemberDto[]>()
  const initialSignal = tenantRequestScope.signal
  const currentMember = { ...member, id: 'member-2', name: 'Іван' }
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  vi.mocked(teamApi.listMembers)
    .mockResolvedValueOnce([member])
    .mockImplementation((options) =>
      options?.signal === initialSignal
        ? Promise.resolve([{ ...member, isActive: false }])
        : currentIdentityReload.promise,
    )
  const user = userEvent.setup()
  const view = renderScreen()
  currentCabinet.retry = vi.fn(() => {
    currentCabinet.targetTenant = {
      ...currentCabinet.targetTenant,
      id: 'tenant-2',
      slug: 'other-garage',
    }
    currentCabinet.snapshot = {
      ...currentCabinet.snapshot,
      tenantId: 'tenant-2',
      generation: 2,
    }
    tenantRequestScope.rotate()
    view.rerender(teamScreen())
    return accessRetry.promise
  })

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Вимкнути',
    }),
  )
  await user.click(confirmButton())
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())

  const readsBeforeAccessSettles = [
    vi.mocked(teamApi.listMembers).mock.calls.length,
    vi.mocked(teamApi.listRoles).mock.calls.length,
    vi.mocked(teamApi.listInvitations).mock.calls.length,
  ]
  const currentSignal = tenantRequestScope.signal
  accessRetry.resolve(undefined)
  await waitFor(() =>
    expect(
      vi
        .mocked(teamApi.listMembers)
        .mock.calls.some(([options]) => options?.signal === currentSignal),
    ).toBe(true),
  )
  currentIdentityReload.resolve([currentMember])

  expect(await screen.findByText('Іван')).toBeInTheDocument()
  expect(screen.queryByText('Олена')).toBeNull()
  expect(readsBeforeAccessSettles).toEqual([1, 1, 1])
  for (const listOperation of [
    teamApi.listMembers,
    teamApi.listRoles,
    teamApi.listInvitations,
  ]) {
    expect(vi.mocked(listOperation).mock.calls).toHaveLength(2)
    expect(vi.mocked(listOperation).mock.calls[1]?.[0]?.signal).toBe(
      currentSignal,
    )
  }
})

it('keeps mutation controls fail-closed when authoritative access retry fails', async () => {
  const currentCabinet = cabinet()
  const accessRetry = deferred<void>()
  currentCabinet.retry = vi.fn(() => accessRetry.promise)
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await assignRole(user, 'Менеджер')
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())
  accessRetry.reject(new Error('offline'))

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'не вдалося оновити права',
  )
  expect(screen.queryByLabelText('Роль для Олена')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Створити роль' })).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Створити запрошення' }),
  ).toBeNull()
  expect(teamApi.createRole).not.toHaveBeenCalled()
  expect(teamApi.createInvitation).not.toHaveBeenCalled()
})

it('refreshes access before the access-warning retry starts any team reads', async () => {
  const currentCabinet = cabinet()
  const failedAccessRetry = deferred<void>()
  const successfulAccessRetry = deferred<void>()
  const teamReload = deferred<TeamMemberDto[]>()
  currentCabinet.retry = vi
    .fn()
    .mockImplementationOnce(() => failedAccessRetry.promise)
    .mockImplementationOnce(() => successfulAccessRetry.promise)
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await assignRole(user, 'Менеджер')
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())
  failedAccessRetry.reject(new Error('offline'))
  const retryAccess = await screen.findByRole('button', {
    name: 'Оновити права',
  })

  vi.mocked(teamApi.listMembers).mockClear()
  vi.mocked(teamApi.listRoles).mockClear()
  vi.mocked(teamApi.listInvitations).mockClear()
  vi.mocked(teamApi.listMembers).mockImplementationOnce(
    () => teamReload.promise,
  )

  await user.click(retryAccess)
  const retryCallsBeforeTeamSettles = vi.mocked(currentCabinet.retry).mock.calls
    .length
  const readsBeforeAccessSettles = [
    vi.mocked(teamApi.listMembers).mock.calls.length,
    vi.mocked(teamApi.listRoles).mock.calls.length,
    vi.mocked(teamApi.listInvitations).mock.calls.length,
  ]

  successfulAccessRetry.resolve(undefined)
  await waitFor(() => expect(teamApi.listMembers).toHaveBeenCalledOnce())
  teamReload.resolve([member])
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledTimes(2))

  expect(retryCallsBeforeTeamSettles).toBe(2)
  expect(readsBeforeAccessSettles).toEqual([0, 0, 0])
})

it('denies a confirmation when team.manage is revoked after the dialog opens', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Вимкнути',
    }),
  )
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  currentCabinet.snapshot?.permissions.delete('team.manage')
  await user.click(confirmButton())

  expect(teamApi.deactivateMember).not.toHaveBeenCalled()
  expect(currentCabinet.retry).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Право керувати командою було змінено.',
  )
})

it('denies direct permission edits when team.manage is revoked after the editor opens', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Права',
    }),
  )
  await screen.findByRole('dialog', { name: 'Права: Олена' })
  currentCabinet.snapshot?.permissions.delete('team.manage')
  await user.click(screen.getByRole('button', { name: 'Зберегти права' }))

  expect(teamApi.updateUserPermissions).not.toHaveBeenCalled()
  expect(currentCabinet.retry).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Право керувати командою було змінено.',
  )
})

it('refreshes access after member and invitation confirmation mutations', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Вимкнути',
    }),
  )
  await user.click(confirmButton())
  await waitFor(() => expect(teamApi.deactivateMember).toHaveBeenCalledOnce())

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Видалити',
    }),
  )
  await user.click(confirmButton())
  await waitFor(() => expect(teamApi.deleteMember).toHaveBeenCalledOnce())

  await user.click(
    (await openInvitationMenu(user)).getByRole('menuitem', {
      name: 'Відкликати',
    }),
  )
  await user.click(confirmButton())
  await waitFor(() => expect(teamApi.revokeInvitation).toHaveBeenCalledOnce())

  expect(currentCabinet.retry).toHaveBeenCalledTimes(3)
  // Each mutation confirms itself in its own toast; the last one is newest.
  expect(screen.getAllByRole('status').at(-1)).toHaveTextContent(
    'Запрошення відкликано.',
  )
})

it('refreshes access after activating a member', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  vi.mocked(teamApi.listMembers).mockResolvedValue([
    { ...member, isActive: false },
  ])
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Активувати',
    }),
  )
  await user.click(confirmButton())

  await waitFor(() => expect(teamApi.activateMember).toHaveBeenCalledOnce())
  expect(currentCabinet.retry).toHaveBeenCalledOnce()
  expect(screen.getByRole('status')).toHaveTextContent('Учасника активовано.')
})

it('supports Escape dismissal and restores focus to the confirmation trigger', async () => {
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openInvitationMenu(user)).getByRole('menuitem', {
      name: 'Відкликати',
    }),
  )
  expect(screen.getByRole('dialog')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Скасувати' })).toHaveFocus()
  await user.keyboard('{Escape}')

  expect(screen.queryByRole('dialog')).toBeNull()
})

it('creates an invitation and refreshes the visible invitation lifecycle', async () => {
  const currentCabinet = cabinet()
  const createdInvitation = invitation({ id: 'invite-2', code: 'INVITE-NEW' })
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  vi.mocked(teamApi.listInvitations)
    .mockResolvedValueOnce([invitation()])
    .mockResolvedValueOnce([invitation(), createdInvitation])
  const user = userEvent.setup()
  renderScreen()

  await user.click(await screen.findByRole('button', { name: 'Запросити' }))
  expect(
    screen.getByRole('dialog', { name: 'Нове запрошення' }),
  ).toBeInTheDocument()
  expect(teamApi.createInvitation).not.toHaveBeenCalled()

  await chooseRole(user, 'Роль для запрошення', 'Механік')
  await user.click(screen.getByRole('button', { name: 'Створити запрошення' }))

  await waitFor(() =>
    expect(teamApi.createInvitation).toHaveBeenCalledWith('role-mechanic', {
      signal: tenantRequestScope.signal,
    }),
  )
  expect(await screen.findByText('INVITE-NEW')).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Нове запрошення' })).toBeNull()
  expect(screen.getByRole('status')).toHaveTextContent('Запрошення створено.')
  expect(screen.getAllByText('Активне')).toHaveLength(2)
  expect(currentCabinet.retry).toHaveBeenCalledOnce()
})

it('preserves the invitation role after failure and blocks dismissal while creating', async () => {
  const user = userEvent.setup()
  const creation = deferred<InvitationDto>()
  vi.mocked(teamApi.createInvitation).mockReturnValueOnce(creation.promise)
  renderScreen()
  await user.click(await screen.findByRole('button', { name: 'Запросити' }))
  await chooseRole(user, 'Роль для запрошення', 'Менеджер')
  const submit = screen.getByRole('button', { name: 'Створити запрошення' })
  await user.click(submit)
  expect(submit).toBeDisabled()
  expect(
    screen.getByRole('button', { name: 'Роль для запрошення' }),
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Закрити' }))
  expect(screen.getByRole('dialog', { name: 'Нове запрошення' })).toBeVisible()
  creation.reject(new Error('offline'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося створити запрошення.',
  )
  expect(
    screen.getByRole('button', { name: 'Роль для запрошення' }),
  ).toHaveTextContent('Менеджер')
  await user.click(submit)
  await waitFor(() => expect(teamApi.createInvitation).toHaveBeenCalledTimes(2))
  expect(teamApi.createInvitation).toHaveBeenLastCalledWith('role-manager', {
    signal: tenantRequestScope.signal,
  })
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Нове запрошення' }),
    ).toBeNull(),
  )
})

it('keeps the owner role read-only and excludes Owner from role assignment and invitations', async () => {
  vi.mocked(teamApi.listMembers).mockResolvedValue([
    member,
    {
      ...member,
      id: 'member-owner',
      userId: 'user-owner',
      name: 'Олексій',
      role: ownerRole,
    },
  ])
  const user = userEvent.setup()
  renderScreen()

  expect(await screen.findByText('Олексій')).toBeInTheDocument()
  expect(screen.queryByLabelText('Роль для Олексій')).toBeNull()
  expect(
    screen.queryByRole('button', { name: 'Дії з учасником Олексій' }),
  ).toBeNull()
  expect(
    screen.getByRole('button', { name: 'Дії з учасником Олена' }),
  ).toBeInTheDocument()
  expect(screen.getByText('Власник', { selector: 'span' })).toBeInTheDocument()
  await openRoleEditor(user)
  await user.click(screen.getByRole('button', { name: 'Роль для Олена' }))
  expect(screen.queryByRole('option', { name: 'Власник' })).toBeNull()
  expect(screen.getByRole('option', { name: 'Менеджер' })).toBeVisible()
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Скасувати' }))

  await user.click(screen.getByRole('button', { name: 'Запросити' }))
  const inviteRole = screen.getByRole('button', { name: 'Роль для запрошення' })
  expect(inviteRole).toHaveTextContent('Механік')
  await user.click(inviteRole)
  expect(screen.getByRole('option', { name: 'Механік' })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  expect(screen.queryByRole('option', { name: 'Власник' })).toBeNull()
  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Нове запрошення' })).toBeVisible()
  expect(inviteRole).toHaveFocus()
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  expect(teamApi.createInvitation).not.toHaveBeenCalled()
})

it('refreshes visible member data after a successful member mutation', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  vi.mocked(teamApi.listMembers)
    .mockResolvedValueOnce([member])
    .mockResolvedValueOnce([{ ...member, isActive: false }])
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Вимкнути',
    }),
  )
  await user.click(confirmButton())

  expect(await screen.findByText('Вимкнений')).toBeInTheDocument()
  expect(currentCabinet.retry).toHaveBeenCalledOnce()
})

it('keeps mutation success without calling it a failure when authoritative access refresh fails', async () => {
  const currentCabinet = cabinet()
  const accessRetry = deferred<void>()
  currentCabinet.retry = vi.fn(() => accessRetry.promise)
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Вимкнути',
    }),
  )
  await user.click(confirmButton())
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())
  accessRetry.reject(new Error('offline'))

  expect(await screen.findByText('Активний')).toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('Учасника вимкнено.')
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Дію виконано, але не вдалося оновити права.',
  )
  expect(
    screen.getByRole('button', { name: 'Оновити права' }),
  ).toBeInTheDocument()
  expect(screen.queryByText('Не вдалося виконати дію.')).toBeNull()
  expect(teamApi.listMembers).toHaveBeenCalledOnce()
})

it('keeps old data hidden across a retry generation switch until the current identity reloads', async () => {
  const currentCabinet = cabinet()
  const accessRetry = deferred<void>()
  const newReload = deferred<TeamMemberDto[]>()
  const initialSignal = tenantRequestScope.signal
  const newMember = { ...member, id: 'member-2', name: 'Іван' }
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  vi.mocked(teamApi.listMembers)
    .mockResolvedValueOnce([member])
    .mockImplementation((options) =>
      options?.signal === initialSignal
        ? Promise.resolve([{ ...member, isActive: false }])
        : newReload.promise,
    )
  const user = userEvent.setup()
  const view = renderScreen()
  currentCabinet.retry = vi.fn(() => {
    currentCabinet.targetTenant = {
      ...currentCabinet.targetTenant,
      id: 'tenant-2',
      slug: 'other-garage',
    }
    currentCabinet.snapshot = {
      ...currentCabinet.snapshot,
      tenantId: 'tenant-2',
      generation: 2,
    }
    tenantRequestScope.rotate()
    view.rerender(teamScreen())
    return accessRetry.promise
  })

  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Вимкнути',
    }),
  )
  await user.click(confirmButton())
  await waitFor(() => expect(currentCabinet.retry).toHaveBeenCalledOnce())
  expect(screen.queryByText('+380501112233')).toBeNull()

  accessRetry.resolve(undefined)
  await waitFor(() =>
    expect(
      vi
        .mocked(teamApi.listMembers)
        .mock.calls.some(
          ([options]) => options?.signal === tenantRequestScope.signal,
        ),
    ).toBe(true),
  )
  newReload.resolve([newMember])

  expect(await screen.findByText('Іван')).toBeInTheDocument()
  expect(screen.queryByText('Олена')).toBeNull()
})

it('says what the team endpoints do not carry instead of inventing it', async () => {
  vi.mocked(useCabinet).mockReturnValue(cabinet())
  vi.mocked(teamApi.listMembers).mockResolvedValue([{ ...member, phone: null }])
  vi.mocked(teamApi.listRoles).mockResolvedValue([ownerRole, mechanicRole])
  vi.mocked(teamApi.listInvitations).mockResolvedValue([invitation()])
  renderScreen()

  // Missing history stays unknown instead of substituting the join date.
  expect(
    await screen.findByTitle('Ще немає даних про активність.'),
  ).toHaveTextContent('—')
  expect(screen.getByText('пошти й телефону не вказано')).toBeVisible()
  // An invitation is a code, not a letter: the UI does not pretend it can
  // resend something when the backend has no delivery target.
  expect(screen.queryByRole('button', { name: 'Надіслати ще' })).toBeNull()
})

it('translates fixed system roles and keeps custom role names', () => {
  const owner = { name: 'Owner', isSystem: true }
  expect(roleLabel(owner, 'uk')).toBe('Власник')
  expect(roleLabel(owner, 'en-GB')).toBe('Owner')
  expect(roleLabel({ name: 'Master', isSystem: true }, 'en-GB')).toBe(
    'Mechanic',
  )
  expect(roleLabel({ name: 'manager', isSystem: true }, 'pl')).toBe('Menedżer')
  // A business-made role named like a system one is still the business's.
  expect(roleLabel({ name: 'Owner', isSystem: false }, 'uk')).toBe('Owner')
  expect(roleLabel({ name: 'Механік', isSystem: false }, 'en-GB')).toBe(
    'Механік',
  )
})

it('renders the team in English (UK)', async () => {
  const systemOwner: RoleDto = { ...ownerRole, name: 'Owner' }
  vi.mocked(teamApi.listRoles).mockResolvedValue([systemOwner, mechanicRole])
  vi.mocked(teamApi.listMembers).mockResolvedValue([
    member,
    {
      ...member,
      id: 'member-2',
      userId: 'user-owner',
      name: 'Ivan',
      role: systemOwner,
    },
  ])

  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      {teamScreen()}
    </LocaleProvider>,
  )

  expect(await screen.findByRole('heading', { name: 'Team' })).toBeVisible()
  expect(await screen.findByText('Олена')).toBeInTheDocument()
  expect(screen.getByText('Showing 2 of 2 members')).toBeInTheDocument()
  expect(screen.getByText('you')).toBeInTheDocument()
  // System role translated, custom role name as the business gave it.
  const row = screen.getByRole('rowheader', { name: /Олена/ }).closest('tr')!
  expect(within(row).getByText('Механік')).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Role for Олена' }),
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Role for Ivan')).toBeNull()
  expect(screen.getByText('Owner', { selector: 'span' })).toBeInTheDocument()
  expect(
    screen.getAllByTitle('No activity recorded yet.')[0],
  ).toHaveTextContent('—')
  expect(screen.getByText('1 active')).toBeInTheDocument()
  expect(screen.getByText(/Механік · valid until/)).toHaveTextContent(
    '01/09/2026',
  )
  expect(
    screen.getByRole('button', { name: 'Actions for Олена' }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Invite' })).toBeVisible()
})

it.each([
  {
    locale: 'uk',
    menu: 'Дії з учасником Олена',
    action: 'Права',
    title: 'Права: Олена',
    cars: 'Перегляд автомобілів',
    zones: 'Керування складами й розміщенням',
    hint: 'Список автомобілів та їхні картки.',
  },
  {
    locale: 'en-GB',
    menu: 'Actions for Олена',
    action: 'Permissions',
    title: 'Permissions: Олена',
    cars: 'View vehicles',
    zones: 'Manage warehouses and locations',
    hint: 'View the vehicle list and vehicle details.',
  },
  {
    locale: 'pl',
    menu: 'Działania: Олена',
    action: 'Uprawnienia',
    title: 'Uprawnienia: Олена',
    cars: 'Przeglądanie aut',
    zones: 'Zarządzanie magazynami i rozmieszczeniem',
    hint: 'Lista aut i ich karty.',
  },
] satisfies {
  locale: Locale
  menu: string
  action: string
  title: string
  cars: string
  zones: string
  hint: string
}[])(
  'localises every permission and its accessible explanation in $locale',
  async ({ locale, menu, action, title, cars, zones, hint }) => {
    const user = userEvent.setup()
    render(
      <LocaleProvider locale={locale} syncDocumentLang={false}>
        {teamScreen()}
      </LocaleProvider>,
    )
    await user.click(await screen.findByRole('button', { name: menu }))
    await user.click(screen.getByRole('menuitem', { name: action }))
    const dialog = within(await screen.findByRole('dialog', { name: title }))
    const viewCars = await dialog.findByRole('checkbox', {
      name: cars,
    })
    expect(viewCars).toHaveAccessibleDescription(hint)
    expect(dialog.getByRole('checkbox', { name: zones })).toBeInTheDocument()
    const checks = dialog.getAllByRole('checkbox')
    expect(checks).toHaveLength(ALL_PERMISSIONS.length)
    for (const check of checks) {
      expect(check).toHaveAccessibleName()
      expect(check).toHaveAccessibleDescription()
      expect(ALL_PERMISSIONS).not.toContain(check.getAttribute('aria-label'))
    }
    for (const permission of ALL_PERMISSIONS)
      expect(
        dialog.queryByText(permission, { exact: true }),
      ).not.toBeInTheDocument()
  },
)

it('keeps canonical permission codes and unknown permissions when saving localised choices', async () => {
  const user = userEvent.setup()
  vi.mocked(teamApi.getUserPermissions).mockResolvedValue({
    userId: 'user-1',
    roleName: 'Механік',
    permissions: ['parts.view', 'future.permission'],
  })
  renderScreen()
  await user.click(
    (await openMemberMenu(user, 'Олена')).getByRole('menuitem', {
      name: 'Права',
    }),
  )
  const dialog = within(
    await screen.findByRole('dialog', { name: 'Права: Олена' }),
  )
  const cars = await dialog.findByRole('checkbox', {
    name: 'Перегляд автомобілів',
  })
  expect(
    dialog.getByRole('checkbox', { name: 'Перегляд запчастин' }),
  ).toBeChecked()
  await user.click(cars)
  await user.click(dialog.getByRole('checkbox', { name: 'Перегляд запчастин' }))
  const zones = dialog.getByRole('checkbox', {
    name: 'Керування складами й розміщенням',
  })
  zones.focus()
  await user.keyboard(' ')
  expect(zones).toBeChecked()
  expect(dialog.getByText('Права користувача — обрано 2 з 24')).toBeVisible()
  await user.click(dialog.getByRole('button', { name: 'Зберегти права' }))
  await waitFor(() =>
    expect(teamApi.updateUserPermissions).toHaveBeenCalledWith(
      'user-1',
      ['future.permission', 'cars.view', 'inventory.zones.manage'],
      { signal: tenantRequestScope.signal },
    ),
  )
})

it('uses compact role choices without search and preserves keyboard assignment', async () => {
  const user = userEvent.setup()
  vi.mocked(teamApi.listMembers).mockResolvedValue([
    member,
    {
      ...member,
      id: 'member-2',
      userId: 'user-2',
      name: 'Микола',
      role: managerRole,
    },
  ])
  renderScreen()
  const filter = await screen.findByRole('button', {
    name: 'Фільтр за роллю',
  })
  expect(filter).toHaveTextContent('Усі ролі')
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук ролі' }),
  ).not.toBeInTheDocument()
  await user.click(filter)
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук ролі' }),
  ).not.toBeInTheDocument()
  expect(screen.getByText('Олена')).toBeVisible()
  await user.click(screen.getByRole('option', { name: 'Менеджер' }))
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(screen.queryByText('Олена')).not.toBeInTheDocument()
  expect(screen.getByText('Микола')).toBeVisible()
  await user.click(filter)
  await user.click(screen.getByRole('option', { name: 'Усі ролі' }))
  const editor = await openRoleEditor(user)
  const assignment = editor.getByRole('button', { name: 'Роль для Олена' })
  await user.click(assignment)
  expect(
    screen
      .getByRole('dialog', { name: 'Доступні ролі' })
      .closest('.rz-table-wrap'),
  ).toBeNull()
  expect(
    screen.queryByRole('option', { name: 'Власник' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук ролі' }),
  ).not.toBeInTheDocument()
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  await user.keyboard('{ArrowDown}{Escape}')
  expect(assignment).toHaveTextContent('Механік')
  expect(assignment).toHaveFocus()
  await user.click(assignment)
  await user.click(assignment)
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  await user.click(assignment)
  expect(
    screen.queryByRole('searchbox', { name: 'Пошук ролі' }),
  ).not.toBeInTheDocument()
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  await user.click(editor.getByRole('button', { name: 'Зберегти' }))
  await waitFor(() =>
    expect(teamApi.changeRole).toHaveBeenCalledWith(
      'member-1',
      'role-manager',
      { signal: tenantRequestScope.signal },
    ),
  )
})

it('does not reassign the current role and prevents duplicate saves or dismissal while saving', async () => {
  const user = userEvent.setup()
  const update = deferred<TeamMemberDto>()
  vi.mocked(teamApi.changeRole).mockReturnValueOnce(update.promise)
  renderScreen()
  const editor = await openRoleEditor(user)
  await chooseRole(user, 'Роль для Олена', 'Механік')
  const save = editor.getByRole('button', { name: 'Зберегти' })
  expect(save).toBeDisabled()
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  await chooseRole(user, 'Роль для Олена', 'Менеджер')
  await user.click(save)
  expect(save).toBeDisabled()
  expect(editor.getByRole('button', { name: 'Роль для Олена' })).toBeDisabled()
  expect(editor.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
  await user.click(save)
  await user.keyboard('{Escape}')
  expect(screen.getByRole('dialog', { name: 'Змінити роль' })).toBeVisible()
  expect(teamApi.changeRole).toHaveBeenCalledOnce()
  update.resolve({ ...member, role: managerRole })
  await waitFor(() => expect(teamApi.listMembers).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Змінити роль' }),
    ).not.toBeInTheDocument(),
  )
})

it('cancels a changed role without submitting and restores the row action focus', async () => {
  const user = userEvent.setup()
  renderScreen()
  const editor = await openRoleEditor(user)
  await chooseRole(user, 'Роль для Олена', 'Менеджер')
  await user.click(editor.getByRole('button', { name: 'Скасувати' }))
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Дії з учасником Олена' }),
  ).toHaveFocus()
  await openRoleEditor(user)
  expect(
    screen.getByRole('button', { name: 'Роль для Олена' }),
  ).toHaveTextContent('Механік')
})

it('keeps role assignment errors in the editor and retries the chosen role', async () => {
  const user = userEvent.setup()
  vi.mocked(teamApi.changeRole).mockRejectedValueOnce(new Error('offline'))
  renderScreen()
  await assignRole(user, 'Менеджер')
  const editor = within(screen.getByRole('dialog', { name: 'Змінити роль' }))
  expect(await editor.findByRole('alert')).toHaveTextContent(
    'Не вдалося змінити роль',
  )
  expect(screen.getAllByRole('alert')).toHaveLength(1)
  expect(
    editor.getByRole('button', { name: 'Роль для Олена' }),
  ).toHaveTextContent('Менеджер')
  await user.click(editor.getByRole('button', { name: 'Зберегти' }))
  await waitFor(() => expect(teamApi.changeRole).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(
      screen.queryByRole('dialog', { name: 'Змінити роль' }),
    ).not.toBeInTheDocument(),
  )
})

it('rechecks team.manage when a role editor is already open', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  renderScreen()
  const editor = await openRoleEditor(user)
  await chooseRole(user, 'Роль для Олена', 'Менеджер')
  currentCabinet.snapshot.permissions.delete('team.manage')
  await user.click(editor.getByRole('button', { name: 'Зберегти' }))
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Право керувати командою було змінено',
  )
})

it('does not offer role assignment for the current member', async () => {
  vi.mocked(teamApi.listMembers).mockResolvedValue([
    { ...member, userId: 'user-owner' },
  ])
  const user = userEvent.setup()
  renderScreen()
  const menu = await openMemberMenu(user, 'Олена')
  expect(
    menu.queryByRole('menuitem', { name: 'Змінити роль' }),
  ).not.toBeInTheDocument()
})

it('closes the role editor when switching tenant identity without submitting its draft', async () => {
  const currentCabinet = cabinet()
  vi.mocked(useCabinet).mockReturnValue(currentCabinet)
  const user = userEvent.setup()
  const view = renderScreen()
  await openRoleEditor(user)
  await chooseRole(user, 'Роль для Олена', 'Менеджер')
  currentCabinet.snapshot = {
    ...currentCabinet.snapshot,
    tenantId: 'tenant-2',
    generation: 2,
  }
  currentCabinet.targetTenant = {
    ...currentCabinet.targetTenant,
    id: 'tenant-2',
  }
  tenantRequestScope.rotate()
  view.rerender(teamScreen())
  expect(
    screen.queryByRole('dialog', { name: 'Змінити роль' }),
  ).not.toBeInTheDocument()
  expect(teamApi.changeRole).not.toHaveBeenCalled()
  await screen.findByText('Олена')
})
