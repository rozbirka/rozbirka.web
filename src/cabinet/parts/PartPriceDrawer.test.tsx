import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, it, vi } from 'vitest'
import type { PartDetail } from '@/api/parts'
import { PartPriceDrawer } from './PartPriceDrawer'

const mocks = vi.hoisted(() => ({ update: vi.fn(), get: vi.fn() }))
vi.mock('@/api/parts', () => ({ partsApi: mocks }))
vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({
    status: 'ready',
    targetTenant: {
      id: 'tenant-1',
      slug: 'yard',
      accountingCurrency: 'USD',
      currencyLocked: true,
    },
    snapshot: { role: 'owner' },
  }),
}))
const part = {
  id: 'p1',
  name: 'Фара ліва',
  desiredSalePrice: 100,
  effectiveSalePrice: 100,
} as PartDetail
function mount(detail = part) {
  const onClose = vi.fn(),
    onSaved = vi.fn()
  const signal = new AbortController().signal
  const beforeSave = vi.fn(() => ({
    signal,
    tenantId: 'tenant-1',
    generation: 1,
  }))
  const view = render(
    <MemoryRouter>
      <PartPriceDrawer
        part={detail}
        beforeSave={beforeSave}
        onClose={onClose}
        onSaved={onSaved}
      />
    </MemoryRouter>,
  )
  return { onClose, onSaved, beforeSave, signal, ...view }
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.update.mockResolvedValue({
    ...part,
    desiredSalePrice: 125.5,
    effectiveSalePrice: 125.5,
  })
})

it('edits only the asking price using the shared drawer and money field', async () => {
  const user = userEvent.setup(),
    { onSaved, onClose, signal } = mount()
  expect(screen.getByRole('dialog', { name: 'Ціна продажу' })).toBeVisible()
  const input = screen.getByRole('textbox', { name: 'Ціна продажу' })
  expect(input).toHaveValue('100')
  await user.clear(input)
  await user.type(input, '125,5')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(mocks.update).toHaveBeenCalledWith(
    'p1',
    { desiredSalePrice: { isSet: true, value: 125.5 } },
    { signal },
  )
  expect(onSaved).toHaveBeenCalledWith(
    expect.objectContaining({ desiredSalePrice: 125.5 }),
  )
  expect(onClose).toHaveBeenCalledOnce()
})
it.each(['-1', 'abc', '1.234', '10000000000'])(
  'keeps invalid price %s in the drawer without sending it',
  async (value) => {
    const user = userEvent.setup(),
      { onClose } = mount()
    fireEvent.change(screen.getByRole('textbox', { name: 'Ціна продажу' }), {
      target: { value },
    })
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(
      screen.getByRole('textbox', { name: 'Ціна продажу' }),
    ).toHaveAttribute('aria-invalid', 'true')
    expect(mocks.update).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  },
)
it.each([
  ['0', 0],
  ['', null],
] as const)(
  'supports zero or clearing the asking price (%s)',
  async (value, expected) => {
    const user = userEvent.setup()
    mount()
    fireEvent.change(screen.getByRole('textbox', { name: 'Ціна продажу' }), {
      target: { value },
    })
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(mocks.update).toHaveBeenCalledWith(
      'p1',
      { desiredSalePrice: { isSet: true, value: expected } },
      expect.anything(),
    )
  },
)
it('cancels without changing the part', async () => {
  const user = userEvent.setup(),
    { onClose } = mount()
  await user.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(onClose).toHaveBeenCalledOnce()
  expect(mocks.update).not.toHaveBeenCalled()
})
it('prevents duplicate saves and closing while the save is pending', async () => {
  let finish!: (part: PartDetail) => void
  mocks.update.mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const user = userEvent.setup(),
    { onClose } = mount()
  const save = screen.getByRole('button', { name: 'Зберегти' })
  const form = screen
    .getByRole('textbox', { name: 'Ціна продажу' })
    .closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(mocks.update).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Закрити' }))
  await user.keyboard('{Escape}')
  expect(onClose).not.toHaveBeenCalled()
  expect(save).toBeDisabled()
  await act(async () => {
    finish(part)
    await Promise.resolve()
  })
  expect(onClose).toHaveBeenCalledOnce()
})
it.each([true, false])(
  'reads back an uncertain save without repeating it (saved=%s)',
  async (landed) => {
    mocks.update.mockRejectedValue({
      kind: 'network',
      message: 'Connection lost',
    })
    mocks.get.mockResolvedValue({
      ...part,
      desiredSalePrice: landed ? 125.5 : 100,
      effectiveSalePrice: landed ? 125.5 : 100,
    })
    const user = userEvent.setup(),
      { onSaved, onClose } = mount()
    fireEvent.change(screen.getByRole('textbox', { name: 'Ціна продажу' }), {
      target: { value: '125.5' },
    })
    await user.click(screen.getByRole('button', { name: 'Зберегти' }))
    await waitFor(() => expect(mocks.get).toHaveBeenCalledOnce())
    expect(mocks.update).toHaveBeenCalledOnce()
    if (landed) {
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalledOnce()
    } else {
      expect(onClose).not.toHaveBeenCalled()
      expect(screen.getByRole('alert')).toHaveTextContent('Введене залишилось')
      expect(screen.getByRole('textbox', { name: 'Ціна продажу' })).toHaveValue(
        '125.5',
      )
    }
  },
)
it('does not send a price when the latest permission guard rejects it', async () => {
  const user = userEvent.setup(),
    { beforeSave, onClose } = mount()
  beforeSave.mockImplementation(() => {
    throw Error('Permission changed')
  })
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(mocks.update).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toBeVisible()
})
