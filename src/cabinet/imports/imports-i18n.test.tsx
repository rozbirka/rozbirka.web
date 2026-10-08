import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import type {
  ImportCapabilities,
  ImportRow,
  ImportStatus,
} from '@/api/part-imports'
import { LocaleProvider, type Locale } from '@/i18n'
import { ImportFileStep } from './import-file'
import { ImportHistory } from './import-history'
import { ImportResultStep } from './import-result'

const capabilities: ImportCapabilities = {
  enabled: true,
  schemaVersion: 2,
  formats: ['csv', 'xlsx'],
  encodings: ['utf-8', 'windows-1251'],
  fields: [],
  transforms: [],
  limits: { maxBytes: 10 * 1024 * 1024, maxRows: 10000, maxColumns: 100 },
  maxOrderGroupSize: 500,
}

const record = (
  status: string,
  execution: ImportStatus['execution'] = null,
  extra: Partial<ImportStatus> = {},
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
  report: { version: 1, status: 'Ready', errorCode: null },
  ...extra,
})

const execution = (committed: number, failed: number, selected: number) => ({
  id: 'e1',
  status: 'Completed',
  selected,
  committed,
  failed,
  digest: 'abc123',
})

const inLocale = (locale: Locale, ui: ReactNode) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      <MemoryRouter>{ui}</MemoryRouter>
    </LocaleProvider>,
  )

const fileStep = (
  locale: Locale,
  props: Partial<Parameters<typeof ImportFileStep>[0]> = {},
) =>
  inLocale(
    locale,
    <ImportFileStep
      busy={false}
      capabilities={capabilities}
      editable
      file={null}
      onChooseFile={vi.fn()}
      onContinue={vi.fn()}
      onReanalyze={vi.fn()}
      onSelection={vi.fn()}
      onToggleSettings={vi.fn()}
      rows={[]}
      selection={{
        delimiter: ',',
        encoding: 'utf-8',
        headerRow: 1,
        startRow: 2,
      }}
      settingsOpen={false}
      status={null}
      {...props}
    />,
  )

const resultStep = (locale: Locale, status: ImportStatus, rows: ImportRow[]) =>
  inLocale(
    locale,
    <ImportResultStep
      busy={false}
      fileName={null}
      onCancel={vi.fn()}
      onNewImport={vi.fn()}
      onReport={vi.fn()}
      onRetry={vi.fn()}
      onRetryReport={vi.fn()}
      onRowPage={vi.fn()}
      onSource={vi.fn()}
      partHref={(id) => `/app/yard/parts/${id}`}
      partsHref="/app/yard/parts"
      rowPage={1}
      rowTotal={rows.length}
      rows={rows}
      status={status}
    />,
  )

