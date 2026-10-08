import { useEffect, useId, useRef, useState } from 'react'
import { Field, TextInput } from '@/components/app'
import { integrationsApi, type NovaPoshtaSettlement } from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { useLocale, useT } from '@/i18n'
import { integrationProblemMessage } from './integration-labels'
import { npFormsMessages } from './np-forms-messages'

export type SettlementUse = 'sending' | 'receiving'

const PROHIBITED = {
  sending: 'prohibitedSending',
  receiving: 'prohibitedReceiving',
} as const satisfies Record<SettlementUse, string>

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
  label,
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
  const { locale } = useLocale()
  const t = useT(npFormsMessages)
  const listId = useId()
  const [query, setQuery] = useState(picked?.name ?? '')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [found, setFound] = useState<{
    term: string
    items: NovaPoshtaSettlement[]
  } | null>(null)
  const [failure, setFailure] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)

  const term = query.trim()
  const options = term.length >= 2 && found?.term === term ? found.items : []
  const matched = picked !== null && picked.name === term
  const loading =
    term.length >= 2 && !matched && found?.term !== term && failure === null

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
            setFailure(null)
          },
          (problem) => {
            if (!controller.signal.aborted)
              setFailure(
                integrationProblemMessage(normalizeApiProblem(problem), locale),
              )
          },
        )
    }, 300)
    return () => {
      controller.abort()
      window.clearTimeout(timer)
    }
    // The failure text is set once per search; a language switch mid-search
    // does not need to repeat the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        error={failure ?? undefined}
        hint={
          term === '' && savedHint !== undefined
            ? savedHint
            : matched
              ? prohibited(picked, use)
                ? t('pickedProhibited', { rule: t(PROHIBITED[use]) })
                : t('picked')
              : t('startTypingHint')
        }
        label={label ?? t('settlementLabel')}
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
              setFound(null)
              setFailure(null)
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
            placeholder={t('startTyping')}
            role="combobox"
            spellCheck={false}
            value={query}
          />

          {showList && (
            <div className="border-app-line-2 bg-app-overlay overflow-hidden rounded-[14px] border shadow-2xl">
              {/* The list floats on the lighter overlay surface, where the page
              dim grey lands a hair under 4.5:1. */}
              <p className="border-app-line text-app-muted flex items-center justify-between gap-2.5 border-b px-3.5 py-2.5 font-mono text-[10px] tracking-[0.12em] uppercase">
                <span>{t('directory')}</span>
                <span>
                  {failure !== null
                    ? t('directoryError')
                    : loading
                      ? t('searching')
                      : options.length > 0
                        ? t('matches', { count: options.length })
                        : t('noMatches')}
                </span>
              </p>
              {failure !== null ? (
                <p className="text-state-danger px-3.5 py-4 text-[13px] leading-5 text-pretty">
                  {t('directoryFailed')}
                </p>
              ) : loading ? (
                <p className="text-app-muted px-3.5 py-4 text-[13px] leading-5">
                  {t('directoryLoading')}
                </p>
              ) : options.length === 0 ? (
                <p className="text-app-muted px-3.5 py-4 text-[13px] leading-5 text-pretty">
                  {t('nothingFound')}
                </p>
              ) : (
                <ul className="max-h-[200px] overflow-auto" id={listId}>
                  {options.map((settlement, index) => (
                    <li key={settlement.ref}>
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
                            {t(PROHIBITED[use])}
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
