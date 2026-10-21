import { Button, Card, Notice } from '@/components/app'
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
    <div className="flex min-w-0 flex-col gap-3">
      <Notice block role="alert" tone="warn">
        <p className="text-app-strong m-0 font-semibold">
          {t('conflictTitle')}
        </p>
        <p className="text-app-muted m-0 mt-0.5 text-pretty">
          {t('conflictBody')}
        </p>
      </Notice>

      <Card bodyClassName="p-0" title={t('whatChanged')}>
        {diffs.length === 0 ? (
          <p className="text-app-muted m-0 px-(--rz-card-p) py-3 text-pretty">
            {t('revisionOnly')}
          </p>
        ) : (
          <div className="rz-table-scroll">
            <table className="rz-table">
              <caption>{t('diffCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('setting')}</th>
                  <th scope="col">{t('yourView')}</th>
                  <th scope="col">{t('currentValue')}</th>
                </tr>
              </thead>
              <tbody>
                {diffs.map((diff) => (
                  <tr key={diff.target}>
                    <th scope="row">{fieldLabel(diff.target, locale)}</th>
                    <td className="text-app-dim line-through">{diff.was}</td>
                    <td className="text-app-strong font-medium">{diff.now}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="rz-caption border-app-line m-0 border-t px-(--rz-card-p) py-2.5 text-pretty">
          {t('nothingCreatedRecheck')}
        </p>
      </Card>

      <div className="rz-card">
        <div className="rz-card__body flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-[1_1_320px]">
            <p
              className={cn(
                'm-0 font-semibold',
                lastValidation === null ? 'text-app-dim' : 'text-app-strong',
              )}
            >
              {lastValidation === null
                ? t('noPreviousEstimate')
                : t('previousEstimate', {
                    count: lastValidation.plannedParts,
                  })}
            </p>
            <p className="text-app-muted m-0 mt-0.5 text-pretty">
              {t('mayChange')}
            </p>
          </div>
          <div className="rz-btn-row">
            <Button disabled={busy} onClick={onSettings}>
              {t('toSettings')}
            </Button>
            <Button disabled={busy} onClick={onRecheck} variant="primary">
              {t('recheck')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
