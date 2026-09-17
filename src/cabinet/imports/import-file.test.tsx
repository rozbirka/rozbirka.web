import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import type {
  ImportCapabilities,
  ImportRow,
  ImportStatus,
} from '@/api/part-imports'
import { ImportFileStep } from './import-file'

const capabilities: ImportCapabilities = {
  enabled: true,
  schemaVersion: 1,
  formats: ['csv', 'xlsx'],
  encodings: ['utf-8', 'windows-1251'],
  fields: [],
  transforms: [],
  limits: { maxBytes: 10 * 1024 * 1024, maxRows: 10000, maxColumns: 100 },
  maxOrderGroupSize: 500,
}

const status: ImportStatus = {
  id: 'import-1',
  status: 'NeedsReview',
  revision: 3,
  previewVersion: 1,
  rowCount: 3,
  createdAt: '2026-09-17T19:12:00.000Z',
  retentionExpiresAt: null,
  errorCode: null,
  digest: null,
  source: {
    fields: [
      { id: 'f1', column: 0, header: 'Назва', type: 'text' },
      { id: 'f2', column: 1, header: 'Кількість', type: 'integer' },
    ],
    tables: [],
    selection: { delimiter: ',', encoding: 'utf-8', headerRow: 1, startRow: 2 },
    warnings: [],
    rows: [],
  },
  execution: null,
  mapping: null,
  report: null,
}

const rows: ImportRow[] = [
  {
    rowId: 'r1',
    sourceRow: 1,
    source: {
      id: 'r1',
      row: 1,
      cells: [
        { column: 0, raw: 'Фара ліва' },
        { column: 1, raw: '2' },
      ],
    },
    draft: null,
  },
]

const renderStep = (
  overrides: Partial<Parameters<typeof ImportFileStep>[0]> = {},
) => {
  const props = {
    busy: false,
    capabilities,
    editable: true,
    file: null,
    onChooseFile: vi.fn(),
    onContinue: vi.fn(),
    onReanalyze: vi.fn(),
    onSelection: vi.fn(),
    onToggleSettings: vi.fn(),
    rows,
    selection: {
      delimiter: ',',
      encoding: 'utf-8',
      headerRow: 1,
      startRow: 2,
    },
    settingsOpen: false,
    status,
    ...overrides,
  }
  render(<ImportFileStep {...props} />)
  return props
}

it('shows what the machine read, with the header row it used', () => {
  renderStep()

  const read = screen.getByRole('region', { name: 'Що прочитано' })
  expect(read).toHaveTextContent('Рядок 1 використано як заголовки')
  expect(within(read).getByText('Фара ліва')).toBeVisible()
  expect(within(read).getByText('Показано перші 1 з 3 рядків')).toBeVisible()
})

it('says the server does not keep the filename when the session did not pick it', () => {
  renderStep()

  expect(screen.getByText(/Назву файлу сервер не зберігає/)).toBeVisible()
})

it('counts the file against the limits the server reported', () => {
  renderStep()

  const limits = screen.getByRole('region', { name: 'Обмеження' })
  expect(within(limits).getByText('3 / 10 000')).toBeVisible()
  expect(within(limits).getByText('2 / 100')).toBeVisible()
})

it('summarises the read settings while they are folded away', () => {
  renderStep()

  expect(
    screen.getByText(/Роздільник кома, кодування utf-8, заголовки в рядку 1/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Роздільник: Табуляція' }),
  ).not.toBeInTheDocument()
})

it('warns that reopening the settings costs the mapping', async () => {
  const user = userEvent.setup()
  const props = renderStep({ settingsOpen: true })

  expect(
    screen.getByText(/файл читається заново — зіставлення колонок доведеться/),
  ).toBeVisible()
  await user.click(
    screen.getByRole('button', { name: 'Роздільник: Табуляція' }),
  )
  expect(props.onSelection).toHaveBeenCalled()
})

it('offers the drop zone, not the preview, before anything is read', () => {
  renderStep({ status: null })

  expect(screen.getByLabelText('Файл імпорту')).toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Що прочитано' }),
  ).not.toBeInTheDocument()
})
