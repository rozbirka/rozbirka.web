import { useMemo, useState } from 'react'
import { Button, DataTable, EmptyState, StatusPill } from '@/components/app'
import { cn } from '@/lib/utils'
import type { StatusTone } from '@/components/app'
import type { ImportCapabilities, ImportStatus } from '@/api/part-imports'
import { issueText, statusLabels } from './import-model'

/** The seven states the history chip can take, and the tone each one reads in. */
const TONES: Record<string, StatusTone> = {
  Uploading: 'warn',
  Uploaded: 'warn',
  Analyzing: 'warn',
  NeedsReview: 'warn',
  Ready: 'warn',
  Queued: 'info',
  Running: 'info',
  CancelRequested: 'info',
  Completed: 'ok',
  CompletedWithErrors: 'warn',
  Cancelled: 'neutral',
  Failed: 'danger',
  Expired: 'neutral',
}

const UNFINISHED = new Set(['Uploaded', 'Analyzing', 'NeedsReview', 'Ready'])

const SEGMENTS = [
  { key: 'all', label: 'Усі', match: () => true },
  {
    key: 'attention',
    label: 'Потребують дії',
    match: (row: ImportStatus) =>
      UNFINISHED.has(row.status) ||
      row.status === 'CompletedWithErrors' ||
      row.status === 'Failed',
  },
  {
    key: 'done',
    label: 'Завершені',
    match: (row: ImportStatus) => row.status === 'Completed',
  },
  {
    key: 'stopped',
    label: 'Скасовані',
    match: (row: ImportStatus) =>
      row.status === 'Cancelled' || row.status === 'Expired',
  },
] as const

const day = (value: string) =>
  new Date(value).toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

const dayAndTime = (value: string) =>
  `${day(value)} · ${new Date(value).toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  })}`

const count = (value: number) =>
  // uk-UA groups thousands with a non-breaking space; a plain one wraps the
  // same and keeps the source free of invisible characters.
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')

/**
 * The second line of the identity column: what this import is waiting for, or
 * what became of it. The design puts the author here; the history endpoint
 * deliberately returns no author and no filename, so the line carries the
 * state instead of a name we would have to invent.
 */
function line(row: ImportStatus) {
  const stage =
    row.status === 'Failed'
      ? row.errorCode
        ? issueText(row.errorCode)
        : 'файл не прочитано'
      : row.status === 'Expired'
        ? 'строк доступності минув'
        : row.status === 'Cancelled'
          ? 'зупинено'
          : row.status === 'NeedsReview'
            ? 'колонки зіставлені, дані не перевірені'
            : row.status === 'Ready'
              ? 'готовий до запуску'
              : (statusLabels[row.status] ?? row.status).toLowerCase()
  const until =
    row.retentionExpiresAt !== null && row.status !== 'Expired'
      ? ` · доступний до ${day(row.retentionExpiresAt)}`
      : ''
  return `${stage}${until}`
}

const actionLabel = (row: ImportStatus) =>
  UNFINISHED.has(row.status)
    ? 'Продовжити'
    : row.status === 'Failed' || row.status === 'Expired'
      ? 'Деталі'
      : 'Результат'

function Kpi({
  label,
  value,
  unit,
  meta,
  tone,
  unavailable,
}: {
  label: string
  value: string
  unit?: string
  meta: string
  tone?: 'plain' | 'warn'
  /** Why the figure is missing. Set means the tile shows a dash and says why. */
  unavailable?: string
}) {
  return (
    <div className="bg-app-raised px-6 pt-5.5 pb-6">
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="mt-3.5 flex items-baseline gap-2">
        <span
          className={cn(
            'text-[30px] leading-none font-extrabold tracking-[-0.03em]',
            unavailable !== undefined
              ? 'text-app-dim'
              : tone === 'warn'
                ? 'text-state-warn'
                : 'text-app-ink',
          )}
          {...(unavailable === undefined ? {} : { title: unavailable })}
        >
          {unavailable === undefined ? value : '—'}
        </span>
        {unit === undefined || unavailable !== undefined ? null : (
          <span className="text-app-muted font-mono text-[13px] font-medium">
            {unit}
          </span>
        )}
      </p>
      <p className="text-app-dim mt-3.5 text-[13px]">{unavailable ?? meta}</p>
    </div>
  )
}

