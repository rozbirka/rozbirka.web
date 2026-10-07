import { Upload } from 'lucide-react'
import { Button, Field, Notice, SelectInput, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'
import {
  commonMessages,
  formatDateTime,
  useLocale,
  useT,
  type Locale,
} from '@/i18n'
import type { ReactNode } from 'react'
import type {
  ImportCapabilities,
  ImportRow,
  ImportSelection,
  ImportStatus,
} from '@/api/part-imports'
import { importFileMessages } from './import-file-messages'
import { formatCount, issueText, looksMisdecoded } from './import-model'
import { useImportT } from './use-import-text'

const DELIMITERS = [
  { value: ',', label: 'delimiterComma' },
  { value: ';', label: 'delimiterSemicolon' },
  { value: '\t', label: 'delimiterTab' },
  { value: '|', label: 'delimiterPipe' },
] as const

const oneDecimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 }

/** Binary units, as the server limits are stated; the decimal follows the locale. */
const fileSize = (bytes: number, locale: Locale) =>
  bytes < 1024
    ? `${String(bytes)} B`
    : bytes < 1024 * 1024
      ? `${formatCount(bytes / 1024, locale, oneDecimal)} KiB`
      : `${formatCount(bytes / (1024 * 1024), locale, oneDecimal)} MiB`

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
  onCancelTransfer,
  transfer,
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
  /** Stops the upload in flight. */
  onCancelTransfer?: () => void
  /** Bytes on the wire, while the file is being sent. */
  transfer?: { loaded: number; total: number } | null
}) {
  const { locale, timeZone } = useLocale()
  const t = useImportT(importFileMessages)
  const tc = useT(commonMessages)
  const count = (value: number) => formatCount(value, locale)
  const size = (bytes: number) => fileSize(bytes, locale)
  const delimiterLabel = (value: string) => {
    const option = DELIMITERS.find((one) => one.value === value)
    return option === undefined ? null : t(option.label)
  }
  const source = status === null ? null : status.source
  // Empty collections come back missing, not empty, so every one of them is
  // read through a default before anything maps over it.
  const columns = source?.fields ?? []
  const warnings = source?.warnings ?? []
  const tables = source?.tables ?? []
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
        title: t('readFailedTitle'),
        body:
          status.errorCode === null
            ? t('readFailedBody')
            : issueText(status.errorCode, locale),
        fix: null,
      }
    : brokenColumns.length > 0
      ? {
          tone: 'warn',
          title: t('encodingTitle'),
          body:
            brokenColumns.length === 1
              ? t('encodingBodyOne', {
                  encoding: selection.encoding.toUpperCase(),
                  column: brokenColumns[0]!.header,
                })
              : t('encodingBodyMany', {
                  encoding: selection.encoding.toUpperCase(),
                  columns: brokenColumns
                    .map((column) => t('quotedColumn', { name: column.header }))
                    .join(', '),
                }),
          fix:
            otherEncoding === undefined || !editable
              ? null
              : {
                  label: t('readAs', {
                    encoding: otherEncoding.toUpperCase(),
                  }),
                  run: () => {
                    const next = { ...selection, encoding: otherEncoding }
                    onSelection(() => next)
                    onReanalyze(next)
                  },
                },
        }
      : null

  const maxMiB = String(
    Math.round(capabilities.limits.maxBytes / (1024 * 1024)),
  )
  const maxColumns = capabilities.limits.maxColumns
  const sending = transfer != null && transfer.loaded < transfer.total
  const transferPercent =
    transfer == null || transfer.total === 0
      ? 0
      : Math.min(100, Math.round((transfer.loaded / transfer.total) * 100))
  // The three things that happen between picking a file and seeing its rows.
  // Each is a state the screen is already in, not a guess at the server.
  const transferSteps = [
    {
      label: t('transferStep'),
      state: sending ? 'running' : 'done',
      note: sending ? `${String(transferPercent)}%` : t('done'),
    },
    {
      label: t('structureStep'),
      state: sending ? 'waiting' : 'running',
      note: sending ? t('waiting') : t('inProgress'),
    },
    { label: t('previewStep'), state: 'waiting', note: t('waiting') },
  ] as const

  if (transfer != null)
    return (
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="border-app-line bg-app-raised grid min-w-0 gap-4 rounded-[18px] border px-5.5 py-5">
          <div className="flex flex-wrap items-center gap-4">
            <span
              aria-hidden
              className="bg-state-info-soft text-state-info inline-flex size-10.5 flex-none items-center justify-center rounded-[11px] font-mono text-[11px] font-medium"
            >
              {format}
            </span>
            <div className="min-w-0 flex-[1_1_200px]">
              <p className="text-app-ink text-[16px] font-bold tracking-[-0.01em]">
                {file?.name ?? t('importFile')}
              </p>
              <p className="text-app-muted mt-1 text-[13px]">
                {size(transfer.total)} ·{' '}
                {transfer.loaded < transfer.total
                  ? t('transferred', { size: size(transfer.loaded) })
                  : t('transferredFully')}
              </p>
            </div>
            {onCancelTransfer === undefined ? null : (
              <Button onClick={onCancelTransfer}>{tc('cancel')}</Button>
            )}
          </div>
          <div
            aria-label={t('transferStep')}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={transferPercent}
            className="bg-app-input h-2 w-full overflow-hidden rounded-full"
            role="progressbar"
          >
            <div
              className="bg-state-info h-full transition-[width] duration-300"
              style={{ width: `${String(transferPercent)}%` }}
            />
          </div>
          <ol className="grid gap-3.5">
            {transferSteps.map((one) => (
              <li className="flex items-center gap-3" key={one.label}>
                <span
                  aria-hidden
                  className={cn(
                    'inline-flex size-6 flex-none items-center justify-center rounded-full text-[12px] font-bold',
                    one.state === 'done' && 'bg-state-ok-soft text-state-ok',
                    one.state === 'running' && 'bg-state-info text-app-canvas',
                    one.state === 'waiting' && 'border-app-line-2 border',
                  )}
                >
                  {one.state === 'done' ? '✓' : ''}
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 text-[14.5px] font-semibold',
                    one.state === 'waiting' ? 'text-app-dim' : 'text-app-ink',
                  )}
                >
                  {one.label}
                </span>
                <span className="text-app-muted font-mono text-[12.5px]">
                  {one.note}
                </span>
              </li>
            ))}
          </ol>
        </div>
        <section className="border-app-line bg-app-raised min-w-0 rounded-[18px] border px-5 py-4.5">
          <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
            {t('meanwhile')}
          </h2>
          <p className="text-app-muted mt-3 text-[13.5px] leading-6 text-pretty">
            {transfer.loaded < transfer.total
              ? t('meanwhileSending')
              : t('meanwhileReading')}
          </p>
        </section>
      </div>
    )

  if (status === null || source === null)
    return (
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-4">
          <label
            className={cn(
              'border-app-line-2 bg-app-input focus-within:border-brand relative grid cursor-pointer justify-items-center gap-3 rounded-[18px] border border-dashed px-6 py-14 text-center transition-colors',
              busy
                ? 'cursor-not-allowed opacity-55'
                : 'hover:border-app-line-2',
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (!busy) onChooseFile(event.dataTransfer.files[0])
            }}
          >
            <span
              aria-hidden
              className="border-app-line text-app-muted inline-flex size-12 items-center justify-center rounded-[14px] border"
            >
              <Upload className="size-5" />
            </span>
            <strong className="text-app-ink text-[16px] font-bold tracking-[-0.01em]">
              {/* Only the formats are shouted; the word between them is not. */}
              {t('dropFile', {
                formats: capabilities.formats
                  .map((one) => one.toUpperCase())
                  .join(t('formatsOr')),
              })}
            </strong>
            <span className="text-app-muted text-[13.5px]">
              {maxColumns === undefined
                ? t('dropLimits', {
                    size: maxMiB,
                    rows: count(capabilities.limits.maxRows),
                  })
                : t('dropLimitsColumns', {
                    size: maxMiB,
                    rows: count(capabilities.limits.maxRows),
                    columns: count(maxColumns),
                  })}
            </span>
            <span className="bg-brand text-brand-foreground mt-1 inline-flex min-h-11 items-center rounded-[12px] px-5 text-[14px] font-bold">
              {file === null ? t('chooseFile') : t('chooseAnotherFile')}
            </span>
            {/* The real control covers the whole zone: invisible, but focusable
              and a target the size of the drop area rather than of a word. */}
            <input
              accept={capabilities.formats.map((one) => `.${one}`).join(',')}
              aria-label={t('importFile')}
              className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
              disabled={busy}
              onChange={(event) => onChooseFile(event.target.files?.[0])}
              type="file"
            />
          </label>
          {file === null ? null : (
            <p className="text-app-muted text-sm">
              {t('picked', { name: file.name, size: size(file.size) })}
            </p>
          )}
        </div>
        <section className="border-app-line bg-app-raised min-w-0 rounded-[18px] border px-5 py-4.5">
          <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
            {t('limits')}
          </h2>
          <dl className="mt-3.5 grid gap-2.5 text-[13.5px]">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">{t('formats')}</dt>
              <dd className="text-app-ink font-mono">
                {capabilities.formats
                  .map((one) => one.toUpperCase())
                  .join(', ')}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">{t('size')}</dt>
              <dd className="text-app-ink font-mono">
                {t('upToMiB', { size: maxMiB })}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-app-muted">
                {maxColumns === undefined ? t('rows') : t('rowsAndColumns')}
              </dt>
              <dd className="text-app-ink font-mono tabular-nums">
                {count(capabilities.limits.maxRows)}
                {maxColumns === undefined ? '' : ` / ${count(maxColumns)}`}
              </dd>
            </div>
          </dl>
        </section>
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
            {file?.name ?? t('importFile')}
          </p>
          <p className="text-app-muted mt-1 text-[13px]">
            {file === null
              ? t('nameUnknown')
              : t('readDone', { size: size(file.size) })}
            {' · '}
            {formatDateTime(status.createdAt, locale, timeZone)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Figure label={t('dataRows')} value={count(status.rowCount)} />
          <Figure label={t('columns')} value={count(columns.length)} />
          {editable ? (
            <Button disabled={busy} onClick={() => onChooseFile(undefined)}>
              {t('otherFile')}
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
          aria-label={t('whatWasRead')}
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_420px] overflow-hidden rounded-[20px] border"
        >
          <div className="border-app-line flex flex-wrap items-baseline justify-between gap-3 border-b px-5.5 py-4">
            <h2 className="text-app-ink text-[15px] font-bold">
              {t('whatWasRead')}
            </h2>
            <p
              className={cn(
                'text-[13px]',
                brokenColumns.length > 0 ? 'text-state-warn' : 'text-app-dim',
              )}
            >
              {brokenColumns.length > 0
                ? t('unreadableColumns', {
                    count: columns.length,
                    broken: count(brokenColumns.length),
                  })
                : selection.headerRow == null
                  ? t('noHeaders')
                  : t('headerRowUsed', { row: String(selection.headerRow) })}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">{t('firstRowsCaption')}</caption>
              <thead>
                <tr>
                  <th className="text-app-muted border-app-line w-12 border-b px-5.5 py-2.5 text-left font-mono text-[10px] tracking-[0.14em] uppercase">
                    {t('rowNumber')}
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
              ? t('numbersFine')
              : status.rowCount <= preview.length
                ? t('shownAll', { count: count(status.rowCount) })
                : t('shownFirst', {
                    shown: count(preview.length),
                    count: count(status.rowCount),
                  })}
          </p>
        </section>

        <div className="grid min-w-0 flex-[0_1_340px] gap-4 sm:min-w-[260px]">
          <section
            aria-label={t('howToRead')}
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <button
              aria-expanded={settingsOpen}
              className="focus-visible:outline-brand flex min-h-11 w-full items-center justify-between gap-3"
              onClick={onToggleSettings}
              type="button"
            >
              <span className="text-app-ink text-[15px] font-bold">
                {t('howToRead')}
              </span>
              <span className="text-brand text-[13px] font-bold">
                {settingsOpen ? t('collapse') : t('change')}
              </span>
            </button>
            <p className="text-app-muted mt-1.5 text-[13px] leading-5 text-pretty">
              {settingsOpen
                ? t('rereadWarning')
                : t('readSummary', {
                    delimiter:
                      delimiterLabel(selection.delimiter)?.toLocaleLowerCase(
                        locale,
                      ) ?? selection.delimiter,
                    encoding: selection.encoding,
                    headers:
                      selection.headerRow == null
                        ? t('withoutHeaders')
                        : t('headersInRow', {
                            row: String(selection.headerRow),
                          }),
                  })}
            </p>

            {warnings.map((warning) => (
              <Notice className="mt-3" key={warning} tone="warn">
                {issueText(warning, locale)}
              </Notice>
            ))}

            {settingsOpen ? (
              <div className="mt-4 grid gap-3.5">
                {tables.length > 0 ? (
                  <Field label={t('sheet')}>
                    <SelectInput
                      onChange={(event) =>
                        onSelection((current) => ({
                          ...current,
                          sheet: event.target.value,
                        }))
                      }
                      value={selection.sheet ?? ''}
                    >
                      <option value="">{t('chooseSheet')}</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                ) : null}

                <div>
                  <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    {t('delimiter')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {DELIMITERS.map((option) => (
                      <Pick
                        active={selection.delimiter === option.value}
                        key={option.value}
                        label={t('delimiterOption', { label: t(option.label) })}
                        onPick={() =>
                          onSelection((current) => ({
                            ...current,
                            delimiter: option.value,
                          }))
                        }
                      >
                        {t(option.label)}
                      </Pick>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                    {t('encoding')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {capabilities.encodings.map((encoding) => (
                      <Pick
                        active={selection.encoding === encoding}
                        key={encoding}
                        label={t('encodingOption', { encoding })}
                        onPick={() =>
                          onSelection((current) => ({ ...current, encoding }))
                        }
                      >
                        {encoding.toUpperCase()}
                      </Pick>
                    ))}
                  </div>
                </div>

                <Field hint={t('headerRowHint')} label={t('headerRow')}>
                  <TextInput
                    type="number"
                    min={1}
                    step={1}
                    placeholder={t('noHeaderRow')}
                    onChange={(event) => {
                      const value = event.target.value
                      const headerRow = value === '' ? null : Number(value)
                      if (
                        headerRow !== null &&
                        (!Number.isSafeInteger(headerRow) || headerRow < 1)
                      )
                        return
                      onSelection((current) => ({
                        ...current,
                        headerRow,
                        startRow: headerRow === null ? 1 : headerRow + 1,
                      }))
                    }}
                    value={selection.headerRow ?? ''}
                  />
                </Field>

                {warnings.includes('HIDDEN_ROWS') ? (
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
                    {t('acceptHiddenRows')}
                  </label>
                ) : null}
                {warnings.includes('HIDDEN_COLUMNS') ? (
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
                    {t('acceptHiddenColumns')}
                  </label>
                ) : null}

                {editable ? (
                  <Button disabled={busy} onClick={() => onReanalyze()}>
                    {t('reread')}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </section>

          {trouble === null ? null : (
            <section
              aria-label={t('tryThis')}
              className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
            >
              <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {t('tryThis')}
              </h2>
              <ul className="mt-3.5 grid gap-3.5">
                {[
                  {
                    title:
                      otherEncoding === undefined
                        ? t('otherEncoding')
                        : t('encodingNamed', {
                            encoding: otherEncoding.toUpperCase(),
                          }),
                    hint: t('encodingHint'),
                  },
                  {
                    title: t('saveAsCsv'),
                    hint: t('saveAsCsvHint'),
                  },
                  {
                    title: t('uploadXlsx'),
                    hint: t('uploadXlsxHint'),
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
                    {t('changeReadSettings')}
                  </Button>
                ) : null}
                <Button disabled={busy} onClick={() => onChooseFile(undefined)}>
                  {t('chooseAnotherFile')}
                </Button>
              </div>
              <p className="text-app-dim mt-4 text-[13px] leading-5 text-pretty">
                {t('nothingCreated')}
              </p>
            </section>
          )}

          <section
            aria-label={t('limits')}
            className="border-app-line bg-app-raised rounded-[18px] border px-5 py-4.5"
          >
            <h2 className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
              {t('limits')}
            </h2>
            <dl className="mt-3 grid gap-2.5">
              {[
                {
                  label: t('fileSize'),
                  value:
                    file === null
                      ? t('upToMiB', { size: maxMiB })
                      : t('ofMiB', { size: size(file.size), max: maxMiB }),
                },
                {
                  label: t('rows'),
                  value: `${count(status.rowCount)} / ${count(capabilities.limits.maxRows)}`,
                },
                {
                  label: t('columns'),
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
              {t('configureImport')}
            </Button>
            <p className="text-app-dim text-[13px] leading-5 text-pretty">
              {t('nextStepHint')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
