import { useEffect, useRef, useState, type ReactNode } from 'react'
import { normalizeApiProblem } from '@/api/errors'
import { useT } from '@/i18n'
import { commonMessages } from '@/i18n/common-messages'
import { isLostResponse, lostResponseMessages } from '@/cabinet/lost-response'
import { Button } from './button'
import { Card } from './card'
import { Field } from './field'
import { TextArea } from './input'
import { Notice } from './notice'
import { inlineNotesMessages } from './inline-notes-messages'

export interface InlineNotesProps {
  value: string | null | undefined
  canEdit: boolean
  onSave: (value: string) => Promise<string | null>
  readBack?: () => Promise<string | null>
  onSaved?: (value: string | null) => void
  busy?: boolean
  maxLength?: number
  emptyLabel?: string
  labels?: { input?: string; edit?: string; save?: string; cancel?: string }
  children: (editor: { action: ReactNode; content: ReactNode }) => ReactNode
}

/** A single notes card presentation for entity details; cars keep their composition. */
export function NotesCard({
  footer,
  ...props
}: Omit<InlineNotesProps, 'children' | 'emptyLabel' | 'labels'> & {
  footer?: ReactNode
}) {
  const t = useT(inlineNotesMessages)
  return (
    <InlineNotes {...props}>
      {({ action, content }) => (
        <Card title={t('label')} aside={action} bodyClassName="p-0">
          <div className="rz-card__body">{content}</div>
          {footer}
        </Card>
      )}
    </InlineNotes>
  )
}

/** Reuses the same editor inside each screen's existing notes container. */
export function InlineNotes({
  value,
  canEdit,
  onSave,
  readBack,
  onSaved,
  busy = false,
  maxLength,
  emptyLabel,
  labels,
  children,
}: InlineNotesProps) {
  const t = useT(inlineNotesMessages)
  const tc = useT(commonMessages)
  const tl = useT(lostResponseMessages)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const mountedRef = useRef(true)
  const editButton = useRef<HTMLButtonElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const visibleValue = value?.trim() ? value : null
  const disabled = pending || busy

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const finishEditing = () => {
    setEditing(false)
    requestAnimationFrame(() => editButton.current?.focus())
  }
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canEdit || busy || pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError(null)
    setStatus(null)
    const next = draft.trim()
    try {
      let saved: string | null
      try {
        saved = await onSave(next)
      } catch (failure) {
        if (!isLostResponse(failure) || !readBack) throw failure
        if (!mountedRef.current) return
        setStatus(tl('checking'))
        try {
          saved = await readBack()
        } catch {
          if (mountedRef.current) {
            setStatus(null)
            setError(tl('checkFailed'))
          }
          return
        }
        if (!mountedRef.current) return
        if ((saved ?? '') !== next) {
          setStatus(null)
          setError(tl('notSaved'))
          return
        }
      }
      if (!mountedRef.current) return
      onSaved?.(saved)
      finishEditing()
      setStatus(tc('saved'))
    } catch (failure) {
      if (!mountedRef.current) return
      const problem = normalizeApiProblem(failure)
      const notesError = problem.fieldErrors?.['notes']?.[0]
      setStatus(null)
      setError(
        notesError ??
          (problem.status === 403 ? tc('noPermission') : t('failed')),
      )
    } finally {
      pendingRef.current = false
      if (mountedRef.current) setPending(false)
    }
  }

  const action =
    canEdit && !editing ? (
      <Button
        ref={editButton}
        disabled={busy}
        size="sm"
        onClick={() => {
          setDraft(value ?? '')
          setError(null)
          setStatus(null)
          setEditing(true)
        }}
      >
        {labels?.edit ?? tc('edit')}
      </Button>
    ) : null
  const content = (
    <div className="grid min-w-0 gap-3">
      {editing && canEdit ? (
        <form
          className="grid min-w-0 gap-3"
          aria-busy={disabled}
          onSubmit={(event) => void save(event)}
        >
          <Field label={labels?.input ?? t('label')} hiddenLabel>
            <TextArea
              autoFocus
              disabled={disabled}
              maxLength={maxLength}
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </Field>
          <div className="rz-btn-row justify-end">
            <Button
              disabled={disabled}
              onClick={() => {
                setError(null)
                setStatus(null)
                finishEditing()
              }}
            >
              {labels?.cancel ?? tc('cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={disabled || draft.trim() === (value ?? '').trim()}
            >
              {pending ? tc('saving') : (labels?.save ?? tc('save'))}
            </Button>
          </div>
        </form>
      ) : (
        <p
          className={`m-0 whitespace-pre-wrap [overflow-wrap:anywhere] ${visibleValue ? 'text-app-ink' : 'text-app-dim'}`}
        >
          {visibleValue ?? emptyLabel ?? t('empty')}
        </p>
      )}
      {error ? (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      ) : null}
      {status ? (
        <p className="rz-caption m-0" role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
  return children({ action, content })
}
