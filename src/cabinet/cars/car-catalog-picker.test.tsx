import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, expect, it, vi } from 'vitest'
import { carCatalogApi } from '@/api/car-catalog'
import { CarCatalogFields } from './car-catalog-picker'

vi.mock('@/api/car-catalog', () => ({
  carCatalogApi: { getMakes: vi.fn(), getModels: vi.fn() },
}))
function Harness() {
  const [value, setValue] = useState({ brand: '', model: '' })
  return (
    <CarCatalogFields
      brand={value.brand}
      model={value.model}
      onChange={setValue}
      disabled={false}
    />
  )
}
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(carCatalogApi.getMakes).mockResolvedValue([
    { id: 448, name: 'Toyota' },
    { id: 452, name: 'BMW' },
  ])
  vi.mocked(carCatalogApi.getModels).mockResolvedValue([{ id: 1, name: 'X5' }])
})
it('opens the make choices as an inline list below the field', async () => {
  const user = userEvent.setup()
  render(<Harness />)

  const trigger = screen.getByRole('button', { name: 'Марка' })
  await user.click(trigger)

  expect(trigger).toHaveAttribute('aria-expanded', 'true')
  expect(await screen.findByRole('listbox', { name: 'Марка' })).toBeVisible()
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})
it('selects a model for the chosen make and clears it when the make changes', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  expect(screen.getByRole('button', { name: 'Модель' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Марка' }))
  await user.type(screen.getByRole('searchbox', { name: 'Пошук марки' }), 'bm')
  await user.click(await screen.findByRole('button', { name: 'BMW' }))
  await user.click(screen.getByRole('button', { name: 'Модель' }))
  await user.click(await screen.findByRole('button', { name: 'X5' }))
  expect(screen.getByRole('button', { name: 'Модель' })).toHaveTextContent('X5')
  expect(carCatalogApi.getModels).toHaveBeenCalledWith(
    452,
    expect.any(AbortSignal),
  )
  await user.click(screen.getByRole('button', { name: 'Марка' }))
  await user.click(await screen.findByRole('button', { name: 'Toyota' }))
  expect(screen.getByRole('button', { name: 'Модель' })).not.toHaveTextContent(
    'X5',
  )
})
it('offers retry and manual entry when the catalog fails', async () => {
  vi.mocked(carCatalogApi.getMakes).mockRejectedValue(new Error('offline'))
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Марка' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Не вдалося')
  await user.type(
    screen.getByRole('searchbox', { name: 'Пошук марки' }),
    'Custom',
  )
  await user.click(
    screen.getByRole('button', { name: 'Ввести «Custom» вручну' }),
  )
  expect(screen.getByRole('button', { name: 'Марка' })).toHaveTextContent(
    'Custom',
  )
  await user.click(screen.getByRole('button', { name: 'Марка' }))
  await screen.findByRole('alert')
  vi.mocked(carCatalogApi.getMakes).mockResolvedValue([
    { id: 452, name: 'BMW' },
  ])
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'BMW' })).toBeVisible(),
  )
})
