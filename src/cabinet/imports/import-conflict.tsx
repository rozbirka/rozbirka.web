import { Button } from '@/components/app'
import { cn } from '@/lib/utils'
import { useLocale, type Locale } from '@/i18n'
import type {
  ImportMapping,
  ImportStatus,
  ImportValidation,
} from '@/api/part-imports'
import { importConfirmMessages } from './import-confirm-messages'
import { fieldLabel, importText, valueLabel } from './import-model'
import { useImportT } from './use-import-text'

/** How one rule reads to a person: a column name, a value, or nothing. */
function saidAs(
  mapping: ImportMapping | null,
  target: string,
  columns: ImportStatus['source'],
  locale: Locale,
) {
  const text = (
    key: 'notMapped' | 'fromColumn' | 'rawValue',
    params?: Record<string, string>,
  ) => importText(importConfirmMessages, locale, key, params)
  const rule = mapping?.rules.find((one) => one.target === target)
  if (rule === undefined) return text('notMapped')
  if (rule.sources.length > 0) {
    const column = columns?.fields?.find((one) => one.id === rule.sources[0])
    return text('fromColumn', {
      column: column?.header ?? rule.sources[0] ?? '—',
    })
  }
  const constant = rule.constant ?? ''
  if (constant === '') return text('notMapped')
  // An unknown constant is shown as the raw value in quotes rather than
  // dressed up as a label we do not actually have.
  return valueLabel(constant, locale) ?? text('rawValue', { value: constant })
}

/**
 * The confirmation someone is looking at was computed against a revision the
 * server has since moved past. Rather than a bare error, this screen shows
 * what the difference actually is — the mapping they confirmed against, beside
 * the mapping that exists now — so the re-check is an informed decision and
 * not a shrug.
 */
export function ImportConflict({
  mine,
  theirs,
  status,
  lastValidation,
  onRecheck,
  onSettings,
  busy,
}: {
  /** The mapping this confirmation was computed against. */
  mine: ImportMapping | null
  /** What the server has now. */
  theirs: ImportMapping | null
  status: ImportStatus
  lastValidation: ImportValidation | null
  onRecheck: () => void
  onSettings: () => void
  busy: boolean
}) {
  const { locale } = useLocale()
  const t = useImportT(importConfirmMessages)
  const targets = [
    ...new Set([
      ...(mine?.rules ?? []).map((rule) => rule.target),
      ...(theirs?.rules ?? []).map((rule) => rule.target),
    ]),
  ]
  const diffs = targets
    .map((target) => ({
      target,
      was: saidAs(mine, target, status.source, locale),
      now: saidAs(theirs, target, status.source, locale),
    }))
    .filter((diff) => diff.was !== diff.now)

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <div
        className="border-state-warn/26 bg-state-warn-soft flex flex-wrap items-center gap-4.5 rounded-[18px] border px-5.5 py-5"
        role="alert"
      >
        <span
          aria-hidden
          className="bg-state-warn/12 text-state-warn inline-flex size-10.5 flex-none items-center justify-center rounded-[11px] text-[18px] font-bold"
        >
          !
        </span>
        <div className="min-w-0 flex-[1_1_320px]">
          <p className="text-state-warn text-[15px] font-bold">
            {t('conflictTitle')}
          </p>
          <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
            {t('conflictBody')}
          </p>
        </div>
      </div>

      <section
        aria-label={t('whatChanged')}
        className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border"
      >
        <h2 className="text-app-ink border-app-line border-b px-5.5 py-4 text-[15px] font-bold">
          {t('whatChanged')}
        </h2>
        {diffs.length === 0 ? (
          <p className="text-app-muted px-5.5 py-4 text-[14px] leading-6 text-pretty">
            {t('revisionOnly')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{t('diffCaption')}</caption>
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">{t('setting')}</th>
                  <th className="px-3 py-2.5 text-left">{t('yourView')}</th>
                  <th className="px-3 py-2.5 text-left">{t('currentValue')}</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((diff) => (
                  <tr className="border-app-line border-b" key={diff.target}>
                    <td className="text-app-ink px-5.5 py-3.5 text-[14.5px] font-bold">
                      {fieldLabel(diff.target, locale)}
                    </td>
                    <td className="text-app-dim px-3 py-3.5 line-through">
                      {diff.was}
                    </td>
                    <td className="text-app-ink px-3 py-3.5 font-medium">
                      {diff.now}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px] leading-5 text-pretty">
          {t('nothingCreatedRecheck')}
        </p>
      </section>

      <div className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-4 rounded-[18px] border px-5.5 py-5">
        <div className="min-w-0 flex-[1_1_320px]">
          <p
            className={cn(
              'text-[14.5px] font-bold',
              lastValidation === null ? 'text-app-dim' : 'text-app-ink',
            )}
          >
            {lastValidation === null
              ? t('noPreviousEstimate')
              : t('previousEstimate', { count: lastValidation.plannedParts })}
          </p>
          <p className="text-app-muted mt-1 text-[13.5px] leading-5 text-pretty">
            {t('mayChange')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button disabled={busy} onClick={onSettings}>
            {t('toSettings')}
          </Button>
          <Button disabled={busy} onClick={onRecheck} variant="primary">
            {t('recheck')}
          </Button>
        </div>
      </div>
    </div>
  )
}
