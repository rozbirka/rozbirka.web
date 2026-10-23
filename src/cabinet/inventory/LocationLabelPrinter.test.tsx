import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useSearchParams } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import { ToastProvider } from '@/components/app'
import {
  LocationLabelPrinter,
  LocationLabelsPage,
} from './LocationLabelPrinter'
import { labelQueueKey, readLabelQueue } from './location-label-queue'
import { tenantResetRegistry } from '../tenant-reset-registry'
const api = vi.hoisted(() => ({
  getSections: vi.fn(),
  getZones: vi.fn(),
  getShelves: vi.fn(),
}))
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
it('prints selected labels directly without creating or showing a queue', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  expect(
    screen.queryByRole('button', { name: /Створити чергу/ }),
  ).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toEqual([
    expect.objectContaining({ id: 's0', qrCode: 'raw:0' }),
  ])
  expect(
    screen.queryByRole('region', { name: 'Активна черга' }),
  ).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it.each(['zone', 'section', 'shelf'] as const)(
  'selects %s labels by row immediately and prints the selected rows',
  async (kind) => {
    const user = userEvent.setup()
    const labels = records.map((record) => ({
      ...record,
      warehouseId: 'parent',
      zoneId: 'parent',
      sectionId: 'parent',
      isSystemUnassigned: false,
      sectionName: 'Section',
    }))
    api.getZones.mockResolvedValue(labels)
    api.getSections.mockResolvedValue(labels)
    api.getShelves.mockResolvedValue(labels)
    render(
      <MemoryRouter initialEntries={['/?labels=1']}>
        <LocationLabelsPage
          target={{ kind, parentId: 'parent', parentName: 'Parent' }}
          inventoryBase="/inventory"
        />
      </MemoryRouter>,
    )
    const first = await screen.findByRole('checkbox', {
      name: 'Обрати: Section 1',
    })
    expect(screen.getAllByRole('checkbox')).toHaveLength(16)
    expect(
      screen.getByRole('navigation', { name: 'Сторінки етикеток' }),
    ).toHaveTextContent('1–15 з 25')
    const firstRow = first.closest('tr')!
    await user.click(firstRow)
    expect(first).toBeChecked()
    await user.click(firstRow)
    expect(first).not.toBeChecked()
    await user.click(first.parentElement!)
    expect(first).toBeChecked()
    await user.click(first)
    expect(first).not.toBeChecked()
    const second = screen.getByRole('checkbox', { name: 'Обрати: Section 2' })
    await user.click(second.closest('tr')!)
    expect(second).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
    await waitFor(() => expect(openPrint).toHaveBeenCalledOnce())
    expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({ id: 's1', kind }),
    ])
  },
)

it('does not change label selection by row while preparing a print', async () => {
  const user = userEvent.setup()
  let finish!: (html: string) => void
  const prepared = new Promise<string>((resolve) => {
    finish = resolve
  })
  renderer.buildZoneLabelHtml.mockReturnValueOnce(prepared)
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  const first = await screen.findByRole('checkbox', {
    name: 'Обрати: Section 1',
  })
  const second = screen.getByRole('checkbox', { name: 'Обрати: Section 2' })
  await user.click(first.closest('tr')!)
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() =>
    expect(renderer.buildZoneLabelHtml).toHaveBeenCalledOnce(),
  )
  expect(first).toBeDisabled()
  await user.click(first.closest('tr')!)
  await user.click(second.closest('tr')!)
  expect(first).toBeChecked()
  expect(second).not.toBeChecked()
  await act(async () => {
    finish('<html>labels</html>')
    await prepared
  })
  expect(first).toBeEnabled()
  await user.click(second.closest('tr')!)
  expect(second).toBeChecked()
})

