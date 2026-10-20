import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { Button } from '@/components/app'
import { commonMessages, useLocale, useT } from '@/i18n'
import { accessMessages } from '../access-messages'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import { moduleLabel } from '../module-messages'
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
  const { locale } = useLocale()
  const t = useT(accessMessages)
  const tc = useT(commonMessages)

  const permitted = SHORTCUTS.filter((key) => {
    const definition = cabinetModules[key]
    if (definition.navigation === undefined) return false
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
    <div className="rz-page">
      <section
        aria-label={t('notFoundTitle')}
        className="rz-card rz-state min-h-[50dvh]"
      >
        <div className="grid justify-items-center gap-2" role="alert">
          <p className="rz-eyebrow m-0">{t('notFoundEyebrow')}</p>
          <h1 className="rz-state__title mt-0">{t('notFoundTitle')}</h1>
          <p className="rz-state__body text-pretty">{t('notFoundBody')}</p>
        </div>

        {!canSearch ? null : (
          <form
            className="mt-1.5 flex w-full max-w-[320px] gap-1.5"
            onSubmit={search}
            role="search"
          >
            <label className="rz-search min-w-0 flex-1">
              <Search aria-hidden />
              <input
                aria-label={t('searchParts')}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('searchPartsPlaceholder')}
                value={query}
              />
            </label>
            <Button type="submit">{t('find')}</Button>
          </form>
        )}

        <div className="rz-btn-row mt-1.5 justify-center">
          {targetTenant === null ? null : (
            <Button asChild variant="primary">
              <Link to={cabinetPath(targetTenant.slug, 'dashboard')}>
                {t('toHome')}
              </Link>
            </Button>
          )}
          <Button onClick={() => void navigate(-1)}>{tc('back')}</Button>
        </div>

        {targetTenant === null || permitted.length === 0 ? null : (
          <nav
            aria-label={t('frequentSections')}
            className="mt-3 grid justify-items-center gap-2"
          >
            <h2 className="rz-eyebrow m-0">{t('frequentSections')}</h2>
            <div className="rz-btn-row justify-center">
              {permitted.map((key) => (
                <Button asChild key={key} size="sm">
                  <Link to={cabinetPath(targetTenant.slug, key)}>
                    {moduleLabel(key, locale)}
                  </Link>
                </Button>
              ))}
            </div>
          </nav>
        )}

        <p className="rz-state__meta m-0 mt-1.5 break-all">
          {location.pathname}
        </p>
      </section>
    </div>
  )
}
