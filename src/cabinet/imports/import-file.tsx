import { Button, Field, Notice, SelectInput } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type { ReactNode } from 'react'
import type {
  ImportCapabilities,
  ImportRow,
  ImportSelection,
  ImportStatus,
} from '@/api/part-imports'
import { issueText, looksMisdecoded } from './import-model'

const DELIMITERS = [
  { value: ',', label: 'Кома' },
  { value: ';', label: 'Крапка з комою' },
  { value: '\t', label: 'Табуляція' },
  { value: '|', label: 'Вертикальна риска' },
] as const

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')

const fileSize = (bytes: number) =>
  bytes < 1024
    ? `${String(bytes)} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`

/** One of the pill choices in "Як читати файл". */
function Pick({
  active,
  children,
  onPick,
  label,
}: {
  active: boolean
  children: ReactNode
  onPick: () => void
  label: string
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'focus-visible:outline-brand inline-flex min-h-11 items-center rounded-[9px] border px-3 text-[13px] font-medium transition-colors',
        active
          ? 'border-app-line-2 text-app-ink bg-white/[0.07]'
          : 'border-app-line text-app-muted hover:text-app-ink',
      )}
      onClick={onPick}
      type="button"
    >
      {children}
    </button>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="text-app-ink mt-1.5 font-mono text-[20px] font-medium">
        {value}
      </p>
    </div>
  )
}

/**
 * Крок 1 — the file is read, and this screen exists to let someone check that
 * the machine sees the same rows they do before any column means anything.
 */
