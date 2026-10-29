import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Pencil, Plug, Unplug } from 'lucide-react'
import {
  Button,
  DateValue,
  Notice,
  SkeletonRows,
  StatusPill,
  type StatusTone,
} from '@/components/app'
import type { Integration, IntegrationDiagnostics } from '@/api/integrations'
import { useFormat, useLocale, useT } from '@/i18n'
import {
  diagnosticCheckLabel,
  integrationErrorMessage,
} from './integration-labels'
import { integrationsMessages } from './integrations-messages'
import { NpChecks } from './np-checks'
import { npDisconnectMessages } from './np-disconnect-messages'
import { npSettingsMessages } from './np-settings-messages'
import { KEY_MASK, pointFromDispatchPoint, pointLine } from './np-setup-model'
import {
  defaultPoint,
  useSenderContacts,
  type NpDeliverySettingsState,
} from './use-np-delivery-settings'

/** A card head with its title, an optional pill and a muted line under it. */
function CardHead({
  hint,
  id,
  pill,
  title,
}: {
  hint?: string
  id: string
  pill?: ReactNode
  title: string
}) {
  return (
    <header className="rz-card__head py-2.5">
      <div className="grid min-w-0 gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="rz-h-card" id={id}>
            {title}
          </h2>
          {pill}
        </div>
        {hint === undefined ? null : (
          <p className="rz-caption m-0 text-pretty">{hint}</p>
        )}
      </div>
    </header>
  )
}

function FactRow({
  label,
  mono = false,
  sub,
  value,
}: {
  label: string
  mono?: boolean
  sub?: ReactNode
  value: ReactNode
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span className={mono ? 'rz-mono' : undefined}>{value}</span>
        {sub === undefined || sub === null || sub === '' ? null : (
          <span className="rz-caption ml-2 font-mono">{sub}</span>
        )}
      </dd>
    </div>
  )
}

/** Who switched Nova Poshta off and when, and that nothing was lost. */
function OffLine({ integration }: { integration: Integration }) {
  const td = useT(npDisconnectMessages)
  const format = useFormat()
  const { deactivatedAt, deactivatedBy } = integration
  const date = format.dateTime(deactivatedAt)
  if (date === null) return td('offKept')
  const when =
    deactivatedBy === null
      ? td('offAt', { date })
      : td('offBy', { name: deactivatedBy, date })
  return `${when} ${td('offKept')}`
}

/** «Ваші права»: the three rights module 46 depends on, each said in words. */
export function NpRightsCard({
  className,
  finance,
  integrations,
  orders,
}: {
  className?: string
  finance: boolean
  integrations: boolean
  orders: boolean
}) {
  const t = useT(npSettingsMessages)
  const row = (label: string, allowed: boolean) => ({
    label,
    value: allowed ? t('rightYes') : t('rightNo'),
    state: allowed ? ('ok' as const) : ('none' as const),
  })
  return (
    <section
      aria-labelledby="np-rights"
      className={`rz-card min-w-0 ${className ?? ''}`}
    >
      <header className="rz-card__head py-2.5">
        <div className="grid min-w-0 gap-0.5">
          <h2 className="rz-h-card" id="np-rights">
            {t('rightsTitle')}
          </h2>
          <p className="rz-caption m-0 text-pretty">{t('rightsHint')}</p>
        </div>
      </header>
      <div className="rz-card__body">
        <NpChecks
          items={[
            row(t('rightIntegrations'), integrations),
            row(t('rightOrders'), orders),
            row(t('rightFinance'), finance),
          ]}
        />
      </div>
    </section>
  )
}

/**
 * The overview of a connected Nova Poshta (module 46 §1.22, §2.1): whether
 * the key still works, what new waybills are dispatched with, and the
 * reader's own rights. The key itself is never shown — only its mask.
 * Switched off (2.14), the same cards say what is kept and lead back on.
 */
