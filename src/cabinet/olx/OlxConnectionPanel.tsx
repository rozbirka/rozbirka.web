import { useRef, useState } from 'react'
import { ArrowUpRight, Link2 } from 'lucide-react'
import { Link } from 'react-router'
import {
  Button,
  Card,
  ConfirmDialog,
  DateValue,
  FactRows,
  Field,
  Notice,
  StatusPill,
  TextInput,
} from '@/components/app'
import type { OlxConnection } from '@/api/olx'
import { useT } from '@/i18n'
import { olxConnectionMessages } from './olx-connection-messages'
import { OlxPublicationReadiness } from './OlxPublicationReadiness'

export function OlxPermissionsCard({
  canManage,
  canPublish,
}: {
  canManage: boolean
  canPublish: boolean
}) {
  const t = useT(olxConnectionMessages)
  const rights = [
    { label: t('manageConnection'), granted: canManage },
    { label: t('manageAdverts'), granted: canPublish },
  ]

  return (
    <Card
      title={t('rightsTitle')}
      headerClassName="min-h-0 border-0 pt-4 pb-0"
      bodyClassName="pt-1"
    >
      <p className="rz-caption m-0">{t('rightsHint')}</p>
      <dl className="divide-app-line border-app-line m-0 mt-1 divide-y border-t">
        {rights.map(({ label, granted }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-2 py-2"
          >
            <dt className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={
                  granted
                    ? 'bg-state-ok size-3 shrink-0 rounded-full'
                    : 'border-app-muted size-3 shrink-0 rounded-full border'
                }
              />
              {label}
            </dt>
            <dd className={granted ? 'text-state-ok m-0' : 'rz-caption m-0'}>
              {t(granted ? 'rightGranted' : 'rightLimited')}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export type ConnectionAction = 'connect' | 'disconnect' | 'verify' | 'write'

export function OlxConnectionPanel({
  connection,
  canManage,
  canPublish,
  busy,
  error,
  onAction,
  workspaceHref,
  retryConnection = false,
  disconnected = false,
}: {
  connection: OlxConnection
  canManage: boolean
  canPublish: boolean
  busy: boolean
  error: string | null
  workspaceHref?: string
  retryConnection?: boolean
  disconnected?: boolean
  onAction: (action: ConnectionAction, account?: string) => Promise<boolean>
}) {
  const t = useT(olxConnectionMessages)
  const [account, setAccount] = useState('alpha-seller-1')
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const disconnectTrigger = useRef<HTMLButtonElement>(null)
  const connectTrigger = useRef<HTMLButtonElement>(null)
  const accountBody = useRef<HTMLDivElement>(null)
  const real = connection.mode === 'oauth'
  const needsConnection = !connection.connected || connection.reconnectRequired
  const canVerify = real && connection.available && !needsConnection
  const writable = connection.scope?.split(/\s+/).includes('write') === true
  const firstConnection = real && connection.available && !connection.connected
  const temporaryError = canManage && connection.hasTemporarySyncError
  const wasDisconnected = real && !connection.connected && disconnected
  const status = connection.reconnectRequired
    ? 'reconnect'
    : temporaryError
      ? 'temporaryStatus'
      : 'working'
  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_20rem]">
      <Card
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t(
              firstConnection && !wasDisconnected ? 'connectTitle' : 'account',
            )}
            {wasDisconnected && <StatusPill>{t('disconnected')}</StatusPill>}
            {real && connection.connected && (
              <StatusPill
                tone={
                  status === 'working'
                    ? 'ok'
                    : status === 'reconnect'
                      ? 'danger'
                      : 'warn'
                }
              >
                {t(status)}
              </StatusPill>
            )}
          </span>
        }
        headerClassName="min-h-0 border-0 pt-4 pb-0"
        bodyClassName="grid gap-3 pt-2"
      >
        <div
          ref={accountBody}
          tabIndex={-1}
          className="grid gap-3"
          aria-busy={busy}
        >
          {!connection.available && (
            <Notice>
              {t('unavailable')} {t('unavailableHint')}
            </Notice>
          )}
          {wasDisconnected ? (
            <Notice>{t('disconnectedNotice')}</Notice>
          ) : (
            firstConnection && (
              <>
                <p className="rz-caption m-0">{t('oneAccount')}</p>
                <Notice>{t('connectEffect')}</Notice>
                {canManage && (
                  <p className="rz-caption m-0">{t('disconnectedHint')}</p>
                )}
              </>
            )
          )}
          {connection.connected && (
            <FactRows
              rows={[
                {
                  label: t(real ? 'accountId' : 'simulatorConnected'),
                  value: (
                    <span className="font-mono">{connection.accountId}</span>
                  ),
                },
                ...(real
                  ? [
                      ...(canManage && connection.lastSuccessfulSyncAt
                        ? [
                            {
                              label: t('lastSyncAt'),
                              value: (
                                <DateValue
                                  value={connection.lastSuccessfulSyncAt}
                                />
                              ),
                            },
                          ]
                        : []),
                      {
                        label: t('verifiedAt'),
                        value: (
                          <DateValue
                            value={connection.verifiedAt}
                            fallback={t('neverChecked')}
                          />
                        ),
                      },
                      ...(canVerify
                        ? [
                            {
                              label: t('accountAccess'),
                              value: t(writable ? 'readWrite' : 'readOnly'),
                            },
                          ]
                        : []),
                    ]
                  : []),
              ]}
            />
          )}
          <OlxPublicationReadiness
            connection={connection}
            canManage={canManage}
            busy={busy}
            onGrant={() => void onAction('write')}
          />
          {real && connection.reconnectRequired && (
            <Notice tone="danger" block>
              <p className="m-0 font-medium">{t('reconnectTitle')}</p>
              <p className="m-0 mt-1">
                {t(canManage ? 'reconnectImpact' : 'reconnectLimited')}
              </p>
            </Notice>
          )}
          {canVerify && temporaryError && (
            <Notice tone="warn">{t('temporarySync')}</Notice>
          )}
          {!canManage && !connection.reconnectRequired && (
            <p className="rz-caption m-0">{t('noManage')}</p>
          )}
          {error && !confirmDisconnect && (
            <Notice tone="danger">{error}</Notice>
          )}
          {!real && connection.available && needsConnection && canManage && (
            <Field label={t('simulatorAccount')}>
              <TextInput
                value={account}
                maxLength={80}
                disabled={busy}
                onChange={(event) => setAccount(event.target.value)}
              />
            </Field>
          )}
        </div>
        {canManage && (connection.available || connection.connected) && (
          <div className="flex flex-wrap items-center gap-2">
            {connection.available && needsConnection && (
              <Button
                ref={connectTrigger}
                variant="primary"
                disabled={busy || (!real && !account.trim())}
                aria-busy={busy}
                onClick={() => void onAction('connect', account)}
              >
                {real ? <ArrowUpRight aria-hidden /> : <Link2 aria-hidden />}
                {t(
                  real
                    ? connection.reconnectRequired
                      ? 'reconnectAction'
                      : retryConnection
                        ? 'retryConnection'
                        : 'connect'
                    : 'simulatorConnect',
                )}
              </Button>
            )}
            {canVerify && (
              <Button disabled={busy} onClick={() => void onAction('verify')}>
                {t('verify')}
              </Button>
            )}
            {connection.connected && (
              <Button
                ref={disconnectTrigger}
                variant="quiet"
                disabled={busy}
                onClick={() => setConfirmDisconnect(true)}
              >
                {t('disconnect')}
              </Button>
            )}
          </div>
        )}
      </Card>
      {(real || workspaceHref) && (
        <div className="grid gap-3.5">
          {workspaceHref && (
            <Card
              title={t('workspaceTitle')}
              headerClassName="min-h-0 border-0 pt-4 pb-0"
              bodyClassName="grid gap-3 pt-1"
            >
              <p className="rz-caption m-0">{t('workspaceHint')}</p>
              <div>
                <Button asChild>
                  <Link to={workspaceHref}>{t('openWorkspace')}</Link>
                </Button>
              </div>
            </Card>
          )}
          {real && (
            <OlxPermissionsCard canManage={canManage} canPublish={canPublish} />
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t('disconnectTitle')}
        consequence={
          real && connection.accountId
            ? t('disconnectAccount', { account: connection.accountId })
            : t('disconnectHint')
        }
        effects={
          real
            ? [
                t('disconnectSync'),
                t('disconnectAdverts'),
                t('disconnectRestore'),
                t('disconnectSwitch'),
              ]
            : []
        }
        confirmLabel={t('disconnect')}
        pending={busy}
        error={error}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          ;(
            disconnectTrigger.current ??
            connectTrigger.current ??
            accountBody.current
          )?.focus()
        }}
        onConfirm={() => {
          void onAction('disconnect').then((success) => {
            if (success) setConfirmDisconnect(false)
          })
        }}
      />
    </div>
  )
}
