import { CabinetLoadingContent } from '../loading-screen'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import {
  Ban,
  Copy,
  KeyRound,
  Power,
  PowerOff,
  SearchX,
  Trash2,
  UserPlus,
  UserRoundCog,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  ConfirmDialog,
  DateValue,
  DeniedState,
  EmptyState,
  ErrorState,
  Notice,
  Pagination,
  SearchInput,
  SkeletonRows,
  StatusPill,
  useOperation,
  useOptionalToast,
  type StatusTone,
  Sheet,
} from '@/components/app'
import { commonMessages, translate, useFormat, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { roleLabel, teamMessages } from './messages'
import { RoleSearchPicker } from './RoleSearchPicker'
import { TeamInvitationDrawer } from './TeamInvitationDrawer'
import { permissionMessages } from './permission-messages'
import { activityDayDifference } from './activity-day'
import { Crumbs, RedesignShell } from '../redesign-shell'
import { ALL_PERMISSIONS, type Permission } from '../access-types'
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
  /** The verb on the confirm button, so the choice reads without the title. */
  verb: string
  /** Bringing someone back is not destructive; the rest is. */
  destructive: boolean
  /** Shown inside the dialog when the action fails, so the retry is one click. */
  failure: string
  confirm(): Promise<boolean>
}

type AccessRefreshState = 'ready' | 'refreshing' | 'failed'

/** The member's own permissions are read when the sheet opens, inside it. */
type PermissionsLoad = 'loading' | 'ready' | 'failed'

type TeamKey = keyof (typeof teamMessages)['uk']

/** The module each permission belongs to, so a role is composed, not hunted. */
const permissionGroupTitles: Record<string, TeamKey> = {
  cars: 'groupCars',
  parts: 'groupParts',
  orders: 'groupOrders',
  customers: 'groupCustomers',
  finance: 'groupFinance',
  intakes: 'groupIntakes',
  inventory: 'groupInventory',
  stickers: 'groupStickers',
  reports: 'groupReports',
  team: 'groupTeam',
  billing: 'groupBilling',
}

const permissionGroups = ALL_PERMISSIONS.reduce<
  { prefix: string; title: TeamKey | null; permissions: Permission[] }[]
>((groups, permission) => {
  const prefix = permission.split('.')[0] ?? permission
  const group = groups.find((candidate) => candidate.prefix === prefix)
  if (group) group.permissions.push(permission)
  else
    groups.push({
      prefix,
      title: permissionGroupTitles[prefix] ?? null,
      permissions: [permission],
    })
  return groups
}, [])

const MEMBER_SEGMENTS = [
  { key: 'all', message: 'segmentAll' },
  { key: 'active', message: 'segmentActive' },
  { key: 'off', message: 'segmentOff' },
] as const

const isOwnerRole = (role: Pick<RoleDto, 'name' | 'isSystem'>) =>
  role.isSystem && role.name.trim().toLowerCase() === 'owner'

const invitationStatus = (
  invitation: InvitationDto,
): { message: TeamKey; tone: StatusTone; active: boolean } => {
  if (invitation.isUsed)
    return { message: 'invitationUsed', tone: 'info', active: false }
  if (invitation.isRevoked)
    return { message: 'invitationRevoked', tone: 'neutral', active: false }
  if (invitation.isExpired)
    return { message: 'invitationExpired', tone: 'warn', active: false }
  return { message: 'invitationActive', tone: 'ok', active: true }
}

