import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useSearchParams } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  LocationLabelPrinter,
  LocationLabelsPage,
} from './LocationLabelPrinter'
import { labelQueueKey, readLabelQueue } from './location-label-queue'
import { tenantResetRegistry } from '../tenant-reset-registry'
const api = vi.hoisted(() => ({ getSections: vi.fn() }))
const renderer = vi.hoisted(() => ({
  buildZoneLabelHtml: vi.fn().mockResolvedValue('<html>labels</html>'),
}))
const context = vi.hoisted(() => ({ tenantId: 't', userId: 'u' }))
vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
vi.mock('./zone-label-output', () => renderer)
vi.mock('@/auth/useTenantSettings', () => ({
  useTenantSettings: () => ({ documentLanguage: 'uk' }),
}))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: { id: context.tenantId },
    snapshot: {
      userId: context.userId,
      tenantId: context.tenantId,
      permissions: new Set(['inventory.view']),
    },
  }),
}))
vi.mock('../use-latest-mutation-guard', () => ({
  useLatestMutationGuard: () => ({
    requireLatestMutation: () => ({ signal: new AbortController().signal }),
  }),
}))
const records = Array.from({ length: 25 }, (_, i) => ({
  id: `s${i}`,
  name: `Section ${i + 1}`,
  code: `A${i + 1}`,
  qrCode: `raw:${i}`,
  isActive: true,
  zoneId: 'z',
  warehouseName: 'Warehouse',
  zoneName: 'Zone',
}))
const openPrint = vi.fn()
function Flow() {
  const [params] = useSearchParams()
  const props = {
    target: { kind: 'section' as const, parentId: 'z', parentName: 'Zone' },
    inventoryBase: '/inventory',
  }
  return params.get('labels') === '1' ? (
    <LocationLabelsPage {...props} />
  ) : (
    <LocationLabelPrinter {...props} />
  )
}
function mount() {
  return render(
    <MemoryRouter>
      <Flow />
    </MemoryRouter>,
  )
}
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  context.tenantId = 't'
  context.userId = 'u'
  api.getSections.mockResolvedValue(records)
  vi.spyOn(window, 'open').mockReturnValue({
    document: { write: vi.fn(), close: vi.fn() },
    focus: vi.fn(),
    print: openPrint,
    close: vi.fn(),
  } as unknown as Window)
})
it('preserves selection across pages, then restores the queue after closing', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  // The bulk bar takes the toolbar's place while a selection exists.
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 25' }),
  )
  expect(
    screen.getByRole('region', { name: 'Дії над обраними' }),
  ).toHaveTextContent('2')
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 2' }))
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toEqual([
    's0',
    's24',
  ])
  await user.click(screen.getByRole('button', { name: 'Завершити вибір' }))
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  expect(await screen.findByRole('button', { name: 'Друк · 2' })).toBeEnabled()
  await user.click(screen.getByRole('checkbox', { name: 'Обрати: Section 1' }))
  expect(readLabelQueue(labelQueueKey('u', 't'))).toMatchObject({
    remainingIds: ['s24'],
    totalCount: 1,
    printedCount: 0,
  })
})
it('prints the entire prepared queue without a follow-up dialog and preserves it for PDF or retry', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати всі на сторінці' }),
  )
  await user.click(screen.getByRole('button', { name: 'Обрати всі · 25' }))
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 25' }))
  await user.click(screen.getByRole('button', { name: 'PDF · 25' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(screen.queryByText('Що вдалося надрукувати?')).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.printedCount).toBe(0)
  await user.click(screen.getByRole('button', { name: 'Друк · 25' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(2))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toMatchObject({
    printedCount: 0,
    totalCount: 25,
    remainingIds: records.map((record) => record.id),
  })
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toHaveLength(25)
  expect(renderer.buildZoneLabelHtml.mock.calls[1]?.[0]).toHaveLength(25)
})
it('blocks a stale missing label and preserves the queue when printing fails', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  api.getSections.mockResolvedValue([])
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  expect(
    await screen.findByText(/Деякі етикетки більше недоступні/),
  ).toBeInTheDocument()
  expect(openPrint).not.toHaveBeenCalled()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toEqual(['s0'])
  await user.click(
    screen.getByRole('checkbox', {
      name: 'Обрати: Етикетка недоступна · s0',
    }),
  )
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})
it('clears persisted state on tenant reset', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  await act(async () =>
    tenantResetRegistry.clear({ userId: 'u', tenantId: 't' }),
  )
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it('does not expose a reset before selection, keeps another collection queue separate and scopes it per user', async () => {
  const user = userEvent.setup()
  const { createLabelQueue, writeLabelQueue } =
    await import('./location-label-queue')
  writeLabelQueue(
    labelQueueKey('u', 't'),
    createLabelQueue(
      { kind: 'shelf', parentId: 'section-x', parentName: 'Other section' },
      ['h'],
    ),
  )
  const view = mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await screen.findByText(/Є незавершена черга: Other section/)
  expect(
    screen.getByRole('link', { name: 'Продовжити чергу' }),
  ).toHaveAttribute('href', '/inventory/sections/section-x?labels=1')
  expect(
    screen.queryByRole('button', { name: 'Зняти вибір' }),
  ).not.toBeInTheDocument()
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeDisabled()
  view.unmount()
  context.userId = 'other-user'
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await screen.findByRole('checkbox', { name: 'Обрати: Section 1' })
  expect(screen.queryByText(/Є незавершена черга/)).not.toBeInTheDocument()
})

it('keeps labels queued after blocked printing and closing the browser print dialog', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  vi.mocked(window.open).mockReturnValueOnce(null)
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  expect(await screen.findByText(/Браузер заблокував/)).toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toEqual(['s0'])
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toEqual(['s0'])
  expect(readLabelQueue(labelQueueKey('u', 't'))?.printedCount).toBe(0)
})

it('does not print a prepared artifact after switching tenant', async () => {
  const user = userEvent.setup()
  let resolve!: (html: string) => void
  const prepared = new Promise<string>((done) => {
    resolve = done
  })
  renderer.buildZoneLabelHtml.mockReturnValueOnce(prepared)
  const view = mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(renderer.buildZoneLabelHtml).toHaveBeenCalled())
  context.tenantId = 'other-tenant'
  view.rerender(
    <MemoryRouter>
      <Flow />
    </MemoryRouter>,
  )
  await act(async () => {
    resolve('<html>old tenant</html>')
    await prepared
  })
  expect(openPrint).not.toHaveBeenCalled()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.printedCount).toBe(0)
  expect(readLabelQueue(labelQueueKey('u', 'other-tenant'))).toBeNull()
})

