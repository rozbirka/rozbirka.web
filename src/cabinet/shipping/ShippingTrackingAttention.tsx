import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AlertTriangle } from 'lucide-react'
import { Button, Notice, Sheet, StatusPill } from '@/components/app'
import {
  getTrackingAttention,
  type TrackingAttention,
} from '@/api/shipping-attention'
import { useFormat, useT } from '@/i18n'
import { cabinetPath } from '../cabinet-paths'
import {
  messages as syncMessages,
  reasons,
} from '../orders/delivery/tracking-sync-messages'
import { messages } from './tracking-attention-messages'

export function ShippingTrackingAttention({
  scopeKey,
  tenantSlug,
  enabled,
}: {
  scopeKey: string
  tenantSlug: string
  enabled: boolean
}) {
  // Discard every response and every visible row when the access scope changes.
  return enabled ? (
    <AttentionSession key={scopeKey} tenantSlug={tenantSlug} />
  ) : null
}

function AttentionSession({ tenantSlug }: { tenantSlug: string }) {
  const t = useT(messages)
  const ts = useT(syncMessages)
  const format = useFormat()
  const [result, setResult] = useState<TrackingAttention | null>(null)
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let disposed = false
    let busy = false
    let controller: AbortController | null = null
    const load = async () => {
      if (busy || document.visibilityState === 'hidden' || !navigator.onLine)
        return
      busy = true
      controller = new AbortController()
      setLoading(true)
      try {
        const data = await getTrackingAttention(page, {
          signal: controller.signal,
        })
        if (disposed) return
        if (data.total > 0 && data.items.length === 0 && page > 1) {
          setPage(1)
        } else {
          setResult(data)
        }
        setError(false)
      } catch {
        if (!disposed && !controller.signal.aborted) setError(true)
      } finally {
        busy = false
        if (!disposed) setLoading(false)
      }
    }
    const reload = () => {
      void load()
    }
    reload()
    const interval = window.setInterval(reload, 60_000)
    document.addEventListener('visibilitychange', reload)
    window.addEventListener('online', reload)
    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', reload)
      window.removeEventListener('online', reload)
    }
  }, [page, refresh])

  const total = result?.total ?? 0
  const retry = () => setRefresh((value) => value + 1)
  return (
    <>
      {total > 0 || error ? (
        <div
          className="rz-banner rz-banner--warn text-app-ink flex-wrap"
          role="status"
        >
          <AlertTriangle
            aria-hidden
            className="text-state-warn size-[15px] shrink-0"
          />
          <div className="min-w-0 flex-1">
            <span className="font-semibold">{t('title')}</span>{' '}
            {total > 0
              ? t('summary', {
                  paused: result?.pausedCount ?? 0,
                  delayed: result?.delayedCount ?? 0,
                })
              : null}
            {error ? <span className="ml-1">{t('error')}</span> : null}
          </div>
          {total > 0 ? (
            <Button ref={trigger} onClick={() => setOpen(true)}>
              {t('view')}
            </Button>
          ) : (
            <Button onClick={retry} disabled={loading}>
              {t('retry')}
            </Button>
          )}
        </div>
      ) : null}
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title={t('title')}
        description={t('description')}
        onCloseAutoFocus={(event) => {
          if (trigger.current) {
            event.preventDefault()
            trigger.current.focus()
          }
        }}
        footer={
          <>
            <Button
              onClick={() => setPage((value) => value - 1)}
              disabled={loading || page <= 1}
            >
              {t('previous')}
            </Button>
            <span className="text-app-muted">
              {t('page', { page, pages: Math.max(1, Math.ceil(total / 10)) })}
            </span>
            <Button
              onClick={() => setPage((value) => value + 1)}
              disabled={loading || page * 10 >= total}
            >
              {t('next')}
            </Button>
            <Button onClick={() => setOpen(false)}>{t('close')}</Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-app-muted">
            {loading ? t('loading') : t('count', { count: total })}
          </span>
          <Button onClick={retry} disabled={loading}>
            {t('refresh')}
          </Button>
        </div>
        {error ? (
          <Notice
            tone="warn"
            action={
              <Button onClick={retry} disabled={loading}>
                {t('retry')}
              </Button>
            }
          >
            {t('error')}
          </Notice>
        ) : null}
        {!loading && !error && total === 0 ? (
          <Notice tone="ok">{t('empty')}</Notice>
        ) : null}
        <ul className="m-0 grid list-none gap-3 p-0" aria-busy={loading}>
          {result?.items.map((item) => (
            <li
              key={`${item.shipmentId}:${item.direction}`}
              className="rz-card min-w-0"
            >
              <div className="rz-card__body grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-app-muted">
                    {t(item.direction === 'return' ? 'return' : 'source')}
                  </span>
                  <StatusPill tone={item.paused ? 'danger' : 'warn'}>
                    {t(item.paused ? 'paused' : 'delayed')}
                  </StatusPill>
                </div>
                <p className="m-0 font-semibold break-all">
                  {t('waybill', { number: item.number ?? t('unknown') })}
                </p>
                <p className="text-app-muted m-0">
                  {t('order', { number: item.orderNumber })} ·{' '}
                  {t('since', {
                    time: format.dateTime(item.since) ?? t('unknown'),
                  })}
                </p>
                <p className="m-0">
                  {item.paused
                    ? ts(reasons[item.reason] ?? 'failed')
                    : t('delayReason')}
                </p>
                {item.paused ? (
                  <p className="text-app-muted m-0">{t('recovery')}</p>
                ) : null}
                <Button asChild className="justify-self-start">
                  <Link
                    to={cabinetPath(tenantSlug, 'waybills', item.shipmentId)}
                    onClick={() => setOpen(false)}
                  >
                    {t('open')}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
