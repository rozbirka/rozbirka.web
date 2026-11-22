import { useEffect, useRef, useState, type FormEvent } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { partsApi, type PartDetail } from '@/api/parts'
import { Button, Field, Notice, TextInput } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { olxLiveMessages } from './olx-live-messages'
import { maxOlxTitleLength, olxTitleLengthIssue } from './olx-title-length'

export function OlxPartNameEditor({
  id,
  title,
  onSaved,
  onClose,
  onPendingChange,
}: {
  id: string
  title: string
  onSaved: (part: PartDetail) => void
  onClose: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const t = useT(olxLiveMessages)
  const tc = useT(commonMessages)
  const tl = useT(lostResponseMessages)
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.parts)
  const [value, setValue] = useState(title)
  const nameIssue = olxTitleLengthIssue(value.trim())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const life = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    input.current?.focus()
    return () => controller.abort()
  }, [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = value.trim()
    const active = life.current?.signal
    if (!active || active.aborted || inFlight.current) return
    if (nameIssue) return
    if (name === title) {
      onClose()
      return
    }
    inFlight.current = true
    setPending(true)
    onPendingChange(true)
    setError(null)
    let signal: AbortSignal | undefined
    try {
      const scope = requireLatestMutation({ quota: false })
      signal = AbortSignal.any([active, scope.signal])
      let saved: PartDetail
      try {
        saved = await partsApi.update(
          id,
          { name, desiredSalePrice: { isSet: false } },
          { signal },
        )
      } catch (failure) {
        if (signal.aborted || !isLostResponse(failure)) throw failure
        setChecking(true)
        try {
          saved = await partsApi.get(id, { signal })
        } catch {
          if (!signal.aborted) setError(tl('checkFailed'))
          return
        }
        if (signal.aborted) return
        if (saved.name !== name) {
          setError(tl('notSaved'))
          return
        }
      }
      if (signal.aborted) return
      onSaved(saved)
      onClose()
    } catch (failure) {
      if (active.aborted || signal?.aborted) return
      const problem = normalizeApiProblem(failure)
      setError(
        Object.values(problem.fieldErrors ?? {}).flat()[0] ?? problem.message,
      )
    } finally {
      inFlight.current = false
      if (!active.aborted) {
        setPending(false)
        setChecking(false)
        onPendingChange(false)
      }
    }
  }

  return (
    <form
      className="rz-inset grid gap-3"
      onSubmit={(event) => void save(event)}
    >
      <Field
        label={t('partName')}
        hint={nameIssue ? undefined : t('title_length')}
        error={
          nameIssue ? t(nameIssue.key, { count: nameIssue.count }) : undefined
        }
        required
      >
        <TextInput
          ref={input}
          disabled={pending}
          maxLength={maxOlxTitleLength}
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setError(null)
          }}
        />
      </Field>
      {checking && <Notice role="status">{tl('checking')}</Notice>}
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
          disabled={pending || nameIssue !== null}
          aria-busy={pending}
        >
          {pending ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  )
}