export const TeamScreen: ComponentType<CabinetModuleScreenProps> = () => {
  const cabinet = useCabinet()
  const { locale, timeZone } = useLocale()
  const format = useFormat()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  const t = useT(teamMessages)
  const tc = useT(commonMessages)
  const toast = useOptionalToast()
  const accessLostMessage = t('accessLost')
  const [data, setData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessWarning, setAccessWarning] = useState<string | null>(null)
  const [accessRefreshState, setAccessRefreshState] =
    useState<AccessRefreshState>('ready')
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [segment, setSegment] =
    useState<(typeof MEMBER_SEGMENTS)[number]['key']>('all')
  const [permissionMember, setPermissionMember] =
    useState<TeamMemberDto | null>(null)
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [permissionsLoad, setPermissionsLoad] =
    useState<PermissionsLoad>('loading')
  const permissionsRequestRef = useRef(0)
  const [invitationDrawerOpen, setInvitationDrawerOpen] = useState(false)
  const [invitationRoleId, setInvitationRoleId] = useState('')
  const [invitationHistoryOpen, setInvitationHistoryOpen] = useState(false)
  const accessRefreshRequiredRef = useRef(false)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const [roleEdit, setRoleEdit] = useState<{
    memberId: string
    roleId: string
    tenantId: string | null
    generation: number | null
  } | null>(null)
  const memberActionRefs = useRef(new Map<string, HTMLButtonElement>())
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
        setError(translate(teamMessages, locale, 'loadFailed'))
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [generation, locale, tenantId])

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
      setAccessWarning(translate(teamMessages, locale, 'accessRefreshFailed'))
      return false
    }
  }, [cabinet, locale])

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
      setError(null)
      try {
        await operation(signal)
      } catch {
        // A dead request is reported where the user triggered it; a tenant
        // switch is not a failure, it is the old screen going away.
        if (signal.aborted) return false
        throw new Error(translate(teamMessages, locale, 'actionFailed'))
      }
      if (signal.aborted) return false

      toast?.show({ message: successMessage, tone: 'ok' })
      await refreshAccess()
      return true
    },
    [accessLostMessage, canManage, locale, refreshAccess, toast],
  )

  const teamData =
    data?.tenantId === tenantId && data.generation === generation ? data : null
  const copyInvitationCode = async (code: string) => {
    const signal = tenantRequestScope.signal
    try {
      await navigator.clipboard.writeText(code)
      if (signal.aborted) return
      toast?.show({ tone: 'ok', message: t('invitationCodeCopied') })
    } catch {
      if (signal.aborted) return
      if (toast)
        toast.show({ tone: 'danger', message: t('invitationCodeCopyFailed') })
      else setError(t('invitationCodeCopyFailed'))
    }
  }
  const availableRoles = useMemo(() => teamData?.roles ?? [], [teamData?.roles])
  const assignableRoles = useMemo(
    () => availableRoles.filter((role) => !isOwnerRole(role)),
    [availableRoles],
  )

  const roleMember =
    roleEdit?.tenantId === tenantId && roleEdit?.generation === generation
      ? teamData?.members.find((member) => member.id === roleEdit.memberId)
      : undefined
  const roleChoiceValid =
    roleMember !== undefined &&
    roleMember.userId !== cabinet.snapshot?.userId &&
    !isOwnerRole(roleMember.role) &&
    roleEdit !== null &&
    roleEdit.roleId !== roleMember.role.id &&
    assignableRoles.some((role) => role.id === roleEdit.roleId)

  const roleAssignment = useOperation(
    async () => {
      if (!roleChoiceValid || roleEdit === null || roleMember === undefined)
        return false
      return mutate(t('roleUpdated'), (signal) =>
        teamApi.changeRole(roleMember.id, roleEdit.roleId, { signal }),
      )
    },
    {
      errorMessage: () => t('roleUpdateFailed'),
      onSuccess: (updated) => {
        if (updated) setRoleEdit(null)
      },
    },
  )

  const openRoleEditor = (member: TeamMemberDto) => {
    if (
      !canManage() ||
      member.userId === cabinet.snapshot?.userId ||
      isOwnerRole(member.role)
    )
      return
    roleAssignment.reset()
    setError(null)
    setRoleEdit({
      memberId: member.id,
      roleId: member.role.id,
      tenantId,
      generation,
    })
  }

  const memberPermissions = useOperation(
    async () => {
      if (permissionMember === null) return false
      return mutate(t('permissionsUpdated'), (signal) =>
        teamApi.updateUserPermissions(
          permissionMember.userId,
          selectedPermissions,
          { signal },
        ),
      )
    },
    {
      errorMessage: () => t('permissionsSaveFailed'),
      onSuccess: () => closePermissions(),
    },
  )

  const invitationCreation = useOperation(
    async () => {
      if (!assignableRoles.some((role) => role.id === invitationRoleId))
        return false
      return mutate(t('invitationCreated'), (signal) =>
        teamApi.createInvitation(invitationRoleId, { signal }),
      )
    },
    {
      errorMessage: () => t('invitationCreateFailed'),
      onSuccess: (created) => {
        if (created) setInvitationDrawerOpen(false)
      },
    },
  )

  const openInvitationDrawer = () => {
    if (!canManage()) {
      setError(accessLostMessage)
      return
    }
    invitationCreation.reset()
    setInvitationRoleId((current) =>
      assignableRoles.some((role) => role.id === current)
        ? current
        : (assignableRoles[0]?.id ?? ''),
    )
    setInvitationDrawerOpen(true)
  }

  const confirmedAction = useOperation(
    async () => {
      if (confirmation === null) return false
      return confirmation.confirm()
    },
    {
      errorMessage: () => confirmation?.failure ?? t('actionFailed'),
      onSuccess: () => setConfirmation(null),
    },
  )

  const openPermissions = async (member: TeamMemberDto) => {
    if (!canManage()) {
      setError(accessLostMessage)
      return
    }
    const signal = tenantRequestScope.signal
    const request = ++permissionsRequestRef.current
    // The sheet opens at once and loads inside, as the design draws it: the
    // reader sees whose rights are coming, then the rights or the failure.
    memberPermissions.reset()
    setSelectedPermissions([])
    setPermissionsLoad('loading')
    setPermissionMember(member)
    try {
      const result = await teamApi.getUserPermissions(member.userId, { signal })
      if (signal.aborted || request !== permissionsRequestRef.current) return
      if (!canManage()) {
        setPermissionMember(null)
        setError(accessLostMessage)
        return
      }
      setSelectedPermissions(result.permissions)
      setPermissionsLoad('ready')
    } catch {
      if (!signal.aborted && request === permissionsRequestRef.current)
        setPermissionsLoad('failed')
    }
  }

  const closePermissions = () => {
    permissionsRequestRef.current += 1
    setPermissionMember(null)
  }

  const toggleUserPermission = (permission: string) => {
    setSelectedPermissions((current) =>
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

  const crumbs = <Crumbs items={t('crumb').split(' · ')} />

  if (!canView) {
    return (
      <RedesignShell crumb={crumbs}>
        {/* The frame shows the state card alone; the page keeps its name. */}
        <h1 className="sr-only">{t('title')}</h1>
        <DeniedState role="alert" title={t('noViewPermission')} />
      </RedesignShell>
    )
  }

  const pageError = roleMember === undefined ? error : null
  const members = teamData?.members ?? []
  const activeMembers = members.filter((one) => one.isActive).length
  const offMembers = members.length - activeMembers
  const segmentCounts = {
    all: members.length,
    active: activeMembers,
    off: offMembers,
  }
  const needle = query.trim().toLowerCase()
  const selectedRole = availableRoles.some((role) => role.id === roleFilter)
    ? roleFilter
    : ''
  const shownMembers = members
    .filter((one) => !selectedRole || one.role.id === selectedRole)
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
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(shownMembers.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageMembers = shownMembers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const openInvitations = (teamData?.invitations ?? []).filter(
    (one) => invitationStatus(one).active,
  )
  const invitationHistory = (teamData?.invitations ?? []).filter(
    (one) => !invitationStatus(one).active,
  )
  const visibleInvitations = invitationHistoryOpen
    ? [...openInvitations, ...invitationHistory]
    : openInvitations
  const seats = cabinet.snapshot?.entitlement?.usage.users ?? null
  const myUserId = cabinet.snapshot?.userId ?? null
  // A failed first load has nothing to show around it: the whole list area
  // becomes the error state with its retry. A failure after data arrived is a
  // notice above the data that is still true.
  const loadFailed = teamData === null && !loading && error !== null
  const activityLabel = (value: string | null | undefined) => {
    const days = activityDayDifference(value, now, timeZone)
    return days === null
      ? '—'
      : days === 0
        ? t('activityToday')
        : days === 1
          ? t('activityYesterday')
          : format.date(value)
  }

  return (
    <>
      <RedesignShell
        actions={
          canManageAccess ? (
            <Button
              onClick={openInvitationDrawer}
              type="button"
              variant="primary"
            >
              <UserPlus aria-hidden />
              {t('invite')}
            </Button>
          ) : undefined
        }
        crumb={crumbs}
      >
        <div className="rz-page-head">
          <h1 className="rz-h-page">{t('title')}</h1>
        </div>

        {!loadFailed && pageError && <Notice tone="danger">{pageError}</Notice>}
        {accessWarning && (
          <Notice
            action={
              <Button
                disabled={accessRefreshState === 'refreshing'}
                onClick={() => {
                  void refreshAccess()
                }}
              >
                {t('refreshAccess')}
              </Button>
            }
            role="alert"
            tone="warn"
          >
            {accessWarning}
          </Notice>
        )}
        {loading && teamData === null && (
          <CabinetLoadingContent
            module="team"
            heading={false}
            label={t('loading')}
          />
        )}
        {loadFailed && (
          <ErrorState
            description={error}
            onRetry={() => setRefreshNonce((current) => current + 1)}
          />
        )}

        {teamData && (
          <>
            <div className="rz-toolbar" role="search">
              <SearchInput
                aria-label={t('searchMembers')}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder={t('searchPlaceholder')}
                value={query}
              />
              <RoleSearchPicker
                label={t('roleFilter')}
                className="w-full shrink-0 sm:w-44"
                compact
                value={selectedRole}
                roles={availableRoles}
                allLabel={t('allRoles')}
                onSelect={(value) => {
                  setRoleFilter(value)
                  setPage(1)
                }}
              />
              <div
                aria-label={t('memberState')}
                className="rz-seg"
                role="group"
              >
                {MEMBER_SEGMENTS.map((one) => (
                  <button
                    aria-pressed={segment === one.key}
                    key={one.key}
                    onClick={() => {
                      setSegment(one.key)
                      setPage(1)
                    }}
                    type="button"
                  >
                    {t(one.message)}
                    <span className="rz-mono rz-dim">
                      {segmentCounts[one.key]}
                    </span>
                  </button>
                ))}
              </div>
              <p className="rz-toolbar__end rz-dim m-0">
                {t('shownMembers', {
                  shown: shownMembers.length,
                  count: teamData.members.length,
                })}
              </p>
            </div>

            <section
              aria-labelledby="team-members-heading"
              className="rz-table-wrap min-w-0"
            >
              <h2 className="sr-only" id="team-members-heading">
                {t('members')}
              </h2>
              {shownMembers.length === 0 ? (
                <EmptyState
                  className="min-h-[200px] border-0"
                  icon={<SearchX aria-hidden />}
                  title={t('noMembersForFilter')}
                  tone="neutral"
                />
              ) : (
                <div className="rz-table-scroll">
                  <table className="rz-table">
                    <caption>{t('membersCaption')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('columnUser')}</th>
                        <th scope="col">{t('columnRole')}</th>
                        <th scope="col">{t('columnActivity')}</th>
                        <th scope="col">{t('columnStatus')}</th>
                        {canManageAccess && (
                          // `relative` keeps the visually hidden label's
                          // containing block inside the cell: absolutely
                          // positioned at the page root it would widen the
                          // document and break the 320px floor.
                          <th className="relative text-right" scope="col">
                            <span className="sr-only">{tc('actions')}</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {pageMembers.map((member) => (
                        <tr key={member.id}>
                          <th className="py-1.5" scope="row">
                            <span className="grid min-w-0 gap-0.5">
                              <span className="flex flex-wrap items-center gap-2">
                                {member.name}
                                {member.userId === myUserId && (
                                  <StatusPill>{t('itsYou')}</StatusPill>
                                )}
                              </span>
                              {member.phone ? (
                                <span className="rz-caption font-normal">
                                  {member.phone}
                                </span>
                              ) : (
                                <span
                                  className="rz-caption font-normal"
                                  title={t('noEmail')}
                                >
                                  {t('noContact')}
                                </span>
                              )}
                            </span>
                          </th>
                          <td className="py-1.5" data-label={t('columnRole')}>
                            <span>{roleLabel(member.role, locale)}</span>
                          </td>
                          <td
                            className="py-1.5"
                            data-label={t('columnActivity')}
                          >
                            <span
                              className="rz-mono rz-muted"
                              title={
                                format.dateTime(member.lastActiveAt) ??
                                t('activityUnknown')
                              }
                            >
                              {activityLabel(member.lastActiveAt)}
                            </span>
                          </td>
                          <td className="py-1.5" data-label={t('columnStatus')}>
                            <StatusPill
                              tone={member.isActive ? 'ok' : 'neutral'}
                            >
                              {member.isActive
                                ? t('memberActive')
                                : t('memberOff')}
                            </StatusPill>
                          </td>
                          {canManageAccess && (
                            <td className="py-1.5">
                              <span className="flex justify-end">
                                {!isOwnerRole(member.role) ? (
                                  <ActionMenu
                                    triggerRef={(node) => {
                                      if (node)
                                        memberActionRefs.current.set(
                                          member.id,
                                          node,
                                        )
                                      else
                                        memberActionRefs.current.delete(
                                          member.id,
                                        )
                                    }}
                                    actions={[
                                      ...(member.userId === myUserId
                                        ? []
                                        : [
                                            {
                                              key: 'role',
                                              label: t('changeRole'),
                                              icon: (
                                                <UserRoundCog aria-hidden />
                                              ),
                                              disabled: roleAssignment.pending,
                                              onSelect: () =>
                                                openRoleEditor(member),
                                            },
                                          ]),
                                      {
                                        key: 'permissions',
                                        label: t('permissions'),
                                        icon: <KeyRound aria-hidden />,
                                        onSelect: () =>
                                          void openPermissions(member),
                                      },
                                      {
                                        key: 'lifecycle',
                                        label: member.isActive
                                          ? t('deactivate')
                                          : t('activate'),
                                        icon: member.isActive ? (
                                          <PowerOff aria-hidden />
                                        ) : (
                                          <Power aria-hidden />
                                        ),
                                        onSelect: () =>
                                          askConfirmation({
                                            title: member.isActive
                                              ? t('deactivateTitle')
                                              : t('activateTitle'),
                                            description: member.isActive
                                              ? t('deactivateDescription', {
                                                  name: member.name,
                                                })
                                              : t('activateDescription', {
                                                  name: member.name,
                                                  role: roleLabel(
                                                    member.role,
                                                    locale,
                                                  ),
                                                }),
                                            verb: member.isActive
                                              ? t('deactivate')
                                              : t('activate'),
                                            destructive: member.isActive,
                                            failure: member.isActive
                                              ? t('deactivateFailed')
                                              : t('activateFailed'),
                                            confirm: () =>
                                              mutate(
                                                member.isActive
                                                  ? t('deactivated')
                                                  : t('activated'),
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
                                        label: tc('delete'),
                                        icon: <Trash2 aria-hidden />,
                                        destructive: true,
                                        onSelect: () =>
                                          askConfirmation({
                                            title: t('deleteTitle'),
                                            description: t(
                                              'deleteDescription',
                                              {
                                                name: member.name,
                                              },
                                            ),
                                            verb: tc('delete'),
                                            destructive: true,
                                            failure: t('deleteFailed'),
                                            confirm: () =>
                                              mutate(t('deleted'), (signal) =>
                                                teamApi.deleteMember(
                                                  member.id,
                                                  {
                                                    signal,
                                                  },
                                                ),
                                              ),
                                          }),
                                      },
                                    ]}
                                    label={t('memberActions', {
                                      name: member.name,
                                    })}
                                  />
                                ) : null}
                              </span>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <Pagination
                label={t('membersPagination')}
                page={currentPage}
                pageSize={pageSize}
                totalPages={totalPages}
                total={shownMembers.length}
                onPage={setPage}
              />
              <div className="border-app-line flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-[var(--rz-cell-px)] py-2.5">
                <p className="rz-caption m-0 text-pretty">
                  {seats === null
                    ? t('seatsNoteUnknown')
                    : seats.max == null
                      ? t('seatsNoteUnlimited', { used: seats.used })
                      : t('seatsNote', { used: seats.used, max: seats.max })}
                </p>
                <Link
                  className="font-semibold"
                  to={`/app/${cabinet.targetTenant?.slug ?? ''}/settings/billing/overview`}
                >
                  {t('raiseLimit')}
                </Link>
              </div>
            </section>

            <section
              aria-labelledby="team-invitations-heading"
              className="rz-card min-w-0"
              id="team-invite"
            >
              <div className="rz-card__head py-2">
                <div className="min-w-0">
                  <h2 className="rz-h-card" id="team-invitations-heading">
                    {t('invitations')}
                  </h2>
                  <p className="rz-caption m-0">{t('invitationsLead')}</p>
                </div>
                <span className="rz-caption rz-mono">
                  {openInvitations.length === 0
                    ? t('noActive')
                    : t('activeInvitations', {
                        count: openInvitations.length,
                      })}
                </span>
              </div>
              <ul className="divide-app-line m-0 list-none divide-y p-0">
                {visibleInvitations.map((item) => {
                  const status = invitationStatus(item)
                  return (
                    <li
                      className="flex min-h-11 min-w-0 max-w-full items-center gap-3 px-[var(--rz-card-p)] py-2"
                      key={item.id}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        {status.active ? (
                          <Button
                            aria-label={t('copyInvitationCode', {
                              code: item.code,
                            })}
                            title={t('copyInvitationCode', { code: item.code })}
                            className="rz-mono text-app-strong max-w-full justify-start gap-1.5 px-0 font-semibold"
                            variant="quiet"
                            onClick={() => void copyInvitationCode(item.code)}
                          >
                            <span className="truncate">{item.code}</span>
                            <Copy
                              aria-hidden
                              className="text-app-dim size-3.5 shrink-0"
                            />
                          </Button>
                        ) : (
                          <p
                            className="rz-mono text-app-strong m-0 truncate font-semibold"
                            title={item.code}
                          >
                            {item.code}
                          </p>
                        )}
                        <p className="rz-caption m-0">
                          {t('validUntil', {
                            role: roleLabel(item.role, locale),
                          })}{' '}
                          <DateValue value={item.expiresAt} />
                        </p>
                      </div>
                      <StatusPill tone={status.tone}>
                        {t(status.message)}
                      </StatusPill>
                      {canManageAccess && status.active && (
                        <span className="shrink-0">
                          <ActionMenu
                            actions={[
                              {
                                key: 'revoke',
                                label: t('revoke'),
                                icon: <Ban aria-hidden />,
                                destructive: true,
                                onSelect: () =>
                                  askConfirmation({
                                    title: t('revokeTitle'),
                                    description: t('revokeDescription', {
                                      code: item.code,
                                    }),
                                    verb: t('revoke'),
                                    destructive: true,
                                    failure: t('revokeFailed'),
                                    confirm: () =>
                                      mutate(t('revoked'), (signal) =>
                                        teamApi.revokeInvitation(item.id, {
                                          signal,
                                        }),
                                      ),
                                  }),
                              },
                            ]}
                            label={t('invitationActions', { code: item.code })}
                          />
                        </span>
                      )}
                    </li>
                  )
                })}
                {visibleInvitations.length === 0 && (
                  <li className="rz-muted px-[var(--rz-card-p)] py-4">
                    {t('noActiveInvitations')}
                  </li>
                )}
              </ul>
              {invitationHistory.length > 0 && (
                <div className="rz-card__foot flex-wrap items-center">
                  <Button
                    aria-expanded={invitationHistoryOpen}
                    onClick={() =>
                      setInvitationHistoryOpen((current) => !current)
                    }
                    type="button"
                  >
                    {invitationHistoryOpen
                      ? t('hideHistory')
                      : t('invitationHistory', {
                          count: invitationHistory.length,
                        })}
                  </Button>
                </div>
              )}
            </section>
          </>
        )}
      </RedesignShell>

      {invitationDrawerOpen && (
        <TeamInvitationDrawer
          roles={assignableRoles}
          roleId={invitationRoleId}
          onRoleChange={setInvitationRoleId}
          onSubmit={invitationCreation.run}
          onClose={() => setInvitationDrawerOpen(false)}
          pending={invitationCreation.pending}
          error={invitationCreation.error}
          canManage={canManageAccess}
        />
      )}

      {roleMember !== undefined && roleEdit !== null && (
        <ConfirmDialog
          title={t('changeRole')}
          consequence={t('changeRoleDescription', { name: roleMember.name })}
          confirmLabel={tc('save')}
          confirmDisabled={!canManageAccess || !roleChoiceValid}
          destructive={false}
          error={
            roleAssignment.error ??
            (!roleAssignment.pending && !canManageAccess
              ? accessLostMessage
              : null)
          }
          open
          pending={roleAssignment.pending}
          onConfirm={roleAssignment.run}
          onOpenChange={(open) => {
            if (!open && !roleAssignment.pending) setRoleEdit(null)
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            memberActionRefs.current.get(roleEdit.memberId)?.focus()
          }}
        >
          <RoleSearchPicker
            label={t('roleFor', { name: roleMember.name })}
            showLabel
            busy={roleAssignment.pending}
            disabled={!canManageAccess}
            roles={assignableRoles}
            value={roleEdit.roleId}
            onSelect={(roleId) =>
              setRoleEdit((current) => current && { ...current, roleId })
            }
          />
        </ConfirmDialog>
      )}

      {permissionMember !== null && (
        <Sheet
          description={t('permissionsDescription', {
            name: permissionMember.name,
            role: roleLabel(permissionMember.role, locale),
          })}
          footer={
            <>
              <Button
                disabled={memberPermissions.pending}
                onClick={closePermissions}
                size="lg"
                type="button"
              >
                {tc('cancel')}
              </Button>
              <Button
                aria-busy={memberPermissions.pending}
                disabled={
                  memberPermissions.pending ||
                  !canManageAccess ||
                  permissionsLoad !== 'ready'
                }
                form={MEMBER_PERMISSIONS_FORM}
                size="lg"
                type="submit"
                variant="primary"
              >
                {t('savePermissions')}
              </Button>
            </>
          }
          onOpenChange={(open) => {
            if (!open && !memberPermissions.pending) closePermissions()
          }}
          open
          size="lg"
          title={t('permissionsTitle', { name: permissionMember.name })}
        >
          <form
            aria-busy={
              memberPermissions.pending || permissionsLoad === 'loading'
            }
            className="grid content-start gap-4"
            id={MEMBER_PERMISSIONS_FORM}
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              memberPermissions.run()
            }}
          >
            {memberPermissions.error === null ? null : (
              <Notice tone="danger">{memberPermissions.error}</Notice>
            )}
            {permissionsLoad === 'failed' ? (
              <Notice tone="danger">{t('permissionsLoadFailed')}</Notice>
            ) : permissionsLoad === 'loading' ? (
              <SkeletonRows label={t('loading')} rows={4} />
            ) : (
              <PermissionChecklist
                legend={t('userPermissions')}
                onToggle={toggleUserPermission}
                selected={selectedPermissions}
              />
            )}
          </form>
        </Sheet>
      )}

      <ConfirmDialog
        cancelLabel={tc('cancel')}
        confirmDisabled={!canManageAccess}
        confirmLabel={confirmation?.verb ?? t('confirm')}
        consequence={confirmation?.description ?? ''}
        destructive={confirmation?.destructive ?? true}
        error={confirmedAction.error}
        onCloseAutoFocus={restoreFocus}
        onConfirm={confirmedAction.run}
        onOpenChange={(open) => {
          if (!open && !confirmedAction.pending) setConfirmation(null)
        }}
        open={confirmation !== null}
        pending={confirmedAction.pending}
        title={confirmation?.title ?? ''}
      />
    </>
  )
}

/**
 * One row of a sheet's item list, as the module page draws it: 44px, a hair
 * line between rows, and the chosen row tinted with a brand edge.
 */
function ItemRow({
  checked,
  children,
}: {
  checked: boolean
  children: ReactNode
}) {
  return (
    <label
      className={cn(
        'border-app-line flex min-h-11 min-w-0 cursor-pointer items-center gap-3 px-3 py-2 [&+&]:border-t',
        checked
          ? 'bg-app-row-selected shadow-[inset_2px_0_0_var(--rz-brand)]'
          : 'hover:bg-app-hover',
      )}
    >
      {children}
    </label>
  )
}

function PermissionChecklist({
  selected,
  onToggle,
  legend,
}: {
  selected: string[]
  onToggle: (this: void, permission: string) => void
  legend?: string
}) {
  const t = useT(teamMessages)
  const tp = useT(permissionMessages)
  const id = useId()
  return (
    <fieldset className="m-0 grid min-w-0 gap-4 border-0 p-0">
      <legend className="rz-label mb-1 p-0">
        {t('selectedCount', {
          legend: legend ?? t('rolePermissions'),
          selected: ALL_PERMISSIONS.filter((item) => selected.includes(item))
            .length,
          total: ALL_PERMISSIONS.length,
        })}
      </legend>
      {permissionGroups.map((group) => (
        <fieldset
          className="m-0 grid min-w-0 gap-2.5 border-0 p-0"
          key={group.prefix}
        >
          <legend className="mb-2.5 w-full p-0">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="rz-h-card">
                {group.title === null ? group.prefix : t(group.title)}
              </span>
              <span className="bg-app-raised text-app-muted rounded-full px-2 py-0.5 font-mono text-caption tabular-nums">
                {t('permissionFraction', {
                  selected: group.permissions.filter((item) =>
                    selected.includes(item),
                  ).length,
                  total: group.permissions.length,
                })}
              </span>
            </span>
          </legend>
          <div className="border-app-line bg-app-sheet-field overflow-hidden rounded-rz-sm border">
            {group.permissions.map((permission) => (
              <ItemRow checked={false} key={permission}>
                <span className="grid min-w-0 flex-1 gap-0.5 py-0.5">
                  <span className="rz-strong break-words font-medium">
                    {tp(permission)}
                  </span>
                  <span
                    className="text-app-muted break-words text-caption"
                    id={`${id}-${permission}-hint`}
                  >
                    {tp(`${permission}.hint`)}
                  </span>
                </span>
                <input
                  aria-label={tp(permission)}
                  aria-describedby={`${id}-${permission}-hint`}
                  checked={selected.includes(permission)}
                  className="rz-check shrink-0"
                  onChange={() => onToggle(permission)}
                  type="checkbox"
                />
              </ItemRow>
            ))}
          </div>
        </fieldset>
      ))}
    </fieldset>
  )
}

const MEMBER_PERMISSIONS_FORM = 'team-member-permissions-form'