it('can cancel a queue whose parent has disappeared from the hierarchy', async () => {
  const user = userEvent.setup()
  const { createLabelQueue, writeLabelQueue } =
    await import('./location-label-queue')
  writeLabelQueue(
    labelQueueKey('u', 't'),
    createLabelQueue(
      { kind: 'shelf', parentId: 'archived', parentName: 'Archived section' },
      ['h'],
    ),
  )
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('button', { name: 'Скасувати чергу' }),
  )
  const confirmation = screen.getByRole('dialog', {
    name: 'Скасувати чергу друку?',
  })
  await user.click(
    within(confirmation).getByRole('button', { name: 'Скасувати чергу' }),
  )
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeEnabled()
})

it('updates the selected checkboxes when another tab replaces the prepared selection', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  const { createLabelQueue, writeLabelQueue } =
    await import('./location-label-queue')
  const replacement = createLabelQueue(
    { kind: 'section', parentId: 'z', parentName: 'Zone' },
    ['s2'],
  )
  writeLabelQueue(labelQueueKey('u', 't'), replacement)
  await act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: labelQueueKey('u', 't') }),
    ),
  )
  expect(
    screen.queryByRole('dialog', { name: 'Скасувати чергу друку?' }),
  ).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.id).toBe(replacement.id)
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 3' }),
  ).toBeChecked()
})

it('keeps the label list and the active queue inline without a drawer', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  expect(
    await screen.findByRole('region', { name: 'Етикетки секцій' }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('region', { name: 'Активна черга' }),
  ).not.toBeInTheDocument()
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  expect(
    screen.getByRole('button', { name: 'Створити чергу · 1' }),
  ).toBeEnabled()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  const queue = screen.getByRole('region', { name: 'Активна черга' })
  expect(within(queue).getByText('Етикеток у черзі: 1')).toBeInTheDocument()
  expect(
    within(queue).getByText('0 з 1 надруковано · 1 залишилось'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('edits prepared labels directly through list checkboxes and prints the current preview', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  await user.click(screen.getByRole('checkbox', { name: 'Обрати: Section 2' }))
  expect(screen.getAllByText('У черзі')).toHaveLength(2)
  expect(screen.getByText('Етикеток у черзі: 2')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Друк · 2' })).toBeEnabled()
  expect(screen.getByRole('button', { name: 'PDF · 2' })).toBeEnabled()
  await user.click(screen.getByRole('checkbox', { name: 'Обрати: Section 1' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 2' }),
  ).toBeChecked()
  expect(screen.getAllByText('У черзі')).toHaveLength(1)
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toEqual(['s1'])
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(renderer.buildZoneLabelHtml).toHaveBeenCalled())
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toEqual([
    expect.objectContaining({ id: 's1' }),
  ])
})

it('selects all prepared labels and clears the entire selection even through a search filter', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  await user.click(screen.getByRole('button', { name: 'Обрати всі · 25' }))
  expect(screen.getByRole('button', { name: 'Друк · 25' })).toBeEnabled()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toHaveLength(25)
  await user.type(screen.getByRole('searchbox'), 'A25')
  const last = screen.getByRole('checkbox', { name: 'Обрати: Section 25' })
  expect(last).toBeChecked()
  await user.click(last)
  expect(screen.getByRole('button', { name: 'Друк · 24' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Обрати знайдені · 1' }))
  expect(last).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Скасувати чергу' }))
  await user.click(
    within(
      screen.getByRole('dialog', { name: 'Скасувати чергу друку?' }),
    ).getByRole('button', { name: 'Скасувати чергу' }),
  )
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 25' }),
  ).not.toBeChecked()
  expect(
    screen.queryByRole('region', { name: 'Активна черга' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: /Створити чергу/ }),
  ).not.toBeInTheDocument()
})

it('preserves the prepared selection when adding all would exceed the queue limit', async () => {
  api.getSections.mockResolvedValue(
    Array.from({ length: 201 }, (_, i) => ({
      ...records[0],
      id: `s${i}`,
      name: `Section ${i + 1}`,
      code: `A${i + 1}`,
    })),
  )
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Створити чергу · 1' }))
  await user.click(screen.getByRole('button', { name: 'Обрати всі · 201' }))
  expect(
    await screen.findByText(/В одній черзі може бути не більше 200/),
  ).toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))?.remainingIds).toEqual(['s0'])
  expect(screen.getByRole('button', { name: 'Друк · 1' })).toBeEnabled()
})
