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
  Notice,
  PageBody,
  PageHeader,
  SelectInput,
  SkeletonRows,
  StatusPill,
  useOperation,
  type StatusTone,
  Sheet,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { commonMessages, translate, useLocale, useT } from '@/i18n'
import { roleLabel, teamMessages } from './messages'
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

/** Two letters standing in for a photo the API does not keep. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

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
  const accessLostMessage = t('accessLost')
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
      setFeedback(null)
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

      setFeedback(successMessage)
      await refreshAccess()
      return true
    },
    [accessLostMessage, canManage, locale, refreshAccess],
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
      onSuccess: () => setPermissionMember(null),
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
      if (!signal.aborted) setError(t('permissionsLoadFailed'))
    }
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

  if (!canView) {
    return (
      <PageBody>
        <PageHeader eyebrow={t('accessEyebrow')} title={t('title')} />
        <Notice role="alert" tone="danger">
          {t('noViewPermission')}
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
    (one) => invitationStatus(one).active,
  )
  const invitationHistory = (teamData?.invitations ?? []).filter(
    (one) => !invitationStatus(one).active,
  )
  const visibleInvitations = invitationHistoryOpen
    ? [...openInvitations, ...invitationHistory]
    : openInvitations
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
                aria-label={t('searchMembers')}
                className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPlaceholder')}
                value={query}
              />
            </span>
            {canManageAccess && (
              <Button
                className="px-5 text-sm font-bold"
                onClick={openInvitationDrawer}
                type="button"
                variant="primary"
              >
                <Plus aria-hidden />
                {t('invite')}
              </Button>
            )}
          </>
        }
        crumb={t('crumb')}
      >
        <RedesignTitle lead={t('lead')} title={t('title')} />

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
                {t('refreshAccess')}
              </Button>
            }
            role="alert"
            tone="warn"
          >
            {accessWarning}
          </Notice>
        )}
        {loading && <SkeletonRows label={t('loading')} />}

        {teamData && (
          <>
            <KpiStrip>
              <Kpi
                label={t('kpiMembers')}
                meta={`${t('activeCount', { count: activeMembers })}${
                  offMembers === 0
                    ? ''
                    : ` · ${t('offCount', { count: offMembers })}`
                }`}
                value={String(teamData.members.length)}
              />
              <Kpi
                label={t('kpiSeats')}
                meta={
                  seats === null
                    ? t('seatsUnknown')
                    : seats.max == null
                      ? t('seatsUnlimited', {
                          plan: planName ?? t('planFallback'),
                        })
                      : t('seatsFree', {
                          plan: planName ?? t('planFallback'),
                          count: Math.max(seats.max - seats.used, 0),
                        })
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
                label={t('kpiInvitations')}
                meta={
                  openInvitations.length === 0
                    ? t('invitationsNone')
                    : t('invitationsHint')
                }
                value={String(openInvitations.length)}
              />
            </KpiStrip>

            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <div
                aria-label={t('memberState')}
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
                    {t(one.message)}
                    <span className="text-app-dim font-mono text-[12px]">
                      {segmentCounts[one.key]}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-app-dim text-[13px]">
                {t('shownMembers', {
                  shown: shownMembers.length,
                  count: teamData.members.length,
                })}
              </p>
            </div>

            <section
              aria-labelledby="team-members-heading"
              className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
            >
              <h2 className="sr-only" id="team-members-heading">
                {t('members')}
              </h2>
              {shownMembers.length === 0 ? (
                <p className="text-app-muted px-5.5 py-8 text-[14px]">
                  {t('noMembersForFilter')}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[14px]">
                    <caption className="sr-only">{t('membersCaption')}</caption>
                    <thead>
                      <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                        <th className="px-5.5 py-2.5 text-left">
                          {t('columnUser')}
                        </th>
                        <th className="px-3 py-2.5 text-left">
                          {t('columnRole')}
                        </th>
                        <th
                          className="px-3 py-2.5 text-left"
                          title={t('noLastSeen')}
                        >
                          {t('columnActivity')}
                        </th>
                        <th className="px-3 py-2.5 text-left">
                          {t('columnStatus')}
                        </th>
                        {canManageAccess && (
                          // `relative` keeps the visually hidden label's
                          // containing block inside the cell: absolutely
                          // positioned at the page root it would widen the
                          // document and break the 320px floor.
                          <th className="relative px-5.5 py-2.5 text-right">
                            <span className="sr-only">{tc('actions')}</span>
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
                                      {t('itsYou')}
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
                                    title={t('noEmail')}
                                  >
                                    {t('noContact')}
                                  </span>
                                )}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-3.5">
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
                              <span className="text-app-muted">
                                {roleLabel(member.role, locale)}
                              </span>
                            )}
                          </td>
                          <td className="text-app-muted px-3 py-3.5">
                            {t('inTeamSince')}{' '}
                            <DateValue value={member.joinedAt} />
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusPill
                              tone={member.isActive ? 'ok' : 'neutral'}
                            >
                              {member.isActive
                                ? t('memberActive')
                                : t('memberOff')}
                            </StatusPill>
                          </td>
                          {canManageAccess && (
                            <td className="px-5.5 py-3.5">
                              <span className="flex justify-end">
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
                                          description: t('deleteDescription', {
                                            name: member.name,
                                          }),
                                          failure: t('deleteFailed'),
                                          confirm: () =>
                                            mutate(t('deleted'), (signal) =>
                                              teamApi.deleteMember(member.id, {
                                                signal,
                                              }),
                                            ),
                                        }),
                                    },
                                  ]}
                                  label={t('memberActions', {
                                    name: member.name,
                                  })}
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
                  <span title={t('noLastSeen')}>{t('lastSeenNote')}</span>{' '}
                  {seats === null
                    ? t('seatsNoteUnknown')
                    : seats.max == null
                      ? t('seatsNoteUnlimited', { used: seats.used })
                      : t('seatsNote', { used: seats.used, max: seats.max })}
                </p>
                <Link
                  className="text-brand text-[13px] font-bold underline-offset-4 hover:underline"
                  to={`/app/${cabinet.targetTenant?.slug ?? ''}/settings/billing/overview`}
                >
                  {t('raiseLimit')}
                </Link>
              </div>
            </section>

            <section
              aria-labelledby="team-invitations-heading"
              className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
              id="team-invite"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 px-5.5 py-4.5">
                <div>
                  <h2
                    className="text-app-ink text-[15px] font-bold"
                    id="team-invitations-heading"
                  >
                    {t('invitations')}
                  </h2>
                  <p className="text-app-dim mt-1 text-[13px]">
                    {t('invitationsLead')}
                  </p>
                </div>
                <span className="text-app-dim font-mono text-[12px]">
                  {openInvitations.length === 0
                    ? t('noActive')
                    : t('activeInvitations', {
                        count: openInvitations.length,
                      })}
                </span>
              </div>
              <ul className="border-app-line divide-app-line divide-y border-t">
                {visibleInvitations.map((item) => {
                  const status = invitationStatus(item)
                  return (
                    <li
                      className="flex min-w-0 max-w-full items-center gap-3 px-5.5 py-3"
                      key={item.id}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p
                          className="text-app-ink truncate font-mono text-[14px] font-bold"
                          title={item.code}
                        >
                          {item.code}
                        </p>
                        <p className="text-app-dim mt-0.5 text-[12.5px]">
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
                  <li className="text-app-muted px-5.5 py-5 text-[13.5px]">
                    {t('noActiveInvitations')}
                  </li>
                )}
              </ul>
              <div className="border-app-line flex flex-wrap items-center justify-between gap-3 border-t px-5.5 py-3.5">
                <p className="text-app-dim text-[12.5px] leading-5">
                  {t('noEmailInvite')}
                </p>
                {invitationHistory.length > 0 && (
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
                )}
              </div>
            </section>
          </>
        )}
      </RedesignShell>

      {invitationDrawerOpen && (
        <Sheet
          description={t('newInvitationDescription')}
          eyebrow={t('crumb')}
          footer={
            <>
              <Button
                disabled={invitationCreation.pending}
                onClick={() => setInvitationDrawerOpen(false)}
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
            className="grid content-start gap-5"
            id={INVITATION_FORM}
            onSubmit={(event) => {
              event.preventDefault()
              invitationCreation.run()
            }}
          >
            {invitationCreation.error !== null && (
              <Notice tone="danger">{invitationCreation.error}</Notice>
            )}
            <Field
              hint={t('invitationRoleHint')}
              label={t('invitationRole')}
              required
            >
              <SelectInput
                onChange={(event) => setInvitationRoleId(event.target.value)}
                value={invitationRoleId}
              >
                {assignableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {roleLabel(role, locale)}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </form>
        </Sheet>
      )}

      {permissionMember !== null && (
        <Sheet
          description={t('permissionsDescription', {
            name: permissionMember.name,
            role: roleLabel(permissionMember.role, locale),
          })}
          eyebrow={t('permissionsEyebrow')}
          footer={
            <>
              <Button
                disabled={memberPermissions.pending}
                onClick={() => setPermissionMember(null)}
                type="button"
              >
                {tc('cancel')}
              </Button>
              <Button
                aria-busy={memberPermissions.pending}
                disabled={memberPermissions.pending || !canManageAccess}
                form={MEMBER_PERMISSIONS_FORM}
                type="submit"
                variant="primary"
              >
                {t('savePermissions')}
              </Button>
            </>
          }
          onOpenChange={(open) => {
            if (!open && !memberPermissions.pending) setPermissionMember(null)
          }}
          open
          title={t('permissionsTitle', { name: permissionMember.name })}
        >
          <form
            aria-busy={memberPermissions.pending}
            className="grid content-start gap-5"
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
            <PermissionChecklist
              legend={t('userPermissions')}
              onToggle={toggleUserPermission}
              selected={selectedPermissions}
            />
          </form>
        </Sheet>
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
                  <Button disabled={confirmedAction.pending}>
                    {tc('cancel')}
                  </Button>
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
                    {t('confirm')}
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
  legend,
}: {
  selected: string[]
  onToggle: (this: void, permission: string) => void
  legend?: string
}) {
  const t = useT(teamMessages)
  return (
    <fieldset className="grid min-w-0 gap-3">
      <legend className="text-app-dim mb-1 text-[13.5px]">
        {t('selectedCount', {
          legend: legend ?? t('rolePermissions'),
          selected: ALL_PERMISSIONS.filter((item) => selected.includes(item))
            .length,
          total: ALL_PERMISSIONS.length,
        })}
      </legend>
      {permissionGroups.map((group) => (
        <fieldset className="grid min-w-0 gap-1" key={group.prefix}>
          <legend className="text-app-dim font-mono text-[11.5px] tracking-[0.08em] uppercase">
            {group.title === null ? group.prefix : t(group.title)}
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

const MEMBER_PERMISSIONS_FORM = 'team-member-permissions-form'
const INVITATION_FORM = 'team-invitation-form'
