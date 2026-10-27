import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  ArrowUpRight,
  Ban,
  KeyRound,
  Pencil,
  Printer,
  RefreshCw,
  SearchCheck,
  SearchX,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  ErrorState,
  Notice,
  StateScreen,
  StatusPill,
  useOptionalToast,
} from '@/components/app'
import { deliveryApi, type DeliveryOrder } from '@/api/delivery'
import { normalizeApiProblem } from '@/api/errors'
import { ordersApi } from '@/api/orders'
import { shippingApi, type Shipment, type ShipmentDraft } from '@/api/shipping'
import { useFormat, useLocale, useT } from '@/i18n'
import { cabinetPath } from '../cabinet-paths'
import { CabinetLoadingContent } from '../loading-screen'
import { moduleLabel, navigationGroupLabel } from '../module-messages'
import { Crumbs, RedesignShell } from '../redesign-shell'
import { NpAccessRecoverySheet } from '../integrations/NpAccessRecoverySheet'
import { npRecoveryMessages } from '../integrations/np-recovery-messages'
import {
  lostAccessConnection,
  useNpConnections,
} from '../integrations/use-np-connections'
import { deliveryMessages } from '../orders/delivery/messages'
import { deliveryProblemMessage } from '../orders/delivery/nova-poshta-availability'
import { TitledNotice } from '../orders/delivery/WaybillCreateSheet'
import {
  WaybillCancelDialog,
  WaybillRecreateDialog,
} from '../orders/delivery/WaybillDialogs'
import { WaybillLabelDrawer } from '../orders/delivery/WaybillDrawers'
import {
  WaybillEditSheet,
  type RecreateReason,
} from '../orders/delivery/WaybillEditSheet'
import { WaybillReconcileSheet } from '../orders/delivery/WaybillReconcileSheet'
import { waybillMessages } from '../orders/delivery/waybill-messages'
import { createdAt } from '../orders/delivery/waybill-view'
import {
  WaybillDeliveryCard,
  WaybillHistoryCard,
  WaybillInfoCard,
  WaybillPaymentCard,
} from './waybill-card-parts'
import {
  deliverySignal,
  trackingSignal,
  unresolvedSignal,
  unresolvedState,
  type Signal,
} from './waybill-presentation'
import type { ListReturnState } from './WaybillList'
import type { WaybillRights } from './WaybillsScreen'
import { waybillsMessages } from './waybills-messages'

interface Loaded {
  shipment: Shipment
  orderNumber: number | null
  /** The order's money; needed by the result check. Null when unreadable. */
  delivery: DeliveryOrder | null
}

type Sheet = 'label' | 'edit' | 'reconcile'
type Dialog =
  | { kind: 'cancel' }
  | { kind: 'recreate'; draft: ShipmentDraft; reason: RecreateReason }

interface CardAction {
  key: string
  label: string
  icon: ReactNode
  primary?: boolean
  quiet?: boolean
  onSelect?: () => void
  to?: string
}

/** Where a waybill stands, read once; every action follows from it. */
type Stage =
  | 'draft'
  | 'created'
  | 'sent'
  | 'received'
  | 'unresolved'
  | 'cancelled'

const stageOf = (shipment: Shipment): Stage => {
  if (shipment.state === 'Draft') return 'draft'
  if (shipment.state === 'Cancelled') return 'cancelled'
  if (unresolvedState(shipment.state)) return 'unresolved'
  if (shipment.receivedAt !== null) return 'received'
  if (shipment.dispatchedAt !== null) return 'sent'
  return 'created'
}

/**
 * «Картка накладної» (module 46 §8). The header carries the actions the
 * waybill's state allows (section 11 «Матриця станів»): a draft continues in
 * its order, a created waybill can be printed, refreshed, edited or
 * cancelled, a sent one only printed and refreshed, an unanswered operation
 * offers the result check and nothing dangerous, a lost cabinet offers
 * recovery. Delivery and payment are separate cards; payment is only shown.
 */
