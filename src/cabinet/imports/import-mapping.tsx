import {
  Button,
  Field,
  Notice,
  SectionPanel,
  SelectInput,
  TextInput,
} from '@/components/app'
import { cn } from '@/lib/utils'
import { useLocale } from '@/i18n'
import type {
  ImportCapabilities,
  ImportField,
  ImportMapping,
  ImportProfile,
  ImportRow,
  ImportStatus,
} from '@/api/part-imports'
import { ImportReferencePicker } from './ImportReferencePicker'
import { fieldLabel, valueLabel } from './import-model'
import { importMappingMessages } from './import-mapping-messages'
import { useCount, useImportT } from './use-import-text'

/** Fields that describe the whole delivery rather than one row. */
const SHARED_FIELDS = [
  'InventoryZoneId',
  'Condition',
  'EquipmentTypeId',
] as const

const SCENARIOS = [
  {
    value: 'Available',
    label: 'scenarioAvailable',
    hint: 'scenarioAvailableHint',
  },
  {
    value: 'Reserved',
    label: 'scenarioReserved',
    hint: 'scenarioReservedHint',
  },
] as const

/**
 * Крок 2 — the screen reads column-first, the way the file does: here is your
 * column, here is what we read out of it, here is the field it becomes. The
 * other direction — a list of our fields waiting to be filled — asks someone
 * to hold our schema in their head while looking at their own spreadsheet.
 */
