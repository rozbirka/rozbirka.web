import { useRef, useState } from 'react'
import {
  Button,
  Field,
  Notice,
  SelectInput,
  Sheet,
  TextArea,
} from '@/components/app'
import type { OrderDetailItem } from '@/api/orders'
import { commonMessages, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { SheetGroup, SheetList } from '../sheet-group'
import { unitCount } from './delivery-flow'
import { deliveryFlowMessages } from './flow-messages'
import { deliveryProblemMessage } from './nova-poshta-availability'

/**
 * «Прийняти повернення» (10.4–10.5). The carrier's status is not proof: the
 * clerk ticks off what is physically in the parcel. Core accepts only a full
 * return, so a missing line keeps the confirmation off and says the rest is
 * a manual matter. A damaged return is still full, but needs a note.
 */
export function ReturnAcceptSheet({
  items,
  onAccept,
  onClose,
  onCloseAutoFocus,
  orderNumber,
  returnWaybill,
}: {
  items: readonly OrderDetailItem[]
  onAccept: (condition: { damaged: boolean; notes: string }) => Promise<void>
  onClose: () => void
  onCloseAutoFocus?: ((event: Event) => void) | undefined
  orderNumber: number
  returnWaybill: string | null
}) {
  const { locale } = useLocale()
  const t = useT(deliveryFlowMessages)
  const tc = useT(commonMessages)
  const [missing, setMissing] = useState<ReadonlySet<string>>(new Set())
  const [damaged, setDamaged] = useState(false)
  const [notes, setNotes] = useState('')
  const [noteError, setNoteError] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement | null>(null)
  const noteRef = useRef<HTMLTextAreaElement | null>(null)

  const total = unitCount(items)
  const received = unitCount(items.filter((item) => !missing.has(item.id)))
  const complete = received === total

  const toggle = (id: string) =>
    setMissing((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = async () => {
    if (pending || !complete) return
    if (damaged && notes.trim() === '') {
      setNoteError(true)
      noteRef.current?.focus()
      return
    }
    setPending(true)
    setError(null)
    try {
      await onAccept({ damaged, notes })
    } catch (problem) {
      setError(deliveryProblemMessage(problem, locale))
      setPending(false)
      window.requestAnimationFrame(() => alertRef.current?.focus())
    }
  }

  return (
    <Sheet
      description={
        returnWaybill === null
          ? t('acceptDescriptionBare', { number: String(orderNumber) })
          : t('acceptDescription', {
              number: String(orderNumber),
              waybill: returnWaybill,
            })
      }
      footer={
        <>
          <p
            className={cn(
              'm-0 min-w-0 flex-1',
              complete ? 'text-app-muted' : 'text-state-warn',
            )}
          >
            {complete
              ? t('unitsAll', { received, count: total })
              : t('unitsPart', { received, count: total })}
          </p>
          <Button disabled={pending} onClick={onClose}>
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending || !complete}
            onClick={() => void submit()}
            title={complete ? undefined : t('missingTitle')}
            variant="primary"
          >
            {pending ? tc('saving') : t('acceptSubmit')}
          </Button>
        </>
      }
      onCloseAutoFocus={onCloseAutoFocus}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={t('acceptTitle')}
    >
      {error === null ? null : (
        <div ref={alertRef} tabIndex={-1}>
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <SheetGroup title={t('acceptGroup')}>
        <SheetList label={t('acceptGroup')}>
          {items.map((item) => {
            const here = !missing.has(item.id)
            return (
              <li key={item.id}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    checked={here}
                    className="rz-check"
                    disabled={pending}
                    onChange={() => toggle(item.id)}
                    type="checkbox"
                  />
                  <span className="rz-strong min-w-0 flex-1 truncate">
                    {item.partName}
                  </span>
                </label>
                <span
                  className={cn(
                    'font-mono text-caption whitespace-nowrap',
                    here ? 'text-state-ok' : 'text-state-danger',
                  )}
                >
                  {here
                    ? t('acceptQty', {
                        received: item.quantity,
                        total: item.quantity,
                      })
                    : t('acceptMissing')}
                </span>
              </li>
            )
          })}
        </SheetList>
      </SheetGroup>

      <SheetGroup>
        <Field label={t('conditionLabel')}>
          <SelectInput
            disabled={pending}
            onChange={(event) => {
              setDamaged(event.target.value === 'damaged')
              setNoteError(false)
            }}
            value={damaged ? 'damaged' : 'intact'}
          >
            <option value="intact">{t('conditionIntact')}</option>
            <option value="damaged">{t('conditionDamaged')}</option>
          </SelectInput>
        </Field>
        <Field
          error={noteError ? t('noteRequired') : undefined}
          label={t('noteLabel')}
          required={damaged}
        >
          <TextArea
            onChange={(event) => {
              setNotes(event.target.value)
              setNoteError(false)
            }}
            placeholder={t('notePlaceholder')}
            readOnly={pending}
            ref={noteRef}
            rows={3}
            value={notes}
          />
        </Field>
      </SheetGroup>

      {complete ? (
        <Notice tone="info">{t('acceptInfo', { count: total })}</Notice>
      ) : (
        <Notice block tone="warn">
          <p className="rz-strong m-0 font-semibold">{t('missingTitle')}</p>
          <p className="m-0 mt-1">{t('missingNote')}</p>
        </Notice>
      )}
    </Sheet>
  )
}