export function WaybillCard({
  fallback,
  integrationId,
  rights,
  shipmentId,
  slug,
}: {
  fallback: ReactNode
  integrationId: string | null
  rights: WaybillRights
  shipmentId: string
  slug: string
}) {
  const t = useT(waybillsMessages)
  const tw = useT(waybillMessages)
  const tm = useT(deliveryMessages)
  const tr = useT(npRecoveryMessages)
  const { locale } = useLocale()
  const format = useFormat()
  const toast = useOptionalToast()
  const navigate = useNavigate()
  const location = useLocation()
  const listSearch =
    (location.state as Partial<ListReturnState> | null)?.listSearch ?? ''
  const listPath = `${cabinetPath(slug, 'waybills')}${listSearch}`

  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<
    { kind: 'missing' } | { kind: 'failed'; message: string } | null
  >(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [dialogPending, setDialogPending] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [recoverOpen, setRecoverOpen] = useState(false)
  // Session facts Core does not keep: a result check without proof yet, and
  // an edit that cancelled the waybill to make a new one in the order.
  const [waiting, setWaiting] = useState(false)
  const [recreating, setRecreating] = useState(false)
  // The control that opened a sheet or dialog takes focus back (section 11).
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const recoverRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (integrationId === null) return
    const controller = new AbortController()
    const signal = controller.signal
    void (async () => {
      const shipment = await shippingApi.byId(integrationId, shipmentId, {
        signal,
      })
      const [order, delivery] = await Promise.all([
        ordersApi.getById(shipment.orderId, { signal }).catch(() => null),
        deliveryApi.get(shipment.orderId, { signal }).catch(() => null),
      ])
      return { shipment, orderNumber: order?.number ?? null, delivery }
    })().then(
      (result) => {
        if (signal.aborted) return
        setLoaded(result)
        setLoadError(null)
      },
      (problem: unknown) => {
        if (signal.aborted) return
        setLoadError(
          normalizeApiProblem(problem).status === 404
            ? { kind: 'missing' }
            : {
                kind: 'failed',
                message: deliveryProblemMessage(problem, locale),
              },
        )
      },
    )
    return () => controller.abort()
    // The message is chosen when the request fails, not re-run per locale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt, integrationId, shipmentId])

  const shipment = loaded?.shipment ?? null
  const stage = shipment === null ? null : stageOf(shipment)
  const live = stage === 'created' || stage === 'sent' || stage === 'received'
  const connections = useNpConnections(
    integrationId,
    rights.integrations && live && shipment?.connectionId != null,
  )
  const lost = live
    ? lostAccessConnection(connections.connections, shipment?.connectionId)
    : null

  /** The order's endpoints answer with its current waybill; keep ours. */
  const accept = useCallback(
    (next: Shipment) => {
      if (next.id === shipmentId)
        setLoaded((current) =>
          current === null ? current : { ...current, shipment: next },
        )
      else setAttempt((value) => value + 1)
    },
    [shipmentId],
  )
  const reload = () => setAttempt((value) => value + 1)

  const remember = () =>
    setOpener(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    )
  const restoreFocus = (event: Event) => {
    event.preventDefault()
    if (opener?.isConnected === true) opener.focus()
  }
  const open = (next: Sheet) => {
    remember()
    setSheet(next)
  }

  if (fallback !== null || loadError !== null || loaded === null)
    return (
      <CardFrame listPath={listPath} title={t('cardWaybill')}>
        {fallback ??
          (loadError?.kind === 'missing' ? (
            <StateScreen
              actions={
                <Button asChild>
                  <Link to={listPath}>{t('title')}</Link>
                </Button>
              }
              description={t('notFoundBody')}
              icon={<SearchX aria-hidden />}
              title={t('notFoundTitle')}
            />
          ) : loadError?.kind === 'failed' ? (
            <ErrorState
              description={loadError.message}
              onRetry={reload}
              title={t('cardErrorTitle')}
            />
          ) : (
            <CabinetLoadingContent
              heading={false}
              label={t('cardLoading')}
              module="waybills"
            />
          ))}
      </CardFrame>
    )

  const current = loaded.shipment
  const currentStage = stageOf(current)
  const { orderNumber, delivery } = loaded
  const orderPath = cabinetPath(slug, 'orders', current.orderId)
  const draft = currentStage === 'draft'
  const syncStale = live && lost === null && current.syncProblem !== null
  const title = t('waybillTitle', { number: current.number ?? t('draft') })
  const created = createdAt(current)
  const sub =
    orderNumber === null
      ? null
      : draft
        ? t('subDraft', { order: String(orderNumber) })
        : created === null
          ? t('subOrder', { order: String(orderNumber) })
          : t('subCreated', {
              order: String(orderNumber),
              date: format.date(created) ?? created,
            })

  const refresh = async () => {
    if (integrationId === null || busy) return
    setBusy(true)
    setError(null)
    try {
      accept(await shippingApi.refresh(integrationId, current.orderId))
    } catch (problem) {
      setError(deliveryProblemMessage(problem, locale))
      reload()
    } finally {
      setBusy(false)
    }
  }

  const cancel = async (recreate: boolean) => {
    if (integrationId === null) return
    setDialogPending(true)
    setDialogError(null)
    try {
      await shippingApi.cancel(integrationId, current.orderId)
      setDialog(null)
      setRecreating(recreate)
      toast?.show({ tone: 'info', message: tw('cancelledToast') })
      reload()
    } catch (problem) {
      // An answer that never came leaves the cancel unknown: the card then
      // offers the result check instead of a second cancel.
      const latest = await shippingApi
        .byId(integrationId, current.id)
        .catch(() => null)
      if (latest !== null && unresolvedState(latest.state)) {
        accept(latest)
        setDialog(null)
      } else setDialogError(deliveryProblemMessage(problem, locale))
    } finally {
      setDialogPending(false)
    }
  }

  // Actions per the state×action matrix; without «Керування замовленнями»
  // only the way to the order stays (8.8). Recovery needs the integrations
  // right instead, which `lost` already implies.
  const toOrder = (primary: boolean): CardAction => ({
    key: 'order',
    label: t('toOrder'),
    icon: <ArrowUpRight aria-hidden />,
    to: orderPath,
    primary,
  })
  const print: CardAction = {
    key: 'print',
    label: t('print'),
    icon: <Printer aria-hidden />,
    onSelect: () => open('label'),
  }
  const refreshAction: CardAction = {
    key: 'refresh',
    label: tm('refreshStatus'),
    icon: <RefreshCw aria-hidden />,
    onSelect: () => void refresh(),
  }
  const actions: CardAction[] =
    lost !== null
      ? [
          {
            key: 'recover',
            label: tr('recover'),
            icon: <KeyRound aria-hidden />,
            primary: true,
            onSelect: () => setRecoverOpen(true),
          },
          toOrder(false),
        ]
      : !rights.manage || currentStage === 'cancelled'
        ? [toOrder(true)]
        : currentStage === 'draft'
          ? [
              {
                key: 'continue',
                label: t('continueInOrder'),
                icon: <ArrowUpRight aria-hidden />,
                to: orderPath,
                primary: true,
              },
            ]
          : currentStage === 'unresolved'
            ? [
                {
                  key: 'check',
                  label: tw('checkResult'),
                  icon: <SearchCheck aria-hidden />,
                  primary: true,
                  onSelect: () => open('reconcile'),
                },
                ...(current.number === null ? [] : [print]),
              ]
            : currentStage === 'created'
              ? [
                  print,
                  refreshAction,
                  {
                    key: 'edit',
                    label: tw('edit'),
                    icon: <Pencil aria-hidden />,
                    onSelect: () => open('edit'),
                  },
                  {
                    key: 'cancel',
                    label: tw('cancelWaybill'),
                    icon: <Ban aria-hidden />,
                    quiet: true,
                    onSelect: () => {
                      remember()
                      setDialogError(null)
                      setDialog({ kind: 'cancel' })
                    },
                  },
                  toOrder(true),
                ]
              : [print, refreshAction, toOrder(true)]

  const button = (
    action: CardAction,
    primary = action.primary === true,
    withRef = true,
  ) => {
    const variant = primary ? 'primary' : action.quiet ? 'quiet' : 'ghost'
    return action.to === undefined ? (
      <Button
        disabled={busy}
        key={action.key}
        onClick={action.onSelect}
        variant={variant}
        ref={action.key === 'recover' && withRef ? recoverRef : undefined}
        {...(action.key === 'refresh' ? { 'aria-busy': busy } : {})}
      >
        {action.icon}
        {action.label}
      </Button>
    ) : (
      <Button asChild key={action.key} variant={variant}>
        <Link to={action.to}>
          {action.icon}
          {action.label}
        </Link>
      </Button>
    )
  }
  // Narrow (8.9): actions move under the delivery status, the way to the
  // order last; the first is the main one and the rest wait under «Ще».
  const narrow = [
    ...actions.filter((action) => action.key !== 'order'),
    ...actions.filter((action) => action.key === 'order'),
  ]
  const narrowActions = (
    <div className="rz-btn-row md:hidden">
      {narrow
        .slice(0, 2)
        .map((action, index) => button(action, index === 0, false))}
      <ActionMenu
        actions={narrow.slice(2).map((action) => ({
          key: action.key,
          label: action.label,
          icon: action.icon,
          onSelect: () => {
            if (action.to !== undefined) void navigate(action.to)
            else action.onSelect?.()
          },
          ...(action.quiet ? { destructive: true } : {}),
        }))}
        label={t('moreLabel')}
      />
    </div>
  )

  const chips: Signal[] = [
    ...(draft
      ? [{ label: t('draft'), tone: 'neutral' as const }]
      : [
          trackingSignal(
            current.state,
            current.trackingCode,
            current.receivedAt,
            locale,
          ),
        ].filter((signal): signal is Signal => signal !== null)),
    ...(currentStage === 'unresolved'
      ? [unresolvedSignal(current.state, locale)]
      : []),
    ...(lost !== null
      ? [{ label: tr('noAccess'), tone: 'danger' as const }]
      : []),
    ...(syncStale
      ? [{ label: t('notUpdating'), tone: 'danger' as const }]
      : []),
  ]

  const cancelOperation =
    current.state === 'CancelUnknown' || current.state === 'Cancelling'
  const lastKnown =
    current.lastTrackedAt === null
      ? null
      : (format.time(current.lastTrackedAt) ?? current.lastTrackedAt)

  const notices = (
    <>
      {error === null ? null : <Notice tone="danger">{error}</Notice>}
      {currentStage !== 'unresolved' ? null : waiting ? (
        <TitledNotice title={tw('waitTitle')} tone="info">
          {cancelOperation ? tw('waitCancel') : tw('waitCreate')}
        </TitledNotice>
      ) : (
        <TitledNotice title={tw('unknownTitle')} tone="warn">
          {cancelOperation ? t('unknownCancelText') : tw('unknownCreate')}
        </TitledNotice>
      )}
      {lost === null ? null : (
        <TitledNotice title={tr('lostTitle')} tone="danger">
          {t('lostText')}
        </TitledNotice>
      )}
      {!syncStale ? null : (
        <Notice
          action={
            <Button
              aria-busy={busy}
              disabled={busy}
              onClick={() => void refresh()}
              size="sm"
            >
              {tm('refreshStatus')}
            </Button>
          }
          tone="warn"
        >
          {lastKnown === null
            ? t('syncFailedNever')
            : t('syncFailed', { time: lastKnown })}
        </Notice>
      )}
      {recreating && currentStage === 'cancelled' ? (
        <TitledNotice title={tw('recreateTitle')} tone="warn">
          {tw('recreateText')}
        </TitledNotice>
      ) : null}
      {rights.manage || lost !== null || currentStage === 'cancelled' ? null : (
        <Notice tone="info">{t('readOnly')}</Notice>
      )}
    </>
  )

  return (
    <CardFrame
      actions={
        <span className="rz-btn-row max-md:hidden">
          {actions.map((action) => button(action))}
        </span>
      }
      chips={chips}
      listPath={listPath}
      number={current.number ?? t('draft')}
      sub={sub}
      title={title}
    >
      {notices}
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="order-3 grid min-w-0 gap-4 lg:order-none lg:col-start-1 lg:row-start-1">
          <WaybillInfoCard
            orderNumber={orderNumber}
            orderPath={orderPath}
            shipment={current}
          />
        </div>
        <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
          <WaybillDeliveryCard
            actions={narrowActions}
            notice={
              draft ? (
                <Notice tone="info">{t('draftNotice')}</Notice>
              ) : undefined
            }
            shipment={current}
            signal={deliverySignal(
              current.state,
              current.trackingCode,
              current.receivedAt,
              locale,
            )}
            stale={syncStale || lost !== null}
          />
        </div>
        <div className="order-4 min-w-0 max-md:hidden lg:order-none lg:col-start-1 lg:row-start-3">
          <WaybillHistoryCard events={current.events} />
        </div>
        <div className="order-2 min-w-0 lg:order-none lg:col-start-2 lg:row-span-3 lg:row-start-1">
          <WaybillPaymentCard
            delivery={delivery}
            finance={rights.finance}
            orderNumber={orderNumber}
            orderPath={orderPath}
            shipment={current}
          />
        </div>
      </div>

      {sheet === 'label' &&
      integrationId !== null &&
      current.number !== null ? (
        <WaybillLabelDrawer
          integrationId={integrationId}
          onClose={() => setSheet(null)}
          onCloseAutoFocus={restoreFocus}
          orderId={current.orderId}
          orderNumber={orderNumber ?? 0}
          waybillNumber={current.number}
        />
      ) : null}

      {sheet === 'edit' && integrationId !== null ? (
        <WaybillEditSheet
          integrationId={integrationId}
          onClose={() => setSheet(null)}
          onCloseAutoFocus={restoreFocus}
          onRecreate={(nextDraft, reason) => {
            setSheet(null)
            setDialogError(null)
            setDialog({ kind: 'recreate', draft: nextDraft, reason })
          }}
          onSaved={(next) => {
            accept(next)
            setSheet(null)
            toast?.show({ tone: 'ok', message: tw('editConfirmed') })
          }}
          orderId={current.orderId}
          shipment={current}
        />
      ) : null}

      {sheet === 'reconcile' && integrationId !== null && delivery !== null ? (
        <WaybillReconcileSheet
          delivery={delivery}
          integrationId={integrationId}
          onClose={() => setSheet(null)}
          onCloseAutoFocus={restoreFocus}
          onResolved={(next) => {
            setWaiting(false)
            setSheet(null)
            accept(next)
            if (next.state === 'Cancelled')
              toast?.show({ tone: 'info', message: tw('cancelledToast') })
            else if (next.state === 'Created' && next.number !== null)
              toast?.show({
                tone: 'ok',
                message: tw('createdToast', { number: next.number }),
              })
          }}
          onWaiting={() => {
            setWaiting(true)
            setSheet(null)
          }}
          orderId={current.orderId}
          orderNumber={orderNumber ?? 0}
          shipment={current}
        />
      ) : null}

      {current.number !== null ? (
        <WaybillCancelDialog
          error={dialogError}
          number={current.number}
          onCloseAutoFocus={restoreFocus}
          onConfirm={() => void cancel(false)}
          onOpenChange={(next) => {
            if (!next) setDialog(null)
          }}
          open={dialog?.kind === 'cancel'}
          orderNumber={orderNumber ?? 0}
          pending={dialogPending}
        />
      ) : null}

      {current.number !== null && dialog?.kind === 'recreate' ? (
        <WaybillRecreateDialog
          error={dialogError}
          number={current.number}
          onCloseAutoFocus={restoreFocus}
          onConfirm={() => void cancel(true)}
          onOpenChange={(next) => {
            if (!next) setDialog(null)
          }}
          open
          pending={dialogPending}
          reason={dialog.reason}
        />
      ) : null}

      {lost !== null && integrationId !== null ? (
        <NpAccessRecoverySheet
          canRecover={rights.integrations}
          connection={lost}
          integrationId={integrationId}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            recoverRef.current?.focus()
          }}
          onOpenChange={setRecoverOpen}
          onRecovered={(_result, count) => {
            toast?.show({ tone: 'ok', message: tr('recovered', { count }) })
            connections.reload()
            reload()
          }}
          open={recoverOpen}
          waybills={
            current.number === null
              ? []
              : [
                  {
                    number: current.number,
                    caption: `#${String(orderNumber ?? '—')} · ${
                      current.trackingStatus ?? chips[0]?.label ?? ''
                    }`,
                  },
                ]
          }
        />
      ) : null}
    </CardFrame>
  )
}

