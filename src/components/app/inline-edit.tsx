import { useEffect, useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

export interface InlineEditProps {
  /** The value as it reads in the table when nothing is being edited. */
  children: ReactNode
  /** Names the control: "Кількість: Фара ліва". */
  label: string
  /** Current value, as text, for the input to start from. */
  value: string
  /** Returns an error message to show in place, or null when it went through. */
  onCommit: (next: string) => Promise<string | null>
  /** Why this row cannot be edited here. Set means the value is read-only. */
  unavailable?: string | undefined
  inputMode?: 'text' | 'numeric' | 'decimal'
  /** Loaded when editing starts, for values the list row does not carry. */
  onOpen?: () => Promise<string>
  className?: string
}

/**
 * One value edited where it is read.
 *
 * For the small corrections that do not deserve a trip to the record: a count
 * that came back wrong from a count, a price agreed on the phone. Anything
 * that changes who may see a record, or moves money between accounts, keeps
 * its own screen — those need a decision, and a decision needs a page.
 */
export function InlineEdit({
  children,
  label,
  value,
  onCommit,
  unavailable,
  inputMode = 'text',
  onOpen,
  className,
}: InlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const close = () => {
    setEditing(false)
    setError(null)
    triggerRef.current?.focus()
  }

  const commit = async () => {
    if (pending) return
    if (draft === value) {
      close()
      return
    }
    setPending(true)
    const failure = await onCommit(draft)
    setPending(false)
    if (failure === null) close()
    else setError(failure)
  }

  if (unavailable !== undefined)
    return (
      <span className={cn('text-app-muted', className)} title={unavailable}>
        {children}
      </span>
    )

  if (!editing)
    return (
      <button
        aria-label={`Змінити — ${label}`}
        className={cn(
          'hover:border-app-line-2 focus-visible:outline-brand group inline-flex min-h-9 items-center gap-1.5 rounded-[8px] border border-transparent px-1.5 text-left',
          className,
        )}
        onClick={(event) => {
          event.stopPropagation()
          setDraft(value)
          setEditing(true)
          if (onOpen)
            void onOpen().then(
              (loaded) => setDraft(loaded),
              () => setError('Не вдалося прочитати поточне значення.'),
            )
        }}
        ref={triggerRef}
        type="button"
      >
        {children}
        <Pencil
          aria-hidden
          className="text-app-dim size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    )

  return (
    <span
      className={cn('grid gap-1', className)}
      onClick={(event) => {
        event.stopPropagation()
      }}
    >
      <span className="flex items-center gap-1.5">
        <input
          aria-label={label}
          className="border-app-line-2 bg-app-input text-app-ink focus-visible:outline-brand min-h-9 w-20 rounded-[8px] border px-2 text-right text-sm tabular-nums"
          disabled={pending}
          inputMode={inputMode}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void commit()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              close()
            }
          }}
          ref={inputRef}
          value={draft}
        />
        <Button
          aria-busy={pending}
          aria-label="Зберегти значення"
          disabled={pending}
          onClick={() => void commit()}
          size="icon"
          variant="primary"
        >
          <Check aria-hidden />
        </Button>
        <Button
          aria-label="Скасувати зміну"
          disabled={pending}
          onClick={close}
          size="icon"
        >
          <X aria-hidden />
        </Button>
      </span>
      {error === null ? null : (
        <span className="text-state-danger text-[12.5px]" role="alert">
          {error}
        </span>
      )}
    </span>
  )
}
