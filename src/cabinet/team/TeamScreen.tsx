import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react'
import { Link } from 'react-router'
import {
  Ban,
  KeyRound,
  Power,
  PowerOff,
  SearchX,
  Trash2,
  UserPlus,
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
  SearchInput,
  SelectInput,
  Skeleton,
  SkeletonRows,
  StatusPill,
  useOperation,
  useOptionalToast,
  type StatusTone,
  Sheet,
} from '@/components/app'
import { commonMessages, translate, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { roleLabel, teamMessages } from './messages'
import { Crumbs, RedesignShell } from '../redesign-shell'
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
  { prefix: string; title: TeamKey | null; permissions: string[] }[]
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
  const { locale } = useLocale()
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
  const roleAssignmentRef = useRef<{
    memberId: string
    roleId: string
  } | null>(null)
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
  const availableRoles = useMemo(() => teamData?.roles ?? [], [teamData?.roles])
  const assignableRoles = useMemo(
    () => availableRoles.filter((role) => !isOwnerRole(role)),
    [availableRoles],
  )

  const roleAssignment = useOperation(
    async () => {
      const target = roleAssignmentRef.current
      if (target === null) return false
      return mutate(t('roleUpdated'), (signal) =>
        teamApi.changeRole(target.memberId, target.roleId, { signal }),
      )
    },
    {
      errorMessage: () => t('roleUpdateFailed'),
    },
  )

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
          <SkeletonRows columns={4} label={t('loading')} rows={6} />
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
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                value={query}
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
                    onClick={() => setSegment(one.key)}
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
                        <th scope="col" title={t('noLastSeen')}>
                          {t('columnActivity')}
                        </th>
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
                      {shownMembers.map((member) => (
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
                            {canManageAccess &&
                            member.userId !== myUserId &&
                            !isOwnerRole(member.role) ? (
                              <SelectInput
                                aria-busy={roleAssignment.pending}
                                aria-label={t('roleFor', { name: member.name })}
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
                                {assignableRoles.map((role) => (
                                  <option key={role.id} value={role.id}>
                                    {roleLabel(role, locale)}
                                  </option>
                                ))}
                              </SelectInput>
                            ) : (
                              <span>{roleLabel(member.role, locale)}</span>
                            )}
                          </td>
                          <td
                            className="py-1.5"
                            data-label={t('columnActivity')}
                          >
                            <span className="rz-muted">{t('inTeamSince')}</span>{' '}
                            <span className="rz-mono">
                              <DateValue
                                value={member.joinedAt}
                                withTime={false}
                              />
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
                                    actions={[
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
              <div className="border-app-line flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t px-[var(--rz-cell-px)] py-2.5">
                <p className="rz-caption m-0 text-pretty">
                  <span title={t('noLastSeen')}>{t('lastSeenNote')}</span>{' '}
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
                        <p
                          className="rz-mono text-app-strong m-0 truncate font-semibold"
                          title={item.code}
                        >
                          {item.code}
                        </p>
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
        <Sheet
          description={t('newInvitationDescription')}
          footer={
            <>
              <Button
                disabled={invitationCreation.pending}
                onClick={() => setInvitationDrawerOpen(false)}
                size="lg"
                type="button"
              >
                {tc('cancel')}
              </Button>
              <Button
                aria-busy={invitationCreation.pending}
                disabled={
                  invitationCreation.pending ||
                  !canManageAccess ||
                  !invitationRoleId
                }
                form={INVITATION_FORM}
                size="lg"
                type="submit"
                variant="primary"
              >
                {t('createInvitation')}
              </Button>
            </>
          }
          onOpenChange={(open) => {
            if (!open && !invitationCreation.pending)
              setInvitationDrawerOpen(false)
          }}
          open
          title={t('newInvitation')}
        >
          <form
            aria-busy={invitationCreation.pending}
            className="grid content-start gap-4"
            id={INVITATION_FORM}
            onSubmit={(event) => {
              event.preventDefault()
              invitationCreation.run()
            }}
          >
            {invitationCreation.error !== null && (
              <Notice tone="danger">{invitationCreation.error}</Notice>
            )}
            <fieldset
              aria-describedby="team-invitation-role-hint"
              className="m-0 grid min-w-0 gap-1.5 border-0 p-0"
            >
              <legend className="rz-label mb-1.5 p-0">
                {t('invitationRole')}
                <span aria-hidden className="rz-req">
                  *
                </span>
              </legend>
              <div className="border-app-line bg-app-sheet-field overflow-hidden rounded-rz-sm border">
                {assignableRoles.map((role) => (
                  <ItemRow checked={invitationRoleId === role.id} key={role.id}>
                    <input
                      checked={invitationRoleId === role.id}
                      className="rz-radio shrink-0"
                      name="team-invitation-role"
                      onChange={() => setInvitationRoleId(role.id)}
                      required
                      type="radio"
                      value={role.id}
                    />
                    <span className="rz-strong font-semibold">
                      {roleLabel(role, locale)}
                    </span>
                  </ItemRow>
                ))}
              </div>
              <p className="rz-hint m-0" id="team-invitation-role-hint">
                {t('invitationRoleHint')}
              </p>
            </fieldset>
            <Notice>{t('noEmailInvite')}</Notice>
          </form>
        </Sheet>
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
              <div className="grid gap-1.5">
                <p className="rz-label m-0" role="status">
                  {t('loading')}
                </p>
                <div className="border-app-line bg-app-sheet-field grid gap-2 rounded-rz-sm border p-3">
                  <Skeleton className="h-[30px]" />
                  <Skeleton className="h-[30px]" />
                  <Skeleton className="h-[30px]" />
                </div>
              </div>
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
          <legend className="rz-h-card mb-2.5 p-0">
            {t('selectedCount', {
              legend: group.title === null ? group.prefix : t(group.title),
              selected: group.permissions.filter((item) =>
                selected.includes(item),
              ).length,
              total: group.permissions.length,
            })}
          </legend>
          <div className="border-app-line bg-app-sheet-field overflow-hidden rounded-rz-sm border">
            {group.permissions.map((permission) => (
              <ItemRow checked={false} key={permission}>
                <span className="rz-mono rz-strong min-w-0 flex-1 truncate">
                  {permission}
                </span>
                <input
                  aria-label={permission}
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
const INVITATION_FORM = 'team-invitation-form'