it('discards an old saved queue without locking the current label list', async () => {
  const { createLabelQueue, writeLabelQueue } =
    await import('./location-label-queue')
  writeLabelQueue(
    labelQueueKey('u', 't'),
    createLabelQueue(
      { kind: 'shelf', parentId: 'old-section', parentName: 'Old section' },
      ['old-label'],
    ),
  )
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeEnabled()
  expect(screen.queryByText(/Є незавершена черга/)).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it('keeps selection across pages but starts fresh after closing the label screen', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  const first = await screen.findByRole('checkbox', {
    name: 'Обрати: Section 1',
  })
  await user.click(first.closest('tr')!)
  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  const pager = screen.getByRole('navigation', { name: 'Сторінки етикеток' })
  expect(pager).toHaveTextContent('16–25 з 25')
  expect(screen.getAllByRole('checkbox')).toHaveLength(11)
  expect(
    within(pager).getByRole('button', { name: 'Наступна сторінка' }),
  ).toBeDisabled()
  await user.click(
    screen.getByRole('checkbox', { name: 'Обрати: Section 25' }).closest('tr')!,
  )
  await user.click(screen.getByRole('button', { name: 'Друк · 2' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toEqual([
    expect.objectContaining({ id: 's0' }),
    expect.objectContaining({ id: 's24' }),
  ])
  await user.click(screen.getByRole('button', { name: 'Завершити вибір' }))
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(
    screen.queryByRole('button', { name: /Друк ·/ }),
  ).not.toBeInTheDocument()
})

it('prints all selected labels or exports PDF without a queue or completion dialog', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати всі на сторінці' }),
  )
  await user.click(screen.getByRole('button', { name: 'Обрати всі · 25' }))
  await user.click(screen.getByRole('button', { name: 'PDF · 25' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Друк · 25' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(2))
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toHaveLength(25)
  expect(renderer.buildZoneLabelHtml.mock.calls[1]?.[0]).toHaveLength(25)
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it('does not print a label that was removed after selection', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  api.getSections.mockResolvedValue([])
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  expect(
    await screen.findByText(/Деякі етикетки більше недоступні/),
  ).toBeVisible()
  expect(openPrint).not.toHaveBeenCalled()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it('clears the current selection when the tenant scope is reset', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await act(async () =>
    tenantResetRegistry.clear({ userId: 'u', tenantId: 't' }),
  )
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(
    screen.queryByRole('button', { name: 'Друк · 1' }),
  ).not.toBeInTheDocument()
})

it('does not restore selections from a saved queue for the same collection', async () => {
  const { createLabelQueue, writeLabelQueue } =
    await import('./location-label-queue')
  writeLabelQueue(
    labelQueueKey('u', 't'),
    createLabelQueue({ kind: 'section', parentId: 'z', parentName: 'Zone' }, [
      's0',
    ]),
  )
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(screen.queryByText('У черзі')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Скасувати чергу' }),
  ).not.toBeInTheDocument()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it('keeps the selection available after a blocked or cancelled browser print', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  vi.mocked(window.open).mockReturnValueOnce(null)
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  expect(await screen.findByText(/Браузер заблокував/)).toBeVisible()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
})

it('retries blocked printing from a toast without restoring a saved queue', async () => {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <MemoryRouter>
        <Flow />
      </MemoryRouter>
    </ToastProvider>,
  )
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  vi.mocked(window.open).mockReturnValueOnce(null)
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  const alert = await screen.findByRole('alert')
  expect(alert).toHaveTextContent('Браузер заблокував')
  await user.click(
    within(alert).getByRole('button', { name: 'Спробувати ще раз' }),
  )
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})

it('does not print an artifact after switching tenant', async () => {
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
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
})

it('does not let an old tab overwrite the current selection with a stored queue', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  const { createLabelQueue, writeLabelQueue } =
    await import('./location-label-queue')
  writeLabelQueue(
    labelQueueKey('u', 't'),
    createLabelQueue({ kind: 'section', parentId: 'z', parentName: 'Zone' }, [
      's2',
    ]),
  )
  await act(() =>
    window.dispatchEvent(
      new StorageEvent('storage', { key: labelQueueKey('u', 't') }),
    ),
  )
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 3' }),
  ).not.toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toEqual([
    expect.objectContaining({ id: 's0' }),
  ])
})

it('prints the current selection after changing checkboxes', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('checkbox', { name: 'Обрати: Section 2' }))
  expect(screen.getByRole('button', { name: 'Друк · 2' })).toBeEnabled()
  await user.click(screen.getByRole('checkbox', { name: 'Обрати: Section 1' }))
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(renderer.buildZoneLabelHtml.mock.calls[0]?.[0]).toEqual([
    expect.objectContaining({ id: 's1' }),
  ])
})

it('clears all selected labels without a queue confirmation', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати всі на сторінці' }),
  )
  await user.click(screen.getByRole('button', { name: 'Обрати всі · 25' }))
  await user.click(screen.getByRole('button', { name: 'Зняти вибір' }))
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).not.toBeChecked()
  expect(
    screen.queryByRole('button', { name: /Друк ·/ }),
  ).not.toBeInTheDocument()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('keeps the current selection if selecting all exceeds the printing limit', async () => {
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
  await user.click(screen.getByRole('button', { name: 'Обрати всі · 201' }))
  expect(
    await screen.findByText(/За один раз можна надрукувати не більше 200/),
  ).toBeVisible()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  expect(screen.getByRole('button', { name: 'Друк · 1' })).toBeEnabled()
})

it('retries loading errors without pretending the label list is empty', async () => {
  api.getSections.mockRejectedValueOnce(new Error('Network failed'))
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  expect(
    await screen.findByText('Не вдалося завантажити етикетки.'),
  ).toBeVisible()
  expect(screen.queryByText('Етикеток поки немає')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeEnabled()
})

it('preserves selection and allows retry when preparing the print output fails', async () => {
  renderer.buildZoneLabelHtml.mockRejectedValueOnce(
    new Error('Rendering failed'),
  )
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'Етикетки секцій' }))
  await user.click(
    await screen.findByRole('checkbox', { name: 'Обрати: Section 1' }),
  )
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  expect(await screen.findByText(/Не вдалося підготувати друк/)).toBeVisible()
  expect(
    screen.getByRole('checkbox', { name: 'Обрати: Section 1' }),
  ).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Друк · 1' }))
  await waitFor(() => expect(openPrint).toHaveBeenCalledTimes(1))
  expect(readLabelQueue(labelQueueKey('u', 't'))).toBeNull()
})
