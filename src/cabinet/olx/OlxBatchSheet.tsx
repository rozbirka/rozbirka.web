import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { ApiProblem } from '@/api/contracts'
import { normalizeApiProblem } from '@/api/errors'
import { olxApi, type OlxConnection } from '@/api/olx'
import {
  olxLiveApi,
  type OlxCategory,
  type OlxLivePublication,
  type OlxPrepareContent,
  type OlxPublicationJob,
  type StartOlxPublicationJob,
} from '@/api/olx-live'
import { partsApi } from '@/api/parts'
import {
  Button,
  ConfirmDialog,
  Field,
  Notice,
  SectionPanel,
  SelectPicker,
  Sheet,
  SkeletonFields,
  TextInput,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { tenantRequestScope } from '../tenant-request-scope'
import { olxBatchMessages } from './olx-batch-messages'
import { olxIssueKeys, olxLiveMessages } from './olx-live-messages'
import { olxPublicationMessages } from './olx-publication-messages'
import { emptyOlxContent } from './olx-prepare-content'

export type OlxBatchMode = 'category' | 'publish'
export interface OlxBatchPart {
  id: string
  name: string | undefined
}

type Status =
  | 'ready'
  | 'blocked'
  | 'linked'
  | 'pending'
  | 'submitted'
  | 'assigned'
  | 'failed'
  | 'skipped'
  | 'queued'

export interface OlxBatchResult extends OlxBatchPart {
  status: Status
  advertId?: string | null
  issues?: string[]
  ready?: { content: OlxPrepareContent; revision: string; save: boolean }
}

interface State {
  rows: OlxBatchResult[]
  complete: boolean
}
type Action = 'assign' | 'check'
type Message = keyof typeof olxBatchMessages.uk
interface Setup {
  account: OlxConnection
  categories: OlxCategory[]
}

const resultGroups = [
  {
    status: 'submitted',
    heading: 'submittedGroup',
    caption: 'submittedHint',
    badge: 'processing',
    badgeClass: 'text-state-info',
  },
  { status: 'assigned', heading: 'assigned' },
  { status: 'blocked', heading: 'blockedGroup', action: 'fix' },
  {
    status: 'linked',
    heading: 'linkedGroup',
    badge: 'unchanged',
    badgeClass: 'text-app-muted',
  },
  { status: 'failed', heading: 'failedGroup', action: 'details' },
  { status: 'pending', heading: 'pending', action: 'details' },
  { status: 'skipped', heading: 'skipped', action: 'details' },
  { status: 'queued', heading: 'jobQueued' },
] as const satisfies readonly {
  status: Status
  heading: Message
  caption?: Message
  badge?: Message
  badgeClass?: string
  action?: Message
}[]

function stopMessage(problem: ApiProblem): Message | undefined {
  switch (problem.code) {
    case 'OLX_CONNECTION_CHANGED':
    case 'OLX_NOT_CONNECTED':
    case 'OLX_RECONNECT_REQUIRED':
      return 'connectionChanged'
    case 'OLX_RATE_LIMITED':
      return 'rateLimit'
    case 'OLX_WRITE_DISABLED':
    case 'OLX_WRITE_SCOPE_REQUIRED':
      return 'permissionChanged'
    default:
      return problem.kind === 'forbidden' || problem.kind === 'session-expired'
        ? 'permissionChanged'
        : undefined
  }
}

function canPrepare(publication: OlxLivePublication) {
  return (
    !publication.advertId && ['draft', 'rejected'].includes(publication.state)
  )
}

function canWrite(setup: Setup | null) {
  return (
    setup?.account.writesAvailable === true &&
    setup.account.scope?.split(' ').includes('write') === true
  )
}

export function OlxBatchSheet({
  initialMode,
  parts,
  partsHref,
  onChanged,
  onJobStarted,
  onClose,
  returnFocus,
}: {
  initialMode: OlxBatchMode
  parts: readonly OlxBatchPart[]
  partsHref: string
  onChanged: () => void
  onJobStarted: (job: OlxPublicationJob, review: OlxBatchResult[]) => void
  onClose: () => void
  returnFocus: () => void
}) {
  const t = useT(olxBatchMessages)
  const tl = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const [mode, setMode] = useState(initialMode)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [setupError, setSetupError] = useState<Message | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [categoryId, setCategoryId] = useState('')
  const [sellerType, setSellerType] = useState('')
  const [showSellerType, setShowSellerType] = useState(false)
  const [state, setState] = useState<State | null>(null)
  const [busy, setBusy] = useState<Action | 'start' | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [startError, setStartError] = useState<Message | null>(null)
  const startRequest = useRef<StartOlxPublicationJob | null>(null)
  const preparedRevisions = useRef(new Map<string, string>())
  const [stop, setStop] = useState<Message | null>(null)
  const scope = useRef<AbortSignal | null>(null)
  const working = useRef(false)
  const resultBody = useRef<HTMLDivElement>(null)
  const ready = state?.rows.filter((row) => row.status === 'ready') ?? []
  const canPublish = canWrite(setup)

  function previewIssue(issue: OlxPreviewIssue) {
    const key = olxIssueKeys.find((code) => code === issue.code)
    if (!key) return tl('checkIssue')
    if (
      key === 'attribute_required' ||
      key === 'attribute_invalid' ||
      key === 'attribute_unknown'
    )
      return `${tl(key)} (${issue.field})`
    return tl(key)
  }

  async function run(
    action: Action,
    connection = setup,
    defaultSellerType = sellerType,
  ) {
    const signal = scope.current
    const expectedAccountId = connection?.account.accountId
    if (!signal || signal.aborted || !expectedAccountId || working.current)
      return
    const category = connection.categories.find(
      ({ id }) => String(id) === categoryId,
    )
    if (action === 'assign' && !category) return
    if (action !== 'assign' && !canWrite(connection)) return
    if (parts.length === 0) return
    startRequest.current = null
    preparedRevisions.current.clear()
    setStartError(null)

    working.current = true
    setConfirm(false)
    setBusy(action)
    setStop(null)
    let changed = false
    let halt = false
    const results = new Map<string, OlxBatchResult>()
    setState({ rows: [...results.values()], complete: false })
    const options = { signal, expectedAccountId }

    for (const candidate of parts) {
      if (signal.aborted) break
      let part = { id: candidate.id, name: candidate.name }
      let result: OlxBatchResult
      try {
        if (halt) result = { ...part, status: 'skipped' }
        else {
          if (!part.name)
            part = {
              ...part,
              name: await partsApi.get(part.id, { signal }).then(
                (item) => item.name,
                () => undefined,
              ),
            }
          const publication = await olxLiveApi.publication(part.id, { signal })
          const current = publication.content ?? emptyOlxContent
          if (!canPrepare(publication)) {
            result = {
              ...part,
              advertId: publication.advertId ?? null,
              status: publication.advertId ? 'linked' : 'pending',
            }
          } else if (action === 'assign' && category) {
            if (
              !current.categoryConfirmed ||
              current.categoryId !== category.id
            ) {
              await olxLiveApi.saveDraft(
                part.id,
                {
                  ...current,
                  categoryId: category.id,
                  categoryConfirmed: true,
                  attributes:
                    current.categoryId === category.id
                      ? current.attributes
                      : {},
                },
                publication.revision ?? null,
                options,
              )
              changed = true
            }
            result = { ...part, status: 'assigned' }
          } else {
            const content = {
              ...current,
              advertiserType: current.advertiserType || defaultSellerType,
            }
            const preview = await olxLiveApi.preview(part.id, content, {
              signal,
            })
            if (signal.aborted) break
            if (
              preview.issues.some(({ code }) => code === 'advertiser_required')
            )
              setShowSellerType(true)
            part = { ...part, name: preview.part.title }
            result = {
              ...part,
              status: 'blocked',
              issues: preview.issues.map(previewIssue),
            }
            if (
              result.issues?.length === 0 &&
              publication.revision &&
              publication.canWrite
            )
              result = {
                ...part,
                status: 'ready',
                ready: {
                  content,
                  revision: publication.revision,
                  save: content.advertiserType !== current.advertiserType,
                },
              }
            else if (result.issues?.length === 0)
              result = {
                ...part,
                status: 'failed',
                issues: [t('permissionChanged')],
              }
          }
        }
      } catch (failure) {
        if (signal.aborted) break
        const problem = normalizeApiProblem(failure)
        const message = stopMessage(problem)
        if (message) {
          halt = true
          setStop(message)
        }
        result = {
          ...part,
          status: 'failed',
          issues: message
            ? [t(message)]
            : [
                problem.code === 'OLX_DRAFT_CHANGED'
                  ? tp('changed')
                  : problem.code === 'OLX_CONTENT_INVALID' ||
                      problem.code === 'OLX_PART_CHANGED'
                    ? tp('invalid')
                    : t(action === 'check' ? 'failedRead' : 'failedAction'),
              ],
        }
      }
      if (signal.aborted) break
      results.set(part.id, result)
      setState({ rows: [...results.values()], complete: false })
    }

    working.current = false
    if (signal.aborted) return
    setBusy(null)
    setState({ rows: [...results.values()], complete: action !== 'check' })
    if (changed) onChanged()
  }

  async function startJob() {
    const signal = scope.current
    const accountId = setup?.account.accountId
    if (
      !signal ||
      signal.aborted ||
      !accountId ||
      !canPublish ||
      working.current ||
      ready.length === 0
    )
      return
    working.current = true
    setBusy('start')
    setConfirm(false)
    setStartError(null)
    try {
      if (!startRequest.current) {
        const checked = []
        for (const row of ready) {
          if (!row.ready || signal.aborted) return
          let revision = preparedRevisions.current.get(row.id)
          if (revision === undefined) {
            revision = row.ready.revision
            if (row.ready.save) {
              const saved = await olxLiveApi.saveDraft(
                row.id,
                row.ready.content,
                revision,
                { signal, expectedAccountId: accountId },
              )
              if (!saved.revision) throw new Error('Missing draft revision.')
              revision = saved.revision
              preparedRevisions.current.set(row.id, revision)
            }
          }
          checked.push({ partId: row.id, revision })
        }
        startRequest.current = {
          operationId: crypto.randomUUID(),
          accountId,
          parts: checked,
        }
      }
      const job = await olxLiveApi.startPublicationJob(startRequest.current, {
        signal,
      })
      if (!signal.aborted)
        onJobStarted(
          job,
          state?.rows.filter((row) => row.status !== 'ready') ?? [],
        )
    } catch (failure) {
      if (!signal.aborted) {
        const problem = normalizeApiProblem(failure)
        setStartError(
          problem.code === 'OLX_BATCH_IN_PROGRESS'
            ? 'jobAlreadyRunning'
            : problem.code === 'OLX_BATCH_INVALID'
              ? 'jobLimit'
              : (stopMessage(problem) ?? 'jobStartFailed'),
        )
      }
    } finally {
      working.current = false
      if (!signal.aborted) setBusy(null)
    }
  }

  const checkInitial = useEffectEvent((connection: Setup) => {
    if (mode === 'publish') void run('check', connection)
  })

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    scope.current = signal
    void (async () => {
      try {
        const account = await olxApi.connection({ signal })
        if (signal.aborted) return
        if (
          !account.available ||
          !account.connected ||
          account.mode !== 'oauth' ||
          !account.accountId ||
          account.reconnectRequired
        ) {
          setSetupError('connectionRequired')
          return
        }
        const categories =
          initialMode === 'category'
            ? await olxLiveApi.categories({ signal })
            : []
        if (!signal.aborted) {
          const connection = { account, categories }
          setSetup(connection)
          checkInitial(connection)
        }
      } catch {
        if (!signal.aborted) setSetupError('failedRead')
      }
    })()
    return () => controller.abort()
  }, [attempt, initialMode])

  const blocked = !setup || Boolean(busy) || Boolean(stop)
  const progress = state?.rows.length ?? 0
  const result = Boolean(state?.complete)
  const mutationBusy = busy === 'assign' || busy === 'start'
  useEffect(() => {
    if (result) resultBody.current?.focus()
  }, [result])

  return (
    <Sheet
      open
      className={
        mode === 'category'
          ? 'sm:w-[min(480px,100vw)]'
          : 'sm:w-[min(520px,100vw)]'
      }
      title={t(
        mode === 'category'
          ? result
            ? 'categoryResult'
            : 'assignTitle'
          : result
            ? 'result'
            : 'publishTitle',
      )}
      description={t('count', { count: parts.length })}
      pending={mutationBusy}
      onOpenChange={(open) => {
        if (!open && !mutationBusy) onClose()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        returnFocus()
      }}
      footer={
        <>
          <Button
            disabled={mutationBusy}
            onClick={onClose}
            variant={result && mode === 'publish' ? 'primary' : 'ghost'}
          >
            {result ? t('done') : tc('cancel')}
          </Button>
          {result && mode === 'category' && !stop ? (
            <Button
              variant="primary"
              disabled={!canPublish}
              onClick={() => {
                setMode('publish')
                void run('check')
              }}
            >
              {t('reviewNext')}
            </Button>
          ) : !result && mode === 'category' ? (
            <Button
              variant="primary"
              disabled={blocked || !categoryId}
              onClick={() => void run('assign')}
            >
              {t('assignAction')}
            </Button>
          ) : !result ? (
            <Button
              variant="primary"
              disabled={blocked || ready.length === 0}
              onClick={() => setConfirm(true)}
            >
              {t('publishAction')}
            </Button>
          ) : null}
        </>
      }
    >
      <div
        ref={resultBody}
        tabIndex={result ? -1 : undefined}
        className="grid min-w-0 gap-4 outline-none"
      >
        {setupError ? (
          <Notice
            tone="danger"
            action={
              <Button
                onClick={() => {
                  setSetupError(null)
                  setAttempt((value) => value + 1)
                }}
              >
                {tl('retry')}
              </Button>
            }
          >
            {t(setupError)}
          </Notice>
        ) : !setup ? (
          <SkeletonFields count={2} label={tl('loading')} />
        ) : !result && mode === 'category' ? (
          <>
            <Field label={t('marketplace')}>
              <TextInput value="OLX" readOnly />
            </Field>
            <SelectPicker
              label={tl('category')}
              showLabel
              required
              disabled={blocked}
              placeholder={tl('choose')}
              value={categoryId}
              hint={t('categoryHint')}
              onValueChange={setCategoryId}
              options={setup.categories.map((category) => ({
                value: String(category.id),
                label: category.path.split(' / ').join(' → ') || category.name,
              }))}
            />
            <Notice tone="info">{t('assignHint')}</Notice>
          </>
        ) : !result ? (
          <>
            <SectionPanel
              title={t('marketplace')}
              variant="plain"
              className="[&>header]:pt-0 [&>div]:pb-0 border-b-0"
              aside={
                state &&
                !blocked &&
                canPublish && (
                  <Button
                    variant="quiet"
                    size="sm"
                    onClick={() => void run('check')}
                  >
                    {t('recheck')}
                  </Button>
                )
              }
            >
              <div className="rz-choice-card border-brand bg-brand-soft cursor-default">
                <span
                  aria-hidden
                  className="border-brand mt-0.5 grid size-3.5 shrink-0 place-items-center rounded-full border"
                >
                  <span className="bg-brand size-1.5 rounded-full" />
                </span>
                <div className="grid min-w-0 gap-1">
                  <strong className="rz-strong">OLX</strong>
                  {canPublish && (
                    <span className="rz-caption">
                      {state && !busy
                        ? t('readiness', {
                            ready: ready.length,
                            blocked: state.rows.filter(
                              (row) => row.status === 'blocked',
                            ).length,
                          })
                        : t('reviewLoading')}
                    </span>
                  )}
                </div>
              </div>
            </SectionPanel>
            {showSellerType && (
              <SelectPicker
                label={tl('advertiser')}
                showLabel
                disabled={blocked || !canPublish}
                placeholder={tl('choose')}
                value={sellerType}
                hint={t('sellerHint')}
                searchable={false}
                onValueChange={(value) => {
                  setSellerType(value)
                  void run('check', setup, value)
                }}
                options={[
                  { value: '', label: '—' },
                  { value: 'business', label: tl('business') },
                  { value: 'private', label: tl('private') },
                ]}
              />
            )}
            {canPublish ? (
              <Notice tone="info">{t('publishHint')}</Notice>
            ) : (
              <Notice tone="warn">{tp('noWrite')}</Notice>
            )}
          </>
        ) : null}
        {startError && <Notice tone="danger">{t(startError)}</Notice>}
        {stop && (
          <Notice tone="warn" role="alert">
            {t(stop)}
          </Notice>
        )}
        {busy && (
          <p className="rz-caption m-0" role="status">
            {busy === 'start'
              ? t('jobStarting')
              : t('progress', { done: progress, total: parts.length })}
          </p>
        )}
        {state && state.rows.length > 0 && (
          <OlxBatchResults
            rows={state.rows}
            partsHref={partsHref}
            busy={Boolean(busy)}
            onNavigate={onClose}
          />
        )}
      </div>
      <ConfirmDialog
        open={confirm}
        title={t('confirmTitle')}
        consequence={t('confirmText', { count: ready.length })}
        confirmLabel={t('publishAction')}
        destructive={false}
        onOpenChange={setConfirm}
        onConfirm={() => void startJob()}
      />
    </Sheet>
  )
}