export function NpOverview({
  connectPath,
  diagnostics,
  editPath,
  integration,
  onDisconnect,
  onReconnect,
  onVerify,
  reconnecting,
  rights,
  settings,
  updated,
  verifying,
}: {
  connectPath: string
  diagnostics: IntegrationDiagnostics | null
  editPath: string
  integration: Integration
  onDisconnect: () => void
  onReconnect: () => void
  onVerify: () => void
  reconnecting: boolean
  rights: { integrations: boolean; orders: boolean; finance: boolean }
  settings: NpDeliverySettingsState
  /** Set right after a save, for the «Оновлено» pill (2.5). */
  updated: boolean
  verifying: boolean
}) {
  const { locale } = useLocale()
  const t = useT(npSettingsMessages)
  const ti = useT(integrationsMessages)
  const td = useT(npDisconnectMessages)
  const active = integration.status === 'active'
  const off = integration.status === 'inactive'
  const failing = integration.status === 'error'
  const data = settings.kind === 'ready' ? settings.data : null
  const senderRef = data?.preferences.senderCounterpartyRef ?? null
  const contacts = useSenderContacts(integration.id, senderRef)

  if (!integration.configured)
    return (
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Notice
          action={
            <Button asChild size="sm" variant="primary">
              <Link to={connectPath}>
                <Plug aria-hidden />
                {ti('connect')}
              </Link>
            </Button>
          }
          tone="info"
        >
          {t('notConnected')}
        </Notice>
        <NpRightsCard {...rights} />
      </div>
    )

  const statusPill: { label: string; tone: StatusTone } = off
    ? { label: td('statusOff'), tone: 'neutral' }
    : failing
      ? { label: ti('rejected'), tone: 'danger' }
      : active
        ? { label: ti('working'), tone: 'ok' }
        : { label: ti('integrationOff'), tone: 'neutral' }

  const sender = data?.senders?.find((item) => item.ref === senderRef) ?? null
  const contact =
    contacts?.find((item) => item.ref === data?.preferences.senderContactRef) ??
    null
  const point = data === null ? null : defaultPoint(data.points)
  const tillId = data?.preferences.codCashRegisterId ?? null
  const till = data?.tills.find((item) => item.id === tillId) ?? null
  const dash = '—'

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid min-w-0 gap-3.5">
        <section aria-labelledby="np-status" className="rz-card min-w-0">
          <header className="rz-card__head py-2.5">
            <div className="grid min-w-0 gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="rz-h-card" id="np-status">
                  {ti('statusCard')}
                </h2>
                <StatusPill tone={statusPill.tone}>
                  {statusPill.label}
                </StatusPill>
              </div>
              <p className="rz-caption m-0 text-pretty">
                {off ? (
                  <OffLine integration={integration} />
                ) : integration.lastErrorCode === null ? (
                  ti('keyAccepted')
                ) : (
                  integrationErrorMessage(integration.lastErrorCode, locale)
                )}
              </p>
            </div>
          </header>
          <dl className="rz-facts">
            <FactRow
              label={t('keyLabel')}
              mono
              sub={
                off ? (
                  td('keyKept')
                ) : integration.verifiedAt === null ? (
                  ti('notCheckedYet')
                ) : (
                  <>
                    {ti('checkedPrefix')}{' '}
                    <DateValue value={integration.verifiedAt} />
                  </>
                )
              }
              value={KEY_MASK}
            />
            <FactRow
              label={t('access')}
              value={
                off
                  ? td('accessStopped')
                  : failing
                    ? t('accessBroken')
                    : active
                      ? t('accessWorking')
                      : t('accessOff')
              }
            />
          </dl>
          {diagnostics === null ? null : (
            <ul className="rz-inset mx-(--rz-card-p) mb-3 grid list-none gap-2">
              {diagnostics.checks.map((check) => (
                <li className="grid gap-0.5" key={check.code}>
                  <span
                    className={`rz-dot text-app-ink ${
                      check.status === 'passed'
                        ? 'rz-dot--ok'
                        : 'rz-dot--danger'
                    }`}
                  >
                    {diagnosticCheckLabel(check.code, locale)}
                  </span>
                  {check.errorCode !== null && (
                    <span className="rz-caption pl-3 text-pretty">
                      {integrationErrorMessage(check.errorCode, locale)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {/* A working connection has nothing to do here; a failing one is
              checked again, or its key replaced, without leaving the card. */}
          {failing ? (
            <div className="rz-btn-row border-app-line border-t px-(--rz-card-p) py-2.5">
              <Button
                aria-busy={verifying}
                disabled={verifying}
                onClick={onVerify}
              >
                {verifying ? ti('verifying') : ti('verifyAgain')}
              </Button>
              {rights.integrations ? (
                <Button asChild variant="primary">
                  <Link to={connectPath}>{ti('replaceKey')}</Link>
                </Button>
              ) : null}
            </div>
          ) : null}
        </section>

        <section aria-labelledby="np-shipping" className="rz-card min-w-0">
          <CardHead
            id="np-shipping"
            pill={
              updated ? <StatusPill tone="ok">{t('updated')}</StatusPill> : null
            }
            title={t('shippingCard')}
          />
          {settings.kind === 'loading' ? (
            <div className="rz-card__body">
              <SkeletonRows embedded label={ti('loading')} rows={4} />
            </div>
          ) : settings.kind === 'error' ? (
            <div className="rz-card__body">
              <Notice tone="danger">{t('shippingLoadError')}</Notice>
            </div>
          ) : (
            <dl className="rz-facts" id="np-shipping-facts">
              <FactRow
                label={t('sender')}
                sub={sender?.tin ?? point?.companyTin ?? undefined}
                value={sender?.name ?? point?.companyName ?? dash}
              />
              <FactRow
                label={t('contact')}
                sub={contact?.phone ?? point?.phone ?? undefined}
                value={contact?.name ?? point?.senderName ?? dash}
              />
              <FactRow
                label={t('point')}
                value={
                  point === null
                    ? dash
                    : pointLine(pointFromDispatchPoint(point)) || point.name
                }
              />
              <FactRow
                label={t('till')}
                value={tillId === null ? t('noTill') : (till?.name ?? dash)}
              />
            </dl>
          )}
          <div className="border-app-line border-t px-(--rz-card-p) py-2.5">
            {rights.integrations && off ? (
              <Button
                aria-busy={reconnecting}
                disabled={reconnecting}
                onClick={onReconnect}
                variant="primary"
              >
                <Plug aria-hidden />
                {reconnecting ? td('reconnecting') : td('reconnect')}
              </Button>
            ) : rights.integrations ? (
              <div className="rz-btn-row">
                <Button asChild>
                  <Link to={editPath}>
                    <Pencil aria-hidden />
                    {t('changeSettings')}
                  </Link>
                </Button>
                <Button onClick={onDisconnect} variant="ghost">
                  <Unplug aria-hidden />
                  {td('disconnect')}
                </Button>
              </div>
            ) : (
              <p className="rz-caption m-0 text-pretty">{t('readOnly')}</p>
            )}
          </div>
        </section>
      </div>
      {/* The narrow layout (2.11) keeps only the connection and dispatch. */}
      <NpRightsCard className="max-lg:hidden" {...rights} />
    </div>
  )
}
