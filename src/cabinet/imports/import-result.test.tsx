import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import type { ImportRow, ImportStatus } from '@/api/part-imports'
import { ImportResultStep } from './import-result'

const record = (
  status: string,
  execution: ImportStatus['execution'],
  report = 'Ready',
): ImportStatus => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  status,
  revision: 7,
  previewVersion: 1,
  rowCount: 240,
  createdAt: '2026-09-17T19:38:00.000Z',
  retentionExpiresAt: '2026-09-24T19:38:00.000Z',
  errorCode: null,
  digest: 'abc123',
  source: null,
  execution,
  mapping: null,
  report: { version: 1, status: report, errorCode: null },
})

const execution = (committed: number, failed: number, selected: number) => ({
  id: 'e1',
  status: 'Completed',
  selected,
  committed,
  failed,
  digest: 'abc123',
})

const made = (
  sourceRow: number,
  name: string,
  quantity: string,
): ImportRow => ({
  rowId: `r${sourceRow}`,
  sourceRow,
  source: { id: `r${sourceRow}`, row: sourceRow, cells: [] },
  draft: { values: { Name: name, Quantity: quantity }, issues: [] },
  executionStatus: 'Committed',
  partId: `part-${sourceRow}`,
})

const broke = (sourceRow: number, code: string, state: string): ImportRow => ({
  rowId: `r${sourceRow}`,
  sourceRow,
  source: { id: `r${sourceRow}`, row: sourceRow, cells: [] },
  draft: { values: { Name: 'Блок ABS', Quantity: '1' }, issues: [] },
  executionStatus: state,
  executionErrorCode: code,
})

const show = (
  status: ImportStatus,
  rows: ImportRow[],
  props: Partial<Parameters<typeof ImportResultStep>[0]> = {},
) => {
  const handlers = {
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    onReport: vi.fn(),
    onRetryReport: vi.fn(),
    onSource: vi.fn(),
    onNewImport: vi.fn(),
    onRowPage: vi.fn(),
  }
  render(
    <MemoryRouter>
      <ImportResultStep
        busy={false}
        fileName={null}
        partHref={(id) => `/app/yard/parts/${id}`}
        partsHref="/app/yard/parts"
        rowPage={1}
        rowTotal={rows.length}
        rows={rows}
        status={status}
        {...handlers}
        {...props}
      />
    </MemoryRouter>,
  )
  return handlers
}

it('counts from the execution, not from the rows it happens to have', () => {
  // The page holds two rows; the import created 237. The headline follows the
  // server, and the sum taken from the page says which page it came from.
  show(record('Completed', execution(237, 0, 240)), [
    made(2, 'Фара ліва', '2'),
    made(3, 'Капот', '1'),
  ])
  expect(
    screen.getByRole('heading', { name: '237 запчастин створено' }),
  ).toBeVisible()
  expect(screen.getByText('3 одиниці товару на цій сторінці')).toBeVisible()
})

it('never claims a duration the server does not report', () => {
  show(record('Completed', execution(237, 0, 240)), [])
  const strip = screen.getByText('Тривалість').closest('div')
  expect(strip).not.toBeNull()
  expect(within(strip!).getByText('—')).toBeVisible()
  expect(strip).toHaveAttribute(
    'title',
    'Сервер не повідомляє час початку й завершення виконання.',
  )
})

it('offers a retry only for rows the server can pick up again', async () => {
  const user = userEvent.setup()
  const handlers = show(record('CompletedWithErrors', execution(237, 2, 239)), [
    broke(41, 'REFERENCE_NOT_FOUND', 'Failed'),
    broke(77, 'STALE_REVISION', 'RetryableFailure'),
  ])
  const table = screen.getByRole('region', { name: 'Рядки з помилками' })
  expect(within(table).getByText('Правка файлу')).toBeVisible()
  expect(within(table).getByText('Можна повторити')).toBeVisible()
  await user.click(screen.getByRole('button', { name: 'Повторити 1 рядок' }))
  expect(handlers.onRetry).toHaveBeenCalledTimes(1)
})

it('offers to finish a stopped import rather than to retry it', () => {
  show(record('Cancelled', execution(118, 0, 420)), [])
  expect(
    screen.getByRole('button', { name: 'Імпортувати решту 302 рядки' }),
  ).toBeVisible()
})

it('stops the running import instead of restarting it', async () => {
  const user = userEvent.setup()
  const handlers = show(
    record('Running', execution(148, 3, 237), 'Pending'),
    [],
  )
  expect(
    screen.getByRole('progressbar', { name: 'Поступ імпорту' }),
  ).toHaveAttribute('value', '148')
  await user.click(screen.getByRole('button', { name: 'Зупинити імпорт' }))
  expect(handlers.onCancel).toHaveBeenCalledTimes(1)
  expect(
    screen.queryByRole('button', { name: /Повторити/ }),
  ).not.toBeInTheDocument()
})

it('says what an expired import lost and what it kept', () => {
  show(record('Expired', execution(1240, 0, 1240), 'Expired'), [])
  expect(screen.getByRole('region', { name: 'Що недоступно' })).toBeVisible()
  expect(
    within(screen.getByRole('region', { name: 'Що залишилось' })).getByText(
      '1 240 запчастин у каталозі',
    ),
  ).toBeVisible()
  // Nothing about the file survives, so nothing offers to fetch it.
  expect(
    screen.queryByRole('button', { name: 'Завантажити вихідний файл' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Завантажити звіт' }),
  ).toBeDisabled()
})

it('explains the entity totals it cannot show', () => {
  show(record('Completed', execution(237, 0, 240)), [])
  const totals = screen.getByRole('region', { name: 'Створено разом' })
  expect(within(totals).getByText('237')).toBeVisible()
  expect(within(totals).getAllByText('—')).toHaveLength(3)
})
