import { Link } from 'react-router'
import { Button } from '@/components/app'
import { cn, plural } from '@/lib/utils'
import type { ImportRow, ImportStatus } from '@/api/part-imports'
import { issueText, statusLabels } from './import-model'

const PAGE_SIZE = 100

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')

/** Parts are priced in dollars, like the cars they come off. */
const money = (amount: number) =>
  new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'USD',
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
  }).format(amount)

const moment = (value: string | null) => {
  if (value === null) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
}

const day = (value: string | null) => {
  if (value === null) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf())
    ? value
    : parsed.toLocaleDateString('uk-UA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
}

/**
 * The execution never reports how long it ran, who started it or what the
 * uploaded file was called — so those cells say so instead of guessing.
 */
const NO_TIMING = 'Час початку й завершення виконання не показується.'
const NO_TOTALS =
  'Після запуску відомі лише кількість створених і невдалих рядків — решта сутностей за типом не розбивається.'
const NO_FILE_NAME =
  'Після перезавантаження сторінки назва файлу вже не показується.'

/** Rows the server will pick up again; everything else needs the file fixed. */
const RETRYABLE = ['Pending', 'RetryableFailure']

function Kpi({
  label,
  value,
  meta,
  tone,
  title,
}: {
  label: string
  value: string
  meta: string
  tone?: 'plain' | 'good' | 'warn' | 'dim'
  title?: string
}) {
  return (
    <div className="bg-app-raised px-6 pt-5.5 pb-6" title={title}>
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          'mt-3.5 text-[26px] leading-none font-extrabold tracking-[-0.03em]',
          tone === 'good' && 'text-state-ok',
          tone === 'warn' && 'text-state-warn',
          tone === 'dim' && 'text-app-dim',
          (tone === undefined || tone === 'plain') && 'text-app-ink',
        )}
      >
        {value}
      </p>
      <p className="text-app-dim mt-3.5 text-[13px] leading-5 text-pretty">
        {meta}
      </p>
    </div>
  )
}

function Strip({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-app-line border-app-line grid grid-cols-[repeat(auto-fit,minmax(min(100%,190px),1fr))] gap-px overflow-hidden rounded-[20px] border">
      {children}
    </div>
  )
}

function Panel({
  label,
  title,
  children,
  footer,
}: {
  label: string
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
    >
      <h2 className="text-app-ink border-app-line border-b px-5.5 py-4 text-[15px] font-bold">
        {title}
      </h2>
      {children}
      {footer === undefined ? null : (
        <p className="text-app-dim border-app-line border-t px-5.5 py-3.5 text-[13px] leading-5 text-pretty">
          {footer}
        </p>
      )}
    </section>
  )
}

/**
 * Крок 5 — what the import actually did. The same screen covers the work in
 * flight, the finished run, the partly failed run, the stopped run and the
 * record whose details have expired: they differ in what is true, not in where
 * things live.
 *
 * Every number here is either the server's own execution counter or a sum over
 * the rows currently loaded — and when it is the latter, the screen says so,
 * because a page holds a hundred rows and an import can hold ten thousand.
 */
