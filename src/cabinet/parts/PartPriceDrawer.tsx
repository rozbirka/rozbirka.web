import { useEffect, useRef, useState, type FormEvent } from 'react'
import { partsApi, type PartDetail } from '@/api/parts'
import { normalizeApiProblem } from '@/api/errors'
import { Button, Field, Notice, Sheet } from '@/components/app'
import { commonMessages, useLocale, useT, type SupportedCurrency } from '@/i18n'
import { amountPrecisionError } from '../currency/amount-precision'
import { MoneyInput } from '../currency/price-currency'
import { useFirstPriceGuard } from '../currency/use-accounting-currency'
import { usePriceSlots } from '../currency/use-price-slots'
import { isLostResponse, lostResponseMessages } from '../lost-response'
import type { LatestMutationScope } from '../use-latest-mutation-guard'
import { partDetailMessages } from './part-detail-messages'
import { partFormMessages } from './part-form-messages'

/** Price-only edit over the part card; never resubmits its other fields. */
export function PartPriceDrawer({
  part,
  beforeSave,
  onSaved,
  onClose,
  returnFocus,
}: {
  part: PartDetail
  beforeSave: () => LatestMutationScope
  onSaved: (saved: PartDetail) => void
  onClose: () => void
  returnFocus?: () => void
}) {
  const t = useT(partDetailMessages)
  const tf = useT(partFormMessages)
  const tc = useT(commonMessages)
  const tl = useT(lostResponseMessages)
  const { locale } = useLocale()
  const guard = useFirstPriceGuard()
  const [value, setValue] = useState(() => {
    const initial = part.desiredSalePrice ?? part.effectiveSalePrice
    return initial == null ? '' : String(initial)
  })
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const mounted = useRef(true)
  const [showErrors, setShowErrors] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const amount = value.trim() === '' ? null : Number(value.replace(',', '.'))
  const validation =
    amount === null
      ? null
      : !Number.isFinite(amount) || amount < 0
        ? tf('priceInvalid')
        : amountPrecisionError(amount, guard.currency, locale)
  const price = usePriceSlots(guard, {
    values: [value],
    onAccept: (accepted) => void save(undefined, accepted),
  })
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const save = async (
    event?: FormEvent,
    accepted?: SupportedCurrency | null,
  ) => {
    event?.preventDefault()
    if (pendingRef.current || price.disabled) return
    setShowErrors(true)
    if (validation) return
    pendingRef.current = true
    setPending(true)
    setError(null)
    setStatus(null)
    const finish = (saved: PartDetail) => {
      if (!mounted.current) return
      beforeSave().signal.throwIfAborted()
      guard.afterSave(price.hasPrice)
      onSaved(saved)
      onClose()
    }
    let scope: LatestMutationScope | undefined
    try {
      if (
        guard.needsCheck(price.hasPrice) &&
        !(await guard.beforeSave(price.hasPrice, accepted))
      )
        return
      scope = beforeSave()
      const saved = await partsApi.update(
        part.id,
        {
          desiredSalePrice: { isSet: true, value: amount },
        },
        { signal: scope.signal },
      )
      if (!scope.signal.aborted) finish(saved)
    } catch (failure) {
      if (!mounted.current || scope?.signal.aborted) return
      if (!isLostResponse(failure)) {
        const problem = normalizeApiProblem(failure)
        setError(
          Object.values(problem.fieldErrors ?? {}).flat()[0] ?? problem.message,
        )
        return
      }
      setStatus(tl('checking'))
      try {
        const readScope = beforeSave()
        const fresh = await partsApi.get(part.id, { signal: readScope.signal })
        if (!mounted.current || readScope.signal.aborted) return
        setStatus(null)
        if ((fresh.desiredSalePrice ?? null) === amount) finish(fresh)
        else setError(tl('notSaved'))
      } catch {
        if (!mounted.current) return
        setStatus(null)
        setError(tl('checkFailed'))
      }
    } finally {
      pendingRef.current = false
      if (mounted.current) setPending(false)
    }
  }
  return (
    <Sheet
      open
      title={t('salePrice')}
      description={part.name}
      onCloseAutoFocus={(event) => {
        if (returnFocus) {
          event.preventDefault()
          returnFocus()
        }
      }}
      onOpenChange={(open) => {
        if (!open && !pendingRef.current) onClose()
      }}
      footer={
        <div className="grid w-full gap-3">
          {price.saveNotes}
          <div className="rz-btn-row justify-end">
            <Button disabled={pending} onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button
              form="part-price-form"
              type="submit"
              variant="primary"
              disabled={pending || price.disabled}
              aria-busy={pending}
            >
              {pending ? tc('saving') : tc('save')}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="part-price-form"
        className="grid gap-4"
        onSubmit={(event) => void save(event)}
      >
        <Field
          label={t('salePrice')}
          hint={price.hint}
          error={showErrors ? validation : undefined}
        >
          <MoneyInput
            currency={price.currency}
            disabled={pending || price.disabled}
            numeric
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        {price.note}
        {status ? <Notice role="status">{status}</Notice> : null}
        {error ? (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        ) : null}
      </form>
    </Sheet>
  )
}