/** Topbar, title and chips of the card; the body is the caller's. */
function CardFrame({
  actions,
  children,
  chips = [],
  listPath,
  number,
  sub = null,
  title,
}: {
  actions?: ReactNode
  children: ReactNode
  chips?: readonly Signal[]
  listPath: string
  /** The last crumb: the waybill number, or «Чернетка». */
  number?: string
  sub?: string | null
  title: string
}) {
  const t = useT(waybillsMessages)
  const { locale } = useLocale()
  return (
    <RedesignShell
      actions={actions}
      crumb={
        <>
          <span className="contents max-md:hidden">
            <Crumbs
              items={[
                navigationGroupLabel('sales', locale),
                <Link key="list" to={listPath}>
                  {moduleLabel('waybills', locale)}
                </Link>,
                number ?? title,
              ]}
            />
          </span>
          <span className="contents md:hidden">
            <Crumbs items={[t('columnWaybill')]} />
          </span>
        </>
      }
      width="record"
    >
      <div className="grid gap-1.5">
        <div className="rz-page-head">
          <h1 className="rz-h-page">{title}</h1>
          {sub === null ? null : <span className="rz-muted">{sub}</span>}
        </div>
        {chips.length === 0 ? null : (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <StatusPill key={chip.label} tone={chip.tone}>
                {chip.label}
              </StatusPill>
            ))}
          </div>
        )}
      </div>
      {children}
    </RedesignShell>
  )
}
