import { Button, Field, Notice, SelectInput, TextInput } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type {
  ImportCapabilities,
  ImportField,
  ImportMapping,
  ImportProfile,
  ImportRow,
  ImportStatus,
} from '@/api/part-imports'
import { ImportReferencePicker } from './ImportReferencePicker'
import { fieldLabels, valueLabels } from './import-model'

/** Fields that describe the whole delivery rather than one row. */
const SHARED_FIELDS = [
  'SourceType',
  'CarId',
  'IntakeId',
  'InventoryZoneId',
  'Condition',
  'EquipmentTypeId',
] as const

const SCENARIOS = [
  {
    value: 'Available',
    label: 'Доступні запчастини',
    hint: 'Позиції одразу в каталозі. Замовлення не створюються.',
  },
  {
    value: 'Reserved',
    label: 'Резерв із замовленням',
    hint: 'Кожен рядок резервується під замовлення клієнта.',
  },
] as const

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')

const label = (id: string) => fieldLabels[id] ?? id

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
    return value == null || value === '' ? null : (valueLabels[value] ?? value)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-app-muted text-[15px]">
          {count(status.rowCount)}{' '}
          {plural(status.rowCount, ['рядок', 'рядки', 'рядків'])} ·{' '}
          {count(columns.length)}{' '}
          {plural(columns.length, ['колонка', 'колонки', 'колонок'])} у файлі.
          Поясніть, що означає кожна колонка.
        </p>
        {profiles.length === 0 ? null : (
          <div
            aria-label="Профіль зіставлення"
            className="flex flex-wrap items-center gap-2"
            role="group"
          >
            <span className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              Профіль
            </span>
            {profiles.map((profile) => (
              <Button
                disabled={busy || !editable}
                key={profile.id}
                onClick={() => onApplyProfile(profile)}
              >
                {profile.name}
              </Button>
            ))}
            <Button disabled={busy || !editable} onClick={onClearProfile}>
              Без профілю
            </Button>
          </div>
        )}
      </div>

      {missing.length === 0 ? null : (
        <Notice tone="warn">
          Не зіставлено{' '}
          {plural(missing.length, [
            'обовʼязкове поле',
            'обовʼязкові поля',
            'обовʼязкових полів',
          ])}
          : {missing.map((field) => label(field.id)).join(', ')}. Перевірка
          даних стане доступною, щойно вони отримають значення.
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section
          aria-label="Зіставлення колонок"
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_480px] overflow-hidden rounded-[20px] border"
        >
          <div className="border-app-line flex flex-wrap items-baseline justify-between gap-3 border-b px-5.5 py-4">
            <h2 className="text-app-ink text-[15px] font-bold">
              Зіставлення колонок
            </h2>
            <p
              className={cn(
                'text-[13px]',
                missing.length > 0 ? 'text-state-warn' : 'text-app-dim',
              )}
            >
              {count(mapped.length)} із {count(columns.length)} зіставлено
              {missing.length > 0
                ? ` · ${count(missing.length)} потребує уваги`
                : ''}
            </p>
          </div>

          <ul className="divide-app-line divide-y">
            {columns.map((column) => {
              const target = targetOf(column.id)
              const raw = sampleFor(column.id)
              const out = resultFor(target)
              return (
                <li
                  className="grid gap-3 px-5.5 py-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.1fr)_minmax(0,0.9fr)] sm:items-start sm:gap-4"
                  key={column.id}
                >
                  <div className="min-w-0">
                    <p className="text-app-ink truncate text-[14.5px] font-bold">
                      {column.header || `Колонка ${String(column.column + 1)}`}
                    </p>
                    <p className="text-app-dim mt-0.5 truncate font-mono text-[12.5px]">
                      {raw === null ? '—' : `«${raw}»`}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className="text-app-line-2 hidden pt-2 text-[13px] sm:block"
                  >
                    →
                  </span>
                  <div className="min-w-0">
                    <SelectInput
                      aria-label={`Поле для колонки «${column.header || String(column.column + 1)}»`}
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
                      <option value="">Не імпортувати</option>
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
                        'truncate text-[14px]',
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

          <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px]">
            {unused.length === 0
              ? 'Усі колонки файлу кудись ідуть.'
              : `${count(unused.length)} ${plural(unused.length, ['колонка файлу не використовується', 'колонки файлу не використовуються', 'колонок файлу не використовуються'])} — це нормально.`}
          </p>
        </section>

        <div className="grid min-w-0 flex-[0_1_360px] gap-4 sm:min-w-[300px]">
          <SharedValues
            busy={busy}
            capabilities={capabilities}
            editable={editable}
            mapping={mapping}
            onRule={onRule}
            rowCount={status.rowCount}
          />

          <section
            aria-label="Сценарій імпорту"
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <h2 className="text-app-ink text-[15px] font-bold">
              Сценарій імпорту
            </h2>
            <div className="mt-3 grid gap-2">
              {SCENARIOS.map((scenario) => {
                const on = strategy === scenario.value
                return (
                  <button
                    aria-pressed={on}
                    className={cn(
                      'focus-visible:outline-brand rounded-[12px] border px-3.5 py-3 text-left transition-colors',
                      on
                        ? 'border-app-line-2 bg-white/[0.07]'
                        : 'border-app-line hover:bg-white/[0.03]',
                    )}
                    disabled={busy || !editable}
                    key={scenario.value}
                    onClick={() => onRule('Strategy', '', scenario.value)}
                    type="button"
                  >
                    <span
                      className={cn(
                        'block text-[14px] font-bold',
                        on ? 'text-app-ink' : 'text-app-muted',
                      )}
                    >
                      {scenario.label}
                    </span>
                    <span className="text-app-muted mt-1 block text-[13px] leading-5 text-pretty">
                      {scenario.hint}
                    </span>
                  </button>
                )
              })}
            </div>
            {strategy === 'Reserved' ? (
              <p className="border-app-line text-app-muted mt-3.5 border-t pt-3.5 text-[13px] leading-5 text-pretty">
                Рядки з однаковим значенням у полі «Група замовлення» створять
                одне замовлення, до {count(capabilities.maxOrderGroupSize)}{' '}
                позицій у кожному. Клієнта буде взято з поля «Клієнт».
              </p>
            ) : null}
          </section>

          <section
            aria-label="Обовʼязкові поля"
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              Обовʼязкові поля
            </h2>
            <ul className="mt-3 grid gap-2">
              {capabilities.fields
                .filter((field) => field.required)
                .map((field) => {
                  const rule = rules.find((one) => one.target === field.id)
                  const from =
                    rule === undefined
                      ? null
                      : rule.sources.length > 0
                        ? (columns.find((one) => one.id === rule.sources[0])
                            ?.header ??
                          rule.sources[0] ??
                          null)
                        : (rule.constant ?? '') === ''
                          ? null
                          : 'спільне значення'
                  return (
                    <li
                      className={cn(
                        'flex items-start gap-2.5 text-[13.5px]',
                        from === null ? 'text-state-warn' : 'text-app-muted',
                      )}
                      key={field.id}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 inline-flex size-4.5 flex-none items-center justify-center rounded-full text-[11px] font-bold',
                          from === null
                            ? 'bg-state-warn/16 text-state-warn'
                            : 'bg-state-ok/16 text-state-ok',
                        )}
                      >
                        {from === null ? '!' : '✓'}
                      </span>
                      <span>
                        {label(field.id)}
                        {from === null
                          ? ' — не зіставлено'
                          : ` — ${from === 'спільне значення' ? from : `колонка «${from}»`}`}
                      </span>
                    </li>
                  )
                })}
            </ul>
          </section>

          <section
            aria-label="Зберегти як профіль"
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <h2 className="text-app-ink text-[15px] font-bold">
              Зберегти як профіль
            </h2>
            <p className="text-app-dim mt-1 text-[13px] leading-5 text-pretty">
              Щоб наступний такий файл зіставився сам.
            </p>
            <div className="mt-3 grid gap-2.5">
              <Field label="Назва профілю">
                <TextInput
                  disabled={busy || !editable}
                  maxLength={200}
                  onChange={(event) => onProfileName(event.target.value)}
                  value={profileName}
                />
              </Field>
              <Button
                disabled={busy || !editable || profileName.trim() === ''}
                onClick={onSaveProfile}
              >
                Зберегти профіль
              </Button>
            </div>
          </section>

          <div className="grid gap-2.5">
            <Button
              disabled={busy || !editable || missing.length > 0}
              onClick={onContinue}
              variant="primary"
            >
              Перевірити дані
            </Button>
            <p className="text-app-dim text-[13px] leading-5 text-pretty">
              Далі ви побачите перелік усіх {count(status.rowCount)} майбутніх
              позицій. Створення почнеться тільки після підтвердження.
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
    <section
      aria-label="Спільні значення"
      className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
    >
      <h2 className="text-app-ink text-[15px] font-bold">Спільні значення</h2>
      <p className="text-app-dim mt-1 text-[13px] leading-5 text-pretty">
        Застосуються до всіх {count(rowCount)} рядків. Якщо значення є в колонці
        файлу — воно має пріоритет.
      </p>
      <div className="mt-3.5 grid gap-3.5">
        {shared.map((field) => (
          <Field
            hint={
              fromColumn(field)
                ? 'Береться з колонки файлу — спільне значення не застосовується.'
                : undefined
            }
            key={field.id}
            label={label(field.id)}
            required={field.required}
          >
            {fromColumn(field) ? (
              <TextInput disabled readOnly value="З колонки файлу" />
            ) : field.allowed ? (
              <SelectInput
                disabled={busy || !editable}
                onChange={(event) => onRule(field.id, '', event.target.value)}
                value={constantOf(field)}
              >
                <option value="">Не вказувати</option>
                {field.allowed.map((value) => (
                  <option key={value} value={value}>
                    {valueLabels[value] ?? value}
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
    </section>
  )
}
