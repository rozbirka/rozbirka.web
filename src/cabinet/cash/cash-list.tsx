import { useRowNavigation } from '@/components/app/use-row-navigation'
import { cashOrderHref } from './cash-navigation'
import { CabinetLoadingContent } from '../loading-screen'
import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRightLeft, ChevronRight, Plus, WalletCards } from 'lucide-react'
import {
  Button,
  ErrorState,
  Notice,
  SearchInput,
  StatusPill,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { moduleMessages } from '../module-messages'
import type { CashDailySummary, CashRegister } from '@/api/cash'
import { useCashText } from './cash-labels'
import { cashMessages } from './cash-messages'
import type { CashFeedEntry } from './cash-feed'
import { Kpi, KpiStrip } from '../redesign-kpi'
import { RedesignShell } from '../redesign-shell'

const SEGMENTS = [
  { key: 'all', label: 'segAll' },
  { key: 'active', label: 'segActive' },
  { key: 'bank', label: 'segBank' },
] as const

/**
 * Гроші · Каси — the till list. Balances are shown per currency and never
 * summed: the server keeps each currency separately and converts nothing, and
 * the screen says so out loud rather than inventing a rate.
 */
export function CashList({
  cashHref = '',
  ordersPath = null,
  registers,
  summary,
  feed,
  feedTruncated,
  date,
  canCreate,
  canTransfer,
  onTransfer,
  error = null,
  loading = false,
  onRetry,
}: {
  cashHref?: string
  ordersPath?: string | null
  registers: readonly CashRegister[]
  summary: CashDailySummary | null
  /** Latest movements merged from each till; the API has no shared feed. */
  feed: readonly CashFeedEntry[]
  /** True when only part of the tills were asked for their latest movements. */
  feedTruncated: boolean
  date: string
  canCreate: boolean
  canTransfer: boolean
  onTransfer: () => void
  /** A failed load, shown under the page title. */
  error?: string | null
  /** The first load is still on its way: nothing to count or list yet. */
  loading?: boolean
  /** Reloads after a failed first load. */
  onRetry?: () => void
}) {
  const navigateRow = useRowNavigation()
  const registerHref = (id: string) =>
    `${cashHref ? `${cashHref}/` : ''}${encodeURIComponent(id)}`
  const entryHref = (entry: CashFeedEntry) =>
    cashOrderHref(entry, ordersPath) ?? registerHref(entry.registerId)
  const t = useT(cashMessages)
  const {
    count,
    money,
    moment,
    movementText,
    registerHint,
    registerType,
    signedMoney,
  } = useCashText()
  const [segment, setSegment] =
    useState<(typeof SEGMENTS)[number]['key']>('all')
  const [query, setQuery] = useState('')

  const counts = {
    all: registers.length,
    active: registers.filter((one) => one.isActive).length,
    bank: registers.filter((one) => one.type === 'bank').length,
  }
  const needle = query.trim().toLowerCase()
  const shown = registers
    .filter(
      (one) =>
        segment === 'all' ||
        (segment === 'active' ? one.isActive : one.type === segment),
    )
    .filter((one) => needle === '' || one.name.toLowerCase().includes(needle))

  const active = registers.filter((one) => one.isActive).length
  const closed = registers.length - active
  const operations = (summary?.registers ?? []).reduce(
    (sum, register) =>
      sum +
      register.currencies.reduce(
        (inner, currency) => inner + currency.operationCount,
        0,
      ),
    0,
  )
  const income = (summary?.registers ?? []).filter((register) =>
    register.currencies.some((currency) => currency.income > 0),
  ).length

  const dayOf = (id: string) =>
    summary?.registers.find((one) => one.id === id)?.currencies ?? []

  return (
    <RedesignShell
      actions={
        <>
          {canTransfer ? (
            <Button onClick={onTransfer}>
              <ArrowRightLeft aria-hidden />
              {t('transfer')}
            </Button>
          ) : null}
          {canCreate ? (
            <Button asChild variant="primary">
              <Link to="new">
                <Plus aria-hidden />
                {t('newTill')}
              </Link>
            </Button>
          ) : null}
        </>
      }
      crumb={<CashCrumbs />}
    >
      <div className="rz-page-head">
        <h1 className="rz-h-page">{t('title')}</h1>
        <span className="rz-muted text-pretty">{t('lead')}</span>
      </div>

      {loading ? (
        <CabinetLoadingContent module="cash" heading={false} />
      ) : error !== null && registers.length === 0 ? (
        // Nothing loaded at all: the failure is the page, with its retry.
        <ErrorState
          description={error}
          {...(onRetry === undefined ? {} : { onRetry })}
        />
      ) : (
        board()
      )}
    </RedesignShell>
  )

  function board() {
    return (
      <>
        {error === null ? null : <Notice tone="danger">{error}</Notice>}

        <KpiStrip>
          <Kpi
            label={t('kpiTills')}
            meta={
              closed === 0
                ? t('activeCount', { count: active })
                : `${t('activeCount', { count: active })} · ${t('closedCount', { count: closed })}`
            }
            value={count(registers.length)}
          />
          <Kpi
            label={t('kpiDayOperations')}
            meta={
              summary === null
                ? t('daySummaryPending')
                : `${date} · ${t('tillsWithIncome', { count: income })}`
            }
            value={count(operations)}
          />
        </KpiStrip>

        <div className="rz-toolbar" role="search">
          <SearchInput
            aria-label={t('searchLabel')}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('tillName')}
            value={query}
          />
          <div aria-label={t('filterLabel')} className="rz-seg" role="group">
            {SEGMENTS.map((one) => (
              <button
                aria-pressed={segment === one.key}
                key={one.key}
                onClick={() => setSegment(one.key)}
                type="button"
              >
                {t(one.label)}
                <span className="rz-mono rz-dim">{count(counts[one.key])}</span>
              </button>
            ))}
          </div>
          <p className="rz-toolbar__end rz-dim m-0">
            {t('shownTills', { shown: shown.length, count: registers.length })}
          </p>
        </div>

        <div className="rz-table-wrap">
          {shown.length === 0 ? (
            <div className="rz-state">
              <span className="rz-state__icon">
                <WalletCards aria-hidden />
              </span>
              <h2 className="rz-state__title">{t('noTillsFiltered')}</h2>
            </div>
          ) : (
            <div className="rz-table-scroll">
              <table className="rz-table">
                <caption>{t('title')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('colTill')}</th>
                    <th scope="col">{t('currency')}</th>
                    <th className="rz-num" scope="col">
                      {t('balances')}
                    </th>
                    <th className="rz-num" scope="col">
                      {t('kpiDayOperations')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((register) => {
                    const currencies = Object.entries(register.balances)
                    const hint = registerHint(register.type)
                    const operationCount = dayOf(register.id).reduce(
                      (sum, one) => sum + one.operationCount,
                      0,
                    )
                    return (
                      <tr
                        className="cursor-pointer"
                        key={register.id}
                        onClick={(event) =>
                          navigateRow(event, registerHref(register.id))
                        }
                      >
                        <th className="py-1" scope="row">
                          <span className="rz-cell-main">
                            <Link
                              className="text-app-strong hover:text-brand-text"
                              to={registerHref(register.id)}
                            >
                              {register.name}
                            </Link>
                            <StatusPill
                              className="shrink-0"
                              tone={register.isActive ? 'ok' : 'neutral'}
                            >
                              {register.isActive ? t('active') : t('inactive')}
                            </StatusPill>
                          </span>
                          <span className="rz-caption block font-normal">
                            {registerType(register.type)}
                            {hint === null ? '' : ` · ${hint}`}
                          </span>
                        </th>
                        <td className="py-1" data-label={t('currency')}>
                          {currencies.length === 0 ? (
                            <span className="rz-dim">{t('noCurrencies')}</span>
                          ) : (
                            <span className="grid gap-0.5">
                              {currencies.map(([currency]) => (
                                <span className="rz-mono" key={currency}>
                                  {currency}
                                </span>
                              ))}
                            </span>
                          )}
                        </td>
                        <td className="rz-num py-1" data-label={t('balances')}>
                          <span className="grid justify-items-end gap-0.5">
                            {currencies.map(([currency, balance]) => (
                              <span
                                className={cn(balance === 0 && 'rz-dim')}
                                key={currency}
                              >
                                {money(balance, currency)}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td
                          className="rz-num py-1"
                          data-label={t('kpiDayOperations')}
                        >
                          {summary === null
                            ? t('dayCounting')
                            : t('operationsCount', { count: operationCount })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <section aria-label={t('recent')} className="rz-card min-w-0">
          <div className="rz-card__head">
            <h2 className="rz-h-card">{t('recent')}</h2>
          </div>
          {feed.length === 0 ? (
            <p className="rz-card__body rz-muted m-0">{t('noOperations')}</p>
          ) : (
            <div className="rz-table-scroll">
              <table className="rz-table">
                <caption>{t('recentCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col">{t('colDate')}</th>
                    <th scope="col">{t('colPurpose')}</th>
                    <th scope="col">{t('colTill')}</th>
                    <th className="rz-num" scope="col">
                      {t('colAmount')}
                    </th>
                    <th scope="col">{t('colType')}</th>
                  </tr>
                </thead>
                <tbody>
                  {feed.map((entry) => (
                    <tr
                      className="cursor-pointer"
                      key={entry.id}
                      onClick={(event) => navigateRow(event, entryHref(entry))}
                    >
                      <th className="py-1" scope="row">
                        <span className="rz-mono rz-dim font-normal whitespace-nowrap">
                          {moment(entry.createdAt)}
                        </span>
                      </th>
                      <td className="py-1" data-label={t('colPurpose')}>
                        {cashOrderHref(entry, ordersPath) === null ? (
                          <span className="text-app-ink block font-medium">
                            {entry.note ?? movementText(entry.type)}
                          </span>
                        ) : (
                          <Link
                            className="text-app-ink block font-medium"
                            to={cashOrderHref(entry, ordersPath)!}
                          >
                            {entry.note ?? movementText(entry.type)}
                          </Link>
                        )}
                        <span className="rz-caption block">
                          {entry.createdByName}
                        </span>
                      </td>
                      <td className="py-1" data-label={t('colTill')}>
                        <Link to={registerHref(entry.registerId)}>
                          {entry.registerName}
                        </Link>
                      </td>
                      <td
                        className={cn(
                          'rz-num py-1 whitespace-nowrap',
                          entry.direction === 'out'
                            ? 'text-app-strong'
                            : 'text-state-ok',
                        )}
                        data-label={t('colAmount')}
                      >
                        {signedMoney(entry)}
                      </td>
                      <td className="py-1" data-label={t('colType')}>
                        {movementText(entry.type)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="rz-card__foot rz-dim m-0 block text-pretty">
            {feedTruncated ? t('feedNoteTruncated') : t('feedNote')}
          </p>
        </section>
      </>
    )
  }
}

/**
 * «Гроші › Каси» as v2 draws a trail: the section muted, a chevron, the
 * screen strong. On a till's own card the screen becomes a link back and the
 * till is the current page.
 */
export function CashCrumbs({
  cashHref,
  current,
}: {
  /** Links «Каси» back to the list when a till is the current page. */
  cashHref?: string
  current?: string
}) {
  const t = useT(cashMessages)
  const tm = useT(moduleMessages)
  return (
    <>
      <span>{tm('group.money')}</span>
      <ChevronRight aria-hidden className="size-3 shrink-0" />
      {current === undefined || cashHref === undefined ? (
        <span aria-current="page">{t('title')}</span>
      ) : (
        <>
          <Link to={cashHref}>{t('title')}</Link>
          <ChevronRight aria-hidden className="size-3 shrink-0" />
          <span aria-current="page">{current}</span>
        </>
      )}
    </>
  )
}
