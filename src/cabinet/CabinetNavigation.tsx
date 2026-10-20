import { useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import {
  Ellipsis,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserRound,
  X,
} from 'lucide-react'
import { Dialog, DropdownMenu } from 'radix-ui'
import { Link, NavLink, useLocation } from 'react-router'
import type { Tenant } from '../api/types'
import { commonMessages, useLocale, useT, type Locale } from '@/i18n'
import { commandPaletteHint, openCommandPalette } from './command-palette-open'
import { cn } from '../lib/utils'
import type { TenantAccessSnapshot } from './access-types'
import { cabinetPath } from './cabinet-paths'
import {
  cabinetModules,
  type CabinetModuleDefinition,
  type CabinetModuleKey,
  type CabinetNavigationGroup,
} from './module-registry'
import { moduleLabel, navigationGroupLabel } from './module-messages'
import { evaluateModuleAccess } from './policy'
import { shellMessages } from './shell-messages'
import { TenantSwitcher } from './TenantSwitcher'
import { useNavigationCollapsed } from './use-navigation-collapsed'

interface NavigationEntry {
  key: CabinetModuleKey
  label: string
  icon: NonNullable<CabinetModuleDefinition['navigation']>['icon']
  placement: NonNullable<CabinetModuleDefinition['navigation']>['placement']
  group: CabinetNavigationGroup
  mobilePriority: number
  to: string
}

const groupOrder: readonly CabinetNavigationGroup[] = [
  'overview',
  'stock',
  'sales',
  'money',
  'settings',
]

/** Four tabs fit a phone; everything else lives behind "Ще". */
const MOBILE_TAB_LIMIT = 4

const byMobilePriority = (a: NavigationEntry, b: NavigationEntry) =>
  a.mobilePriority - b.mobilePriority

const groupsOf = (entries: readonly NavigationEntry[], locale: Locale) =>
  groupOrder
    .map((group) => ({
      group,
      label: navigationGroupLabel(group, locale),
      entries: entries.filter((entry) => entry.group === group),
    }))
    .filter((section) => section.entries.length > 0)

export interface CabinetNavigationProps {
  /** Signed-in person's name, for the account menu. */
  userName?: string | null
  tenant: Tenant
  tenants: readonly Tenant[]
  snapshot: TenantAccessSnapshot
  onSwitchTenant: (tenantId: string) => Promise<void>
  onLogout: () => Promise<void>
}

export function CabinetNavigation({
  userName = null,
  tenant,
  tenants,
  snapshot,
  onSwitchTenant,
  onLogout,
}: CabinetNavigationProps) {
  const { locale } = useLocale()
  const entries = useMemo(
    () =>
      Object.values(cabinetModules).flatMap((definition): NavigationEntry[] => {
        const navigation = definition.navigation
        if (
          navigation === undefined ||
          evaluateModuleAccess(
            { ...definition, navigation },
            { status: 'ready', snapshot, error: null },
            'view',
          ).kind !== 'allowed'
        ) {
          return []
        }

        return [
          {
            key: definition.key,
            label: moduleLabel(definition.key, locale),
            icon: navigation.icon,
            placement: navigation.placement,
            group: navigation.group,
            mobilePriority:
              navigation.mobilePriority ?? Number.MAX_SAFE_INTEGER,
            to: cabinetPath(tenant.slug, definition.key),
          },
        ]
      }),
    [locale, snapshot, tenant.slug],
  )

  return (
    <>
      <DesktopNavigation
        entries={entries}
        userName={userName}
        tenant={tenant}
        tenants={tenants}
        onSwitchTenant={onSwitchTenant}
        onLogout={onLogout}
      />
      <TabletNavigation
        entries={entries}
        tenant={tenant}
        tenants={tenants}
        onSwitchTenant={onSwitchTenant}
        onLogout={onLogout}
      />
      <MobileNavigation
        entries={entries}
        tenant={tenant}
        tenants={tenants}
        onSwitchTenant={onSwitchTenant}
        onLogout={onLogout}
      />
    </>
  )
}

interface PresentationProps {
  entries: readonly NavigationEntry[]
  tenant: Tenant
  tenants: readonly Tenant[]
  onSwitchTenant: (tenantId: string) => Promise<void>
  onLogout: () => Promise<void>
}

function DesktopNavigation({
  entries,
  userName,
  tenant,
  tenants,
  onSwitchTenant,
  onLogout,
}: PresentationProps & { userName: string | null }) {
  const primary = entries.filter((entry) => entry.placement === 'primary')
  const account = entries.filter((entry) => entry.placement === 'account')

  const [collapsed, toggleCollapsed] = useNavigationCollapsed()
  const { locale } = useLocale()
  const t = useT(shellMessages)

  if (collapsed) {
    return (
      <Rail
        className="hidden lg:flex"
        entries={entries}
        label={t('nav.desktop')}
        onLogout={onLogout}
        onSwitchTenant={onSwitchTenant}
        tenant={tenant}
        tenants={tenants}
        toggle={
          <RailControl label={t('nav.showMenu')}>
            <button
              aria-controls="cabinet-navigation"
              aria-expanded={false}
              aria-label={t('nav.showMenu')}
              className="rz-nav-item w-9 cursor-pointer justify-center border-0 bg-transparent p-0"
              onClick={toggleCollapsed}
              type="button"
            >
              <PanelLeftOpen aria-hidden />
            </button>
          </RailControl>
        }
      />
    )
  }

  return (
    <aside className="rz-sidebar hidden lg:flex" id="cabinet-navigation">
      <TenantSwitcher
        tenant={tenant}
        tenants={tenants}
        onSwitch={onSwitchTenant}
      />
      <SearchTrigger />
      <nav aria-label={t('nav.desktop')} className="flex flex-col">
        {groupsOf(primary, locale).map((section) => (
          <NavigationList
            entries={section.entries}
            key={section.group}
            label={section.label}
            presentation="desktop"
          />
        ))}
        {account.length > 0 ? (
          <NavigationList
            entries={account}
            label={navigationGroupLabel('settings', locale)}
            presentation="desktop"
          />
        ) : null}
      </nav>
      <div className="border-app-line mt-auto flex items-center gap-2 border-t px-2 pt-2 pb-1">
        <AccountMenu onLogout={onLogout} userName={userName} />
        <button
          aria-controls="cabinet-navigation"
          aria-expanded
          aria-label={t('nav.hideMenu')}
          className="rz-btn rz-btn--ghost rz-btn--sm rz-btn--icon size-6 pointer-coarse:size-control"
          onClick={toggleCollapsed}
          type="button"
        >
          <PanelLeftClose aria-hidden />
        </button>
      </div>
    </aside>
  )
}

/** The sidebar's way into Cmd+K, as v2 draws it under the business switcher. */
function SearchTrigger() {
  const tc = useT(commonMessages)
  return (
    <button
      className="rz-search text-app-dim hover:text-app-muted mt-1 mb-2 w-full cursor-pointer text-left"
      onClick={() => openCommandPalette()}
      type="button"
    >
      <Search aria-hidden />
      <span className="flex-1">{tc('search')}</span>
      <kbd className="rz-kbd">{commandPaletteHint()}</kbd>
    </button>
  )
}

/**
 * Who is signed in, and the way out (D14: logout lives in the account menu,
 * not in the navigation itself).
 */
function AccountMenu({
  onLogout,
  userName,
}: {
  onLogout: () => Promise<void>
  userName: string | null
}) {
  const t = useT(shellMessages)
  const trimmed = userName?.trim() ?? ''
  const name = trimmed === '' ? null : trimmed
  const initials =
    name === null
      ? '·'
      : name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part.charAt(0).toUpperCase())
          .join('')

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="rounded-control hover:bg-app-hover text-app-muted flex min-w-0 flex-1 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left"
          type="button"
        >
          <span aria-hidden className="rz-avatar rz-avatar--round">
            {initials}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {name ?? t('shell.account')}
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          className="rz-menu z-50"
          collisionPadding={16}
          side="top"
          sideOffset={6}
        >
          <DropdownMenu.Item asChild className="rz-menu__item outline-none">
            <Link to="/account">
              <UserRound aria-hidden />
              {t('shell.account')}
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="rz-menu__sep" />
          <DropdownMenu.Item
            className="rz-menu__item outline-none"
            onSelect={() => void onLogout()}
          >
            <LogOut aria-hidden />
            {t('nav.logout')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

function TabletNavigation(props: PresentationProps) {
  const t = useT(shellMessages)
  return (
    <Rail
      {...props}
      className="hidden md:flex lg:hidden"
      label={t('nav.tablet')}
    />
  )
}

/** `.rz-rail`: tablet, and the desktop menu folded away. */
function Rail({
  entries,
  tenant,
  tenants,
  onSwitchTenant,
  onLogout,
  className,
  label,
  toggle,
}: PresentationProps & {
  className: string
  label: string
  toggle?: ReactNode
}) {
  const primary = entries.filter((entry) => entry.placement === 'primary')
  const account = entries.filter((entry) => entry.placement === 'account')
  const { locale } = useLocale()
  const t = useT(shellMessages)

  return (
    <aside
      className={cn(
        'rz-rail scrollbar-none sticky top-0 h-dvh self-start overflow-y-auto',
        className,
      )}
    >
      <RailControl label={t('tenant.switch')}>
        <TenantSwitcher
          compact
          tenant={tenant}
          tenants={tenants}
          onSwitch={onSwitchTenant}
        />
      </RailControl>
      <nav
        aria-label={label}
        className="flex w-full flex-1 flex-col items-center"
      >
        {groupsOf(primary, locale).map((section) => (
          <NavigationList
            entries={section.entries}
            key={section.group}
            presentation="rail"
          />
        ))}
        {account.length > 0 ? (
          <NavigationList entries={account} presentation="rail" />
        ) : null}
      </nav>
      <div className="mt-auto grid justify-items-center gap-0.5">
        <LogoutButton onLogout={onLogout} presentation="rail" />
        {toggle}
      </div>
    </aside>
  )
}

function MobileNavigation({
  entries,
  tenant,
  tenants,
  onSwitchTenant,
  onLogout,
}: PresentationProps) {
  const mobileEntries = [...entries]
    .filter((entry) => entry.placement === 'primary')
    .sort(byMobilePriority)
    .slice(0, MOBILE_TAB_LIMIT)
  const mobileKeys = new Set(mobileEntries.map((entry) => entry.key))
  const moreEntries = entries.filter(
    (entry) => entry.placement !== 'nested' && !mobileKeys.has(entry.key),
  )
  const t = useT(shellMessages)
  // D17: the scanner owns the bottom of the screen for its glove dock.
  const scanning = /\/scan\/?$/.test(useLocation().pathname)
  if (scanning) return null

  return (
    <Dialog.Root>
      <nav aria-label={t('nav.mobile')} className="rz-tabbar md:hidden">
        {mobileEntries.map((entry) => (
          <NavigationLink key={entry.key} entry={entry} presentation="mobile" />
        ))}
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="text-app-muted flex h-12 min-w-14 cursor-pointer flex-col items-center justify-center gap-[3px] border-0 bg-transparent text-micro font-medium"
          >
            <Ellipsis aria-hidden className="size-5" />
            <span>{t('nav.more')}</span>
          </button>
        </Dialog.Trigger>
      </nav>
      <Dialog.Portal>
        <Dialog.Overlay className="bg-app-scrim fixed inset-0 z-50" />
        <Dialog.Content className="rz-card bg-app-overlay border-app-line-2 rounded-sheet shadow-dialog fixed inset-x-2 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 grid max-h-[min(76dvh,42rem)] gap-3 overflow-y-auto p-3.5 md:hidden">
          <div className="flex items-center justify-between">
            <Dialog.Title className="rz-h-title">
              {t('nav.menuTitle')}
            </Dialog.Title>
            <Dialog.Close
              aria-label={t('nav.closeMenu')}
              className="rz-btn rz-btn--ghost rz-btn--icon size-touch"
            >
              <X aria-hidden className="size-[18px]" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            {t('nav.menuDescription')}
          </Dialog.Description>
          <div className="grid grid-cols-2 gap-1">
            {moreEntries.map((entry) => (
              <Dialog.Close asChild key={entry.key}>
                <NavigationLink entry={entry} presentation="dialog" />
              </Dialog.Close>
            ))}
          </div>
          <div className="border-app-line grid gap-1 border-t pt-2.5">
            <p className="rz-caption m-0">{t('nav.currentTenant')}</p>
            <TenantSwitcher
              framed
              tenant={tenant}
              tenants={tenants}
              onSwitch={onSwitchTenant}
            />
            <Dialog.Close asChild>
              <LogoutButton onLogout={onLogout} presentation="dialog" />
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function LogoutButton({
  onLogout,
  presentation,
  ...props
}: {
  onLogout: () => Promise<void>
  presentation: 'rail' | 'dialog'
} & Omit<ComponentProps<'button'>, 'onClick'>) {
  const t = useT(shellMessages)
  const button = (
    <button
      {...props}
      type="button"
      aria-label={presentation === 'rail' ? t('nav.logout') : undefined}
      onClick={() => void onLogout()}
      className={cn(
        'rz-nav-item cursor-pointer border-0 bg-transparent',
        presentation === 'rail' && 'w-9 justify-center p-0',
        presentation === 'dialog' && 'h-touch px-2.5',
      )}
    >
      <LogOut aria-hidden />
      {presentation !== 'rail' && <span>{t('nav.logout')}</span>}
    </button>
  )

  return presentation === 'rail' ? (
    <RailControl label={t('nav.logout')}>{button}</RailControl>
  ) : (
    button
  )
}

function NavigationList({
  entries,
  presentation,
  className,
  label,
}: {
  entries: readonly NavigationEntry[]
  presentation: 'desktop' | 'rail'
  className?: string
  label?: string | null
}) {
  return (
    <div
      className={cn(
        'rz-nav-group',
        presentation === 'rail' && 'justify-items-center',
        className,
      )}
    >
      {presentation === 'desktop' && label ? (
        <p className="rz-nav-group__title">{label}</p>
      ) : null}
      <ul role="list" className="m-0 grid list-none gap-px p-0">
        {entries.map((entry) => (
          <li key={entry.key}>
            {presentation === 'rail' ? (
              <RailControl label={entry.label}>
                <NavigationLink entry={entry} presentation={presentation} />
              </RailControl>
            ) : (
              <NavigationLink entry={entry} presentation={presentation} />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function NavigationLink({
  entry,
  presentation,
  ...props
}: {
  entry: NavigationEntry
  presentation: 'desktop' | 'rail' | 'mobile' | 'dialog'
} & Omit<ComponentProps<typeof NavLink>, 'children' | 'className' | 'to'>) {
  const Icon = entry.icon

  return (
    <NavLink
      {...props}
      aria-label={presentation === 'rail' ? entry.label : undefined}
      className={cn(
        presentation === 'mobile' ? '' : 'rz-nav-item',
        presentation === 'rail' && 'w-9 justify-center p-0',
        presentation === 'dialog' && 'text-app-ink h-touch px-2.5',
      )}
      end
      to={entry.to}
    >
      <Icon aria-hidden />
      {presentation !== 'rail' && <span>{entry.label}</span>}
    </NavLink>
  )
}

function RailControl({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label: string
}) {
  const [hasFocus, setHasFocus] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      className={cn('relative', className)}
      onBlur={() => setHasFocus(false)}
      onFocus={() => setHasFocus(true)}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
    >
      {children}
      <span
        className="cabinet-rail-tooltip"
        hidden={!hasFocus && !isHovered}
        role="tooltip"
      >
        {label}
      </span>
    </div>
  )
}
