import { useEffect, useId, useMemo, useState } from 'react'
import { Dialog } from 'radix-ui'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router'
import { partsApi } from '@/api/parts'
import { carsApi } from '@/api/cars'
import { customersApi } from '@/api/customers'
import { ordersApi } from '@/api/orders'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'
import type { Tenant } from '@/api/types'
import type { TenantAccessSnapshot } from './access-types'
import { cabinetPath } from './cabinet-paths'
import { cabinetModules, type CabinetModuleKey } from './module-registry'
import { evaluateModuleAccess } from './policy'

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
 * already has its own route. So the palette has no on-screen trigger — a
 * keyboard shortcut only exists where there is a keyboard — and it searches
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
        evaluateModuleAccess(
          definition,
          { status: 'ready', snapshot, error: null },
          'view',
        ).kind === 'allowed'
      )
        allowed.add(definition.key)
    return allowed
  }, [snapshot])

  const destinations = useMemo<Command[]>(
    () =>
      Object.values(cabinetModules).flatMap((definition): Command[] => {
        const navigation = definition.navigation
        if (navigation === undefined || !canView.has(definition.key)) return []
        return [
          {
            id: `module:${definition.key}`,
            label: navigation.label,
            detail: null,
            to: cabinetPath(tenant.slug, definition.key),
            icon: navigation.icon,
          },
        ]
      }),
    [canView, tenant.slug],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
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
      void searchEverything(trimmed, canView, tenant.slug, controller.signal)
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
  }, [canView, open, tenant.slug, trimmed])

  const groups = useMemo<CommandGroup[]>(() => {
    const matching = destinations.filter((destination) =>
      destination.label.toLowerCase().includes(trimmed.toLowerCase()),
    )
    return [
      ...(matching.length > 0
        ? [{ key: 'modules', label: 'Розділи', commands: matching }]
        : []),
      ...found,
    ]
  }, [destinations, found, trimmed])

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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="border-app-line bg-app-raised fixed top-[12vh] left-1/2 z-50 grid max-h-[70vh] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-[18px] border shadow-2xl"
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
          <Dialog.Title className="sr-only">Пошук по кабінету</Dialog.Title>
          <div className="border-app-line flex items-center gap-3 border-b px-4">
            <Search aria-hidden className="text-app-dim size-4 shrink-0" />
            <input
              aria-activedescendant={
                current === undefined ? undefined : `${listId}-${current.id}`
              }
              aria-controls={listId}
              aria-label="Пошук по кабінету"
              autoComplete="off"
              className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent py-4 text-[15px] outline-none"
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              aria-expanded={flat.length > 0}
              placeholder="Розділ, деталь, авто, клієнт або замовлення"
              role="combobox"
              value={query}
            />
            <kbd className="text-app-dim border-app-line-2 hidden rounded-[6px] border px-1.5 py-0.5 font-mono text-[11px] sm:block">
              Esc
            </kbd>
          </div>

          <div className="overflow-y-auto p-2" id={listId} role="listbox">
            {flat.length === 0 ? (
              <p className="text-app-muted px-3 py-8 text-center text-sm">
                {trimmed.length < 2
                  ? 'Наберіть принаймні дві літери.'
                  : searching
                    ? 'Шукаємо…'
                    : 'Нічого не знайшли.'}
              </p>
            ) : (
              groups.map((group) => (
                <div className="mb-1" key={group.key}>
                  <p className="text-app-dim px-3 pt-2 pb-1 font-mono text-[10.5px] tracking-[0.14em] uppercase">
                    {group.label}
                  </p>
                  {group.commands.map((command) => {
                    const Icon = command.icon
                    return (
                      <button
                        aria-selected={current?.id === command.id}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-3 rounded-[10px] px-3 text-left text-sm',
                          current?.id === command.id
                            ? 'bg-app-input text-white'
                            : 'text-app-muted hover:bg-white/[0.03]',
                        )}
                        id={`${listId}-${command.id}`}
                        key={command.id}
                        onClick={() => run(command)}
                        onMouseEnter={() =>
                          setActive(
                            flat.findIndex((entry) => entry.id === command.id),
                          )
                        }
                        role="option"
                        type="button"
                      >
                        {Icon === undefined ? null : (
                          <Icon aria-hidden className="size-4 shrink-0" />
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {command.label}
                        </span>
                        {command.detail === null ? null : (
                          <span className="text-app-dim shrink-0 text-[12.5px]">
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
  signal: AbortSignal,
): Promise<CommandGroup[]> {
  const settled = await Promise.allSettled([
    canView.has('parts')
      ? partsApi
          .search({ query, page: 1, pageSize: PER_SOURCE }, { signal })
          .then((page) => ({
            key: 'parts',
            label: 'Деталі',
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
            label: 'Автомобілі',
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
          label: 'Клієнти',
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
            label: 'Замовлення',
            commands: page.items.map((order) => ({
              id: `order:${order.id}`,
              label: `Замовлення №${String(order.number)}`,
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
