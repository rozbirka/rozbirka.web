import { Upload } from 'lucide-react'
import {
  Button,
  Card,
  FactRows,
  Field,
  Notice,
  SelectInput,
  StatusPill,
  TextInput,
} from '@/components/app'
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

/** One of the choices in "Як читати файл": a `.rz-seg` toggle. */
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
      onClick={onPick}
      type="button"
    >
      {children}
    </button>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <p className="rz-caption m-0">{label}</p>
      <p className="text-app-strong m-0 font-mono text-title tabular-nums">
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
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="rz-card min-w-0">
          <div className="rz-card__body grid gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span aria-hidden className="rz-code">
                {format}
              </span>
              <div className="min-w-0 flex-[1_1_200px]">
                <p className="text-app-strong m-0 font-semibold break-words">
                  {file?.name ?? t('importFile')}
                </p>
                <p className="text-app-muted m-0 mt-0.5">
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
              className="rz-meter w-full"
              role="progressbar"
            >
              <span
                className="transition-[width] duration-300"
                style={{ width: `${String(transferPercent)}%` }}
              />
            </div>
            <ol className="m-0 grid list-none gap-2 p-0">
              {transferSteps.map((one) => (
                <li
                  className="flex items-center gap-3"
                  data-state={one.state === 'done' ? 'done' : undefined}
                  key={one.label}
                >
                  <span aria-hidden className="rz-steps__n">
                    {one.state === 'done' ? '✓' : ''}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 font-medium',
                      one.state === 'waiting'
                        ? 'text-app-dim'
                        : 'text-app-strong',
                    )}
                  >
                    {one.label}
                  </span>
                  <StatusPill
                    tone={
                      one.state === 'done'
                        ? 'ok'
                        : one.state === 'running'
                          ? 'info'
                          : 'neutral'
                    }
                  >
                    {one.note}
                  </StatusPill>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <Card className="min-w-0" title={t('meanwhile')}>
          <p className="text-app-muted m-0 text-pretty">
            {transfer.loaded < transfer.total
              ? t('meanwhileSending')
              : t('meanwhileReading')}
          </p>
        </Card>
      </div>
    )

  const limitsCard = (rows: { label: string; value: string }[]) => (
    <Card className="min-w-0" title={t('limits')}>
      <FactRows
        className="py-0"
        rows={rows.map((row) => ({
          label: row.label,
          value: <span className="font-mono tabular-nums">{row.value}</span>,
        }))}
      />
    </Card>
  )

  if (status === null || source === null)
    return (
      <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-2">
          <label
            className={cn(
              'rz-state border-app-line-2 bg-app-inset focus-within:border-brand relative cursor-pointer rounded-panel border border-dashed transition-colors',
              busy ? 'cursor-not-allowed opacity-55' : 'hover:bg-app-hover',
            )}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              if (!busy) onChooseFile(event.dataTransfer.files[0])
            }}
          >
            <span aria-hidden className="rz-state__icon">
              <Upload />
            </span>
            <strong className="rz-state__title">
              {/* Only the formats are shouted; the word between them is not. */}
              {t('dropFile', {
                formats: capabilities.formats
                  .map((one) => one.toUpperCase())
                  .join(t('formatsOr')),
              })}
            </strong>
            <span className="rz-state__body">
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
            <span className="rz-btn rz-btn--primary mt-1">
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
            <p className="text-app-muted m-0">
              {t('picked', { name: file.name, size: size(file.size) })}
            </p>
          )}
        </div>
        {limitsCard([
          {
            label: t('formats'),
            value: capabilities.formats
              .map((one) => one.toUpperCase())
              .join(', '),
          },
          { label: t('size'), value: t('upToMiB', { size: maxMiB }) },
          {
            label: maxColumns === undefined ? t('rows') : t('rowsAndColumns'),
            value: `${count(capabilities.limits.maxRows)}${
              maxColumns === undefined ? '' : ` / ${count(maxColumns)}`
            }`,
          },
        ])}
      </div>
    )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="rz-card">
        <div className="rz-card__body flex flex-wrap items-center gap-4">
          <span aria-hidden className="rz-code">
            {format}
          </span>
          <div className="min-w-0 flex-[1_1_260px]">
            <p className="text-app-strong m-0 font-semibold break-words">
              {file?.name ?? t('importFile')}
            </p>
            <p className="text-app-muted m-0 mt-0.5">
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
      </div>

      {trouble === null ? null : (
        <Notice
          action={
            trouble.fix === null ? undefined : (
              <Button disabled={busy} onClick={trouble.fix.run}>
                {trouble.fix.label}
              </Button>
            )
          }
          block
          role={trouble.tone === 'danger' ? 'alert' : 'status'}
          tone={trouble.tone}
        >
          <p className="text-app-strong m-0 font-semibold">{trouble.title}</p>
          <p className="text-app-muted m-0 mt-0.5 text-pretty">
            {trouble.body}
          </p>
        </Notice>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <Card
          aside={
            <p
              className={cn(
                'm-0 text-caption',
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
          }
          bodyClassName="p-0"
          className="min-w-0 flex-[1_1_420px]"
          title={t('whatWasRead')}
        >
          <div className="rz-table-scroll">
            <table className="rz-table">
              <caption>{t('firstRowsCaption')}</caption>
              <thead>
                <tr>
                  <th className="w-12" scope="col">
                    {t('rowNumber')}
                  </th>
                  {columns.map((column) => (
                    <th key={column.id} scope="col">
                      {column.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.rowId}>
                    <th className="text-app-dim font-mono" scope="row">
                      {row.sourceRow}
                    </th>
                    {columns.map((column) => (
                      <td className="whitespace-nowrap" key={column.id}>
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
          <p className="rz-caption border-app-line m-0 border-t px-3 py-2.5">
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
        </Card>

        <div className="grid max-w-full min-w-0 flex-[1_1_280px] gap-4 lg:max-w-[380px]">
          <section aria-label={t('howToRead')} className="rz-card">
            <button
              aria-expanded={settingsOpen}
              className="rz-card__head w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left"
              onClick={onToggleSettings}
              type="button"
            >
              <span className="rz-h-card">{t('howToRead')}</span>
              <span className="text-brand-text font-medium">
                {settingsOpen ? t('collapse') : t('change')}
              </span>
            </button>
            <div className="rz-card__body grid gap-3">
              <p className="text-app-muted m-0 text-pretty">
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
                <Notice key={warning} tone="warn">
                  {issueText(warning, locale)}
                </Notice>
              ))}

              {settingsOpen ? (
                <div className="grid gap-3">
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

                  <div className="rz-field">
                    <p className="rz-label m-0">{t('delimiter')}</p>
                    <div className="rz-seg max-w-full flex-wrap">
                      {DELIMITERS.map((option) => (
                        <Pick
                          active={selection.delimiter === option.value}
                          key={option.value}
                          label={t('delimiterOption', {
                            label: t(option.label),
                          })}
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

                  <div className="rz-field">
                    <p className="rz-label m-0">{t('encoding')}</p>
                    <div className="rz-seg max-w-full flex-wrap">
                      {capabilities.encodings.map((encoding) => (
                        <Pick
                          active={selection.encoding === encoding}
                          key={encoding}
                          label={t('encodingOption', { encoding })}
                          onPick={() =>
                            onSelection((current) => ({
                              ...current,
                              encoding,
                            }))
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
                    <label className="rz-choice text-app-muted h-auto min-h-control px-0">
                      <input
                        checked={selection.acceptHiddenRows ?? false}
                        className="rz-check"
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
                    <label className="rz-choice text-app-muted h-auto min-h-control px-0">
                      <input
                        checked={selection.acceptHiddenColumns ?? false}
                        className="rz-check"
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
                    <div className="rz-btn-row">
                      <Button disabled={busy} onClick={() => onReanalyze()}>
                        {t('reread')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          {trouble === null ? null : (
            <Card title={t('tryThis')}>
              <div className="grid gap-3">
                <ul className="m-0 grid list-none gap-3 p-0">
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
                      <p className="text-app-strong m-0 font-semibold">
                        {fix.title}
                      </p>
                      <p className="text-app-muted m-0 mt-0.5 text-pretty">
                        {fix.hint}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="rz-btn-row">
                  {editable ? (
                    <Button disabled={busy} onClick={onToggleSettings}>
                      {t('changeReadSettings')}
                    </Button>
                  ) : null}
                  <Button
                    disabled={busy}
                    onClick={() => onChooseFile(undefined)}
                  >
                    {t('chooseAnotherFile')}
                  </Button>
                </div>
                <p className="rz-caption m-0 text-pretty">
                  {t('nothingCreated')}
                </p>
              </div>
            </Card>
          )}

          {limitsCard([
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
          ])}

          <div className="grid gap-2">
            <Button
              disabled={busy || columns.length === 0}
              onClick={onContinue}
              variant="primary"
            >
              {t('configureImport')}
            </Button>
            <p className="rz-caption m-0 text-pretty">{t('nextStepHint')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
