import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { ExternalLink, Link2, RefreshCw, RotateCcw } from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DateValue,
  Fact,
  FactList,
  Notice,
  StatusPill,
  type StatusTone,
} from '@/components/app'
import {
  olxLiveApi,
  type OlxLivePublication,
  type OlxPrepareContent,
  type OlxPreview,
} from '@/api/olx-live'
import { normalizeApiProblem } from '@/api/errors'
import { useFormat, useT } from '@/i18n'
import {
  olxAdvertTone,
  olxIssueKeys,
  olxLiveMessages,
} from './olx-live-messages'
import {
  olxPublicationMessages,
  readOlxProviderIssue,
} from './olx-publication-messages'
import { useOlxPublicationStatus } from './use-olx-publication-status'

const failureMessages: Record<string, keyof typeof olxPublicationMessages.uk> =
  {
    OLX_CONTENT_INVALID: 'invalidContent',
    OLX_WRITE_REJECTED: 'providerRejected',
    OLX_RECONNECT_REQUIRED: 'reconnectRequired',
    OLX_CONNECTION_CHANGED: 'reconnectRequired',
    OLX_NOT_CONNECTED: 'reconnectRequired',
    OLX_WRITE_SCOPE_REQUIRED: 'noWrite',
    OLX_PAYMENT_REQUIRED: 'paymentHint',
    OLX_RATE_LIMITED: 'rateLimited',
    OLX_UNAVAILABLE: 'temporaryFailure',
    OLX_ADVERT_MISMATCH: 'advertMismatch',
  }

const validationFields: Record<string, keyof typeof olxPublicationMessages.uk> =
  {
    title: 'fieldTitle',
    description: 'fieldDescription',
    category_id: 'fieldCategory',
    advertiser_type: 'fieldAdvertiser',
    attributes: 'fieldAttributes',
    contact: 'fieldContact',
    'contact.name': 'fieldContactName',
    'contact.phone': 'fieldPhone',
    location: 'fieldLocation',
    'location.city_id': 'fieldCity',
    'location.district_id': 'fieldDistrict',
    images: 'fieldPhotos',
    price: 'fieldPrice',
  }

const confirmations = {
  publish: { title: 'confirmPublish', consequence: 'publishConsequence' },
  remove: { title: 'confirmRemove', consequence: 'removeConsequence' },
  restore: { title: 'confirmRestore', consequence: 'restoreConsequence' },
} as const

type PublicationAction = 'save' | 'publish' | 'refresh' | 'remove' | 'restore'

const providerToneClass: Record<StatusTone, string> = {
  neutral: '',
  ok: 'text-state-ok',
  info: 'text-state-info',
  warn: 'text-state-warn',
  danger: 'text-state-danger',
}

