import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import {
  ExternalLink,
  Eye,
  EyeOff,
  Link2,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react'
import {
  ActionMenu,
  Button,
  Card,
  ConfirmDialog,
  DateValue,
  Fact,
  FactList,
  Notice,
  SectionPanel,
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
  olxPublicationFailures,
  olxPublicationMessages,
  readOlxProviderIssue,
  olxProviderFieldLabel,
} from './olx-publication-messages'
import { useOlxPublicationStatus } from './use-olx-publication-status'
import { tenantRequestScope } from '../tenant-request-scope'

const confirmations = {
  publish: { title: 'confirmPublish', consequence: 'publishConsequence' },
  remove: { title: 'confirmRemove', consequence: 'removeConsequence' },
  restore: { title: 'confirmRestore', consequence: 'restoreConsequence' },
  exclude: {
    title: 'partTabConfirmExclude',
    consequence: 'partTabExcludeConsequence',
  },
} as const

type PublicationAction =
  | 'save'
  | 'publish'
  | 'refresh'
  | 'remove'
  | 'restore'
  | 'exclude'
  | 'include'

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
  canSeeDiagnostics,
  editor,
  details,
  result,
  partAvailable,
  expectedAccountId: selectedAccountId,
  partPage,
  onOpenEditor,
  onOpenLink,
  onChange,
  onBusy,
}: {
  id: string
  publication: OlxLivePublication
  canSeeDiagnostics: boolean
  editor?: {
    content: OlxPrepareContent
    preview: OlxPreview | null
    canEdit: boolean
    blocked: boolean
    actionsTarget: HTMLDivElement | null
    statusTarget?: HTMLElement | null
    checkAction: ReactNode
    onShowStatus: (() => void) | undefined
  }
  result?: {
    title: string | null
    category: string | undefined
    onEditDescription?: () => void
    partHref: string | null
    actionsTarget: HTMLDivElement | null
  } | null
  details?: {
    category: string | null
    actionsTarget: HTMLDivElement | null
    close: ReactNode
  }
  partAvailable: boolean
  expectedAccountId?: string
  partPage?: {
    accountId: string | null
    canManage: boolean
    category?: string | undefined
    readiness?: ReactNode
  }
  onOpenEditor?: () => void
  onOpenLink?: () => void
  onChange: (value: OlxLivePublication) => void
  onBusy?: (value: boolean) => void
}) {
  const t = useT(olxPublicationMessages)
  const tl = useT(olxLiveMessages)
  const fmt = useFormat()
  const { content, preview, canEdit, blocked } = editor ?? {}
  const showingResult = Boolean(result)
  const editingDescription = !showingResult && Boolean(editor?.onShowStatus)
  const [pendingAction, setPendingAction] = useState<PublicationAction | null>(
    null,
  )
  const busy = pendingAction !== null
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<keyof typeof confirmations | null>(
    null,
  )
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
    const lifetime = life.current?.signal
    const signal =
      lifetime && AbortSignal.any([lifetime, tenantRequestScope.signal])
    if (
      inFlight.current ||
      !signal ||
      signal.aborted ||
      (action === 'publish' && publication.excluded)
    )
      return
    inFlight.current = true
    setPendingAction(action)
    onBusy?.(true)
    setError(null)
    if (action === 'publish') setSaved(null)
    let publishDispatched = false
    const expectedAccountId = partPage?.accountId ?? selectedAccountId
    const account = expectedAccountId ? { expectedAccountId } : {}
    try {
      let value = publication
      if (action === 'save' || action === 'publish') {
        if (!content || !canEdit || blocked) return
        value = await olxLiveApi.saveDraft(
          id,
          content,
          publication.revision ?? null,
          { signal, ...account },
        )
        if (signal.aborted) return
        onChange(value)
        if (action === 'save') setSaved(JSON.stringify(content))
      }
      if (action === 'publish') {
        if (!value.revision) throw new Error('No saved revision.')
        publishDispatched = true
        value = await olxLiveApi.publish(id, value.revision, {
          signal,
          ...account,
        })
      } else if (action === 'refresh')
        value = await olxLiveApi.refreshPublication(id, { signal })
      else if (action === 'remove')
        value = await olxLiveApi.remove(id, {
          signal,
          ...account,
          ...(expectedAccountId && publication.advertId
            ? { expectedAdvertId: publication.advertId }
            : {}),
        })
      else if (action === 'restore')
        value = await olxLiveApi.restore(id, { signal })
      else if (action === 'exclude' || action === 'include') {
        if (!expectedAccountId || !partPage?.canManage) return
        value = await olxLiveApi.setExclusion(
          id,
          {
            excluded: action === 'exclude',
            expectedAccountId,
          },
          { signal },
        )
      }
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
        const message =
          canSeeDiagnostics || code === 'OLX_PAYMENT_REQUIRED'
            ? olxPublicationFailures[code ?? '']
            : undefined
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
                    : (message ??
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
    useOlxPublicationStatus(
      publication,
      !partPage && Boolean(editor) && !showingResult,
    )
  const showInlineIssues =
    editor != null &&
    (partPage != null || (!showingResult && !editingDescription))
  const issues = [
    ...new Set(
      (canSeeDiagnostics ? (publication.errorFields ?? []) : []).flatMap(
        (issue) => {
          const local = olxIssueKeys.find((key) => key === issue)
          if (local) return [tl(local)]
          const { field, reason } = readOlxProviderIssue(issue)
          const label = olxProviderFieldLabel(field)
          if (!label) return []
          return [
            reason && !showInlineIssues
              ? `${t(label)} · ${t(reason)}`
              : t(label),
          ]
        },
      ),
    ),
  ]
  const failure = publication.error
    ? t(
        !canSeeDiagnostics && publication.error !== 'OLX_PAYMENT_REQUIRED'
          ? 'diagnosticsRestricted'
          : publication.error === 'OLX_WRITE_REJECTED' && issues.length > 0
            ? 'providerRejectedWithFields'
            : (olxPublicationFailures[publication.error] ?? 'syncError'),
      )
    : null
  const hasModerationIssue = [
    'moderated',
    'blocked',
    'disabled',
    'removed_by_moderator',
  ].includes(providerStatus ?? '')
  const moderationCause = canSeeDiagnostics
    ? (publication.moderationReason ?? t('moderationUnavailable'))
    : t('diagnosticsRestricted')
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
      variant={partPage || editingDescription ? 'primary' : 'ghost'}
      disabled={busy || blocked}
      onClick={() => void run('save')}
    >
      {t(
        contentEditable
          ? partPage
            ? 'partTabSaveUpdate'
            : 'saveUpdate'
          : 'save',
      )}
    </Button>
  )
  const restoreButton = partAvailable && publication.canRestore && (
    <Button disabled={busy} onClick={() => setConfirm('restore')}>
      <RotateCcw aria-hidden />
      {t('restore')}
    </Button>
  )
  const requiresManualRestore =
    partAvailable && publication.requiresManualRestore
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
          disabled={
            busy ||
            blocked === true ||
            !publication.canWrite ||
            publication.excluded === true
          }
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

  const confirmationDialog = (
    <ConfirmDialog
      open={confirm !== null}
      onOpenChange={(open) => {
        if (!open) setConfirm(null)
      }}
      title={t(confirmation.title)}
      consequence={t(confirmation.consequence)}
      confirmLabel={t(
        confirm === 'exclude' ? 'partTabExclude' : (confirm ?? 'publish'),
      )}
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
  )

  if (partPage) {
    const reconciling =
      state === 'unknown' || state === 'creating' || state === 'delete_unknown'
    const payment = providerStatus === 'unpaid' || providerStatus === 'limited'
    const removed =
      state === 'removed' ||
      (state === 'linked' && providerStatus === 'removed_by_user')
    const stockRemoval =
      removed &&
      publication.removeRequested &&
      publication.requiresManualRestore === false &&
      providerStatus === 'removed_by_user'
    const showRestore = publication.canRestore === true || stockRemoval
    const canExclude =
      partPage.canManage && Boolean(partPage.accountId) && !reconciling
    const withdraw =
      canRemove && ['linked', 'update_pending'].includes(state) && !removed
    const displayedLabel = publication.excluded
      ? t('partTabExcluded')
      : payment
        ? t('partTabPayment')
        : reconciling
          ? t('partTabReconcile')
          : state === 'draft'
            ? t('draft')
            : state === 'rejected'
              ? t('partTabRejected')
              : label
    return (
      <div
        ref={resultHeading}
        aria-label={t('statusSection')}
        role="region"
        tabIndex={-1}
        className="grid min-w-0 gap-3"
        aria-busy={busy}
      >
        <Card
          title={t('listingTitle')}
          aside={
            <div role="status">
              <StatusPill
                tone={
                  publication.excluded
                    ? 'neutral'
                    : payment || reconciling
                      ? 'warn'
                      : tone
                }
              >
                {displayedLabel}
              </StatusPill>
            </div>
          }
        >
          <div className="grid min-w-0 gap-3">
            {state === 'draft' &&
              !publication.advertId &&
              !publication.excluded && (
                <p className="rz-caption m-0">
                  {preview?.issues.length === 0
                    ? t('partTabReady')
                    : t('notPublished')}
                </p>
              )}
            {(Boolean(publication.advertId) ||
              Boolean(publication.checkedAt) ||
              Boolean(publication.observedStatus) ||
              (state === 'rejected' && issues.length > 0)) && (
              <dl className="rz-facts m-0">
                {publication.advertId && (
                  <Fact label={t('advert')}>
                    {offerLink ? (
                      <a
                        className="text-brand-text inline-flex items-center gap-1.5 font-mono hover:underline"
                        href={offerLink}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {advertNumber}
                        <ExternalLink aria-hidden className="size-icon-xs" />
                      </a>
                    ) : (
                      <span className="font-mono">{advertNumber}</span>
                    )}
                  </Fact>
                )}
                {publication.observedStatus && (
                  <Fact label={t('providerState')}>
                    <span className="font-mono">
                      {publication.observedStatus}
                    </span>
                  </Fact>
                )}
                {partPage.category && publication.advertId && (
                  <Fact label={t('fieldCategory')}>{partPage.category}</Fact>
                )}
                {publication.checkedAt && (
                  <Fact label={tl('checkedAt')}>
                    <DateValue value={publication.checkedAt} />
                  </Fact>
                )}
                {state === 'rejected' && issues.length > 0 && (
                  <Fact label={t('partTabIssues')}>{issues.length}</Fact>
                )}
              </dl>
            )}
            {publication.excluded && (
              <Notice tone="warn">{t('partTabExcludedHint')}</Notice>
            )}
            {reconciling && <Notice>{t('unknownHint')}</Notice>}
            {payment && (
              <Notice tone="warn">
                {t(
                  providerStatus === 'limited' ? 'limitedHint' : 'paymentHint',
                )}
              </Notice>
            )}
            {removed && !partAvailable && (
              <Notice>{t('partTabNoStock')}</Notice>
            )}
            {stockRemoval && !publication.excluded && (
              <p className="rz-caption m-0">{t('partTabStockRestore')}</p>
            )}
            {publication.requiresManualRestore && !publication.excluded && (
              <p className="rz-caption m-0">{t('manualRestoreHint')}</p>
            )}
            {state === 'linked' && providerStatus === 'new' && (
              <Notice>{t('moderationPending')}</Notice>
            )}
            {hasModerationIssue && (
              <Notice tone="warn">{moderationCause}</Notice>
            )}
            {failure &&
              (!hasModerationIssue || canSeeDiagnostics) &&
              !(state === 'rejected' && issues.length > 0) &&
              (!payment || publication.error !== 'OLX_PAYMENT_REQUIRED') && (
                <Notice tone="danger" role="alert" block>
                  {failure}
                  {issues.length > 0 && (
                    <ul className="m-0 mt-1 list-disc pl-5">
                      {issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </Notice>
              )}
            {actionError}
            {saved === JSON.stringify(content) && canSave && (
              <Notice tone="ok">
                {t(contentEditable ? 'updateQueued' : 'saved')}
              </Notice>
            )}
            {partPage.readiness}
            <div className="rz-btn-row">
              {editable && !publication.excluded && (
                <Button
                  variant="primary"
                  disabled={
                    busy ||
                    blocked === true ||
                    !canEdit ||
                    !publication.canWrite ||
                    preview?.issues.length !== 0 ||
                    (state === 'rejected' && issues.length > 0)
                  }
                  onClick={() => setConfirm('publish')}
                >
                  <Send aria-hidden />
                  {t(state === 'rejected' ? 'partTabRepublish' : 'publish')}
                </Button>
              )}
              {payment && (
                <Button variant="primary" asChild>
                  <a
                    href="https://www.olx.ua/myaccount/"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink aria-hidden /> {t('partTabPay')}
                  </a>
                </Button>
              )}
              {reconciling ? (
                <Button disabled={busy} onClick={() => void run('refresh')}>
                  <RefreshCw aria-hidden /> {t('partTabReconcileNow')}
                </Button>
              ) : (
                !editable && refreshButton
              )}
              {!payment && !reconciling && publication.advertId && openButton}
              {withdraw && (
                <Button disabled={busy} onClick={() => setConfirm('remove')}>
                  <EyeOff aria-hidden /> {t('remove')}
                </Button>
              )}
              {showRestore && !publication.excluded && (
                <Button
                  variant={partAvailable ? 'primary' : 'ghost'}
                  disabled={busy || !partAvailable || !publication.canRestore}
                  onClick={() => setConfirm('restore')}
                >
                  <RotateCcw aria-hidden /> {t('restore')}
                </Button>
              )}
              {canExclude &&
                (publication.excluded ? (
                  <Button disabled={busy} onClick={() => void run('include')}>
                    <Eye aria-hidden /> {t('partTabInclude')}
                  </Button>
                ) : (
                  <ActionMenu
                    label={t('listingActions')}
                    actions={[
                      {
                        key: 'exclude',
                        label: t('partTabExclude'),
                        icon: <EyeOff aria-hidden />,
                        disabled: busy,
                        onSelect: () => setConfirm('exclude'),
                      },
                    ]}
                  />
                ))}
            </div>
          </div>
        </Card>
        {editor?.actionsTarget &&
          createPortal(
            <>
              {saveButton}
              {editor.checkAction}
            </>,
            editor.actionsTarget,
          )}
        {confirmationDialog}
      </div>
    )
  }

  return (
    <div className="grid min-w-0 gap-3" aria-busy={busy}>
      {result && (
        <div
          ref={resultHeading}
          role={result.title ? 'region' : undefined}
          aria-label={result.title ? t('statusSection') : undefined}
          tabIndex={-1}
          className="min-w-0 outline-none"
        >
          <SectionPanel
            title={result.title ?? t('statusSection')}
            headingLevel={3}
            variant="plain"
            aside={
              <div className="flex flex-wrap items-center gap-2">
                <div role="status">
                  <StatusPill tone={tone}>{label}</StatusPill>
                </div>
                {removeMenu}
              </div>
            }
          >
            <FactList columns={2}>
              {publication.advertId && (
                <Fact label={t('advert')}>
                  <span className="font-mono">{advertNumber}</span>
                </Fact>
              )}
              <Fact label={tl('checkedAt')}>
                <DateValue
                  value={publication.checkedAt}
                  fallback={t('statusNotChecked')}
                />
              </Fact>
              {publication.advertId && result.category && (
                <Fact label={t('fieldCategory')} className="sm:col-span-2">
                  {result.category}
                </Fact>
              )}
              {publication.advertId &&
                providerLabel &&
                providerLabel !== label && (
                  <Fact label={t('providerState')}>{providerLabel}</Fact>
                )}
            </FactList>
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
            {requiresManualRestore && (
              <Notice tone="warn" action={restoreButton}>
                {t('manualRestoreHint')}
              </Notice>
            )}
            {actionError}
            <div className="rz-btn-row empty:hidden">
              {refreshButton}
              {canEdit && contentEditable && result.onEditDescription && (
                <Button disabled={busy} onClick={result.onEditDescription}>
                  {t('editDescription')}
                </Button>
              )}
              {result.partHref && (
                <Button asChild variant="quiet">
                  <Link to={result.partHref}>{t('openPart')}</Link>
                </Button>
              )}
              {!requiresManualRestore && restoreButton}
            </div>
          </SectionPanel>
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
      {publication.excluded && <Notice tone="warn">{t('partExcluded')}</Notice>}
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
          {canSeeDiagnostics && (
            <p className="m-0 font-medium">{t('moderationHeading')}</p>
          )}
          <p className="m-0 mt-1 break-words">{moderationCause}</p>
        </Notice>
      )}
      {editable && !publication.canWrite && <Notice>{t('noWrite')}</Notice>}
      {editor && !canEdit && canSave && <Notice>{t('noEdit')}</Notice>}
      {!showingResult && requiresManualRestore && (
        <Notice tone="warn">{t('manualRestoreHint')}</Notice>
      )}
      {failure && (!hasModerationIssue || canSeeDiagnostics) && (
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
      ) : result?.actionsTarget ? (
        createPortal(actions, result.actionsTarget)
      ) : editor?.actionsTarget ? (
        createPortal(actions, editor.actionsTarget)
      ) : !editor ? (
        <div className="flex flex-wrap gap-2">{actions}</div>
      ) : null}
      {confirmationDialog}
    </div>
  )
}