export function OlxBatchResults({
  rows,
  partsHref,
  busy,
  onNavigate,
  selection,
}: {
  rows: OlxBatchResult[]
  partsHref: string
  busy: boolean
  onNavigate: () => void
  selection?: {
    eligible: ReadonlySet<string>
    checked: ReadonlySet<string>
    disabled: boolean
    onToggle: (id: string) => void
  }
}) {
  const t = useT(olxBatchMessages)
  return (
    <div className="grid min-w-0 gap-4">
      {resultGroups.map((group) => {
        const items = rows.filter((row) => row.status === group.status)
        if (items.length === 0) return null
        return (
          <SectionPanel
            key={group.status}
            title={`${t(group.heading)} · ${items.length}`}
            variant="plain"
            className="border-b-0 [&>header]:pt-0 [&>div]:pb-0 [&>div]:pt-3"
          >
            <ul
              role="list"
              className="divide-app-line m-0 list-none divide-y rounded-control border border-app-line bg-app-sheet-field p-0"
            >
              {items.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2"
                >
                  {selection?.eligible.has(row.id) && (
                    <input
                      type="checkbox"
                      className="rz-check"
                      aria-label={t(
                        row.status === 'pending'
                          ? 'retryVerifyPart'
                          : 'retrySelectPart',
                        {
                          name: row.name ?? row.id,
                        },
                      )}
                      checked={selection.checked.has(row.id)}
                      disabled={selection.disabled}
                      onChange={() => selection.onToggle(row.id)}
                    />
                  )}
                  <div className="grid min-w-0 flex-[1_1_10rem] gap-0.5">
                    <span className="rz-strong break-words">
                      {row.name ?? row.id}
                    </span>
                    {row.advertId && (
                      <span className="rz-caption">
                        {t('advert', { id: row.advertId })}
                      </span>
                    )}
                    {row.issues && row.issues.length > 0 && (
                      <div className="rz-caption grid gap-0.5">
                        {[...new Set(row.issues)].map((issue) => (
                          <p className="m-0 break-words" key={issue}>
                            {issue}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {'badge' in group && (
                    <span className={`font-semibold ${group.badgeClass}`}>
                      {t(group.badge)}
                    </span>
                  )}
                  {'action' in group && !busy && (
                    <Button
                      asChild
                      size="sm"
                      variant="quiet"
                      className={
                        group.status === 'failed'
                          ? 'text-state-danger'
                          : 'text-brand-text'
                      }
                    >
                      <Link
                        to={`${partsHref}/${encodeURIComponent(row.id)}/olx`}
                        aria-label={`${t(group.action)} · ${row.name ?? row.id}`}
                        onClick={onNavigate}
                      >
                        {t(group.action)}
                      </Link>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {'caption' in group && (
              <p className="rz-caption m-0">{t(group.caption)}</p>
            )}
          </SectionPanel>
        )
      })}
    </div>
  )
}

type OlxPreviewIssue = Awaited<
  ReturnType<typeof olxLiveApi.preview>
>['issues'][number]
