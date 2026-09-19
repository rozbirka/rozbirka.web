import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react'
import { Link } from 'react-router'
import {
  Ban,
  KeyRound,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
} from 'lucide-react'
import { AlertDialog } from 'radix-ui'
import {
  ActionMenu,
  Button,
  DateValue,
  Field,
  FormDialog,
  Notice,
  PageBody,
  PageHeader,
  SelectInput,
  SkeletonRows,
  StatusPill,
  TextInput,
  useOperation,
  type StatusTone,
} from '@/components/app'
import { cn, plural } from '@/lib/utils'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { ALL_PERMISSIONS } from '../access-types'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { tenantRequestScope } from '../tenant-request-scope'
import {
  teamApi,
  type InvitationDto,
  type RoleDto,
  type TeamMemberDto,
} from '@/api/team'

interface TeamData {
  tenantId: string | null
  generation: number | null
  members: TeamMemberDto[]
  roles: RoleDto[]
  invitations: InvitationDto[]
}

interface Confirmation {
  title: string
  /** What this action does, in the words of the person it happens to. */
  description: string
  /** Shown inside the dialog when the action fails, so the retry is one click. */
  failure: string
  confirm(): Promise<boolean>
}

type AccessRefreshState = 'ready' | 'refreshing' | 'failed'

const accessLostMessage =
  'Право керувати командою було змінено. Оновіть права або попросіть власника розбірки повернути доступ.'

/** The module each permission belongs to, so a role is composed, not hunted. */
const permissionGroupTitles: Record<string, string> = {
  cars: 'Автомобілі',
  parts: 'Запчастини',
  orders: 'Замовлення',
  customers: 'Клієнти',
  finance: 'Фінанси',
  intakes: 'Приймання',
  inventory: 'Інвентаризація',
  stickers: 'Стікери',
  reports: 'Звіти',
  team: 'Команда',
  billing: 'Підписка',
}

const permissionGroups = ALL_PERMISSIONS.reduce<
  { prefix: string; title: string; permissions: string[] }[]
>((groups, permission) => {
  const prefix = permission.split('.')[0] ?? permission
  const group = groups.find((candidate) => candidate.prefix === prefix)
  if (group) group.permissions.push(permission)
  else
    groups.push({
      prefix,
      title: permissionGroupTitles[prefix] ?? prefix,
      permissions: [permission],
    })
  return groups
}, [])

const MEMBER_SEGMENTS = [
  { key: 'all', label: 'Усі' },
  { key: 'active', label: 'Активні' },
  { key: 'off', label: 'Вимкнені' },
] as const

/** What the team endpoints do not carry, said out loud where it is missing. */
const NO_LAST_SEEN =
  'Останній вхід учасника не зберігається — відома лише дата приєднання.'
const NO_EMAIL =
  'Пошти в учасника немає — кабінет знає імʼя й телефон, а телефон тут не вказано.'
const NO_RESEND =
  'Надіслати запрошення повторно нема куди: кабінет не шле листів, він лише видає код. Потрібен новий — створіть запрошення нижче.'
const NO_EMAIL_INVITE =
  'Листів кабінет не надсилає й пошти не питає: запрошення — це код, який ви передаєте людині самі. Місце в тарифі рахується за учасниками, а не за виданими кодами.'

