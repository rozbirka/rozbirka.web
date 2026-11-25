import { useEffect, useRef, useState, type FormEvent } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { olxLiveApi, type OlxLivePublication } from '@/api/olx-live'
import { partsApi, type PartDetail } from '@/api/parts'
import {
  Button,
  Field,
  Notice,
  SkeletonFields,
  TextArea,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { cabinetModules } from '../module-registry'
import { PartPriceEditor } from '../parts/PartPriceDrawer'
import { tenantRequestScope } from '../tenant-request-scope'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { olxBatchMessages } from './olx-batch-messages'
import { olxLiveMessages } from './olx-live-messages'
import { olxPublicationMessages } from './olx-publication-messages'
import { canPrepareOlxDraft, emptyOlxContent } from './olx-prepare-content'

export type OlxBatchFixField = 'price' | 'description'

export function OlxBatchPartEditor({
  partId,
  field,
  accountId,
  onSaved,
  onClose,
  onPendingChange,
}: {
  partId: string
  field: OlxBatchFixField
  accountId: string
  onSaved: () => void
  onClose: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const t = useT(olxBatchMessages)
  const tl = useT(olxLiveMessages)
  const tp = useT(olxPublicationMessages)
  const tc = useT(commonMessages)
  const tr = useT(lostResponseMessages)
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.parts)
  const scope = useRef<AbortSignal | null>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const saving = useRef(false)
  const [load, setLoad] = useState<{
    part: PartDetail
    publication: OlxLivePublication
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [loadFailed, setLoadFailed] = useState(false)
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editable =
    load?.part.status === 'available' &&
    load.publication.canWrite &&
    canPrepareOlxDraft(load.publication)

  useEffect(() => {
    const controller = new AbortController()
    const signal = AbortSignal.any([
      controller.signal,
      tenantRequestScope.signal,
    ])
    scope.current = signal
    void Promise.all([
      partsApi.get(partId, { signal }),
      olxLiveApi.publication(partId, { signal }),
    ]).then(
      ([part, publication]) => {
        if (signal.aborted) return
        setLoad({ part, publication })
        setDescription(
          part.publicDescription ??
            publication.content?.publicDescription ??
            '',
        )
      },
      () => {
        if (!signal.aborted) setLoadFailed(true)
      },
    )
    return () => controller.abort()
  }, [partId, attempt])

  useEffect(() => {
    if (field === 'description' && editable) input.current?.focus()
  }, [editable, field])

  function beforeSave() {
    const signal = scope.current
    if (!signal || signal.aborted) throw new Error('The editor is closed.')
    requireLatestMutation({
      permission: 'olx.publications.manage',
      quota: false,
    })
    const mutation = requireLatestMutation({ quota: false })
    return { ...mutation, signal }
  }

  async function saveDescription(event: FormEvent) {
    event.preventDefault()
    const value = description.trim()
    if (!load || !editable || !value || saving.current) return
    saving.current = true
    setPending(true)
    onPendingChange(true)
    setError(null)
    const sourceIsPart = load.part.publicDescription != null
    const signal = scope.current
    let saved = false
    try {
      const mutation = beforeSave()
      if (sourceIsPart) {
        await partsApi.update(
          partId,
          { publicDescription: value, desiredSalePrice: { isSet: false } },
          { signal: mutation.signal },
        )
      } else {
        await olxLiveApi.saveDraft(
          partId,
          {
            ...(load.publication.content ?? emptyOlxContent),
            publicDescription: value,
          },
          load.publication.revision ?? null,
          { expectedAccountId: accountId, signal: mutation.signal },
        )
      }
      saved = true
    } catch (failure) {
      if (!signal || signal.aborted) return
      if (isLostResponse(failure)) {
        setChecking(true)
        try {
          const latest = sourceIsPart
            ? (await partsApi.get(partId, { signal })).publicDescription
            : (await olxLiveApi.publication(partId, { signal })).content
                ?.publicDescription
          saved = latest === value
          if (!saved && !signal.aborted) setError(tr('notSaved'))
        } catch {
          if (!signal.aborted) setError(tr('checkFailed'))
        }
      } else {
        const problem = normalizeApiProblem(failure)
        setError(
          problem.code === 'OLX_DRAFT_CHANGED'
            ? tp('changed')
            : (Object.values(problem.fieldErrors ?? {}).flat()[0] ??
                t('repairSaveFailed')),
        )
      }
    } finally {
      saving.current = false
      if (!signal?.aborted) {
        setPending(false)
        setChecking(false)
        onPendingChange(false)
      }
    }
    if (saved && !signal?.aborted) onSaved()
  }

  if (loadFailed)
    return (
      <Notice
        tone="danger"
        action={
          <div className="rz-btn-row">
            <Button onClick={onClose}>{tc('cancel')}</Button>
            <Button
              onClick={() => {
                setLoadFailed(false)
                setAttempt((value) => value + 1)
              }}
            >
              {tl('retry')}
            </Button>
          </div>
        }
      >
        {t('failedRead')}
      </Notice>
    )

  if (!load) return <SkeletonFields count={1} label={tl('loading')} />

  if (!editable)
    return (
      <Notice
        tone="warn"
        action={<Button onClick={onClose}>{tc('close')}</Button>}
      >
        {t('repairUnavailable')}
      </Notice>
    )

  if (field === 'price')
    return (
      <PartPriceEditor
        inline
        part={load.part}
        beforeSave={beforeSave}
        onSaved={onSaved}
        onClose={onClose}
        onPendingChange={onPendingChange}
      />
    )

  return (
    <form
      className="rz-inset grid gap-3"
      onSubmit={(event) => void saveDescription(event)}
    >
      <Field label={tl('description')} hint={tl('descriptionHint')}>
        <TextArea
          ref={input}
          disabled={pending}
          maxLength={9000}
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      {checking && <Notice role="status">{tr('checking')}</Notice>}
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <div className="rz-btn-row justify-end">
        <Button disabled={pending} onClick={onClose}>
          {tc('cancel')}
        </Button>
        <Button
          type="submit"
          variant="ghost"
          disabled={pending || !description.trim()}
          aria-busy={pending}
        >
          {pending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  )
}
