import { useEffect, useId, useRef, useState } from 'react'
import { Field, TextInput } from '@/components/app'
import { integrationsApi, type NovaPoshtaSettlement } from '@/api/integrations'

export type SettlementUse = 'sending' | 'receiving'

const PROHIBITED: Record<SettlementUse, string> = {
  sending: 'не приймає відправлень',
  receiving: 'не видає відправлень',
}

const prohibited = (
  settlement: NovaPoshtaSettlement,
  use: SettlementUse,
): boolean =>
  (use === 'sending'
    ? settlement.prohibitedSending
    : settlement.prohibitedIssuance) === true

/**
 * The carrier's own settlement list. A name typed by hand is not a choice —
 * Core validates against this catalogue and rejects anything that is not in
 * it, so the field only accepts what the list returned.
 */
export function SettlementPicker({
  integrationId,
  label = 'Населений пункт',
  onPick,
  picked,
  savedHint,
  use,
}: {
  integrationId: string
  label?: string
  onPick: (settlement: NovaPoshtaSettlement | null) => void
  picked: NovaPoshtaSettlement | null
  /** Shown while a stored settlement stands and nothing new is typed. */
  savedHint?: string | undefined
  use: SettlementUse
}) {
  const listId = useId()
  const [query, setQuery] = useState(picked?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [found, setFound] = useState<{
    term: string
    items: NovaPoshtaSettlement[]
  } | null>(null)
  const [failed, setFailed] = useState(false)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const term = query.trim()
  const options = term.length >= 2 && found?.term === term ? found.items : []
  const matched = picked !== null && picked.name === term

  useEffect(() => {
    if (term.length < 2 || matched) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void integrationsApi
        .settlements(integrationId, term, 1, { signal: controller.signal })
        .then(
          (page) => {
            if (controller.signal.aborted) return
            setFound({ term, items: page.items })
            setFailed(false)
          },
          () => {
            if (!controller.signal.aborted) setFailed(true)
          },
        )
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
  }, [integrationId, matched, term])

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close, true)
    return () => document.removeEventListener('mousedown', close, true)
  }, [open])

  const choose = (settlement: NovaPoshtaSettlement) => {
    setQuery(settlement.name)
    setOpen(false)
    onPick(settlement)
  }

  const showList = open && term.length >= 2

  return (
    <div ref={boxRef}>
      <Field
        hint={
          failed
            ? 'Довідник Нової пошти зараз недоступний. Спробуйте ще раз.'
            : term === '' && savedHint !== undefined
              ? savedHint
              : matched
                ? prohibited(picked, use)
                  ? `Обрано з довідника. Цей пункт ${PROHIBITED[use]}.`
                  : 'Обрано з довідника Нової пошти.'
                : 'Почніть вводити назву — підкажемо з довідника Нової пошти.'
        }
        label={label}
        required
      >
        {/* The list lives inside the field, so the note stays under both —
            and a long list pushes the form instead of covering it. */}
        <div className="grid gap-2">
          <TextInput
            aria-autocomplete="list"
            aria-controls={showList ? listId : undefined}
            aria-expanded={showList}
            autoComplete="off"
            className={matched ? 'border-state-ok/30' : undefined}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
              setOpen(true)
              onPick(null)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (!showList || options.length === 0) return
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((index) => (index + 1) % options.length)
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive(
                  (index) => (index - 1 + options.length) % options.length,
                )
              }
              if (event.key === 'Enter') {
                const option = options[active]
                if (option !== undefined) {
                  event.preventDefault()
                  choose(option)
                }
              }
              if (event.key === 'Escape') setOpen(false)
            }}
            placeholder="Почніть вводити назву"
            role="combobox"
            spellCheck={false}
            value={query}
          />

          {showList && (
            <div className="border-app-line-2 bg-app-overlay overflow-hidden rounded-[14px] border shadow-2xl">
              {/* The list floats on the lighter overlay surface, where the page
              dim grey lands a hair under 4.5:1. */}
              <p className="border-app-line text-app-muted flex items-center justify-between gap-2.5 border-b px-3.5 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase">
                <span>Довідник Нової пошти</span>
                <span>
                  {options.length > 0
                    ? `${options.length} збіг.`
                    : 'без збігів'}
                </span>
              </p>
              {options.length === 0 ? (
                <p className="text-app-muted px-3.5 py-4 text-[13px] leading-5 text-pretty">
                  У довіднику немає населеного пункту з такою назвою. Перевірте
                  написання або введіть коротший запит.
                </p>
              ) : (
                <ul className="max-h-[200px] overflow-auto" id={listId}>
                  {options.map((settlement, index) => (
                    <li key={settlement.id}>
                      <button
                        className={`border-app-line flex w-full items-center justify-between gap-3 border-b px-3.5 py-2.5 text-left hover:bg-white/[0.055] ${
                          index === active ? 'bg-white/[0.055]' : ''
                        }`}
                        onClick={() => choose(settlement)}
                        type="button"
                      >
                        <span className="min-w-0 truncate text-[14px] font-bold text-white">
                          {settlement.name}
                        </span>
                        {prohibited(settlement, use) && (
                          <span className="text-state-warn font-mono text-[11px] whitespace-nowrap">
                            {PROHIBITED[use]}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </Field>
    </div>
  )
}
