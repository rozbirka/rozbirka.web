import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/app'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import { cabinetModules, type CabinetModuleKey } from '../module-registry'

/** Where a lost reader usually meant to go, in the order they usually mean it. */
const SHORTCUTS: CabinetModuleKey[] = [
  'dashboard',
  'parts',
  'cars',
  'orders',
  'customers',
  'cash',
]

/**
 * Сторінку не знайдено. The address that failed is shown as it is, because a
 * mistyped link is usually visible in it — and the search box goes to the parts
 * list, the one place in the cabinet that takes a free-text query.
 */
export function CabinetNotFoundScreen() {
  const { targetTenant, snapshot } = useCabinet()
  const location = useLocation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const permitted = SHORTCUTS.filter((key) => {
    const definition = cabinetModules[key]
    if (!definition.released || definition.navigation === undefined)
      return false
    const permission = definition.viewPermission
    return permission === undefined || snapshot?.permissions.has(permission)
  })

  // The one free-text search in the cabinet lives on the parts list; without
  // the right to open it there is nothing to offer.
  const canSearch =
    targetTenant !== null && snapshot?.permissions.has('parts.view') === true

  const search = (event: FormEvent) => {
    event.preventDefault()
    const needle = query.trim()
    if (needle === '' || targetTenant === null) return
    void navigate(
      `${cabinetPath(targetTenant.slug, 'parts')}?q=${encodeURIComponent(needle)}`,
    )
  }

  return (
    <div className="type-redesign -mx-4 -mt-6 grid min-h-[70dvh] place-items-center sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="grid w-full max-w-[620px] gap-6 px-4 py-16 sm:px-6 md:px-8 lg:px-12">
        <div role="alert">
          <p className="text-app-dim font-mono text-[12px] tracking-[0.14em] uppercase">
            Помилка 404
          </p>
          <h1 className="mt-2.5 text-[38px] leading-[1.02] font-extrabold tracking-[-0.03em] text-white sm:text-[46px]">
            Сторінку не знайдено
          </h1>
          <p className="text-app-muted mt-3 max-w-[56ch] text-[14.5px] leading-6 text-pretty">
            Можливо, запис видалили або посилання неповне. Спробуйте знайти
            деталь за номером — або поверніться на головну.
          </p>
        </div>

        {!canSearch ? null : (
          <form
            className="border-app-line bg-app-raised focus-within:border-app-line-2 flex h-13 min-w-0 items-center gap-3 rounded-[14px] border px-4"
            onSubmit={search}
          >
            <Search aria-hidden className="text-app-dim size-4 shrink-0" />
            <input
              aria-label="Пошук запчастин"
              className="text-app-ink placeholder:text-app-dim min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Номер деталі, назва, VIN"
              value={query}
            />
            <button
              className="text-app-muted hover:text-app-ink shrink-0 text-[13px] font-bold"
              type="submit"
            >
              Знайти
            </button>
          </form>
        )}

        <div className="flex flex-wrap gap-2.5">
          {targetTenant === null ? null : (
            <Button
              asChild
              className="px-5 text-sm font-bold"
              variant="primary"
            >
              <Link to={cabinetPath(targetTenant.slug, 'dashboard')}>
                На головну
              </Link>
            </Button>
          )}
          <Button onClick={() => void navigate(-1)}>Назад</Button>
        </div>

        {targetTenant === null || permitted.length === 0 ? null : (
          <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
            <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              Часті розділи
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {permitted.map((key) => (
                <Link
                  className="border-app-line text-app-muted hover:border-app-line-2 hover:text-app-ink inline-flex min-h-11 items-center rounded-[10px] border px-3.5 text-[13px] font-medium"
                  key={key}
                  to={cabinetPath(targetTenant.slug, key)}
                >
                  {cabinetModules[key].navigation?.label ?? key}
                </Link>
              ))}
            </div>
          </section>
        )}

        <p className="text-app-dim font-mono text-[12px] break-all">
          {location.pathname}
        </p>
      </div>
    </div>
  )
}