describe('upload step in other locales', () => {
  it('describes the drop zone and limits in English', () => {
    fileStep('en-GB')
    expect(screen.getByText('Drop a CSV or XLSX file')).toBeVisible()
    expect(
      screen.getByText('up to 10 MiB · up to 10,000 rows and 100 columns'),
    ).toBeVisible()
    expect(screen.getByText('Choose file')).toBeVisible()
    expect(screen.getByLabelText('Import file')).toBeInTheDocument()
    const limits = screen.getByText('Limits').closest('section')!
    expect(within(limits).getByText('Formats')).toBeVisible()
    expect(within(limits).getByText('up to 10 MiB')).toBeVisible()
    expect(within(limits).getByText('10,000 / 100')).toBeVisible()
  })

  it('describes the drop zone in Polish', () => {
    fileStep('pl')
    expect(screen.getByText('Przeciągnij plik CSV lub XLSX')).toBeVisible()
    expect(screen.getByText('Wybierz plik')).toBeVisible()
  })

  it('shows what was read with an English date in the business time zone', () => {
    fileStep('en-GB', {
      status: record('NeedsReview', null, {
        rowCount: 3,
        source: {
          fields: [
            { id: 'f1', column: 0, header: 'Назва', type: 'text' },
            { id: 'f2', column: 1, header: 'Кількість', type: 'integer' },
          ],
          tables: [],
          selection: {
            delimiter: ';',
            encoding: 'utf-8',
            headerRow: 1,
            startRow: 2,
          },
          warnings: ['HIDDEN_ROWS'],
          rows: [],
        },
      }),
      rows: [
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
      ],
      selection: {
        delimiter: ';',
        encoding: 'utf-8',
        headerRow: 1,
        startRow: 2,
      },
    })
    const read = screen.getByRole('region', { name: 'What was read' })
    // Column names come from the file and stay as they are.
    expect(within(read).getByText('Назва')).toBeVisible()
    expect(
      within(read).getByText('Showing the first 1 of 3 rows'),
    ).toBeVisible()
    expect(screen.getByText(/17\/09\/2026, 22:38/)).toBeVisible()
    expect(
      screen.getByText(
        /Delimiter: semicolon, encoding utf-8, headers in row 1\./,
      ),
    ).toBeVisible()
    expect(
      screen.getByText(
        'The file has hidden rows. Check whether they should be imported.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('button', { name: 'Set up import' })).toBeVisible()
  })
})

describe('result step in other locales', () => {
  it('reports a finished import in English', () => {
    resultStep('en-GB', record('Completed', execution(1240, 0, 1240)), [])
    expect(
      screen.getByRole('heading', { name: '1,240 parts created' }),
    ).toBeVisible()
    expect(screen.getByText('Completed')).toBeVisible()
    expect(screen.getByText('Created 17/09/2026, 22:38')).toBeVisible()
    expect(screen.getByText('1,240 of 1,240')).toBeVisible()
    expect(screen.getByText('24/09/2026')).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Download report' }),
    ).toBeEnabled()
    expect(screen.getByRole('region', { name: 'Also created' })).toBeVisible()
  })

  it('offers to finish a stopped import in English and Polish', () => {
    const { unmount } = resultStep(
      'en-GB',
      record('Cancelled', execution(118, 0, 420)),
      [],
    )
    expect(
      screen.getByRole('button', { name: 'Import the remaining 302 rows' }),
    ).toBeVisible()
    unmount()
    resultStep('pl', record('Cancelled', execution(118, 0, 420)), [])
    expect(
      screen.getByRole('button', { name: 'Zaimportuj pozostałe 302 wiersze' }),
    ).toBeVisible()
  })

  it('names row errors by code in English', () => {
    resultStep('en-GB', record('CompletedWithErrors', execution(1, 1, 2)), [
      {
        rowId: 'r41',
        sourceRow: 41,
        source: { id: 'r41', row: 41, cells: [] },
        draft: { values: { Name: 'Блок ABS', Quantity: '1' }, issues: [] },
        executionStatus: 'Failed',
        executionErrorCode: 'REFERENCE_NOT_FOUND',
      },
    ])
    const table = screen.getByRole('region', { name: 'Rows with errors' })
    expect(within(table).getByText('Value not available')).toBeVisible()
    expect(within(table).getByText('Fix the file')).toBeVisible()
    expect(
      screen.getByRole('heading', { name: '1 part created, 1 row failed' }),
    ).toBeVisible()
  })
})

describe('history in English', () => {
  it('labels figures, statuses and actions', () => {
    inLocale(
      'en-GB',
      <ImportHistory
        capabilities={capabilities}
        imports={[
          record('Completed'),
          {
            ...record('NeedsReview'),
            id: 'bbbbbbbb-1111-2222-3333-444444444444',
          },
        ]}
        onNew={vi.fn()}
        onOpen={vi.fn()}
        onPage={vi.fn()}
        page={1}
        total={2}
      />,
    )
    expect(screen.getByText('Imports this month')).toBeVisible()
    expect(screen.getByText('One import is unfinished')).toBeVisible()
    expect(screen.getAllByText('Completed').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Result' })).toBeVisible()
  })
})