/**
 * Історія імпортів — the screen someone lands on to start a new import or to
 * come back to one they left. Figures first, then the one import that still
 * wants something, then the list.
 */
export function ImportHistory({
  capabilities,
  imports,
  total,
  page,
  onPage,
  onOpen,
}: {
  capabilities: ImportCapabilities
  imports: readonly ImportStatus[]
  total: number
  page: number
  onPage: (page: number) => void
  onOpen: (id: string) => void
}) {
  const [segment, setSegment] = useState<string>('all')
  const active = SEGMENTS.find((s) => s.key === segment) ?? SEGMENTS[0]
  const rows = useMemo(
    () => imports.filter((row) => active.match(row)),
    [active, imports],
  )
  const unfinished = imports.find((row) => UNFINISHED.has(row.status))

  const thisMonth = useMemo(() => {
    const now = new Date()
    return imports.filter((row) => {
      const at = new Date(row.createdAt)
      return (
        at.getMonth() === now.getMonth() &&
        at.getFullYear() === now.getFullYear()
      )
    }).length
  }, [imports])

  // The history endpoint returns no execution for a row — it deliberately
  // carries only the import's own state. So the two figures that count created
  // parts and failed rows have nothing to add up, and say so instead of
  // showing a zero that would read as "nothing went wrong".
  const noExecution =
    'Список імпортів не повертає підсумків виконання — вони на екрані самого імпорту.'

  return (
    <div className="min-w-0">
      <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-px overflow-hidden rounded-[20px] border">
        <Kpi
          label="Імпортів цього місяця"
          meta={
            unfinished === undefined
              ? `${count(total)} за весь час`
              : 'один у підготовці'
          }
          value={count(thisMonth)}
        />
        <Kpi
          label="Створено запчастин"
          meta=""
          unavailable={noExecution}
          value="—"
        />
        <Kpi
          label="Рядків з помилками"
          meta=""
          tone="warn"
          unavailable={noExecution}
          value="—"
        />
        <Kpi
          label="Ліміт файлу"
          meta={`до ${count(capabilities.limits.maxRows)} рядків · ${capabilities.formats.join(', ').toUpperCase()}`}
          unit="MiB"
          value={String(
            Math.round(capabilities.limits.maxBytes / (1024 * 1024)),
          )}
        />
      </div>

      {unfinished === undefined ? null : (
        <div className="border-state-warn/25 bg-state-warn-soft mt-3.5 flex flex-wrap items-center gap-4 rounded-[18px] border px-5.5 py-4.5">
          <div className="min-w-[240px] flex-[1_1_320px]">
            <p className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="bg-state-warn size-1.75 rounded-full"
              />
              <span className="text-state-warn text-[15px] font-bold">
                Один імпорт незавершений
              </span>
            </p>
            <p className="text-app-muted mt-1.5 text-[14px] leading-6 text-pretty">
              {unfinished.id.slice(0, 8)} — {line(unfinished)}.
            </p>
          </div>
          <Button onClick={() => onOpen(unfinished.id)} variant="primary">
            Продовжити підготовку
          </Button>
        </div>
      )}

      <div className="mt-9 flex flex-wrap items-center justify-between gap-5">
        <div
          aria-label="Групи імпортів"
          className="border-app-line bg-app-raised flex max-w-full flex-wrap gap-1 rounded-[12px] border p-1"
          role="group"
        >
          {SEGMENTS.map((option) => {
            const on = option.key === segment
            const shown = imports.filter((row) => option.match(row)).length
            return (
              <button
                aria-pressed={on}
                className={cn(
                  'focus-visible:outline-brand inline-flex min-h-11 items-center gap-2 rounded-[9px] px-3.5 text-[13px] font-bold whitespace-nowrap transition-colors',
                  on
                    ? 'text-app-ink bg-white/[0.08]'
                    : 'text-app-muted hover:text-app-ink',
                )}
                key={option.key}
                onClick={() => setSegment(option.key)}
                type="button"
              >
                {option.label}{' '}
                <span
                  className={cn(
                    'font-mono text-[11px] font-medium',
                    on ? 'text-app-muted' : 'text-app-dim',
                  )}
                >
                  {shown}
                </span>
              </button>
            )
          })}
        </div>
        <p className="text-app-dim text-[13px]">
          Показано {rows.length} з {imports.length} на цій сторінці
          {total > imports.length ? ` · ${count(total)} усього` : ''}
        </p>
      </div>

      <div className="mt-4.5">
        <DataTable
          caption="Історія імпортів"
          columns={[
            {
              key: 'id',
              label: 'Номер',
              variant: 'primary',
              cell: (row) => (
                <span className="text-app-muted font-mono text-[14px]">
                  {row.id.slice(0, 8)}
                </span>
              ),
            },
            {
              key: 'when',
              label: 'Дата й стан',
              cell: (row) => (
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-app-ink truncate text-[15px] font-bold tracking-[-0.01em]">
                    {dayAndTime(row.createdAt)}
                  </span>
                  <span className="text-app-muted truncate text-[13px]">
                    {line(row)}
                  </span>
                </span>
              ),
            },
            {
              key: 'rows',
              label: 'Рядків',
              align: 'end',
              cell: (row) => (
                <span className="font-mono text-[14px]">
                  {row.rowCount > 0 ? count(row.rowCount) : '—'}
                </span>
              ),
            },
            {
              key: 'created',
              label: 'Створено',
              align: 'end',
              cell: () => (
                <span
                  className="text-app-dim font-mono text-[14px]"
                  title={noExecution}
                >
                  —
                </span>
              ),
            },
            {
              key: 'failed',
              label: 'Помилки',
              align: 'end',
              cell: () => (
                <span
                  className="text-app-dim font-mono text-[14px]"
                  title={noExecution}
                >
                  —
                </span>
              ),
            },
            {
              key: 'status',
              label: 'Статус',
              align: 'end',
              cell: (row) => (
                <StatusPill tone={TONES[row.status] ?? 'neutral'}>
                  {statusLabels[row.status] ?? row.status}
                </StatusPill>
              ),
            },
            {
              key: 'action',
              label: 'Дія',
              align: 'end',
              cell: (row) => (
                <Button onClick={() => onOpen(row.id)}>
                  {actionLabel(row)}
                </Button>
              ),
            },
          ]}
          empty={
            <EmptyState
              description={
                imports.length === 0
                  ? 'Завантажте таблицю CSV або XLSX — і залишки з неї стануть позиціями складу.'
                  : 'У цій групі порожньо. Виберіть іншу або подивіться всі.'
              }
              title={
                imports.length === 0 ? 'Імпортів ще немає' : 'Тут поки порожньо'
              }
            />
          }
          footer={
            <div className="border-app-line flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4">
              <p className="text-app-dim text-[13px]">
                Деталі й вихідний файл доступні, поки не мине строк зберігання
                імпорту
              </p>
              <span className="flex items-center gap-2.5">
                <Button disabled={page === 1} onClick={() => onPage(page - 1)}>
                  Назад
                </Button>
                <span className="text-app-muted font-mono text-[13px] tabular-nums">
                  {page}
                </span>
                <Button
                  disabled={page * 50 >= total}
                  onClick={() => onPage(page + 1)}
                >
                  Показати ще
                </Button>
              </span>
            </div>
          }
          rowKey={(row) => row.id}
          rows={rows}
        />
      </div>

      <p className="text-app-dim mt-3 text-[13px] leading-6">
        Колонки «Створено» і «Помилки» порожні не випадково: список імпортів
        навмисно не віддає ні підсумків виконання, ні автора, ні назви файлу. Ці
        числа є на екрані самого імпорту.
      </p>
    </div>
  )
}