export function ImportFileStep({
  capabilities,
  status,
  rows,
  file,
  selection,
  onSelection,
  editable,
  busy,
  settingsOpen,
  onToggleSettings,
  onChooseFile,
  onReanalyze,
  onContinue,
}: {
  capabilities: ImportCapabilities
  status: ImportStatus | null
  rows: readonly ImportRow[]
  /** The picked file, known only for the session that picked it. */
  file: File | null
  selection: ImportSelection
  onSelection: (next: (current: ImportSelection) => ImportSelection) => void
  editable: boolean
  busy: boolean
  settingsOpen: boolean
  onToggleSettings: () => void
  onChooseFile: (file: File | undefined) => void
  onReanalyze: (override?: ImportSelection) => void
  onContinue: () => void
}) {
  const source = status === null ? null : status.source
  const columns = source?.fields ?? []
  const preview = rows.slice(0, 5)
  const format = (file?.name.split('.').pop() ?? 'CSV').toUpperCase()

  // Which text columns came back as mojibake, and what we can offer about it.
  const textColumns = columns.filter((column) =>
    rows.some((row) => {
      const raw = row.source.cells.find(
        (cell) => cell.column === column.column,
      )?.raw
      return raw !== null && raw !== undefined && /[^\d\s.,-]/.test(raw)
    }),
  )
  const brokenColumns = textColumns.filter((column) =>
    looksMisdecoded(
      rows.map(
        (row) =>
          row.source.cells.find((cell) => cell.column === column.column)?.raw ??
          null,
      ),
    ),
  )
  const otherEncoding = capabilities.encodings.find(
    (one) => one.toLowerCase() !== selection.encoding.toLowerCase(),
  )
  const failed = status !== null && status.status === 'Failed'
  const trouble: {
    tone: 'danger' | 'warn'
    title: string
    body: string
    fix: { label: string; run: () => void } | null
  } | null = failed
    ? {
        tone: 'danger',
        title: 'Файл прочитати не вдалося',
        body:
          status.errorCode === null
            ? 'Сервер не зміг прочитати цю таблицю. Спробуйте інші налаштування читання або інший файл.'
            : issueText(status.errorCode),
        fix: null,
      }
    : brokenColumns.length > 0
      ? {
          tone: 'warn',
          title: 'Кодування не розпізнано — назви нечитабельні',
          body: `Файл прочитано як ${selection.encoding.toUpperCase()}, але текст у ${brokenColumns.length === 1 ? `колонці «${brokenColumns[0]!.header}»` : `колонках ${brokenColumns.map((column) => `«${column.header}»`).join(', ')}`} пошкоджений. Схоже, таблиця збережена в іншому кодуванні.`,
          fix:
            otherEncoding === undefined || !editable
              ? null
              : {
                  label: `Прочитати як ${otherEncoding.toUpperCase()}`,
                  run: () => {
                    const next = { ...selection, encoding: otherEncoding }
                    onSelection(() => next)
                    onReanalyze(next)
                  },
                },
        }
      : null

  if (status === null || source === null)
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <label
          className="import-drop"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            onChooseFile(event.dataTransfer.files[0])
          }}
        >
          <strong>
            Перетягніть файл {capabilities.formats.join(' або ').toUpperCase()}
          </strong>
          <span>
            або виберіть його — до{' '}
            {String(Math.round(capabilities.limits.maxBytes / (1024 * 1024)))}{' '}
            MiB, до {count(capabilities.limits.maxRows)} рядків
          </span>
          <input
            accept={capabilities.formats.map((one) => `.${one}`).join(',')}
            aria-label="Файл імпорту"
            disabled={busy}
            onChange={(event) => onChooseFile(event.target.files?.[0])}
            type="file"
          />
        </label>
        {file === null ? null : (
          <p className="text-app-muted text-sm">
            Обрано {file.name} · {fileSize(file.size)}. Натисніть «Завантажити
            файл», щоб сервер його прочитав.
          </p>
        )}
      </div>
    )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="border-state-ok/20 bg-app-raised flex flex-wrap items-center gap-4.5 rounded-[18px] border px-5.5 py-5">
        <span
          aria-hidden
          className="bg-state-ok-soft text-state-ok inline-flex size-10.5 flex-none items-center justify-center rounded-[11px] font-mono text-[11px] font-medium"
        >
          {format}
        </span>
        <div className="min-w-0 flex-[1_1_260px] sm:min-w-[200px]">
          <p className="text-app-ink text-[16px] font-bold tracking-[-0.01em]">
            {file?.name ?? 'Файл імпорту'}
          </p>
          <p className="text-app-muted mt-1 text-[13px]">
            {file === null
              ? 'Назву файлу сервер не зберігає — вона відома лише в сеансі, де його обрали.'
              : `${fileSize(file.size)} · передано й прочитано`}
            {' · '}
            {new Date(status.createdAt).toLocaleString('uk-UA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Figure label="Рядків даних" value={count(status.rowCount)} />
          <Figure label="Колонок" value={count(columns.length)} />
          {editable ? (
            <Button disabled={busy} onClick={() => onChooseFile(undefined)}>
              Інший файл
            </Button>
          ) : null}
        </div>
      </div>

      {trouble === null ? null : (
        <div
          className={cn(
            'flex flex-wrap items-center gap-4.5 rounded-[18px] border px-5.5 py-5',
            trouble.tone === 'danger'
              ? 'border-state-danger/26 bg-state-danger-soft'
              : 'border-state-warn/26 bg-state-warn-soft',
          )}
          role={trouble.tone === 'danger' ? 'alert' : 'status'}
        >
          <span
            aria-hidden
            className={cn(
              'inline-flex size-10.5 flex-none items-center justify-center rounded-[11px] text-[18px] font-bold',
              trouble.tone === 'danger'
                ? 'bg-state-danger/12 text-state-danger'
                : 'bg-state-warn/12 text-state-warn',
            )}
          >
            !
          </span>
          <div className="min-w-0 flex-[1_1_320px]">
            <p
              className={cn(
                'text-[15px] font-bold',
                trouble.tone === 'danger'
                  ? 'text-state-danger'
                  : 'text-state-warn',
              )}
            >
              {trouble.title}
            </p>
            <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
              {trouble.body}
            </p>
          </div>
          {trouble.fix === null ? null : (
            <Button disabled={busy} onClick={trouble.fix.run} variant="primary">
              {trouble.fix.label}
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <section
          aria-label="Що прочитано"
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_420px] overflow-hidden rounded-[20px] border"
        >
          <div className="border-app-line flex flex-wrap items-baseline justify-between gap-3 border-b px-5.5 py-4">
            <h2 className="text-app-ink text-[15px] font-bold">Що прочитано</h2>
            <p
              className={cn(
                'text-[13px]',
                brokenColumns.length > 0 ? 'text-state-warn' : 'text-app-dim',
              )}
            >
              {brokenColumns.length > 0
                ? `${String(brokenColumns.length)} з ${String(columns.length)} ${plural(columns.length, ['колонки', 'колонок', 'колонок'])} нечитабельні`
                : selection.headerRow == null
                  ? 'Заголовків немає — колонки названо за номерами'
                  : `Рядок ${String(selection.headerRow)} використано як заголовки`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">Перші рядки файлу</caption>
              <thead>
                <tr>
                  <th className="text-app-muted border-app-line w-12 border-b px-5.5 py-2.5 text-left font-mono text-[10px] tracking-[0.14em] uppercase">
                    №
                  </th>
                  {columns.map((column) => (
                    <th
                      className="text-app-muted border-app-line border-b px-3 py-2.5 text-left font-mono text-[10px] tracking-[0.14em] whitespace-nowrap uppercase"
                      key={column.id}
                    >
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr className="border-app-line border-b" key={row.rowId}>
                    <td className="text-app-dim px-5.5 py-3 font-mono text-[13px]">
                      {row.sourceRow}
                    </td>
                    {columns.map((column) => (
                      <td
                        className="text-app-ink px-3 py-3 whitespace-nowrap"
                        key={column.id}
                      >
                        {row.source.cells.find(
                          (cell) => cell.column === column.column,
                        )?.raw ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-app-dim px-5.5 py-3.5 text-[13px]">
            {brokenColumns.length > 0 &&
            brokenColumns.length < textColumns.length + 1
              ? 'Числові колонки прочитані правильно — проблема тільки в текстових.'
              : status.rowCount <= preview.length
                ? `Показано всі ${count(status.rowCount)} рядки файлу`
                : `Показано перші ${count(preview.length)} з ${count(status.rowCount)} рядків`}
          </p>
        </section>

        <div className="grid min-w-0 flex-[0_1_340px] gap-4 sm:min-w-[260px]">
          <section
            aria-label="Як читати файл"
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <button
              aria-expanded={settingsOpen}
              className="focus-visible:outline-brand flex min-h-11 w-full items-center justify-between gap-3"
              onClick={onToggleSettings}
              type="button"
            >
              <span className="text-app-ink text-[15px] font-bold">
                Як читати файл
              </span>
              <span className="text-brand text-[13px] font-bold">
                {settingsOpen ? 'Згорнути' : 'Змінити'}
              </span>
            </button>
            <p className="text-app-muted mt-1.5 text-[13px] leading-5 text-pretty">
              {settingsOpen
                ? 'Після зміни налаштувань файл читається заново — зіставлення колонок доведеться перевірити.'
                : `Роздільник ${DELIMITERS.find((one) => one.value === selection.delimiter)?.label.toLowerCase() ?? selection.delimiter}, кодування ${selection.encoding}, заголовки в рядку ${String(selection.headerRow ?? 1)}. Змініть, якщо дані виглядають не так.`}
            </p>

            {source.warnings.map((warning) => (
              <Notice className="mt-3" key={warning} tone="warn">
                {issueText(warning)}
              </Notice>
            ))}

            {settingsOpen ? (
              <div className="mt-4 grid gap-3.5">
                {source.tables.length > 0 ? (
                  <Field label="Аркуш">
                    <SelectInput
                      onChange={(event) =>
                        onSelection((current) => ({
                          ...current,
                          sheet: event.target.value,
                        }))
                      }
                      value={selection.sheet ?? ''}
                    >
                      <option value="">Оберіть аркуш</option>
                      {source.tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                ) : null}

                <div>
                  <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    Роздільник
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DELIMITERS.map((option) => (
                      <Pick
                        active={selection.delimiter === option.value}
                        key={option.value}
                        label={`Роздільник: ${option.label}`}
                        onPick={() =>
                          onSelection((current) => ({
                            ...current,
                            delimiter: option.value,
                          }))
                        }
                      >
                        {option.label}
                      </Pick>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    Кодування
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {capabilities.encodings.map((encoding) => (
                      <Pick
                        active={selection.encoding === encoding}
                        key={encoding}
                        label={`Кодування: ${encoding}`}
                        onPick={() =>
                          onSelection((current) => ({ ...current, encoding }))
                        }
                      >
                        {encoding.toUpperCase()}
                      </Pick>
                    ))}
                  </div>
                </div>

                <Field
                  hint="Дані читаються з наступного рядка."
                  label="Рядок заголовків"
                >
                  <SelectInput
                    onChange={(event) =>
                      onSelection((current) => ({
                        ...current,
                        headerRow:
                          event.target.value === ''
                            ? null
                            : Number(event.target.value),
                        startRow:
                          event.target.value === ''
                            ? 1
                            : Number(event.target.value) + 1,
                      }))
                    }
                    value={
                      selection.headerRow == null
                        ? ''
                        : String(selection.headerRow)
                    }
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="">Немає</option>
                  </SelectInput>
                </Field>

                {source.warnings.includes('HIDDEN_ROWS') ? (
                  <label className="text-app-muted flex min-h-11 items-center gap-2.5 text-[14px]">
                    <input
                      checked={selection.acceptHiddenRows ?? false}
                      className="accent-brand size-4.5"
                      onChange={(event) =>
                        onSelection((current) => ({
                          ...current,
                          acceptHiddenRows: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Підтверджую включення прихованих рядків
                  </label>
                ) : null}
                {source.warnings.includes('HIDDEN_COLUMNS') ? (
                  <label className="text-app-muted flex min-h-11 items-center gap-2.5 text-[14px]">
                    <input
                      checked={selection.acceptHiddenColumns ?? false}
                      className="accent-brand size-4.5"
                      onChange={(event) =>
                        onSelection((current) => ({
                          ...current,
                          acceptHiddenColumns: event.target.checked,
                        }))
                      }
                      type="checkbox"
                    />
                    Підтверджую включення прихованих колонок
                  </label>
                ) : null}

                {editable ? (
                  <Button disabled={busy} onClick={() => onReanalyze()}>
                    Прочитати заново
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>

          {trouble === null ? null : (
            <section
              aria-label="Спробуйте"
              className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
            >
              <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                Спробуйте
              </h2>
              <ul className="mt-3.5 grid gap-3.5">
                {[
                  {
                    title:
                      otherEncoding === undefined
                        ? 'Інше кодування'
                        : `Кодування ${otherEncoding.toUpperCase()}`,
                    hint: 'Windows-1251 — найчастіша причина для таблиць з Excel українською.',
                  },
                  {
                    title: 'Зберегти як CSV UTF-8',
                    hint: 'В Excel: Файл → Зберегти як → CSV UTF-8 (з комами).',
                  },
                  {
                    title: 'Завантажити XLSX',
                    hint: 'XLSX не має проблем з кодуванням — можна завантажити оригінал таблиці.',
                  },
                ].map((fix) => (
                  <li key={fix.title}>
                    <p className="text-app-ink text-[14px] font-bold">
                      {fix.title}
                    </p>
                    <p className="text-app-muted mt-1 text-[13px] leading-5 text-pretty">
                      {fix.hint}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {editable ? (
                  <Button disabled={busy} onClick={onToggleSettings}>
                    Змінити налаштування читання
                  </Button>
                ) : null}
                <Button disabled={busy} onClick={() => onChooseFile(undefined)}>
                  Вибрати інший файл
                </Button>
              </div>
              <p className="text-app-dim mt-4 text-[13px] leading-5 text-pretty">
                Нічого не створено. Цей імпорт залишиться в історії — його можна
                продовжити пізніше або почати новий.
              </p>
            </section>
          )}

          <section
            aria-label="Обмеження"
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              Обмеження
            </h2>
            <dl className="mt-3 grid gap-2.5">
              {[
                {
                  label: 'Розмір файлу',
                  value:
                    file === null
                      ? `до ${String(Math.round(capabilities.limits.maxBytes / (1024 * 1024)))} MiB`
                      : `${fileSize(file.size)} / ${String(Math.round(capabilities.limits.maxBytes / (1024 * 1024)))} MiB`,
                },
                {
                  label: 'Рядків',
                  value: `${count(status.rowCount)} / ${count(capabilities.limits.maxRows)}`,
                },
                {
                  label: 'Колонок',
                  value:
                    capabilities.limits.maxColumns === undefined
                      ? count(columns.length)
                      : `${count(columns.length)} / ${count(capabilities.limits.maxColumns)}`,
                },
              ].map((limit) => (
                <div
                  className="flex items-baseline justify-between gap-4"
                  key={limit.label}
                >
                  <dt className="text-app-muted text-[13px]">{limit.label}</dt>
                  <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                    {limit.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="grid gap-2.5">
            <Button
              disabled={busy || columns.length === 0}
              onClick={onContinue}
              variant="primary"
            >
              Налаштувати імпорт
            </Button>
            <p className="text-app-dim text-[13px] leading-5 text-pretty">
              На наступному кроці ви вкажете, що означає кожна колонка. Дані ще
              не створюються.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
