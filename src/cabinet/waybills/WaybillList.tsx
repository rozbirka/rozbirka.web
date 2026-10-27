import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ArrowRight, CloudOff, RefreshCw, SearchX, Truck } from 'lucide-react'
import {
  Button,
  DataTable,
  Notice,
  Pagination,
  StateScreen,
  StatusPill,
  type DataColumn,
} from '@/components/app'
import { shippingApi, type ShipmentListItem } from '@/api/shipping'
import { commonMessages, useFormat, useLocale, useT, type Locale } from '@/i18n'
import { cn } from '@/lib/utils'
import { cabinetPath } from '../cabinet-paths'
import { CabinetLoadingContent } from '../loading-screen'
import { moduleLabel, navigationGroupLabel } from '../module-messages'
import { Crumbs, RedesignShell } from '../redesign-shell'
import { uah } from '../orders/delivery/delivery-money'
import { formatPhone } from '@/lib/phone'
import {
  FILTER_PARAMS,
  filtered,
  readFilters,
  usePeriod,
  type WaybillFilters,
} from './waybill-filter-state'
import { WaybillToolbar } from './waybill-filters'
import { deliverySignal, listCodNote, shortPlace } from './waybill-presentation'
import type { WaybillRights } from './WaybillsScreen'
import { waybillsMessages } from './waybills-messages'

const PAGE_SIZE = 20
const HOUR_MS = 60 * 60 * 1000

/** What a card needs to send «До списку» back to the same view. */
export interface ListReturnState {
  listSearch: string
}

/** A business day as Core's UTC range: the day's first and last moment. */
const dayStart = (day: string) => new Date(`${day}T00:00:00`).toISOString()
const dayEnd = (day: string) => new Date(`${day}T23:59:59.999`).toISOString()

function query(filters: WaybillFilters) {
  return {
    ...(filters.q.trim() === '' ? {} : { search: filters.q.trim() }),
    ...(filters.delivery === '' ? {} : { deliveryCode: filters.delivery }),
    ...(filters.cod === '' ? {} : { hasCod: filters.cod === 'yes' }),
    ...(filters.sync === '' ? {} : { hasProblem: filters.sync === 'problem' }),
    ...(filters.from === '' ? {} : { from: dayStart(filters.from) }),
    ...(filters.to === '' ? {} : { to: dayEnd(filters.to) }),
    page: filters.page,
    pageSize: PAGE_SIZE,
  }
}

/** A live waybill the carrier can still move: worth asking about. */
const refreshable = (row: ShipmentListItem) =>
  row.number !== null && row.state === 'Created' && row.receivedAt === null

/**
 * «Накладні Нової пошти» (module 46 §7): every waybill made or attached in
 * Rozbirka, drafts included, newest first. Delivery, cash on delivery and
 * sync are three columns on purpose — a sync failure never hides the last
 * known delivery status.
 */
