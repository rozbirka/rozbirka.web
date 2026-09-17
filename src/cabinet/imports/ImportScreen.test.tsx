import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import {
  AxiosHeaders,
  AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import type { ImportStatus, ImportRow } from '@/api/part-imports'
import { ImportScreen } from './ImportScreen'
import { cabinetModules } from '../module-registry'
const context = vi.hoisted(() => ({
  permissions: new Set(['parts.view', 'parts.manage']),
  tenantId: 't',
}))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    snapshot: {
      tenantId: context.tenantId,
      userId: 'u',
      generation: 1,
      role: 'owner',
      permissions: context.permissions,
      features: new Set(),
      entitlement: {
        state: 'active',
        usage: { parts: { used: 0, max: 10000 } },
      },
      subscription: null,
    },
    targetTenant: { id: context.tenantId, slug: 'yard' },
  }),
}))
const original = apiClient.defaults.adapter!
let status: ImportStatus
let rows: ImportRow[]
let calls: InternalAxiosRequestConfig[]
let invalid = false
let commitFails = false
let commitFailureCode = ''
beforeEach(() => {
  context.permissions = new Set(['parts.view', 'parts.manage'])
  context.tenantId = 't'
  calls = []
  invalid = false
  commitFails = false
  commitFailureCode = ''
  status = {
    id: 'one',
    status: 'NeedsReview',
    revision: 1,
    previewVersion: 1,
    rowCount: 1,
    createdAt: '2026-09-15T10:00:00Z',
    retentionExpiresAt: null,
    errorCode: null,
    digest: null,
    execution: null,
    report: null,
    mapping: {
      version: 1,
      schemaVersion: 1,
      rules: [{ target: 'Name', sources: ['csv:1'] }],
      skippedFields: [],
    },
    source: {
      fields: [{ id: 'csv:1', column: 1, header: 'Назва', type: 'text' }],
      tables: [{ id: 'csv', name: 'CSV', hidden: false }],
      selection: { delimiter: ',', encoding: 'utf-8' },
      warnings: [],
      rows: [],
    },
  }
  rows = [
    {
      rowId: 'r1',
      sourceRow: 2,
      source: { id: 'r1', row: 2, cells: [{ column: 1, raw: 'Фара' }] },
      draft: { values: { Name: 'Фара', Quantity: '2' }, issues: [] },
    },
  ]
  apiClient.defaults.adapter = async (config) => {
    await Promise.resolve()
    calls.push(config)
    let data: unknown
    if (config.url?.endsWith('/capabilities'))
      data = {
        enabled: true,
        schemaVersion: 1,
        fields: [{ id: 'Name', type: 'text', required: true }],
        formats: ['csv', 'xlsx'],
        encodings: ['utf-8'],
        transforms: [],
        limits: { maxBytes: 10485760, maxRows: 10000 },
        maxOrderGroupSize: 500,
      }
    else if (config.url?.includes('/rows?'))
      data = {
        items: rows,
        total: 1,
        page: 1,
        pageSize: 100,
        revision: status.revision,
        previewVersion: 1,
      }
    else if (config.url?.endsWith('/validate')) {
      status = {
        ...status,
        revision: 2,
        status: invalid ? 'NeedsReview' : 'Ready',
        digest: invalid ? null : 'abc',
      }
      data = {
        revision: 2,
        previewVersion: 1,
        digest: status.digest,
        selectedCount: 1,
        invalidCount: invalid ? 1 : 0,
        plannedParts: invalid ? 0 : 1,
        plannedOrders: 0,
        reservedUnits: 0,
        plannedCustomers: 0,
        plannedCars: 0,
        plannedIntakes: 0,
        plannedWarehouses: 0,
        plannedZones: 0,
        plannedPhotos: 0,
      }
    } else if (config.url?.endsWith('/commit')) {
      if (commitFails) {
        if (commitFailureCode)
          throw new AxiosError(
            'Request failed',
            'ERR_BAD_REQUEST',
            config,
            undefined,
            {
              data: { error: { code: commitFailureCode } },
              status: 409,
              statusText: 'Conflict',
              headers: new AxiosHeaders(),
              config,
            },
          )
        throw new Error('network')
      }
      data = {
        id: 'execution',
        selected: 1,
        committed: 0,
        failed: 0,
        status: 'Queued',
        digest: 'abc',
      }
      status = {
        ...status,
        status: 'Queued',
        revision: 3,
        execution: data as ImportStatus['execution'],
      }
    } else if (config.url?.endsWith('/one')) data = status
    else if (config.url?.includes('?page='))
      data = { items: [status], total: 1, page: 1, pageSize: 50 }
    else throw Error(`Unexpected request ${config.url}`)
    return {
      data: { data },
      status: 200,
      statusText: 'OK',
      headers: new AxiosHeaders(),
      config,
    }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount() {
  return render(
    <MemoryRouter initialEntries={['/parts/imports/one']}>
      <Routes>
        <Route
          path="/parts/imports/:importId"
          element={<ImportScreen definition={cabinetModules.parts} />}
        />
      </Routes>
    </MemoryRouter>,
  )
}
it('denies private history without parts.manage', () => {
  context.permissions = new Set(['parts.view'])
  mount()
  expect(screen.getByText('Недостатньо прав для імпорту')).toBeVisible()
  expect(calls).toHaveLength(0)
})
it('resumes a draft and requires a fresh server validation before commit', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByText('Фара')
  expect(
    screen.getByRole('button', { name: 'До підтвердження' }),
  ).toBeDisabled()
  await user.click(
    screen.getByRole('checkbox', { name: 'Імпортувати рядок 2' }),
  )
  await user.click(screen.getByRole('button', { name: 'До підтвердження' }))
  await screen.findByRole('region', { name: 'Буде створено' })
  expect(calls.filter((c) => c.url?.endsWith('/commit'))).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Почати імпорт' }))
  await screen.findByText('Результати рядків')
  const sent = calls.find((c) => c.url?.endsWith('/commit'))!
  expect(JSON.parse(sent.data as string)).toMatchObject({
    revision: 2,
    previewVersion: 1,
    digest: 'abc',
  })
})
it('keeps invalid rows on review and never commits them', async () => {
  invalid = true
  const user = userEvent.setup()
  mount()
  await screen.findByText('Фара')
  await user.click(
    screen.getByRole('checkbox', { name: 'Імпортувати рядок 2' }),
  )
  await user.click(screen.getByRole('button', { name: 'До підтвердження' }))
  await waitFor(() =>
    expect(calls.some((c) => c.url?.endsWith('/validate'))).toBe(true),
  )
  expect(
    screen.queryByRole('button', { name: 'Почати імпорт' }),
  ).not.toBeInTheDocument()
  expect(calls.some((c) => c.url?.endsWith('/commit'))).toBe(false)
})
it('reuses the commit key after an uncertain network response', async () => {
  commitFails = true
  const user = userEvent.setup()
  mount()
  await screen.findByText('Фара')
  await user.click(
    screen.getByRole('checkbox', { name: 'Імпортувати рядок 2' }),
  )
  await user.click(screen.getByRole('button', { name: 'До підтвердження' }))
  await screen.findByRole('region', { name: 'Буде створено' })
  await user.click(screen.getByRole('button', { name: 'Почати імпорт' }))
  await screen.findByRole('alert')
  commitFails = false
  await user.click(screen.getByRole('button', { name: 'Почати імпорт' }))
  await screen.findByText('Результати рядків')
  const commits = calls.filter((c) => c.url?.endsWith('/commit'))
  expect(commits).toHaveLength(2)
  expect((JSON.parse(commits[0]!.data as string) as { key: string }).key).toBe(
    (JSON.parse(commits[1]!.data as string) as { key: string }).key,
  )
})
it('does not request further rows on unmount', async () => {
  const view = mount()
  await screen.findByText('Фара')
  view.unmount()
  const count = calls.length
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20))
  })
  expect(calls).toHaveLength(count)
})

it('shows the server stale revision error and invalidates confirmation', async () => {
  commitFails = true
  commitFailureCode = 'STALE_REVISION'
  const user = userEvent.setup()
  mount()
  await screen.findByText('Фара')
  await user.click(
    screen.getByRole('checkbox', { name: 'Імпортувати рядок 2' }),
  )
  await user.click(screen.getByRole('button', { name: 'До підтвердження' }))
  await screen.findByRole('region', { name: 'Буде створено' })
  await user.click(screen.getByRole('button', { name: 'Почати імпорт' }))
  expect(
    await screen.findByText(
      'Дані змінилися. Оновіть імпорт і повторіть перевірку.',
    ),
  ).toBeVisible()
  // The confirmation is spent: there is nothing left to press, and the screen
  // says why rather than offering a button that cannot work.
  expect(
    screen.queryByRole('button', { name: 'Почати імпорт' }),
  ).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Назад до перевірки' }),
  ).toBeVisible()
})
