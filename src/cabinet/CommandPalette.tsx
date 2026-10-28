import { useEffect, useId, useMemo, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { partsApi } from '@/api/parts'
import { carsApi } from '@/api/cars'
import { customersApi } from '@/api/customers'
import { ordersApi } from '@/api/orders'
import {
  translate,
  useLocale,
  useT,
  type Locale,
  type MessageKey,
  type MessageParams,
} from '@/i18n'
import type { LucideIcon } from 'lucide-react'
import type { Tenant } from '@/api/types'
import type { TenantAccessSnapshot } from './access-types'
import { cabinetPath } from './cabinet-paths'
import { onOpenCommandPalette } from './command-palette-open'
import { moduleLabel } from './module-messages'
import { cabinetModules, type CabinetModuleKey } from './module-registry'
import { evaluateModuleAccess } from './policy'
import { stickerNavigationTarget } from './stickers/sticker-access'
import { shellMessages } from './shell-messages'

interface Command {
  id: string
  label: string
  /** What tells this result apart from a namesake: a code, a customer, a sum. */
  detail: string | null
  to: string
  icon?: LucideIcon | undefined
}

interface CommandGroup {
  key: string
  label: string
  commands: Command[]
}

const SEARCH_DEBOUNCE_MS = 250
const PER_SOURCE = 5

/**
 * Cmd+K for the office roles.
 *
 * The research is explicit that this is a desktop tool and useless in the
 * yard: out there it is a phone, one hand and a scanner, and the scanner
 * already has its own route. So the only on-screen trigger is the dashboard's
 * own search field, which asks through `openCommandPalette`; everywhere else
 * it is the shortcut, which only exists where there is a keyboard. It searches
 * only the modules this account may open, asking each list endpoint the same
 * question the list screens ask.
 */
export function CommandPalette({
  tenant,
  snapshot,
}: {
  tenant: Tenant
  snapshot: TenantAccessSnapshot
}) {
  const navigate = useNavigate()
  const { locale } = useLocale()
  const t = useT(shellMessages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<CommandGroup[]>([])
  const [searching, setSearching] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()

  const canView = useMemo(() => {
    const allowed = new Set<CabinetModuleKey>()
    for (const definition of Object.values(cabinetModules))
      if (
        definition.key === 'stickers'
          ? stickerNavigationTarget(tenant.slug, {
              status: 'ready',
              snapshot,
              error: null,
            }) !== null
          : evaluateModuleAccess(
              definition,
              { status: 'ready', snapshot, error: null },
              'view',
            ).kind === 'allowed'
      )
        allowed.add(definition.key)
    return allowed
  }, [snapshot, tenant.slug])

  const destinations = useMemo<Command[]>(
    () =>
      Object.values(cabinetModules).flatMap((definition): Command[] => {
        const navigation = definition.navigation
        if (navigation === undefined || !canView.has(definition.key)) return []
        return [
          {
            id: `module:${definition.key}`,
            label: moduleLabel(definition.key, locale),
            detail: null,
            to:
              definition.key === 'stickers'
                ? stickerNavigationTarget(tenant.slug, {
                    status: 'ready',
                    snapshot,
                    error: null,
                  })!
                : cabinetPath(tenant.slug, definition.key),
            icon: navigation.icon,
          },
        ]
      }),
    [canView, locale, snapshot, tenant.slug],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    const stopListening = onOpenCommandPalette(() => setOpen(true))
    return () => {
      window.removeEventListener('keydown', onKey)
      stopListening()
    }
  }, [])

  const trimmed = query.trim()

  useEffect(() => {
    const controller = new AbortController()
    // Everything happens after the debounce, including clearing: results from
    // the previous keystroke stay on screen while the next one is being typed,
    // instead of the list emptying between every letter.
    const timer = setTimeout(() => {
      if (!open || trimmed.length < 2) {
        setFound([])
        setSearching(false)
        return
      }
      setSearching(true)
      void searchEverything(
        trimmed,
        canView,
        tenant.slug,
        locale,
        controller.signal,
      )
        .then((groups) => {
          if (controller.signal.aborted) return
          setFound(groups)
          setSearching(false)
        })
        .catch(() => {
          if (controller.signal.aborted) return
          setFound([])
          setSearching(false)
        })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [canView, locale, open, tenant.slug, trimmed])

  const groups = useMemo<CommandGroup[]>(() => {
    const matching = destinations.filter((destination) =>
      destination.label.toLowerCase().includes(trimmed.toLowerCase()),
    )
    return [
      ...(matching.length > 0
        ? [{ key: 'modules', label: t('palette.modules'), commands: matching }]
        : []),
      ...found,
    ]
  }, [destinations, found, t, trimmed])

  const flat = groups.flatMap((group) => group.commands)
  const current = flat[Math.min(active, Math.max(flat.length - 1, 0))]

  const run = (command: Command | undefined) => {
    if (command === undefined) return
    setOpen(false)
    setQuery('')
    void navigate(command.to)
  }

  return (
    <Dialog.Root
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
        setActive(0)
      }}
      open={open}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="rz-scrim content-start max-sm:p-3 sm:pt-10">
          <Dialog.Content
            aria-describedby={undefined}
            className="rz-dialog max-h-[min(400px,90dvh)] max-w-[600px] grid-rows-[auto_minmax(0,1fr)]"
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((value) => Math.min(value + 1, flat.length - 1))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((value) => Math.max(value - 1, 0))
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                run(current)
              }
            }}
          >
            <Dialog.Title className="sr-only">
              {t('palette.title')}
            </Dialog.Title>
            <div className="rz-search border-app-line h-12 rounded-none border-x-0 border-t-0 bg-transparent px-3.5">
              <Search aria-hidden />
              <input
                aria-activedescendant={
                  current === undefined ? undefined : `${listId}-${current.id}`
                }
                aria-controls={listId}
                aria-label={t('palette.title')}
                autoComplete="off"
                className="text-input text-app-strong placeholder:text-app-dim"
                onChange={(event) => {
                  const next = event.target.value
                  setQuery(next)
                  setFound([])
                  setSearching(next.trim().length >= 2)
                  setActive(0)
                }}
                aria-expanded={flat.length > 0}
                placeholder={t('palette.placeholder')}
                role="combobox"
                value={query}
              />
              <kbd className="rz-kbd max-sm:hidden">Esc</kbd>
            </div>

            <div className="overflow-y-auto p-1.5" id={listId} role="listbox">
              {flat.length === 0 ? (
                <p className="rz-muted m-0 px-3 py-8 text-center">
                  {trimmed.length < 2
                    ? t('palette.typeMore')
                    : searching
                      ? t('palette.searching')
                      : t('palette.nothing')}
                </p>
              ) : (
                groups.map((group) => (
                  <div className="mb-1 grid gap-px" key={group.key}>
                    <p className="text-app-dim m-0 px-2 pt-2 pb-1 text-micro font-semibold">
                      {group.label}
                    </p>
                    {group.commands.map((command) => {
                      const Icon = command.icon
                      return (
                        <button
                          aria-selected={current?.id === command.id}
                          className="rz-menu__item w-full"
                          data-highlighted={
                            current?.id === command.id ? '' : undefined
                          }
                          id={`${listId}-${command.id}`}
                          key={command.id}
                          onClick={() => run(command)}
                          onMouseEnter={() =>
                            setActive(
                              flat.findIndex(
                                (entry) => entry.id === command.id,
                              ),
                            )
                          }
                          role="option"
                          type="button"
                        >
                          {Icon === undefined ? null : (
                            <Icon
                              aria-hidden
                              className="text-app-dim shrink-0"
                            />
                          )}
                          <span className="min-w-0 flex-1 truncate">
                            {command.label}
                          </span>
                          {command.detail === null ? null : (
                            <span className="rz-mono text-app-dim shrink-0 text-caption">
                              {command.detail}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))
              )}
            </div>
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/**
 * Asks every list this account may open, at once. One source failing does not
 * empty the palette — the others still answer.
 */
async function searchEverything(
  query: string,
  canView: ReadonlySet<CabinetModuleKey>,
  slug: string,
  locale: Locale,
  signal: AbortSignal,
): Promise<CommandGroup[]> {
  const t = (key: MessageKey<typeof shellMessages>, params?: MessageParams) =>
    translate(shellMessages, locale, key, params)
  const settled = await Promise.allSettled([
    canView.has('parts')
      ? partsApi
          .search({ query, page: 1, pageSize: PER_SOURCE }, { signal })
          .then((page) => ({
            key: 'parts',
            label: t('palette.parts'),
            commands: page.items.map((part) => ({
              id: `part:${part.id}`,
              label: part.name,
              detail: part.car
                ? `${part.car.make} ${part.car.model}`
                : (part.oemCode ?? null),
              to: cabinetPath(slug, 'parts', part.id),
            })),
          }))
      : null,
    canView.has('cars')
      ? carsApi
          .list({ search: query, page: 1, pageSize: PER_SOURCE }, { signal })
          .then((page) => ({
            key: 'cars',
            label: t('palette.cars'),
            commands: page.items.map((car) => ({
              id: `car:${car.id}`,
              label: `${car.brand} ${car.model}`,
              detail: car.code,
              to: cabinetPath(slug, 'cars', car.id),
            })),
          }))
      : null,
    canView.has('customers')
      ? customersApi.search(query, { signal }).then((items) => ({
          key: 'customers',
          label: t('palette.customers'),
          commands: items.slice(0, PER_SOURCE).map((customer) => ({
            id: `customer:${customer.id}`,
            label: customer.name,
            detail: customer.phone,
            to: cabinetPath(slug, 'customers', customer.id),
          })),
        }))
      : null,
    canView.has('orders')
      ? ordersApi
          .list({ search: query, page: 1, pageSize: PER_SOURCE }, { signal })
          .then((page) => ({
            key: 'orders',
            label: t('palette.orders'),
            commands: page.items.map((order) => ({
              id: `order:${order.id}`,
              label: t('palette.order', { number: String(order.number) }),
              detail: order.customerName,
              to: cabinetPath(slug, 'orders', order.id),
            })),
          }))
      : null,
  ])

  return settled.flatMap((result) =>
    result.status === 'fulfilled' &&
    result.value !== null &&
    result.value.commands.length > 0
      ? [
          {
            key: result.value.key,
            label: result.value.label,
            commands: result.value.commands.map((command) => ({
              ...command,
              detail: command.detail ?? null,
            })),
          },
        ]
      : [],
  )
}