export function WaybillList({
  fallback,
  integrationId,
  rights,
  slug,
}: {
  /** Shown instead of the table when Nova Poshta is out of reach. */
  fallback: ReactNode
  integrationId: string | null
  rights: WaybillRights
  slug: string
}) {
  const t = useT(waybillsMessages)
  const tc = useT(commonMessages)
  const { locale } = useLocale()
  const format = useFormat()
  const navigate = useNavigate()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const filters = readFilters(params)
  const period = usePeriod(filters)
  const [result, setResult] = useState<{
    key: string
    items: ShipmentListItem[]
    total: number
    totalPages: number
  } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const requestKey = JSON.stringify([integrationId, filters, attempt])

  useEffect(() => {
    if (integrationId === null) return
    const controller = new AbortController()
    const request = query(filters)
    void shippingApi
      .list(integrationId, request, { signal: controller.signal })
      .then((page) => {
        if (controller.signal.aborted) return
        setResult({
          key: requestKey,
          items: page.items,
          total: page.total,
          totalPages: page.totalPages,
        })
        setFailed(null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(requestKey)
      })
    return () => controller.abort()
    // `requestKey` carries the filters and the retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const setParam = (name: (typeof FILTER_PARAMS)[number], value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('page')
    setParams(next, { replace: name === 'q', flushSync: name === 'q' })
  }
  const reset = () => {
    const next = new URLSearchParams(params)
    for (const name of [...FILTER_PARAMS, 'page']) next.delete(name)
    setParams(next)
  }
  const goToPage = (page: number) => {
    const next = new URLSearchParams(params)
    if (page > 1) next.set('page', String(page))
    else next.delete('page')
    setParams(next)
  }

  const rows = result?.key === requestKey ? result.items : null
  const error = failed === requestKey
  const loading = integrationId !== null && rows === null && !error
  const isFiltered = filtered(filters)
  const firstRun = rows !== null && rows.length === 0 && !isFiltered
  const stale = (rows ?? []).filter((row) => row.syncProblem !== null)
  const listState: ListReturnState = { listSearch: location.search }
  const cardPath = (row: ShipmentListItem) =>
    cabinetPath(slug, 'waybills', row.id)

  /** Asks the carrier about each live waybill on the page, then reloads. */
  const refresh = async (targets: readonly ShipmentListItem[]) => {
    if (integrationId === null || refreshing) return
    setRefreshing(true)
    await Promise.allSettled(
      targets.map((row) => shippingApi.refresh(integrationId, row.orderId)),
    )
    setRefreshing(false)
    setAttempt((value) => value + 1)
  }

  const ago = (value: string | null) => {
    if (value === null) return ''
    const elapsed = Date.now() - new Date(value).getTime()
    if (elapsed < HOUR_MS)
      return t('minutesAgo', {
        count: Math.max(Math.round(elapsed / 60000), 1),
      })
    if (elapsed < 24 * HOUR_MS)
      return t('hoursAgo', { count: Math.round(elapsed / HOUR_MS) })
    return format.date(value) ?? value
  }

  const columns: DataColumn<ShipmentListItem>[] = [
    {
      key: 'waybill',
      label: t('columnWaybill'),
      variant: 'primary',
      cell: (row) => (
        <span className="grid">
          <Link
            aria-label={
              row.number === null
                ? t('openWaybill')
                : t('openWaybillNumber', { number: row.number })
            }
            className="rz-mono rz-strong w-fit font-normal no-underline"
            onClick={(event) => event.stopPropagation()}
            state={listState}
            title={t('openWaybill')}
            to={cardPath(row)}
          >
            {row.number ?? t('draft')}
          </Link>
          <span className="rz-caption rz-mono font-normal max-md:hidden">
            {format.date(row.createdAt) ?? row.createdAt}
          </span>
          <span className="rz-caption font-normal md:hidden">
            {[row.recipient.name, shortPlace(row.recipient)]
              .filter((part) => part !== '' && part !== '—')
              .join(' · ')}
          </span>
        </span>
      ),
    },
    {
      key: 'order',
      label: t('columnOrder'),
      hideNarrow: true,
      cell: (row) => (
        <Link
          className="rz-mono"
          onClick={(event) => event.stopPropagation()}
          to={cabinetPath(slug, 'orders', row.orderId)}
        >
          #{row.orderNumber}
        </Link>
      ),
    },
    {
      key: 'recipient',
      label: t('columnRecipient'),
      hideNarrow: true,
      cell: (row) => (
        <span className="grid">
          <span className="rz-strong">{row.recipient.name || '—'}</span>
          {row.recipient.phone === '' ? null : (
            <span className="rz-caption rz-mono">
              {formatPhone(row.recipient.phone)}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'destination',
      label: t('columnDestination'),
      hideNarrow: true,
      cell: (row) => shortPlace(row.recipient),
    },
    {
      key: 'delivery',
      label: t('columnDelivery'),
      cell: (row) => <DeliveryCell locale={locale} row={row} />,
    },
    {
      key: 'cod',
      label: t('columnCod'),
      align: 'end',
      hideNarrow: true,
      cell: (row) => {
        const note =
          row.state === 'Cancelled'
            ? null
            : listCodNote(row.state, row.paymentState, locale)
        const amount =
          row.state === 'Cancelled' || row.codUah === null || row.codUah <= 0
            ? null
            : row.codUah
        return (
          <span className="grid justify-items-end">
            <span
              className={cn(
                'rz-mono whitespace-nowrap',
                note?.tone === 'ok' && 'text-state-ok',
                note?.tone === 'warn' && 'text-state-warn',
              )}
            >
              {amount === null ? '—' : uah(amount, locale)}
            </span>
            {note === null || amount === null ? null : (
              <span className="rz-caption rz-mono">{note.text}</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'sync',
      label: t('columnSync'),
      hideNarrow: true,
      cell: (row) =>
        row.syncProblem === null ? null : (
          <span className="grid justify-items-start">
            <StatusPill tone="danger">{t('syncError')}</StatusPill>
            {row.lastSuccessAt === null ? null : (
              <span className="rz-caption">{ago(row.lastSuccessAt)}</span>
            )}
          </span>
        ),
    },
  ]

  const ordersPath = cabinetPath(slug, 'orders')
  const noneText =
    filters.q !== '' && period !== ''
      ? t('noneQueryPeriod', { query: filters.q, period })
      : filters.q !== ''
        ? t('noneQuery', { query: filters.q })
        : period !== ''
          ? t('nonePeriod', { period })
          : t('noneFilters')

  return (
    <RedesignShell
      actions={
        fallback === null ? (
          <span className="max-md:hidden">
            <Button
              aria-busy={refreshing}
              disabled={refreshing || rows === null}
              onClick={() => void refresh((rows ?? []).filter(refreshable))}
            >
              <RefreshCw aria-hidden />
              {t('refreshAll')}
            </Button>
          </span>
        ) : undefined
      }
      crumb={
        <>
          <span className="contents max-md:hidden">
            <Crumbs
              items={[navigationGroupLabel('sales', locale), t('title')]}
            />
          </span>
          <span className="contents md:hidden">
            <Crumbs items={[moduleLabel('waybills', locale)]} />
          </span>
        </>
      }
    >
      <div className="rz-page-head">
        <h1 className="rz-h-page">{t('title')}</h1>
        <span className="rz-muted max-md:hidden">{t('lead')}</span>
      </div>

      {fallback ?? (
        <>
          {stale.length === 0 ? null : (
            <Notice
              action={
                <Button
                  aria-busy={refreshing}
                  disabled={refreshing}
                  onClick={() => void refresh(stale)}
                  size="sm"
                >
                  {t('refreshAll')}
                </Button>
              }
              tone="warn"
            >
              {t('staleNotice', { count: stale.length })}
            </Notice>
          )}

          {firstRun ? null : (
            <WaybillToolbar
              filters={filters}
              finance={rights.finance}
              found={rows === null ? null : (result?.total ?? null)}
              onChange={setParam}
              onReset={reset}
            />
          )}

          <section aria-label={t('listLabel')}>
            {error ? (
              <StateScreen
                actions={
                  <Button onClick={() => setAttempt((value) => value + 1)}>
                    <RefreshCw aria-hidden />
                    {tc('retry')}
                  </Button>
                }
                description={t('errorBody')}
                icon={<CloudOff aria-hidden />}
                role="alert"
                title={t('errorTitle')}
                tone="danger"
              />
            ) : loading || rows === null ? (
              <CabinetLoadingContent
                heading={false}
                label={t('loading')}
                module="waybills"
              />
            ) : firstRun ? (
              <StateScreen
                actions={
                  <Button asChild variant="primary">
                    <Link to={ordersPath}>
                      {t('goToOrders')}
                      <ArrowRight aria-hidden />
                    </Link>
                  </Button>
                }
                description={t('emptyBody')}
                icon={<Truck aria-hidden />}
                title={t('emptyTitle')}
              />
            ) : (
              <DataTable
                caption={t('listLabel')}
                columns={columns}
                empty={
                  <StateScreen
                    actions={<Button onClick={reset}>{t('resetAll')}</Button>}
                    className="border-0"
                    description={noneText}
                    icon={<SearchX aria-hidden />}
                    title={t('noneTitle')}
                  />
                }
                footer={
                  <Pagination
                    onPage={goToPage}
                    page={filters.page}
                    totalPages={Math.max(result?.totalPages ?? 1, 1)}
                    {...(result === null || result.total === 0
                      ? {}
                      : { pageSize: PAGE_SIZE, total: result.total })}
                  />
                }
                onRowClick={(row) =>
                  void navigate(cardPath(row), { state: listState })
                }
                rowClassName={(row) =>
                  row.state === 'Cancelled' ? 'opacity-60' : undefined
                }
                rowKey={(row) => row.id}
                rows={rows}
              />
            )}
          </section>
        </>
      )}
    </RedesignShell>
  )
}

function DeliveryCell({
  row,
  locale,
}: {
  row: ShipmentListItem
  locale: Locale
}) {
  const signal = deliverySignal(
    row.state,
    row.deliveryCode,
    row.receivedAt,
    locale,
  )
  return signal === null ? (
    <StatusPill tone="neutral">—</StatusPill>
  ) : (
    <StatusPill tone={signal.tone}>{signal.label}</StatusPill>
  )
}