export function OlxPublicationActions({
  id,
  publication,
  editor,
  details,
  partAvailable,
  onOpenEditor,
  onOpenLink,
  onChange,
  onBusy,
}: {
  id: string
  publication: OlxLivePublication
  editor?: {
    content: OlxPrepareContent
    preview: OlxPreview | null
    canEdit: boolean
    blocked: boolean
    actionsTarget: HTMLDivElement | null
    statusTarget?: HTMLElement | null
    checkAction: ReactNode
    result: {
      title: string
      category: string | undefined
      onEditDescription: () => void
      partHref: string | null
    } | null
    onShowStatus: (() => void) | undefined
  }
  details?: {
    category: string | null
    actionsTarget: HTMLDivElement | null
    close: ReactNode
  }
  partAvailable: boolean
  onOpenEditor?: () => void
  onOpenLink?: () => void
  onChange: (value: OlxLivePublication) => void
  onBusy?: (value: boolean) => void
}) {
  const t = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const fmt = useFormat()
  const { content, preview, canEdit, blocked } = editor ?? {}
  const result = editor?.result
  const showingResult = Boolean(result)
  const editingDescription = !showingResult && Boolean(editor?.onShowStatus)
  const [pendingAction, setPendingAction] = useState<PublicationAction | null>(
    null,
  )
  const busy = pendingAction !== null
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<
    'publish' | 'remove' | 'restore' | null
  >(null)
  const confirmation = confirmations[confirm ?? 'publish']
  const [saved, setSaved] = useState<string | null>(null)
  const life = useRef<AbortController | null>(null)
  const inFlight = useRef(false)
  const resultHeading = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    return () => controller.abort()
  }, [])
  useEffect(() => {
    if (showingResult) resultHeading.current?.focus()
  }, [showingResult])
  const editable =
    publication.state === 'draft' || publication.state === 'rejected'
  const contentEditable =
    ['linked', 'update_pending'].includes(publication.state) &&
    !publication.removeRequested
  const canSave = editable || contentEditable
  async function run(action: PublicationAction) {
    const signal = life.current?.signal
    if (inFlight.current || !signal || signal.aborted) return
    inFlight.current = true
    setPendingAction(action)
    onBusy?.(true)
    setError(null)
    if (action === 'publish') setSaved(null)
    let publishDispatched = false
    try {
      let value = publication
      if (action === 'save' || action === 'publish') {
        if (!content || !canEdit || blocked) return
        value = await olxLiveApi.saveDraft(
          id,
          content,
          publication.revision ?? null,
          { signal },
        )
        if (signal.aborted) return
        onChange(value)
        if (action === 'save') setSaved(JSON.stringify(content))
      }
      if (action === 'publish') {
        if (!value.revision) throw new Error('No saved revision.')
        publishDispatched = true
        value = await olxLiveApi.publish(id, value.revision, { signal })
      } else if (action === 'refresh')
        value = await olxLiveApi.refreshPublication(id, { signal })
      else if (action === 'remove')
        value = await olxLiveApi.remove(id, { signal })
      else if (action === 'restore')
        value = await olxLiveApi.restore(id, { signal })
      if (!signal.aborted) {
        onChange(value)
        setConfirm(null)
        if (action === 'save' && contentEditable) editor?.onShowStatus?.()
      }
    } catch (problem) {
      if (!signal.aborted && publishDispatched) {
        try {
          const recovered = await olxLiveApi.publication(id, { signal })
          if (!signal.aborted) {
            onChange(recovered)
            if (!['draft', 'rejected'].includes(recovered.state))
              setConfirm(null)
            if (recovered.state === 'linked' && recovered.advertId) return
          }
        } catch {
          // Keep the original error and an explicit refresh action; never resend creation.
        }
      }
      if (!signal.aborted) {
        const code = normalizeApiProblem(problem).code
        setError(
          t(
            code === 'OLX_DRAFT_CHANGED'
              ? 'changed'
              : code === 'OLX_NOT_RESTORABLE'
                ? 'restoreChanged'
                : code === 'OLX_CONTENT_INVALID' || code === 'OLX_PART_CHANGED'
                  ? 'invalid'
                  : code === 'OLX_WRITE_SCOPE_REQUIRED' ||
                      code === 'OLX_CONNECTION_CHANGED' ||
                      code === 'OLX_RECONNECT_REQUIRED'
                    ? 'reconnect'
                    : (failureMessages[code ?? ''] ??
                      (action === 'refresh' ? 'statusRefreshError' : 'error')),
          ),
        )
      }
    } finally {
      inFlight.current = false
      if (!signal.aborted) {
        setPendingAction(null)
        onBusy?.(false)
      }
    }
  }
  const { state, providerStatus, providerLabel, label, tone } =
    useOlxPublicationStatus(publication, Boolean(editor) && !showingResult)
  const showInlineIssues = editor && !showingResult && !editingDescription
  const issues = [
    ...new Set(
      (publication.errorFields ?? []).flatMap((issue) => {
        const local = olxIssueKeys.find((key) => key === issue)
        if (local) return [tl(local)]
        const { field, reason } = readOlxProviderIssue(issue)
        const label = field.startsWith('attributes.')
          ? 'fieldAttributes'
          : Object.hasOwn(validationFields, field)
            ? validationFields[field]
            : undefined
        if (!label) return []
        return [
          reason && !showInlineIssues ? `${t(label)} · ${t(reason)}` : t(label),
        ]
      }),
    ),
  ]
  const failure = publication.error
    ? t(
        publication.error === 'OLX_WRITE_REJECTED' && issues.length > 0
          ? 'providerRejectedWithFields'
          : (failureMessages[publication.error] ?? 'syncError'),
      )
    : null
  const hasModerationIssue = [
    'moderated',
    'blocked',
    'disabled',
    'removed_by_moderator',
  ].includes(providerStatus ?? '')
  const checkedAt = publication.checkedAt && fmt.dateTime(publication.checkedAt)
  const advertNumber = `№ ${publication.advertId}`
  const offerLink =
    publication.url && state !== 'deleted' ? publication.url : null
  const showFacts = details && Boolean(publication.advertId)
  const emptyDetails = Boolean(details && editable && !publication.advertId)
  const canRemove =
    Boolean(publication.advertId) &&
    !editable &&
    !publication.removeRequested &&
    state !== 'deleted' &&
    state !== 'delete_unknown' &&
    state !== 'restore_pending' &&
    !publication.canRestore &&
    publication.canWrite
  const removeMenu = canRemove && (
    <ActionMenu
      label={t('listingActions')}
      actions={[
        {
          key: 'withdraw',
          label: t('remove'),
          destructive: true,
          disabled: busy,
          onSelect: () => setConfirm('remove'),
        },
      ]}
    />
  )
  const editButton = !editor && onOpenEditor && canSave && (
    <Button
      variant={editable ? 'primary' : 'ghost'}
      disabled={busy}
      onClick={onOpenEditor}
    >
      {t(editable ? 'openPublish' : 'editDescription')}
    </Button>
  )
  const refreshButton = state !== 'deleted' &&
    (!editable || Boolean(error) || Boolean(publication.revision)) && (
      <Button
        disabled={busy}
        aria-busy={pendingAction === 'refresh'}
        onClick={() => void run('refresh')}
      >
        <RefreshCw
          aria-hidden
          className={
            pendingAction === 'refresh' ? 'motion-safe:animate-spin' : undefined
          }
        />
        {t('refreshStatus')}
      </Button>
    )
  const openButton = offerLink && (
    <Button asChild variant={showingResult || details ? 'primary' : 'ghost'}>
      <a href={offerLink} target="_blank" rel="noopener noreferrer">
        <ExternalLink aria-hidden />
        {t('open')}
      </a>
    </Button>
  )
  const saveButton = canSave && canEdit && (
    <Button
      variant={editingDescription ? 'primary' : 'ghost'}
      disabled={busy || blocked}
      onClick={() => void run('save')}
    >
      {t(contentEditable ? 'saveUpdate' : 'save')}
    </Button>
  )
  const restoreButton = partAvailable && publication.canRestore && (
    <Button disabled={busy} onClick={() => setConfirm('restore')}>
      <RotateCcw aria-hidden />
      {t('restore')}
    </Button>
  )
  const actions = showingResult ? (
    openButton
  ) : editingDescription ? (
    <>
      <Button disabled={busy} onClick={editor?.onShowStatus}>
        {t('backToStatus')}
      </Button>
      {saveButton}
    </>
  ) : (
    <>
      {(!details || editable) && editButton}
      {!editor && onOpenLink && (
        <Button
          variant={onOpenEditor && canSave ? 'ghost' : 'primary'}
          disabled={busy}
          onClick={onOpenLink}
        >
          <Link2 aria-hidden />
          {t('linkExisting')}
        </Button>
      )}
      {saveButton}
      {editor?.checkAction}
      {editable && canEdit && preview?.issues.length === 0 && (
        <Button
          variant="primary"
          disabled={busy || blocked === true || !publication.canWrite}
          onClick={() => setConfirm('publish')}
        >
          {t('publish')}
        </Button>
      )}
      {!details && refreshButton}
      {restoreButton}
      {!emptyDetails && details?.close}
      {openButton}
    </>
  )

  const publicationBadge =
    !showingResult &&
    !editingDescription &&
    !emptyDetails &&
    (!showFacts || providerLabel !== label) ? (
      <div role="status" className="flex flex-wrap items-center gap-2">
        <StatusPill tone={tone}>{label}</StatusPill>
        {!showFacts && providerLabel && providerLabel !== label && (
          <StatusPill tone={olxAdvertTone(providerStatus)}>
            {providerLabel}
          </StatusPill>
        )}
      </div>
    ) : null
  const actionError =
    error && !confirm ? <Notice tone="danger">{error}</Notice> : null

  return (
    <div className="grid min-w-0 gap-3" aria-busy={busy}>
      {result && (
        <div ref={resultHeading} tabIndex={-1} className="min-w-0 outline-none">
          <Card title={result.title} aside={removeMenu}>
            <div className="grid gap-3">
              <section
                aria-label={t('statusSection')}
                className="border-app-line grid min-w-0 gap-2 border-b pb-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div
                    role="status"
                    className="grid min-w-0 justify-items-start gap-1.5"
                  >
                    <StatusPill tone={tone}>{label}</StatusPill>
                    <span className="rz-caption flex flex-wrap gap-x-1.5">
                      <span>{tl('checkedAt')}</span>
                      <DateValue
                        value={publication.checkedAt}
                        fallback={t('statusNotChecked')}
                      />
                    </span>
                  </div>
                  {refreshButton}
                </div>
                {state === 'linked' &&
                  (providerStatus === 'new' ||
                    providerStatus === 'disabled' ||
                    !providerLabel) && (
                    <p className="text-app-muted m-0 text-pretty">
                      {t(
                        providerStatus === 'new'
                          ? 'moderationPending'
                          : providerStatus === 'disabled'
                            ? 'providerDisabled'
                            : 'providerStatusPending',
                      )}
                    </p>
                  )}
                {actionError}
              </section>
              {Boolean(publication.advertId) && (
                <FactList columns={2}>
                  <Fact label={t('advert')}>{advertNumber}</Fact>
                  {result.category && (
                    <Fact label={t('fieldCategory')}>{result.category}</Fact>
                  )}
                  {providerLabel && providerLabel !== label && (
                    <Fact label={t('providerState')}>{providerLabel}</Fact>
                  )}
                </FactList>
              )}
              {((canEdit === true && contentEditable) ||
                Boolean(restoreButton) ||
                result.partHref !== null) && (
                <div className="flex flex-wrap gap-2">
                  {canEdit && contentEditable && (
                    <Button disabled={busy} onClick={result.onEditDescription}>
                      {t('editDescription')}
                    </Button>
                  )}
                  {result.partHref && (
                    <Button asChild variant="quiet">
                      <Link to={result.partHref}>{t('openPart')}</Link>
                    </Button>
                  )}
                  {restoreButton}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
      {showFacts && (
        <dl className="rz-facts border-app-line bg-app-raised rounded-panel border px-3 text-right [&>div]:grid-cols-[minmax(0,1fr)_minmax(0,1.7fr)] [&_dt]:text-left">
          <Fact label={t('advert')}>
            {offerLink ? (
              <a
                href={offerLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-text inline-flex items-center gap-1.5 font-mono hover:underline"
              >
                {advertNumber}
                <ExternalLink aria-hidden className="size-icon-xs shrink-0" />
              </a>
            ) : (
              <span className="font-mono">{advertNumber}</span>
            )}
          </Fact>
          {providerLabel && (
            <Fact label={t('providerState')}>
              <span
                role="status"
                className={`font-mono ${providerToneClass[olxAdvertTone(providerStatus)]}`}
              >
                {providerLabel}
              </span>
            </Fact>
          )}
          {details.category && (
            <Fact label={t('fieldCategory')}>
              <span className="font-mono">{details.category}</span>
            </Fact>
          )}
          <Fact label={tl('checkedAt')}>
            <DateValue
              value={publication.checkedAt}
              fallback={t('statusNotChecked')}
            />
          </Fact>
        </dl>
      )}
      {emptyDetails && (
        <Card
          title={t('listingTitle')}
          aside={<StatusPill tone={tone}>{label}</StatusPill>}
        >
          <div className="grid gap-4">
            <p className="text-app-muted m-0 text-pretty">
              {t('listingStartHint')}
            </p>
            <div className="flex flex-wrap gap-2">{actions}</div>
          </div>
        </Card>
      )}
      {editor?.statusTarget && state === 'draft'
        ? createPortal(publicationBadge, editor.statusTarget)
        : publicationBadge}
      {showFacts && !failure && contentEditable && (
        <p className="rz-caption m-0">{t('linkedHint')}</p>
      )}
      {!showingResult && !editingDescription && !showFacts && checkedAt && (
        <p className="rz-dim m-0">{tl('checked', { date: checkedAt })}</p>
      )}
      {(state === 'unknown' ||
        state === 'creating' ||
        state === 'delete_unknown') && (
        <Notice tone="info">{t('unknownHint')}</Notice>
      )}
      {providerStatus === 'unpaid' &&
        publication.error !== 'OLX_PAYMENT_REQUIRED' && (
          <Notice tone="warn">{t('paymentHint')}</Notice>
        )}
      {providerStatus === 'limited' && (
        <Notice tone="warn">{t('limitedHint')}</Notice>
      )}
      {hasModerationIssue && (
        <Notice tone="warn" block>
          <p className="m-0 font-medium">{t('moderationHeading')}</p>
          <p className="m-0 mt-1 break-words">
            {publication.moderationReason ?? t('moderationUnavailable')}
          </p>
        </Notice>
      )}
      {editable && !publication.canWrite && <Notice>{t('noWrite')}</Notice>}
      {editor && !canEdit && canSave && <Notice>{t('noEdit')}</Notice>}
      {partAvailable && publication.requiresManualRestore && (
        <Notice tone="warn">{t('manualRestoreHint')}</Notice>
      )}
      {failure && (
        <Notice tone="danger" block role="alert">
          <p className="m-0">{failure}</p>
          {issues.length > 0 && (
            <ul className="m-0 mt-1 list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </Notice>
      )}
      {!showingResult && actionError}
      {editor && saved === JSON.stringify(content) && canSave && (
        <Notice tone="ok">
          {t(contentEditable ? 'updateQueued' : 'saved')}
        </Notice>
      )}
      {details ? (
        <>
          {((!editable && Boolean(editButton)) ||
            Boolean(refreshButton) ||
            canRemove) && (
            <div className="flex flex-wrap gap-2">
              {!editable && editButton}
              {refreshButton}
              {removeMenu}
            </div>
          )}
          {!emptyDetails &&
            details.actionsTarget &&
            createPortal(actions, details.actionsTarget)}
        </>
      ) : editor?.actionsTarget ? (
        createPortal(actions, editor.actionsTarget)
      ) : !editor ? (
        <div className="flex flex-wrap gap-2">{actions}</div>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null)
        }}
        title={t(confirmation.title)}
        consequence={t(confirmation.consequence)}
        confirmLabel={t(confirm ?? 'publish')}
        destructive={confirm === 'remove'}
        pending={busy}
        error={error}
        onCloseAutoFocus={(event) => {
          if (!resultHeading.current) return
          event.preventDefault()
          resultHeading.current.focus()
        }}
        onConfirm={() => {
          if (confirm) void run(confirm)
        }}
      >
        {confirm === 'publish' && preview && (
          <div className="grid gap-3">
            <FactList columns={2}>
              <Fact label={t('fieldTitle')}>{preview.part.title}</Fact>
              <Fact label={t('fieldPrice')}>
                {fmt.money(
                  preview.part.price ?? null,
                  preview.part.currency ?? null,
                )}
              </Fact>
              {preview.category && (
                <Fact label={t('fieldCategory')} className="sm:col-span-2">
                  {preview.category.path}
                </Fact>
              )}
            </FactList>
            {busy && (
              <Notice tone="info" role="status">
                {t('sendingPublication')}
              </Notice>
            )}
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
