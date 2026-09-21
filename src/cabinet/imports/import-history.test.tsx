import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type { ImportCapabilities, ImportStatus } from '@/api/part-imports'
import { ImportHistory } from './import-history'

const capabilities: ImportCapabilities = {
  enabled: true,
  schemaVersion: 1,
  formats: ['csv', 'xlsx'],
  encodings: ['utf-8'],
  fields: [],
  transforms: [],
  limits: { maxBytes: 10 * 1024 * 1024, maxRows: 10000 },
  maxOrderGroupSize: 500,
}

const anImport = (
  id: string,
  status: string,
  rowCount = 10,
  createdAt = '2026-09-17T14:08:00.000Z',
): ImportStatus => ({
  id,
  status,
  revision: 1,
  previewVersion: 1,
  rowCount,
  createdAt,
  retentionExpiresAt: '2026-09-24T10:00:00.000Z',
  errorCode: null,
  digest: null,
  source: null,
  execution: null,
  mapping: null,
  report: null,
})

const rows = [
  anImport('aaaaaaaa-1', 'NeedsReview', 240),
  anImport('bbbbbbbb-2', 'CompletedWithErrors', 240),
  anImport('cccccccc-3', 'Completed', 86),
  anImport('dddddddd-4', 'Cancelled', 420),
  anImport('eeeeeeee-5', 'Failed', 0),
  anImport('ffffffff-6', 'Expired', 1240),
]

const renderHistory = (
  imports: ImportStatus[] = rows,
  onOpen = vi.fn(),
  onPage = vi.fn(),
  onNew = vi.fn(),
) => {
  render(
    <ImportHistory
      capabilities={capabilities}
      imports={imports}
      onNew={onNew}
      onOpen={onOpen}
      onPage={onPage}
      page={1}
      total={imports.length}
    />,
  )
  return { onOpen, onPage, onNew }
}

it('states the file limit from the capabilities the server reported', () => {
  renderHistory()

  expect(screen.getByText('Ліміт файлу')).toBeVisible()
  expect(screen.getByText('10')).toBeVisible()
  expect(screen.getByText('MiB')).toBeVisible()
  expect(screen.getByText(/до 10 000 рядків · CSV, XLSX/)).toBeVisible()
})

it('leaves the execution figures empty and says why, instead of showing a zero', () => {
  renderHistory()

  const reason =
    'Список імпортів не повертає підсумків виконання — вони на екрані самого імпорту.'
  expect(screen.getAllByText(reason).length).toBeGreaterThan(0)
  expect(screen.getAllByTitle(reason).length).toBeGreaterThan(rows.length)
})

it('offers to continue the one import that is still unfinished', async () => {
  const user = userEvent.setup()
  const { onOpen } = renderHistory()

  const banner = screen.getByText('Один імпорт незавершений').closest('div')!
  expect(banner).toHaveTextContent('колонки зіставлені, дані не перевірені')

  await user.click(
    screen.getByRole('button', { name: 'Продовжити підготовку' }),
  )
  expect(onOpen).toHaveBeenCalledWith('aaaaaaaa-1')
})

it('says nothing about unfinished work when there is none', () => {
  renderHistory([anImport('cccccccc-3', 'Completed')])

  expect(screen.queryByText('Один імпорт незавершений')).not.toBeInTheDocument()
})

it('groups the list and counts each group', async () => {
  const user = userEvent.setup()
  renderHistory()

  const groups = screen.getByRole('group', { name: 'Групи імпортів' })
  expect(within(groups).getByRole('button', { name: 'Усі 6' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await user.click(
    within(groups).getByRole('button', { name: 'Потребують дії 3' }),
  )
  expect(screen.getAllByRole('row')).toHaveLength(4) // header + three
  expect(screen.getByText(/Показано 3 з 6/)).toBeVisible()

  await user.click(within(groups).getByRole('button', { name: 'Скасовані 2' }))
  expect(screen.getAllByRole('row')).toHaveLength(3)
})

it('names the action by what the import is waiting for', () => {
  renderHistory()

  const rowFor = (id: string) => screen.getByText(id.slice(0, 8)).closest('tr')!
  expect(within(rowFor('aaaaaaaa-1')).getByRole('button')).toHaveTextContent(
    'Продовжити',
  )
  expect(within(rowFor('cccccccc-3')).getByRole('button')).toHaveTextContent(
    'Результат',
  )
  expect(within(rowFor('eeeeeeee-5')).getByRole('button')).toHaveTextContent(
    'Деталі',
  )
  expect(within(rowFor('ffffffff-6')).getByRole('button')).toHaveTextContent(
    'Деталі',
  )
})

it('replaces the whole history with the four steps when nothing was imported', async () => {
  const user = userEvent.setup()
  const { onNew } = renderHistory([])

  expect(
    screen.getByRole('heading', {
      name: 'Завантажте таблицю — і склад наповниться за кілька хвилин',
    }),
  ).toBeVisible()
  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('group', { name: 'Групи імпортів' }),
  ).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Завантажити файл' }))
  expect(onNew).toHaveBeenCalled()
})

it('states the limits on the empty screen from the same capabilities', () => {
  renderHistory([])

  expect(screen.getByText('CSV, XLSX')).toBeVisible()
  expect(screen.getByText(/до 10 MiB, до 10 000 рядків/)).toBeVisible()
  expect(
    screen.getByText('Ліміт фото для цього середовища невідомий.'),
  ).toBeVisible()
})
