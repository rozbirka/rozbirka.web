import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { PartLocationFilters } from './PartLocationFilters'
const api = vi.hoisted(() => ({
  getWarehouses: vi.fn(),
  getZones: vi.fn(),
  getSections: vi.fn(),
  getShelves: vi.fn(),
}))
vi.mock('@/api/inventory', () => ({ inventoryApi: api }))
const props = {
  owner: 'tenant:user:1',
  enabled: true,
  warehouseId: 'w',
  zoneId: 'z',
  sectionId: 's',
  shelfId: '',
  withoutSection: false,
  withoutShelf: false,
  onChange: vi.fn(),
}
beforeEach(() => {
  props.onChange.mockReset()
  api.getWarehouses
    .mockReset()
    .mockResolvedValue([{ id: 'w', name: 'Склад', isActive: true }])
  api.getZones.mockReset().mockResolvedValue([
    { id: 'z', warehouseId: 'w', name: 'Зона', isActive: true },
    { id: 'z2', warehouseId: 'w', name: 'Зона 2', isActive: true },
  ])
  api.getSections
    .mockReset()
    .mockResolvedValue([
      { id: 's', zoneId: 'z', name: 'Секція А', code: 'A', isActive: true },
    ])
  api.getShelves.mockReset().mockResolvedValue(
    Array.from({ length: 100 }, (_, i) => ({
      id: `p${i + 1}`,
      zoneId: 'z',
      sectionId: 's',
      name: `Полиця ${i + 1}`,
      code: `P${i + 1}`,
      isActive: true,
    })),
  )
})
it('loads only the selected parents and uses the same native selector for 100 shelves', async () => {
  const user = userEvent.setup()
  render(<PartLocationFilters {...props} />)
  await waitFor(() =>
    expect(api.getShelves).toHaveBeenCalledWith('z', expect.anything(), 's'),
  )
  expect(api.getSections).toHaveBeenCalledWith('z', expect.anything())
  await screen.findByRole('option', { name: 'Полиця 100' })
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Полиця' }),
    'p100',
  )
  expect(props.onChange).toHaveBeenCalledWith('shelf', 'p100')
})
it('keeps section-only and shelf-less placements distinct', async () => {
  const user = userEvent.setup()
  render(<PartLocationFilters {...props} />)
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Полиця' }),
    '__without__',
  )
  expect(props.onChange).toHaveBeenCalledWith('shelf', '__without__')
})
it('does not show options from the previous zone after a delayed read completes', async () => {
  let complete: (items: unknown[]) => void = () => undefined
  api.getSections
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve
        }),
    )
    .mockResolvedValueOnce([
      {
        id: 'new',
        zoneId: 'z2',
        name: 'Нова секція',
        code: 'N',
        isActive: true,
      },
    ])
  const view = render(<PartLocationFilters {...props} sectionId="" />)
  view.rerender(<PartLocationFilters {...props} zoneId="z2" sectionId="" />)
  await act(() => {
    return Promise.resolve(
      complete([
        {
          id: 'old',
          zoneId: 'z',
          name: 'Стара секція',
          code: 'O',
          isActive: true,
        },
      ]),
    )
  })
  expect(
    await screen.findByRole('option', { name: /^Нова секція/ }),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('option', { name: 'Стара секція' }),
  ).not.toBeInTheDocument()
})
it('keeps a linked shelf selected when loading its options fails and offers retry', async () => {
  api.getShelves.mockRejectedValue(new Error('offline'))
  render(<PartLocationFilters {...props} shelfId="p100" />)
  expect(
    await screen.findByText('Не вдалося завантажити список секцій або полиць.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Полиця' })).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Спробувати ще раз' }),
  ).toBeInTheDocument()
  expect(props.onChange).not.toHaveBeenCalled()
})

it('reveals each child only after its parents are selected and hides children when the parent is cleared', () => {
  const view = render(
    <PartLocationFilters {...props} warehouseId="" zoneId="" sectionId="" />,
  )
  expect(
    screen.queryByRole('combobox', { name: 'Секція' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Полиця' }),
  ).not.toBeInTheDocument()
  view.rerender(<PartLocationFilters {...props} zoneId="" sectionId="" />)
  expect(
    screen.queryByRole('combobox', { name: 'Секція' }),
  ).not.toBeInTheDocument()
  view.rerender(<PartLocationFilters {...props} sectionId="" />)
  expect(screen.getByRole('combobox', { name: 'Секція' })).toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Полиця' }),
  ).not.toBeInTheDocument()
  view.rerender(<PartLocationFilters {...props} />)
  expect(screen.getByRole('combobox', { name: 'Полиця' })).toBeInTheDocument()
  view.rerender(<PartLocationFilters {...props} sectionId="" withoutSection />)
  expect(screen.getByRole('combobox', { name: 'Секція' })).toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Полиця' }),
  ).not.toBeInTheDocument()
  view.rerender(<PartLocationFilters {...props} zoneId="" sectionId="" />)
  expect(
    screen.queryByRole('combobox', { name: 'Секція' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('combobox', { name: 'Полиця' }),
  ).not.toBeInTheDocument()
})