/** Two letters standing in for a photo the API does not keep. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

const invitationStatus = (
  invitation: InvitationDto,
): { label: string; tone: StatusTone } => {
  if (invitation.isUsed) return { label: 'Використано', tone: 'info' }
  if (invitation.isRevoked) return { label: 'Відкликано', tone: 'neutral' }
  if (invitation.isExpired) return { label: 'Прострочено', tone: 'warn' }
  return { label: 'Активне', tone: 'ok' }
}

export const TeamScreen: ComponentType<CabinetModuleScreenProps> = () => {
  const cabinet = useCabinet()
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [accessWarning, setAccessWarning] = useState<string | null>(null)
  const [accessRefreshState, setAccessRefreshState] =
    useState<AccessRefreshState>('ready')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [query, setQuery] = useState('')
  const [segment, setSegment] =
    useState<(typeof MEMBER_SEGMENTS)[number]['key']>('all')
  const [permissionMember, setPermissionMember] =
    useState<TeamMemberDto | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [newRoleName, setNewRoleName] = useState('Нова роль')
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([
    'orders.view',
  ])
  const [editingRole, setEditingRole] = useState<RoleDto | null>(null)
  const [editingRoleName, setEditingRoleName] = useState('')
  const [editingRolePermissions, setEditingRolePermissions] = useState<
    string[]
  >([])
  const accessRefreshRequiredRef = useRef(false)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const roleAssignmentRef = useRef<{
    memberId: string
    roleId: string
  } | null>(null)
  const invitationRoleRef = useRef<string | null>(null)
  const tenantId = cabinet.snapshot?.tenantId ?? null
  const generation = cabinet.snapshot?.generation ?? null
  const canView = cabinet.snapshot?.permissions.has('team.view') === true
  const canManageAccess =
    accessRefreshState === 'ready' &&
    cabinet.snapshot?.permissions.has('team.manage') === true

  const canManage = useCallback(
    () =>
      !accessRefreshRequiredRef.current &&
      cabinet.snapshot?.permissions.has('team.manage') === true,
    [cabinet],
  )

  const load = useCallback(async () => {
    const signal = tenantRequestScope.signal
    setLoading(true)
    setError(null)
    try {
      const [members, roles, invitations] = await Promise.all([
        teamApi.listMembers({ signal }),
        teamApi.listRoles({ signal }),
        teamApi.listInvitations({ signal }),
      ])
      if (!signal.aborted)
        setData({ tenantId, generation, members, roles, invitations })
    } catch {
      if (!signal.aborted)
        setError(
          'Не вдалося завантажити дані команди. Перевірте зв’язок і оновіть сторінку.',
        )
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [generation, tenantId])

  useEffect(() => {
    if (!canView || accessRefreshState !== 'ready') return
    const timeout = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeout)
  }, [accessRefreshState, canView, generation, load, refreshNonce, tenantId])

  const refreshAccess = useCallback(async () => {
    accessRefreshRequiredRef.current = true
    setAccessRefreshState('refreshing')
    try {
      await cabinet.retry()
      setAccessWarning(null)
      accessRefreshRequiredRef.current = false
      setAccessRefreshState('ready')
      setRefreshNonce((current) => current + 1)
      return true
    } catch {
      setAccessRefreshState('failed')
      setAccessWarning(
        'Дію виконано, але не вдалося оновити права. Натисніть «Оновити права», щоб продовжити роботу.',
      )
      return false
    }
  }, [cabinet])

  const mutate = useCallback(
    async (
      successMessage: string,
      operation: (signal: AbortSignal) => Promise<unknown>,
    ) => {
      if (!canManage()) {
        setError(accessLostMessage)
        return false
      }
      const signal = tenantRequestScope.signal
      setFeedback(null)
      setError(null)
      try {
        await operation(signal)
      } catch {
        // A dead request is reported where the user triggered it; a tenant
        // switch is not a failure, it is the old screen going away.
        if (signal.aborted) return false
        throw new Error('Не вдалося виконати дію. Спробуйте ще раз.')
      }
      if (signal.aborted) return false

      setFeedback(successMessage)
      await refreshAccess()
      return true
    },
    [canManage, refreshAccess],
  )

  const teamData =
    data?.tenantId === tenantId && data.generation === generation ? data : null
  const availableRoles = useMemo(() => teamData?.roles ?? [], [teamData?.roles])

  const roleAssignment = useOperation(
    async () => {
      const target = roleAssignmentRef.current
      if (target === null) return false
      return mutate('Роль учасника оновлено.', (signal) =>
        teamApi.changeRole(target.memberId, target.roleId, { signal }),
      )
    },
    {
      errorMessage: () =>
        'Не вдалося змінити роль учасника. Перевірте зв’язок і спробуйте ще раз.',
    },
  )

  const memberPermissions = useOperation(
    async () => {
      if (permissionMember === null) return false
      return mutate('Права учасника оновлено.', (signal) =>
        teamApi.updateUserPermissions(
          permissionMember.userId,
          selectedPermissions,
          { signal },
        ),
      )
    },
    {
      errorMessage: () =>
        'Не вдалося зберегти права. Перевірте зв’язок і спробуйте ще раз.',
      onSuccess: () => setPermissionMember(null),
    },
  )

  const roleUpdate = useOperation(
    async () => {
      if (editingRole === null) return false
      return mutate('Роль оновлено.', (signal) =>
        teamApi.updateRole(
          editingRole.id,
          {
            name: editingRoleName.trim(),
            permissions: editingRolePermissions,
          },
          { signal },
        ),
      )
    },
    {
      errorMessage: () =>
        'Не вдалося зберегти роль. Перевірте зв’язок і спробуйте ще раз.',
      onSuccess: () => setEditingRole(null),
    },
  )

  const roleCreation = useOperation(
    async () =>
      mutate('Роль створено.', (signal) =>
        teamApi.createRole(
          { name: newRoleName.trim(), permissions: newRolePermissions },
          { signal },
        ),
      ),
    {
      errorMessage: () =>
        'Не вдалося створити роль. Перевірте зв’язок і спробуйте ще раз.',
      onSuccess: (created) => {
        if (!created) return
        setNewRoleName('Нова роль')
        setNewRolePermissions(['orders.view'])
      },
    },
  )

  const invitationCreation = useOperation(
    async () => {
      const roleId = invitationRoleRef.current
      if (roleId === null) return false
      return mutate('Запрошення створено.', (signal) =>
        teamApi.createInvitation(roleId, { signal }),
      )
    },
    {
      errorMessage: () =>
        'Не вдалося створити запрошення. Перевірте зв’язок і спробуйте ще раз.',
    },
  )

  const confirmedAction = useOperation(
    async () => {
      if (confirmation === null) return false
      return confirmation.confirm()
    },
    {
      errorMessage: () =>
        confirmation?.failure ?? 'Не вдалося виконати дію. Спробуйте ще раз.',
      onSuccess: () => setConfirmation(null),
    },
  )

  const openPermissions = async (member: TeamMemberDto) => {
    if (!canManage()) {
      setError(accessLostMessage)
      return
    }
    const signal = tenantRequestScope.signal
    try {
      const result = await teamApi.getUserPermissions(member.userId, { signal })
      if (signal.aborted) return
      if (!canManage()) {
        setError(accessLostMessage)
        return
      }
      memberPermissions.reset()
      setPermissionMember(member)
      setSelectedPermissions(result.permissions)
    } catch {
      if (!signal.aborted)
        setError(
          'Не вдалося завантажити права учасника. Перевірте зв’язок і спробуйте ще раз.',
        )
    }
  }

  const openRoleEditor = (role: RoleDto) => {
    roleUpdate.reset()
    setEditingRole(role)
    setEditingRoleName(role.name)
    setEditingRolePermissions(role.permissions ?? [])
  }

  const toggleNewRolePermission = (permission: string) => {
    setNewRolePermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    )
  }

  const toggleUserPermission = (permission: string) => {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    )
  }

  const toggleEditingRolePermission = (permission: string) => {
    setEditingRolePermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    )
  }

  const askConfirmation = (next: Confirmation) => {
    if (!canManage()) {
      setError(accessLostMessage)
      return
    }
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    confirmedAction.reset()
    setConfirmation(next)
  }

  const restoreFocus = () => restoreFocusRef.current?.focus()

  if (!canView) {
    return (
      <PageBody>
        <PageHeader eyebrow="Налаштування доступу" title="Команда" />
        <Notice role="alert" tone="danger">
          Недостатньо прав для перегляду команди. Попросіть власника розбірки
          відкрити вам розділ «Команда».
        </Notice>
      </PageBody>
    )
  }

  const pageError = error ?? roleAssignment.error
  const members = teamData?.members ?? []
  const activeMembers = members.filter((one) => one.isActive).length
  const offMembers = members.length - activeMembers
  const segmentCounts = {
    all: members.length,
    active: activeMembers,
    off: offMembers,
  }
  const needle = query.trim().toLowerCase()
  const shownMembers = members
    .filter(
      (one) =>
        segment === 'all' ||
        (segment === 'active' ? one.isActive : !one.isActive),
    )
    .filter(
      (one) =>
        needle === '' ||
        one.name.toLowerCase().includes(needle) ||
        (one.phone ?? '').toLowerCase().includes(needle),
    )
  const openInvitations = (teamData?.invitations ?? []).filter(
    (one) => invitationStatus(one).label === 'Активне',
  )
  const seats = cabinet.snapshot?.entitlement?.usage.users ?? null
  const planName = cabinet.snapshot?.subscription?.planName ?? null
  const myUserId = cabinet.snapshot?.userId ?? null

  return (
    <>
      <RedesignShell
        actions={
          <>
            <span className="border-app-line bg-app-raised focus-within:border-app-line-2 flex h-10 w-full min-w-0 items-center gap-2.5 rounded-[10px] border px-3 sm:w-[260px]">
              <Search aria-hidden className="text-app-dim size-4 shrink-0" />
              <input
                aria-label="Пошук учасників"
                className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Імʼя або телефон"
                value={query}
              />
            </span>
            {canManageAccess && (
              <Button
                asChild
                className="px-5 text-sm font-bold"
                variant="primary"
              >
                <a href="#team-invite">
                  <Plus aria-hidden />
                  Запросити
                </a>
              </Button>
            )}
          </>
        }
        crumb="Налаштування · Команда"
      >
        <RedesignTitle
          lead="Хто має доступ до складу, продажів і грошей."
          title="Команда"
        />

        {feedback && <Notice tone="ok">{feedback}</Notice>}
        {pageError && <Notice tone="danger">{pageError}</Notice>}
        {accessWarning && (
          <Notice
            action={
              <Button
                disabled={accessRefreshState === 'refreshing'}
                onClick={() => {
                  void refreshAccess()
                }}
              >
                Оновити права
              </Button>
            }
            role="alert"
            tone="warn"
          >
            {accessWarning}
          </Notice>
        )}
        {loading && <SkeletonRows label="Завантажуємо команду…" />}

        {teamData && (
          <>
            <KpiStrip>
              <Kpi
                label="Учасників"
                meta={`${String(activeMembers)} ${plural(activeMembers, ['активний', 'активні', 'активних'])}${
                  offMembers === 0
                    ? ''
                    : ` · ${String(offMembers)} ${plural(offMembers, ['вимкнений', 'вимкнені', 'вимкнених'])}`
                }`}
                value={String(teamData.members.length)}
              />
              <Kpi
                label="Місць у тарифі"
                meta={
                  seats === null
                    ? 'тариф не повідомляє ліміт місць'
                    : seats.max == null
                      ? `${planName ?? 'Тариф'} · без обмеження`
                      : `${planName ?? 'Тариф'} · вільно ${String(Math.max(seats.max - seats.used, 0))}`
                }
                tone={
                  seats?.max != null && seats.used >= seats.max
                    ? 'warn'
                    : 'plain'
                }
                value={
                  seats === null
                    ? '—'
                    : seats.max == null
                      ? String(seats.used)
                      : `${String(seats.used)} / ${String(seats.max)}`
                }
              />
              <Kpi
                label="Запрошень діє"
                meta={
                  openInvitations.length === 0
                    ? 'усі коди використані або відкликані'
                    : 'код вводять під час реєстрації'
                }
                value={String(openInvitations.length)}
              />
            </KpiStrip>

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div
                aria-label="Стан учасника"
                className="border-app-line bg-app-raised flex min-w-0 flex-wrap gap-1 rounded-[14px] border p-1"
                role="group"
              >
                {MEMBER_SEGMENTS.map((one) => (
                  <button
                    aria-pressed={segment === one.key}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-2 rounded-[10px] px-3.5 text-[13.5px] font-bold whitespace-nowrap',
                      segment === one.key
                        ? 'text-app-ink bg-white/[0.08]'
                        : 'text-app-muted hover:text-app-ink',
                    )}
                    key={one.key}
                    onClick={() => setSegment(one.key)}
                    type="button"
                  >
                    {one.label}
                    <span className="text-app-dim font-mono text-[12px]">
                      {segmentCounts[one.key]}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-app-dim text-[13px]">
                Показано {shownMembers.length} з {teamData.members.length}{' '}
                {plural(teamData.members.length, [
                  'учасника',
                  'учасників',
                  'учасників',
                ])}
              </p>
            </div>

            <section
              aria-labelledby="team-members-heading"
              className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
            >
              <h2 className="sr-only" id="team-members-heading">
                Учасники
              </h2>
              {shownMembers.length === 0 ? (
                <p className="text-app-muted px-5.5 py-8 text-[14px]">
                  Учасників за цим фільтром немає.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[14px]">
                    <caption className="sr-only">Учасники команди</caption>
                    <thead>
                      <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                        <th className="px-5.5 py-2.5 text-left">Користувач</th>
                        <th className="px-3 py-2.5 text-left">Роль</th>
                        <th
                          className="px-3 py-2.5 text-left"
                          title={NO_LAST_SEEN}
                        >
                          Активність
                        </th>
                        <th className="px-3 py-2.5 text-left">Статус</th>
                        {canManageAccess && (
                          // `relative` keeps the visually hidden label's
                          // containing block inside the cell: absolutely
                          // positioned at the page root it would widen the
                          // document and break the 320px floor.
                          <th className="relative px-5.5 py-2.5 text-right">
                            <span className="sr-only">Дії</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {shownMembers.map((member) => (
                        <tr
                          className="border-app-line border-b"
                          key={member.id}
                        >
                          <td className="px-5.5 py-3.5">
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                aria-hidden
                                className="border-app-line text-app-muted inline-flex size-9 shrink-0 items-center justify-center rounded-full border font-mono text-[12px]"
                              >
                                {initials(member.name)}
                              </span>
                              <span className="grid min-w-0 gap-0.5">
                                <span className="text-app-ink flex flex-wrap items-center gap-2 font-medium">
                                  {member.name}
                                  {member.userId === myUserId && (
                                    <span className="border-app-line text-app-dim rounded-full border px-2 py-0.5 text-[11px]">
                                      це ви
                                    </span>
                                  )}
                                </span>
                                {member.phone ? (
                                  <span className="text-app-dim text-[12.5px]">
                                    {member.phone}
                                  </span>
                                ) : (
                                  <span
                                    className="text-app-dim text-[12.5px]"
                                    title={NO_EMAIL}
                                  >
                                    пошти й телефону не вказано
                                  </span>
                                )}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
                            {canManageAccess ? (
                              <SelectInput
                                aria-busy={roleAssignment.pending}
                                aria-label={`Роль для ${member.name}`}
                                className="min-w-40"
                                onChange={(event) => {
                                  roleAssignmentRef.current = {
                                    memberId: member.id,
                                    roleId: event.target.value,
                                  }
                                  roleAssignment.run()
                                }}
                                value={member.role.id}
                              >
                                {availableRoles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {role.name}
                                  </option>
                                ))}
                              </SelectInput>
                            ) : (
                              <span className="text-app-muted">
                                {member.role.name}
                              </span>
                            )}
                          </td>
                          <td className="text-app-muted px-3 py-3.5">
                            у команді з <DateValue value={member.joinedAt} />
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusPill
                              tone={member.isActive ? 'ok' : 'neutral'}
                            >
                              {member.isActive ? 'Активний' : 'Вимкнений'}
                            </StatusPill>
                          </td>
                          {canManageAccess && (
                            <td className="px-5.5 py-3.5">
                              <span className="flex justify-end">
                                <ActionMenu
                                  actions={[
                                    {
                                      key: 'permissions',
                                      label: 'Права',
                                      icon: <KeyRound aria-hidden />,
                                      onSelect: () =>
                                        void openPermissions(member),
                                    },
                                    {
                                      key: 'lifecycle',
                                      label: member.isActive
                                        ? 'Вимкнути'
                                        : 'Активувати',
                                      icon: member.isActive ? (
                                        <PowerOff aria-hidden />
                                      ) : (
                                        <Power aria-hidden />
                                      ),
                                      onSelect: () =>
                                        askConfirmation({
                                          title: member.isActive
                                            ? 'Вимкнути учасника'
                                            : 'Активувати учасника',
                                          description: member.isActive
                                            ? `${member.name} втратить доступ до кабінету. Ви зможете активувати цей обліковий запис пізніше.`
                                            : `${member.name} знову отримає доступ до кабінету з роллю «${member.role.name}».`,
                                          failure: member.isActive
                                            ? 'Не вдалося вимкнути учасника. Перевірте зв’язок і спробуйте ще раз.'
                                            : 'Не вдалося активувати учасника. Перевірте зв’язок і спробуйте ще раз.',
                                          confirm: () =>
                                            mutate(
                                              member.isActive
                                                ? 'Учасника вимкнено.'
                                                : 'Учасника активовано.',
                                              (signal) =>
                                                member.isActive
                                                  ? teamApi.deactivateMember(
                                                      member.id,
                                                      { signal },
                                                    )
                                                  : teamApi.activateMember(
                                                      member.id,
                                                      { signal },
                                                    ),
                                            ),
                                        }),
                                    },
                                    {
                                      key: 'delete',
                                      label: 'Видалити',
                                      icon: <Trash2 aria-hidden />,
                                      destructive: true,
                                      onSelect: () =>
                                        askConfirmation({
                                          title: 'Видалити учасника',
                                          description: `${member.name} втратить доступ назавжди. Щоб повернути людину в команду, доведеться створити нове запрошення.`,
                                          failure:
                                            'Не вдалося видалити учасника. Перевірте зв’язок і спробуйте ще раз.',
                                          confirm: () =>
                                            mutate(
                                              'Учасника видалено.',
                                              (signal) =>
                                                teamApi.deleteMember(
                                                  member.id,
                                                  { signal },
                                                ),
                                            ),
                                        }),
                                    },
                                  ]}
                                  label={`Дії з учасником ${member.name}`}
                                />
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="border-app-line flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-5.5 py-3.5">
                <p className="text-app-dim text-[13px] leading-5 text-pretty">
                  <span title={NO_LAST_SEEN}>
                    Останній вхід не зберігається — у колонці «Активність» лише
                    дата приєднання.
                  </span>{' '}
                  {seats === null
                    ? 'Скільки місць дає тариф, зараз невідомо.'
                    : seats.max == null
                      ? `Зайнято ${String(seats.used)} — тариф не обмежує кількість людей.`
                      : `Зайнято ${String(seats.used)} з ${String(seats.max)} місць тарифу.`}
                </p>
                <Link
                  className="text-brand text-[13px] font-bold underline-offset-4 hover:underline"
                  to="../billing"
                >
                  Збільшити ліміт
                </Link>
              </div>
            </section>

            <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2">
              <section
                aria-labelledby="team-roles-heading"
                className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5"
              >
                <h2
                  className="text-app-ink text-[15px] font-bold"
                  id="team-roles-heading"
                >
                  Ролі й доступи
                </h2>
                <p className="text-app-dim mt-1.5 text-[13px] leading-5 text-pretty">
                  Системні ролі змінити не можна — створіть власну й дайте їй
                  рівно ті права, що потрібні.
                </p>
                <ul className="mt-4 grid gap-2.5">
                  {teamData.roles.map((role) => (
                    <li
                      className="border-app-line rounded-[16px] border px-4 py-3.5"
                      key={role.id}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="flex flex-wrap items-center gap-2.5">
                          <span className="text-app-ink text-[14px] font-bold">
                            {role.name}
                          </span>
                          <StatusPill tone={role.isSystem ? 'info' : 'neutral'}>
                            {role.isSystem ? 'Системна роль' : 'Власна роль'}
                          </StatusPill>
                        </span>
                        <span className="text-app-dim font-mono text-[12px]">
                          {role.membersCount === null
                            ? '—'
                            : `${String(role.membersCount)} ${plural(role.membersCount, ['учасник', 'учасники', 'учасників'])}`}
                        </span>
                      </div>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {(role.permissions ?? [])
                          .slice(0, 6)
                          .map((permission) => (
                            <span
                              className="border-app-line text-app-muted rounded-full border px-2.5 py-0.5 font-mono text-[11.5px]"
                              key={permission}
                            >
                              {permission}
                            </span>
                          ))}
                        {(role.permissions?.length ?? 0) > 6 && (
                          <span className="text-app-dim px-1 py-0.5 text-[11.5px]">
                            ще {String((role.permissions?.length ?? 0) - 6)} з{' '}
                            {String(ALL_PERMISSIONS.length)}
                          </span>
                        )}
                        {(role.permissions?.length ?? 0) === 0 && (
                          <span className="text-app-dim text-[12.5px]">
                            Прав ще немає
                          </span>
                        )}
                      </div>
                      {canManageAccess && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {role.isSystem ? (
                            <span className="text-app-dim text-[12.5px]">
                              Змінам не підлягає
                            </span>
                          ) : (
                            <>
                              <Button
                                aria-label={`Редагувати ${role.name}`}
                                onClick={() => openRoleEditor(role)}
                              >
                                <Pencil aria-hidden />
                                Редагувати
                              </Button>
                              <Button
                                aria-label={`Видалити ${role.name}`}
                                onClick={() =>
                                  askConfirmation({
                                    title: 'Видалити роль',
                                    description: `Роль «${role.name}» зникне зі списку. Учасникам із цією роллю доведеться призначити іншу.`,
                                    failure:
                                      'Не вдалося видалити роль. Перевірте зв’язок і спробуйте ще раз.',
                                    confirm: () =>
                                      mutate('Роль видалено.', (signal) =>
                                        teamApi.deleteRole(role.id, {
                                          signal,
                                        }),
                                      ),
                                  })
                                }
                                variant="danger"
                              >
                                <Trash2 aria-hidden />
                                Видалити
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                  {teamData.roles.length === 0 && (
                    <li className="text-app-muted text-[13.5px]">
                      Ролей поки немає.
                    </li>
                  )}
                </ul>
                {canManageAccess && (
                  <form
                    className="border-app-line mt-5 grid min-w-0 gap-4 border-t pt-5"
                    onSubmit={(event) => {
                      event.preventDefault()
                      roleCreation.run()
                    }}
                  >
                    <h3 className="text-app-ink text-[14px] font-bold">
                      Нова роль
                    </h3>
                    {roleCreation.error !== null && (
                      <Notice tone="danger">{roleCreation.error}</Notice>
                    )}
                    <Field
                      hint="Наприклад: Диспетчер, Комірник, Продавець."
                      label="Назва нової ролі"
                      required
                    >
                      <TextInput
                        onChange={(event) => setNewRoleName(event.target.value)}
                        value={newRoleName}
                      />
                    </Field>
                    <PermissionChecklist
                      onToggle={toggleNewRolePermission}
                      selected={newRolePermissions}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        {...roleCreation.triggerProps}
                        disabled={
                          roleCreation.pending ||
                          !newRoleName.trim() ||
                          newRolePermissions.length === 0
                        }
                        type="submit"
                        variant="primary"
                      >
                        <Plus aria-hidden />
                        Створити роль
                      </Button>
                    </div>
                  </form>
                )}
              </section>

              <section
                aria-labelledby="team-invitations-heading"
                className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5"
                id="team-invite"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h2
                    className="text-app-ink text-[15px] font-bold"
                    id="team-invitations-heading"
                  >
                    Запрошення
                  </h2>
                  <span className="text-app-dim font-mono text-[12px]">
                    {openInvitations.length === 0
                      ? 'жодного активного'
                      : `${String(openInvitations.length)} ${plural(openInvitations.length, ['діє', 'діють', 'діють'])}`}
                  </span>
                </div>
                <p className="text-app-dim mt-1.5 text-[13px] leading-5 text-pretty">
                  Запрошення — це код, який людина вводить під час реєстрації.
                </p>
                <ul className="mt-4 grid gap-2.5">
                  {teamData.invitations.map((item) => {
                    const status = invitationStatus(item)
                    return (
                      <li
                        className="border-app-line flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[16px] border px-4 py-3.5"
                        key={item.id}
                      >
                        <div className="min-w-0 flex-[1_1_160px]">
                          <p className="text-app-ink font-mono text-[14px] font-bold">
                            {item.code}
                          </p>
                          <p className="text-app-dim mt-0.5 text-[12.5px]">
                            {item.role.name} · діє до{' '}
                            <DateValue value={item.expiresAt} />
                          </p>
                        </div>
                        <StatusPill tone={status.tone}>
                          {status.label}
                        </StatusPill>
                        {canManageAccess && (
                          <div className="ml-auto flex flex-wrap gap-2">
                            <button
                              className="border-app-line text-app-dim inline-flex min-h-11 cursor-not-allowed items-center rounded-[10px] border px-3.5 text-[13px] font-medium"
                              disabled
                              title={NO_RESEND}
                              type="button"
                            >
                              Надіслати ще
                            </button>
                            {status.label === 'Активне' && (
                              <Button
                                aria-label={`Відкликати ${item.code}`}
                                onClick={() =>
                                  askConfirmation({
                                    title: 'Відкликати запрошення',
                                    description: `Код ${item.code} перестане працювати. Створіть нове запрошення, якщо доступ ще потрібен.`,
                                    failure:
                                      'Не вдалося відкликати запрошення. Перевірте зв’язок і спробуйте ще раз.',
                                    confirm: () =>
                                      mutate(
                                        'Запрошення відкликано.',
                                        (signal) =>
                                          teamApi.revokeInvitation(item.id, {
                                            signal,
                                          }),
                                      ),
                                  })
                                }
                                variant="danger"
                              >
                                <Ban aria-hidden />
                                Відкликати
                              </Button>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                  {teamData.invitations.length === 0 && (
                    <li className="text-app-muted text-[13.5px]">
                      Запрошень поки немає.
                    </li>
                  )}
                </ul>
                {canManageAccess && (
                  <form
                    className="border-app-line mt-5 grid min-w-0 gap-3 border-t pt-5 sm:grid-cols-[minmax(0,16rem)_auto] sm:items-end"
                    onSubmit={(event) => {
                      event.preventDefault()
                      const form = new FormData(event.currentTarget)
                      const roleId = form.get('invitation-role')
                      if (typeof roleId === 'string' && roleId) {
                        invitationRoleRef.current = roleId
                        invitationCreation.run()
                      }
                    }}
                  >
                    <Field label="Роль для запрошення">
                      <SelectInput name="invitation-role">
                        {availableRoles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                    <Button
                      {...invitationCreation.triggerProps}
                      type="submit"
                      variant="primary"
                    >
                      <Plus aria-hidden />
                      Створити запрошення
                    </Button>
                  </form>
                )}
                {invitationCreation.error !== null && (
                  <Notice tone="danger">{invitationCreation.error}</Notice>
                )}
                <p className="text-app-dim mt-4 text-[12.5px] leading-5 text-pretty">
                  {NO_EMAIL_INVITE}
                </p>
              </section>
            </div>
          </>
        )}
      </RedesignShell>

      {editingRole !== null && (
        <FormDialog
          description="Змініть назву та права ролі. Зміни діють одразу для всіх, хто має цю роль."
          error={roleUpdate.error}
          onOpenChange={(open) => {
            if (!open) setEditingRole(null)
          }}
          onSubmit={(event) => {
            event.preventDefault()
            roleUpdate.run()
          }}
          open
          pending={roleUpdate.pending}
          size="lg"
          submitDisabled={
            !canManageAccess ||
            !editingRoleName.trim() ||
            editingRolePermissions.length === 0
          }
          submitLabel="Зберегти роль"
          title={`Роль: ${editingRole.name}`}
        >
          <Field label="Назва ролі" required>
            <TextInput
              onChange={(event) => setEditingRoleName(event.target.value)}
              value={editingRoleName}
            />
          </Field>
          <PermissionChecklist
            onToggle={toggleEditingRolePermission}
            selected={editingRolePermissions}
          />
        </FormDialog>
      )}

      {permissionMember !== null && (
        <FormDialog
          description={`Індивідуальні права для ${permissionMember.name}. Вони замінюють права ролі «${permissionMember.role.name}».`}
          error={memberPermissions.error}
          onOpenChange={(open) => {
            if (!open) setPermissionMember(null)
          }}
          onSubmit={(event) => {
            event.preventDefault()
            memberPermissions.run()
          }}
          open
          pending={memberPermissions.pending}
          size="lg"
          submitDisabled={!canManageAccess}
          submitLabel="Зберегти права"
          title={`Права: ${permissionMember.name}`}
        >
          <PermissionChecklist
            legend="Права користувача"
            onToggle={toggleUserPermission}
            selected={selectedPermissions}
          />
        </FormDialog>
      )}

      <AlertDialog.Root
        onOpenChange={(open) => {
          if (!open && !confirmedAction.pending) setConfirmation(null)
        }}
        open={confirmation !== null}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
          {confirmation && (
            <AlertDialog.Content
              className="bg-app-overlay border-app-line-2 rounded-sheet fixed inset-x-3 top-1/2 z-50 grid max-w-md -translate-y-1/2 gap-3 border p-5 text-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
              onCloseAutoFocus={restoreFocus}
            >
              <AlertDialog.Title className="text-lg font-semibold">
                {confirmation.title}
              </AlertDialog.Title>
              <AlertDialog.Description className="text-app-muted text-sm leading-6">
                {confirmation.description}
              </AlertDialog.Description>
              {confirmedAction.error !== null && (
                <Notice tone="danger">{confirmedAction.error}</Notice>
              )}
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {/* Cancel first, and focused on open: the way out of a
                    destructive question is never the default. */}
                <AlertDialog.Cancel asChild>
                  <Button disabled={confirmedAction.pending}>Скасувати</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    aria-busy={confirmedAction.pending}
                    disabled={!canManageAccess || confirmedAction.pending}
                    onClick={(event) => {
                      event.preventDefault()
                      confirmedAction.run()
                    }}
                    variant="danger"
                  >
                    Підтвердити
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          )}
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  )
}

function PermissionChecklist({
  selected,
  onToggle,
  legend = 'Права ролі',
}: {
  selected: string[]
  onToggle: (this: void, permission: string) => void
  legend?: string
}) {
  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="text-app-dim mb-1 text-[13.5px]">
        {legend} — обрано{' '}
        {ALL_PERMISSIONS.filter((item) => selected.includes(item)).length} з{' '}
        {ALL_PERMISSIONS.length}
      </legend>
      {permissionGroups.map((group) => (
        <fieldset className="grid min-w-0 gap-1" key={group.prefix}>
          <legend className="text-app-dim font-mono text-[11.5px] tracking-[0.08em] uppercase">
            {group.title}
          </legend>
          <div className="grid min-w-0 gap-1 sm:grid-cols-2">
            {group.permissions.map((permission) => (
              <label
                className="text-app-muted rounded-control flex min-h-11 min-w-11 items-center gap-2.5 px-2 font-mono text-[13.5px] hover:bg-white/[0.04]"
                key={permission}
              >
                <input
                  aria-label={permission}
                  checked={selected.includes(permission)}
                  className="accent-brand size-4 shrink-0"
                  onChange={() => onToggle(permission)}
                  type="checkbox"
                />
                {permission}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </fieldset>
  )
}