export function ImportResultStep({
  status,
  rows,
  rowTotal,
  rowPage,
  onRowPage,
  fileName,
  partsHref,
  partHref,
  onCancel,
  onRetry,
  onReport,
  onRetryReport,
  onSource,
  onNewImport,
  busy,
}: {
  status: ImportStatus
  rows: readonly ImportRow[]
  rowTotal: number
  rowPage: number
  onRowPage: (page: number) => void
  /** Known only while the upload is still in this browser session. */
  fileName: string | null
  partsHref: string
  partHref: (partId: string) => string
  onCancel: () => void
  onRetry: () => void
  onReport: () => void
  onRetryReport: () => void
  onSource: () => void
  onNewImport: () => void
  busy: boolean
}) {
  const execution = status.execution
  const selected = execution?.selected ?? status.rowCount
  const committed = execution?.committed ?? 0
  const failed = execution?.failed ?? 0
  const queued = Math.max(0, selected - committed - failed)
  const expired = status.status === 'Expired'
  const running = ['Queued', 'Running', 'CancelRequested'].includes(
    status.status,
  )
  const stopped = status.status === 'Cancelled'
  const partial = failed > 0

  const created = rows.filter((row) => row.executionStatus === 'Committed')
  const broken = rows.filter((row) => row.executionErrorCode)
  const retryable = broken.filter((row) =>
    RETRYABLE.includes(row.executionStatus ?? ''),
  ).length
  // A page holds a hundred rows; the execution counters cover the whole import.
  // Anything summed from rows says so unless the page happens to hold them all.
  const allCreated = created.length >= committed
  const allBroken = broken.length >= failed
  const units = created.reduce((sum, row) => {
    const quantity = Number(row.draft?.values['Quantity'] ?? '')
    return sum + (Number.isFinite(quantity) ? quantity : 0)
  }, 0)
  const unitsMeta = expired
    ? 'деталізація вже недоступна'
    : `${count(units)} ${plural(units, ['одиниця товару', 'одиниці товару', 'одиниць товару'])}${allCreated ? '' : ' на цій сторінці'}`

  const reportReady = !expired && status.report?.status === 'Ready'
  const reportFailed = status.report?.status === 'Failed'

  const headline = expired
    ? 'Деталі цього імпорту вже недоступні'
    : running
      ? 'Створюємо запчастини'
      : stopped
        ? `Імпорт зупинено на ${count(committed)} позиції`
        : partial
          ? `${count(committed)} ${plural(committed, ['запчастина створена', 'запчастини створено', 'запчастин створено'])}, ${count(failed)} ${plural(failed, ['рядок не пройшов', 'рядки не пройшли', 'рядків не пройшли'])}`
          : `${count(committed)} ${plural(committed, ['запчастина створена', 'запчастини створено', 'запчастин створено'])}`

  const lede = expired
    ? `Файл, рядки й звіт зберігаються обмежений час. Створені запчастини залишаються в каталозі — вони не видаляються.`
    : running
      ? 'Сторінку можна закрити — робота продовжиться. Повернутися до неї можна з історії імпортів.'
      : stopped
        ? `Створені ${count(committed)} ${plural(committed, ['позиція залишається', 'позиції залишаються', 'позицій залишаються'])} в каталозі. Решта рядків не опрацьована.`
        : partial
          ? 'Створені позиції вже в каталозі й залишаться там. Рядки з тимчасовими помилками можна повторити — успішні не дублюватимуться.'
          : 'Позиції вже доступні для продажу.'

  return (
    <div className="flex min-w-0 flex-col gap-3.5">
      <section
        aria-label="Стан імпорту"
        className="border-app-line bg-app-raised rounded-[20px] border px-6 pt-6 pb-6 sm:px-8"
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-3 py-1 text-[12.5px] font-bold',
              running && 'border-brand/34 text-brand bg-brand/10',
              !running &&
                !expired &&
                !partial &&
                !stopped &&
                'border-state-ok/30 text-state-ok bg-state-ok/10',
              (partial || stopped) &&
                'border-state-warn/30 text-state-warn bg-state-warn-soft',
              expired && 'border-app-line text-app-dim',
            )}
          >
            {statusLabels[status.status] ?? status.status}
          </span>
          <span className="text-app-dim text-[13.5px]">
            Створено {moment(status.createdAt)}
          </span>
        </p>
        <h2 className="text-app-ink mt-4 text-[26px] leading-[1.12] font-extrabold tracking-[-0.03em] text-pretty sm:text-[32px]">
          {headline}
        </h2>
        <p className="text-app-muted mt-2.5 max-w-[68ch] text-[14.5px] leading-6 text-pretty">
          {lede}
        </p>

        {running ? (
          <div className="mt-6">
            <p className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-[40px] leading-none font-extrabold tracking-[-0.03em] text-white">
                {count(committed)}
              </span>
              <span className="text-app-muted text-[15px] font-bold">
                із {count(selected)} створено
              </span>
            </p>
            <progress
              aria-label="Поступ імпорту"
              className="mt-4 h-2 w-full"
              max={Math.max(1, selected)}
              value={committed}
            />
            <p className="text-app-dim mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              <span>{count(committed)} створено</span>
              <span className={cn(failed > 0 && 'text-state-warn')}>
                {count(failed)} з помилкою
              </span>
              <span>{count(queued)} в черзі</span>
            </p>
          </div>
        ) : null}

        {status.errorCode ? (
          <p className="border-state-warn/26 bg-state-warn-soft text-state-warn mt-5 rounded-[14px] border px-4 py-3 text-[13.5px] leading-5 text-pretty">
            {issueText(status.errorCode)}
          </p>
        ) : null}
      </section>

      <Strip>
        <Kpi
          label="Створено позицій"
          meta={unitsMeta}
          tone={committed > 0 ? 'good' : 'dim'}
          value={`${count(committed)} з ${count(selected)}`}
        />
        <Kpi
          label="Помилок"
          meta={
            expired
              ? 'деталізація вже недоступна'
              : failed === 0
                ? stopped
                  ? 'зупинка не є помилкою'
                  : 'усі рядки пройшли'
                : `${count(retryable)} можна повторити${allBroken ? '' : ' на цій сторінці'}`
          }
          tone={failed === 0 ? 'plain' : 'warn'}
          value={`${count(failed)} ${plural(failed, ['рядок', 'рядки', 'рядків'])}`}
        />
        <Kpi
          label="Тривалість"
          meta="невідомо"
          title={NO_TIMING}
          tone="dim"
          value="—"
        />
        <Kpi
          label="Звіт CSV"
          meta={
            expired
              ? 'строк зберігання минув'
              : reportReady
                ? `усі ${count(status.rowCount)} ${plural(status.rowCount, ['рядок', 'рядки', 'рядків'])} зі статусами`
                : reportFailed
                  ? 'підготовка не вдалася'
                  : 'готується окремо від імпорту'
          }
          tone={reportReady && !expired ? 'plain' : 'dim'}
          value={
            expired
              ? 'Недоступний'
              : reportReady
                ? 'Готовий'
                : reportFailed
                  ? 'Помилка'
                  : 'Готується'
          }
        />
      </Strip>

      {expired ? (
        <div className="flex flex-wrap items-start gap-3.5">
          <Panel label="Що недоступно" title="Що недоступно">
            <ul className="text-app-muted grid gap-2.5 px-5.5 py-4 text-[13.5px] leading-6">
              {[
                'Вихідний файл',
                'Перелік рядків і результат кожного з них',
                'CSV-звіт імпорту',
                'Повтор невдалих рядків',
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <span aria-hidden className="text-app-dim">
                    —
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
          <Panel
            footer="Щоб донести залишки, завантажте актуальний файл — новий імпорт створить лише те, чого немає."
            label="Що залишилось"
            title="Що залишилось"
          >
            <ul className="text-app-muted grid gap-2.5 px-5.5 py-4 text-[13.5px] leading-6">
              {[
                `${count(committed)} ${plural(committed, ['запчастина', 'запчастини', 'запчастин'])} у каталозі`,
                'Підсумкові числа в історії імпортів',
                'Надходження й зони, створені цим імпортом',
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <span aria-hidden className="text-state-ok">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      {!expired && broken.length > 0 ? (
        <Panel
          footer={
            running
              ? 'Повторити невдалі рядки можна буде після завершення — успішні не дублюватимуться.'
              : 'Повтор створює тільки ті позиції, яких ще немає. Рядки з правками у файлі потрібно імпортувати заново.'
          }
          label="Рядки з помилками"
          title={`Рядки з помилками · ${count(broken.length)}${allBroken ? '' : ' на цій сторінці'}`}
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">Рядок</th>
                  <th className="px-3 py-2.5 text-left">Позиція</th>
                  <th className="px-3 py-2.5 text-left">Причина</th>
                  <th className="px-3 py-2.5 text-left">Що робити</th>
                </tr>
              </thead>
              <tbody>
                {broken.map((row) => {
                  const again = RETRYABLE.includes(row.executionStatus ?? '')
                  return (
                    <tr className="border-app-line border-b" key={row.rowId}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] tabular-nums">
                        {count(row.sourceRow)}
                      </td>
                      <td className="text-app-ink px-3 py-3.5 font-medium">
                        {row.draft?.values['Name'] ?? '—'}
                      </td>
                      <td className="text-app-muted px-3 py-3.5">
                        {issueText(row.executionErrorCode ?? '')}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2.5 py-1 text-[12.5px] font-medium whitespace-nowrap',
                            again
                              ? 'border-state-ok/24 text-state-ok bg-state-ok/10'
                              : 'border-state-warn/24 text-state-warn bg-state-warn-soft',
                          )}
                        >
                          {again ? 'Можна повторити' : 'Правка файлу'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      {!expired && created.length > 0 ? (
        <Panel
          footer={`Створених позицій на цій сторінці: ${count(created.length)}. Сторінка показує ${count(rows.length)} із ${count(rowTotal)} ${plural(rowTotal, ['рядка', 'рядків', 'рядків'])}, по ${count(PAGE_SIZE)} на сторінку.`}
          label="Створені позиції"
          title="Створені позиції"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr className="text-app-muted border-app-line border-b font-mono text-[10px] tracking-[0.14em] uppercase">
                  <th className="px-5.5 py-2.5 text-left">Рядок</th>
                  <th className="px-3 py-2.5 text-left">Запчастина</th>
                  <th className="px-3 py-2.5 text-right">К-сть</th>
                  <th className="px-3 py-2.5 text-right">Ціна</th>
                  <th className="px-3 py-2.5 text-left">Зона</th>
                </tr>
              </thead>
              <tbody>
                {created.map((row) => {
                  const values = row.draft?.values ?? {}
                  const code = [
                    values['ExternalCode'],
                    values['OemCode'] ? `OEM ${values['OemCode']}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  const price = Number(values['DesiredSalePrice'] ?? '')
                  return (
                    <tr className="border-app-line border-b" key={row.rowId}>
                      <td className="text-app-dim px-5.5 py-3.5 font-mono text-[13px] tabular-nums">
                        {count(row.sourceRow)}
                      </td>
                      <td className="px-3 py-3.5">
                        {row.partId ? (
                          <Link
                            className="text-app-ink hover:text-brand font-medium underline-offset-4 hover:underline"
                            to={partHref(row.partId)}
                          >
                            {values['Name'] ?? `Рядок ${row.sourceRow}`}
                          </Link>
                        ) : (
                          <span className="text-app-ink font-medium">
                            {values['Name'] ?? `Рядок ${row.sourceRow}`}
                          </span>
                        )}
                        {code === '' ? null : (
                          <span className="text-app-dim mt-1 block font-mono text-[12px]">
                            {code}
                          </span>
                        )}
                      </td>
                      <td className="text-app-ink px-3 py-3.5 text-right font-mono tabular-nums">
                        {values['Quantity'] ?? '—'}
                      </td>
                      <td className="text-app-ink px-3 py-3.5 text-right font-mono tabular-nums">
                        {Number.isFinite(price) && values['DesiredSalePrice']
                          ? money(price)
                          : '—'}
                      </td>
                      <td className="text-app-muted px-3 py-3.5">
                        {values['InventoryZoneId'] ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}

      <div className="flex flex-wrap items-start gap-3.5">
        <section
          aria-label="Створено разом"
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[20px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">Створено разом</h2>
          <dl className="mt-3.5 grid gap-2.5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-app-muted text-[13.5px]">Запчастини</dt>
              <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                {count(committed)}
              </dd>
            </div>
            {['Надходження', 'Складські зони', 'Замовлення'].map((label) => (
              <div
                className="flex flex-wrap items-baseline justify-between gap-3"
                key={label}
                title={NO_TOTALS}
              >
                <dt className="text-app-dim text-[13.5px]">{label}</dt>
                <dd className="text-app-dim font-mono text-[13px]">—</dd>
              </div>
            ))}
          </dl>
          <p className="text-app-dim mt-4 text-[13px] leading-5 text-pretty">
            Скільки надходжень, зон і замовлень створив імпорт, після запуску не
            повідомляє.
          </p>
          <div className="mt-4">
            <Button asChild>
              <Link to={partsHref}>До каталогу запчастин</Link>
            </Button>
          </div>
        </section>

        <section
          aria-label="Файл і звіт"
          className="border-app-line bg-app-raised min-w-0 flex-[1_1_320px] rounded-[20px] border px-5.5 py-5"
        >
          <h2 className="text-app-ink text-[15px] font-bold">Файл і звіт</h2>
          <dl className="mt-3.5 grid gap-2.5">
            <div
              className="flex flex-wrap items-baseline justify-between gap-3"
              {...(fileName === null ? { title: NO_FILE_NAME } : {})}
            >
              <dt className="text-app-muted text-[13.5px]">Файл</dt>
              <dd
                className={cn(
                  'min-w-0 text-[13.5px] break-all',
                  fileName === null ? 'text-app-dim' : 'text-app-ink',
                )}
              >
                {fileName ?? '—'}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-app-muted text-[13.5px]">Рядків у файлі</dt>
              <dd className="text-app-ink font-mono text-[13px] tabular-nums">
                {count(status.rowCount)}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <dt className="text-app-muted text-[13.5px]">Доступно до</dt>
              <dd
                className={cn(
                  'text-[13.5px]',
                  status.retentionExpiresAt === null
                    ? 'text-app-dim'
                    : 'text-app-ink',
                )}
              >
                {day(status.retentionExpiresAt) ?? 'не вказано'}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Button
              disabled={busy || !reportReady}
              onClick={onReport}
              title={
                reportReady
                  ? undefined
                  : 'Звіт ще готується — він збирається окремо від імпорту.'
              }
            >
              Завантажити звіт
            </Button>
            {reportFailed ? (
              <Button disabled={busy} onClick={onRetryReport}>
                Підготувати звіт ще раз
              </Button>
            ) : null}
            {expired ? null : (
              <Button disabled={busy} onClick={onSource}>
                Завантажити вихідний файл
              </Button>
            )}
          </div>
        </section>
      </div>

      {!expired && rowTotal > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-app-dim text-[13px]">
            Сторінка {count(rowPage)} із{' '}
            {count(Math.ceil(rowTotal / PAGE_SIZE))}
          </p>
          <div className="flex gap-2.5">
            <Button
              disabled={busy || rowPage === 1}
              onClick={() => onRowPage(rowPage - 1)}
            >
              Назад
            </Button>
            <Button
              disabled={busy || rowPage * PAGE_SIZE >= rowTotal}
              onClick={() => onRowPage(rowPage + 1)}
            >
              Далі
            </Button>
          </div>
        </div>
      ) : null}

      <div className="border-app-line bg-app-raised flex flex-wrap items-center justify-between gap-4 rounded-[18px] border px-5.5 py-5">
        <p className="text-app-muted min-w-0 flex-[1_1_320px] text-[13.5px] leading-6 text-pretty">
          {running
            ? 'Зупинка спрацює після завершення поточного пакета. Уже створені запчастини залишаться в каталозі.'
            : expired
              ? 'Підсумкові числа збережені в історії. Деталізацію по рядках і вихідний файл відновити не можна.'
              : 'Щоб прибрати створене, потрібно видалити позиції вручну — імпорт не має загального скасування.'}
        </p>
        <div className="flex flex-wrap gap-2.5">
          {running ? (
            <Button disabled={busy} onClick={onCancel} variant="primary">
              Зупинити імпорт
            </Button>
          ) : null}
          {!running && !expired && (queued > 0 || retryable > 0) ? (
            <Button disabled={busy} onClick={onRetry} variant="primary">
              {queued > 0
                ? `Імпортувати решту ${count(queued)} ${plural(queued, ['рядок', 'рядки', 'рядків'])}`
                : `Повторити ${count(retryable)} ${plural(retryable, ['рядок', 'рядки', 'рядків'])}`}
            </Button>
          ) : null}
          <Button disabled={busy} onClick={onNewImport}>
            Новий імпорт
          </Button>
        </div>
      </div>
    </div>
  )
}
