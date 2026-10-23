import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { PartSourceFilter } from './PartSourceFilter'
const api = vi.hoisted(() => ({
  cars: vi.fn(),
  intakes: vi.fn(),
  intake: vi.fn(),
}))
vi.mock('@/api/cars', () => ({ carsApi: { list: api.cars } }))
vi.mock('@/api/intakes', () => ({
  intakesApi: { list: api.intakes, get: api.intake },
}))
const props = {
  kind: 'cars' as const,
  owner: 'tenant:1',
  values: [] as string[],
  enabled: true,
  onChange: vi.fn(),
}
beforeEach(() => {
  props.onChange.mockReset()
  api.cars.mockReset().mockResolvedValue({
    items: [
      {
        id: 'car-1',
        code: 'TESLA-01',
        brand: 'Tesla',
        model: 'Model Y',
        year: 2023,
      },
    ],
    page: 1,
    pageSize: 30,
    total: 1,
    totalPages: 1,
  })
  api.intakes.mockReset().mockResolvedValue({
    items: [{ id: 'batch-1', name: 'Жовтень', supplier: 'Постачальник' }],
    page: 1,
    pageSize: 30,
    total: 1,
    totalPages: 1,
  })
  api.intake.mockReset().mockResolvedValue({
    id: 'batch-1',
    name: 'Жовтень',
    supplier: 'Постачальник',
  })
})
it('loads cars only when opened and chooses one concrete car', async () => {
  const user = userEvent.setup()
  render(<PartSourceFilter {...props} />)
  expect(api.cars).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Авто' }))
  await user.click(
    await screen.findByRole('option', {
      name: 'TESLA-01 · Tesla Model Y (2023)',
    }),
  )
  expect(props.onChange).toHaveBeenCalledWith('car-1')
  expect(screen.queryByRole('listbox')).toBeNull()
  expect(api.intakes).not.toHaveBeenCalled()
})
it('searches all pages on the server without applying typed text', async () => {
  const user = userEvent.setup()
  api.cars.mockResolvedValueOnce({
    items: [],
    page: 1,
    pageSize: 30,
    total: 45,
    totalPages: 2,
  })
  render(<PartSourceFilter {...props} />)
  await user.click(screen.getByRole('button', { name: 'Авто' }))
  await user.click(
    await screen.findByRole('button', { name: 'Наступна сторінка' }),
  )
  await waitFor(() =>
    expect(api.cars).toHaveBeenLastCalledWith(
      { page: 2, pageSize: 30, search: '' },
      expect.anything(),
    ),
  )
  await user.type(screen.getByRole('searchbox'), 'TESLA')
  await waitFor(() =>
    expect(api.cars).toHaveBeenLastCalledWith(
      { page: 1, pageSize: 30, search: 'TESLA' },
      expect.anything(),
    ),
  )
  expect(props.onChange).not.toHaveBeenCalled()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('listbox')).toBeNull()
})
it('retains an applied batch after failed loading and supports retry and reset', async () => {
  const user = userEvent.setup()
  api.intakes.mockRejectedValueOnce(new Error('offline'))
  render(<PartSourceFilter {...props} kind="intakes" values={['batch-1']} />)
  await user.click(screen.getByRole('button', { name: 'Партія' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Не вдалося завантажити список',
  )
  expect(props.onChange).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(
    await screen.findByRole('option', { name: 'Жовтень' }),
  ).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByRole('option', { name: 'Жовтень' })).toHaveTextContent(
    /^Жовтень$/,
  )
  await user.click(screen.getByRole('option', { name: 'Партія: усі' }))
  expect(props.onChange).toHaveBeenCalledWith(null)
})
it('does not load protected sources without view permission', () => {
  render(<PartSourceFilter {...props} enabled={false} />)
  const button = screen.getByRole('button', { name: 'Авто' })
  expect(button).toBeDisabled()
  fireEvent.click(button)
  expect(api.cars).not.toHaveBeenCalled()
  expect(api.intakes).not.toHaveBeenCalled()
})

it('clears the previous error when reopening loads successfully', async () => {
  const user = userEvent.setup()
  api.cars.mockRejectedValueOnce(new Error('offline'))
  render(<PartSourceFilter {...props} />)
  const button = screen.getByRole('button', { name: 'Авто' })
  await user.click(button)
  await screen.findByRole('alert')
  await user.keyboard('{Escape}')
  await user.click(button)
  await screen.findByRole('option', { name: 'TESLA-01 · Tesla Model Y (2023)' })
  expect(screen.queryByRole('alert')).toBeNull()
})