export function ImportMappingStep({
  capabilities,
  status,
  rows,
  mapping,
  profiles,
  profileName,
  onProfileName,
  onRule,
  onSkip,
  onApplyProfile,
  onSaveProfile,
  onClearProfile,
  onContinue,
  busy,
  editable,
}: {
  capabilities: ImportCapabilities
  status: ImportStatus
  rows: readonly ImportRow[]
  mapping: ImportMapping | null
  profiles: readonly ImportProfile[]
  profileName: string
  onProfileName: (name: string) => void
  onRule: (target: string, source: string, constant?: string) => void
  onSkip: (fileFieldId: string, skipped: boolean) => void
  onApplyProfile: (profile: ImportProfile) => void
  onSaveProfile: () => void
  onClearProfile: () => void
  onContinue: () => void
  busy: boolean
  editable: boolean
}) {
  const { locale } = useLocale()
  const t = useImportT(importMappingMessages)
  const count = useCount()
  const label = (id: string) => fieldLabel(id, locale)
  const columns = status.source?.fields ?? []
  const sample = rows[0] ?? null
  const rules = mapping?.rules ?? []
  const skipped = new Set(mapping?.skippedFields ?? [])

  const targetOf = (fileFieldId: string) =>
    rules.find((rule) => rule.sources.includes(fileFieldId))?.target ?? ''

  const rowFields = capabilities.fields.filter(
    (field) =>
      !SHARED_FIELDS.includes(field.id as (typeof SHARED_FIELDS)[number]),
  )
  const mapped = columns.filter((column) => targetOf(column.id) !== '')
  const unused = columns.filter(
    (column) => targetOf(column.id) === '' && !skipped.has(column.id),
  )
  const missing = capabilities.fields.filter(
    (field) =>
      field.required &&
      !rules.some(
        (rule) =>
          rule.target === field.id &&
          (rule.sources.length > 0 || (rule.constant ?? '') !== ''),
      ),
  )

  const strategy =
    rules.find((rule) => rule.target === 'Strategy')?.constant ?? 'Available'

  const sampleFor = (fileFieldId: string) => {
    const column = columns.find((one) => one.id === fileFieldId)
    if (column === undefined || sample === null) return null
    return (
      sample.source.cells.find((cell) => cell.column === column.column)?.raw ??
      null
    )
  }
  const resultFor = (target: string) => {
    if (target === '' || sample?.draft == null) return null
    const value = sample.draft.values[target]
    return value == null || value === ''
      ? null
      : (valueLabel(value, locale) ?? value)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-app-muted m-0">
          {t('fileSummary', {
            rows: t('fileRows', { count: status.rowCount }),
            columns: t('fileColumns', { count: columns.length }),
          })}
        </p>
        {profiles.length === 0 ? null : (
          <div
            aria-label={t('profileGroup')}
            className="flex flex-wrap items-center gap-2"
            role="group"
          >
            <span className="rz-eyebrow">{t('profile')}</span>
            {profiles.map((profile) => (
              <Button
                disabled={busy || !editable}
                key={profile.id}
                onClick={() => onApplyProfile(profile)}
                size="sm"
              >
                {profile.name}
              </Button>
            ))}
            <Button
              disabled={busy || !editable}
              onClick={onClearProfile}
              size="sm"
            >
              {t('noProfile')}
            </Button>
          </div>
        )}
      </div>

      {missing.length === 0 ? null : (
        <Notice tone="warn">
          {t('missingRequired', {
            count: missing.length,
            fields: missing.map((field) => label(field.id)).join(', '),
          })}
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section
          aria-label={t('columnMapping')}
          className="rz-card min-w-0 flex-[1_1_480px]"
        >
          <div className="rz-card__head py-2.5">
            <h2 className="rz-h-card">{t('columnMapping')}</h2>
            <p
              className={cn(
                'm-0 text-caption',
                missing.length > 0 ? 'text-state-warn' : 'text-app-dim',
              )}
            >
              {t('mappedOf', {
                mapped: count(mapped.length),
                total: count(columns.length),
              })}
              {missing.length > 0
                ? t('needsAttention', { count: count(missing.length) })
                : ''}
            </p>
          </div>

          <ul className="divide-app-line m-0 list-none divide-y p-0">
            {columns.map((column) => {
              const target = targetOf(column.id)
              const raw = sampleFor(column.id)
              const out = resultFor(target)
              return (
                <li
                  className="grid gap-2 px-(--rz-card-p) py-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)_minmax(0,0.9fr)] sm:items-start sm:gap-4"
                  key={column.id}
                >
                  <div className="min-w-0">
                    <p className="text-app-strong m-0 truncate font-semibold">
                      {column.header ||
                        t('columnNumber', {
                          number: String(column.column + 1),
                        })}
                    </p>
                    <p className="rz-caption m-0 mt-0.5 truncate font-mono">
                      {raw === null ? '—' : t('sample', { value: raw })}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="text-app-dim hidden pt-1.5 sm:block"
                  >
                    →
                  </span>
                  <div className="min-w-0">
                    <SelectInput
                      aria-label={t('fieldForColumn', {
                        column: column.header || String(column.column + 1),
                      })}
                      disabled={busy || !editable}
                      onChange={(event) => {
                        const next = event.target.value
                        if (next === '') {
                          if (target !== '') onRule(target, '')
                          onSkip(column.id, true)
                          return
                        }
                        onSkip(column.id, false)
                        onRule(next, column.id)
                      }}
                      value={target}
                    >
                      <option value="">{t('doNotImport')}</option>
                      {rowFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {label(field.id)}
                          {field.required ? ' *' : ''}
                        </option>
                      ))}
                    </SelectInput>
                  </div>
                  <div className="min-w-0 sm:text-right">
                    <p
                      className={cn(
                        'm-0 truncate',
                        out === null ? 'text-app-dim' : 'text-app-muted',
                      )}
                    >
                      {out ?? '—'}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="rz-caption border-app-line m-0 border-t px-(--rz-card-p) py-2.5">
            {unused.length === 0
              ? t('allColumnsUsed')
              : t('unusedColumns', { count: unused.length })}
          </p>
        </section>

        <div className="grid max-w-full min-w-0 flex-[1_1_300px] gap-4 lg:max-w-[380px]">
          <SharedValues
            busy={busy}
            capabilities={capabilities}
            editable={editable}
            mapping={mapping}
            onRule={onRule}
            rowCount={status.rowCount}
          />

          <SectionPanel title={t('scenario')}>
            <div className="grid gap-2">
              {SCENARIOS.map((scenario) => {
                const on = strategy === scenario.value
                return (
                  <button
                    aria-pressed={on}
                    className="rz-choice-card aria-pressed:border-brand aria-pressed:bg-brand-soft hover:not-aria-pressed:bg-app-hover grid w-full gap-0.5 bg-transparent text-left disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={busy || !editable}
                    key={scenario.value}
                    onClick={() => onRule('Strategy', '', scenario.value)}
                    type="button"
                  >
                    <span
                      className={cn(
                        'block font-semibold',
                        on ? 'text-app-strong' : 'text-app-muted',
                      )}
                    >
                      {t(scenario.label)}
                    </span>
                    <span className="text-app-muted block text-pretty">
                      {t(scenario.hint)}
                    </span>
                  </button>
                )
              })}
            </div>
            {strategy === 'Reserved' ? (
              <p className="border-app-line text-app-muted m-0 border-t pt-3 text-pretty">
                {t('reservedNote', {
                  size: count(capabilities.maxOrderGroupSize),
                })}
              </p>
            ) : null}
          </SectionPanel>

          <SectionPanel title={t('requiredFields')}>
            <ul className="m-0 grid list-none gap-2 p-0">
              {capabilities.fields
                .filter((field) => field.required)
                .map((field) => {
                  const rule = rules.find((one) => one.target === field.id)
                  const header =
                    rule === undefined || rule.sources.length === 0
                      ? undefined
                      : (columns.find((one) => one.id === rule.sources[0])
                          ?.header ?? rule.sources[0])
                  const from: { column: string } | 'shared' | null =
                    header !== undefined
                      ? { column: header }
                      : rule === undefined ||
                          rule.sources.length > 0 ||
                          (rule.constant ?? '') === ''
                        ? null
                        : 'shared'
                  return (
                    <li
                      className={cn(
                        'flex items-start gap-2.5',
                        from === null ? 'text-state-warn' : 'text-app-muted',
                      )}
                      key={field.id}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-px inline-flex size-4.5 flex-none items-center justify-center rounded-full font-mono text-micro',
                          from === null
                            ? 'bg-state-warn-soft text-state-warn'
                            : 'bg-state-ok-soft text-state-ok',
                        )}
                      >
                        {from === null ? '!' : '✓'}
                      </span>
                      <span>
                        {from === null
                          ? t('notMapped', { field: label(field.id) })
                          : from === 'shared'
                            ? t('fromSharedValue', { field: label(field.id) })
                            : t('fromColumn', {
                                field: label(field.id),
                                column: from.column,
                              })}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </SectionPanel>

          <SectionPanel
            description={t('saveAsProfileHint')}
            title={t('saveAsProfile')}
          >
            <div className="grid gap-3">
              <Field label={t('profileName')}>
                <TextInput
                  disabled={busy || !editable}
                  maxLength={200}
                  onChange={(event) => onProfileName(event.target.value)}
                  value={profileName}
                />
              </Field>
              <div className="rz-btn-row">
                <Button
                  disabled={busy || !editable || profileName.trim() === ''}
                  onClick={onSaveProfile}
                >
                  {t('saveProfile')}
                </Button>
              </div>
            </div>
          </SectionPanel>

          <div className="grid gap-2">
            <Button
              disabled={busy || !editable || missing.length > 0}
              onClick={onContinue}
              variant="primary"
            >
              {t('checkData')}
            </Button>
            <p className="rz-caption m-0 text-pretty">
              {t('checkDataHint', { count: count(status.rowCount) })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Values that apply to the whole delivery, not to one row. */
function SharedValues({
  capabilities,
  mapping,
  onRule,
  rowCount,
  busy,
  editable,
}: {
  capabilities: ImportCapabilities
  mapping: ImportMapping | null
  onRule: (target: string, source: string, constant?: string) => void
  rowCount: number
  busy: boolean
  editable: boolean
}) {
  const { locale } = useLocale()
  const t = useImportT(importMappingMessages)
  const count = useCount()
  const rules = mapping?.rules ?? []
  const shared = capabilities.fields.filter((field) =>
    SHARED_FIELDS.includes(field.id as (typeof SHARED_FIELDS)[number]),
  )
  if (shared.length === 0) return null

  const constantOf = (field: ImportField) =>
    rules.find((rule) => rule.target === field.id)?.constant ?? ''
  const fromColumn = (field: ImportField) =>
    (rules.find((rule) => rule.target === field.id)?.sources.length ?? 0) > 0

  return (
    <SectionPanel
      description={t('sharedValuesHint', { count: count(rowCount) })}
      title={t('sharedValues')}
    >
      <div className="grid gap-3">
        {shared.map((field) => (
          <Field
            hint={fromColumn(field) ? t('fromFileColumnHint') : undefined}
            key={field.id}
            label={fieldLabel(field.id, locale)}
            required={field.required}
          >
            {fromColumn(field) ? (
              <TextInput disabled readOnly value={t('fromFileColumn')} />
            ) : field.allowed ? (
              <SelectInput
                disabled={busy || !editable}
                onChange={(event) => onRule(field.id, '', event.target.value)}
                value={constantOf(field)}
              >
                <option value="">{t('notSpecified')}</option>
                {field.allowed.map((value) => (
                  <option key={value} value={value}>
                    {valueLabel(value, locale) ?? value}
                  </option>
                ))}
              </SelectInput>
            ) : field.type === 'reference' ? (
              <ImportReferencePicker
                field={field.id}
                onChange={(value) => onRule(field.id, '', value)}
                value={constantOf(field)}
              />
            ) : (
              <TextInput
                disabled={busy || !editable}
                onChange={(event) => onRule(field.id, '', event.target.value)}
                value={constantOf(field)}
              />
            )}
          </Field>
        ))}
      </div>
    </SectionPanel>
  )
}
