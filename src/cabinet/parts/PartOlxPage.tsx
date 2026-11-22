import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Link2 } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { normalizeApiProblem } from '@/api/errors'
import { launchOlxOAuth, olxApi, type OlxConnection } from '@/api/olx'
import type { OlxLivePublication } from '@/api/olx-live'
import type { PartDetail } from '@/api/parts'
import {
  Button,
  ErrorState,
  Notice,
  PanelFooter,
  SkeletonRows,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { OlxLinkAdvertPanel } from '../olx/OlxLinkAdvertPanel'
import { OlxPreparationPanel } from '../olx/OlxPreparationPanel'
import { OlxPublicationReadiness } from '../olx/OlxPublicationReadiness'
import { olxConnectionMessages } from '../olx/olx-connection-messages'
import {
  clearOlxPartReturn,
  olxPartOutcome,
  readOlxPartReturn,
  saveOlxPartReturn,
  type OlxPartDraft,
} from '../olx/olx-part-oauth-return'
import { olxPublicationMessages } from '../olx/olx-publication-messages'
import { tenantRequestScope } from '../tenant-request-scope'

export function PartOlxPage({
  partId,
  partDetails,
  available,
  canEditPart,
  settingsHref,
  onPartSaved,
}: {
  partId: string
  partDetails: Pick<PartDetail, 'condition' | 'oemCode'>
  available: boolean
  canEditPart: boolean
  settingsHref: string | null
  onPartSaved: (part: PartDetail) => void
}) {
  const t = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const ta = useT(olxConnectionMessages)
  const titleId = useId()
  const { snapshot } = useCabinet()
  const returnState = useLocation().state as { olxPartOutcome?: unknown } | null
  const [returned] = useState(() => {
    const outcome = olxPartOutcome(returnState?.olxPartOutcome)
    if (!snapshot || !outcome) return null
    const pending = readOlxPartReturn(snapshot)
    return pending?.partId === partId ? { ...pending, outcome } : null
  })
  const draftSnapshot = useRef<{
    draft: OlxPartDraft | null
    editingPartData: boolean
  } | null>(null)
  const [connection, setConnection] = useState<OlxConnection | null>(null)
  const [publication, setPublication] = useState<OlxLivePublication | null>(
    null,
  )
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [editorRevision, setEditorRevision] = useState(0)
  const [linking, setLinking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [grantBusy, setGrantBusy] = useState(false)
  const [grantError, setGrantError] = useState<string | null>(null)
  const pendingGrant = useRef(false)
  const connectionSignal = useRef<AbortSignal | null>(null)
  const [editorActions, setEditorActions] = useState<HTMLDivElement | null>(
    null,
  )
  const [linkActions, setLinkActions] = useState<HTMLDivElement | null>(null)
  const [statusTarget, setStatusTarget] = useState<HTMLDivElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    if (returned) clearOlxPartReturn()
  }, [returned])

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    connectionSignal.current = signal
    void olxApi.connection({ signal }).then(
      (account) => {
        if (!signal.aborted) setConnection(account)
      },
      () => {
        if (!signal.aborted) setFailed(true)
      },
    )
    return () => controller.abort()
  }, [attempt])

  const settingsLink = settingsHref && (
    <Button asChild>
      <Link to={settingsHref}>{t('settings')}</Link>
    </Button>
  )
  const connectionNotice =
    connection &&
    (connection.mode !== 'oauth' || !connection.available
      ? ta('unavailable')
      : !connection.connected || connection.reconnectRequired
        ? t(
            !settingsHref
              ? 'askAdmin'
              : connection.reconnectRequired
                ? 'accessLost'
                : 'connectHint',
          )
        : null)
  const sameOlxAccount = returned?.accountId === (connection?.accountId ?? null)
  const restoredDraft = sameOlxAccount ? (returned?.draft ?? null) : null
  const returnedWithWrite =
    sameOlxAccount &&
    returned?.outcome === 'connected' &&
    connection?.scope?.split(/\s+/).includes('write') === true

  function openLinkView(open: boolean) {
    setLinking(open)
    heading.current?.focus()
  }

  async function grantPublication() {
    const signal = connectionSignal.current
    if (
      !settingsHref ||
      !snapshot ||
      !connection ||
      busy ||
      pendingGrant.current ||
      !signal ||
      signal.aborted
    )
      return
    if (draftSnapshot.current?.editingPartData) {
      setGrantError(t('returnFinishPartEdit'))
      return
    }
    pendingGrant.current = true
    setGrantBusy(true)
    setGrantError(null)
    try {
      const start = await olxApi.startWriteOAuth({ signal })
      if (signal.aborted) return
      if (draftSnapshot.current?.editingPartData) {
        setGrantError(t('returnFinishPartEdit'))
        return
      }
      if (
        !saveOlxPartReturn(
          snapshot,
          partId,
          connection.accountId ?? null,
          draftSnapshot.current?.draft ?? null,
          start.expiresAt,
        )
      ) {
        setGrantError(t('returnStorageError'))
        return
      }
      launchOlxOAuth(start)
    } catch (problem) {
      const { code } = normalizeApiProblem(problem)
      if (!signal.aborted) {
        clearOlxPartReturn()
        setGrantError(
          ta(
            code === 'OLX_RATE_LIMITED'
              ? 'rateLimited'
              : code === 'OLX_BUSY'
                ? 'busy'
                : code === 'OLX_RECONNECT_REQUIRED'
                  ? 'reconnectHint'
                  : 'errorHint',
          ),
        )
      }
    } finally {
      pendingGrant.current = false
      if (!signal.aborted) setGrantBusy(false)
    }
  }

  return (
    <section aria-labelledby={titleId} className="grid min-w-0 gap-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2
          ref={heading}
          id={titleId}
          tabIndex={-1}
          className="rz-h-title scroll-mt-4 focus:outline-none"
        >
          {t(linking ? 'linkExisting' : 'title')}
        </h2>
        {!linking && publication?.canLinkExisting && !publication.advertId && (
          <Button
            disabled={busy || grantBusy}
            onClick={() => openLinkView(true)}
          >
            <Link2 aria-hidden />
            {t('linkExisting')}
          </Button>
        )}
      </header>
      {returned && connection && (
        <Notice tone={returnedWithWrite ? 'ok' : 'warn'}>
          {!sameOlxAccount
            ? ta('accessChanged')
            : returnedWithWrite
              ? t('publicationReady')
              : returned.outcome === 'cancelled'
                ? t('returnCancelled')
                : returned.outcome === 'connected'
                  ? t('noWrite')
                  : ta(
                      returned.outcome === 'account_in_use'
                        ? 'accountInUse'
                        : returned.outcome === 'already_connected'
                          ? 'alreadyConnected'
                          : returned.outcome === 'failed'
                            ? 'failed'
                            : 'accessChanged',
                    )}
        </Notice>
      )}
      {failed ? (
        <ErrorState
          title={t('loadPublicationError')}
          onRetry={() => {
            setFailed(false)
            setAttempt((value) => value + 1)
          }}
        />
      ) : !connection ? (
        <SkeletonRows rows={3} label={t('loadingPublication')} />
      ) : connectionNotice ? (
        <>
          <Notice tone={connection.reconnectRequired ? 'danger' : 'info'}>
            {connectionNotice}
          </Notice>
          {settingsLink && <div>{settingsLink}</div>}
        </>
      ) : (
        <>
          <div className={linking ? 'hidden' : 'grid min-w-0 gap-3'}>
            <OlxPublicationReadiness
              connection={connection}
              canManage={Boolean(settingsHref)}
              onGrant={() => void grantPublication()}
              busy={busy || grantBusy}
              error={grantError}
            />
            {canEditPart &&
              !available &&
              publication &&
              !publication.advertId && (
                <Notice tone="warn">{t('partUnavailable')}</Notice>
              )}
            <div className="contents" inert={grantBusy}>
              <OlxPreparationPanel
                key={editorRevision}
                id={partId}
                partDetails={partDetails}
                canEdit={canEditPart && available}
                actionsTarget={editorActions}
                page={{ partAvailable: available, statusTarget }}
                onPartSaved={onPartSaved}
                onPublicationChange={setPublication}
                onMutationBusy={setBusy}
                draftRef={draftSnapshot}
                restoredDraft={restoredDraft}
                startEditingDescription={
                  restoredDraft?.editingDescription ?? false
                }
              />
              <PanelFooter
                standalone
                leading={<div ref={setStatusTarget} />}
                className="sm:sticky sm:bottom-0 sm:z-10 [&:not(:has(button,a,.rz-skel))]:hidden"
              >
                <div ref={setEditorActions} className="contents" />
              </PanelFooter>
            </div>
          </div>
          {linking && publication && (
            <>
              <OlxLinkAdvertPanel
                partId={partId}
                revision={publication.revision ?? null}
                available={available}
                actionsTarget={linkActions}
                onBusy={setBusy}
                onLinked={(value) => {
                  setPublication(value)
                  setEditorRevision((revision) => revision + 1)
                  openLinkView(false)
                }}
              />
              <PanelFooter standalone>
                <Button
                  variant="quiet"
                  disabled={busy}
                  onClick={() => openLinkView(false)}
                >
                  <ArrowLeft aria-hidden />
                  {tc('back')}
                </Button>
                <div ref={setLinkActions} className="contents" />
              </PanelFooter>
            </>
          )}
        </>
      )}
    </section>
  )
}
