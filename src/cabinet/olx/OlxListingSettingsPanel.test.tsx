import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n/LocaleProvider'
import { tenantRequestScope } from '../tenant-request-scope'
import { OlxListingSettingsPanel } from './OlxListingSettingsPanel'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  update:
    vi.fn<
      (
        request: typeof existing,
        options: { signal: AbortSignal },
      ) => Promise<typeof existing>
    >(),
  city: vi.fn(),
  cities: vi.fn(),
  districts: vi.fn(),
}))

vi.mock('@/api/olx-listing-settings', () => ({ olxListingSettingsApi: api }))

const existing = {
  contactName: 'Олег',
  contactPhone: '+380 67 123 45 67',
  cityId: 1,
  districtId: 11,
  descriptionSuffix: 'Відправляємо Новою поштою.',
}

beforeEach(() => {
  vi.resetAllMocks()
  api.get.mockResolvedValue(existing)
  api.update.mockImplementation((request) => Promise.resolve(request))
  api.city.mockResolvedValue({
    id: 1,
    name: 'Київ',
    region: 'Київська область',
  })
  api.districts.mockResolvedValue([{ id: 11, name: 'Оболонський' }])
})

it('allows reading saved defaults without an integration permission', async () => {
  render(<OlxListingSettingsPanel canManage={false} />)

  expect(await screen.findByLabelText('Ім’я контакту')).toHaveValue('Олег')
  expect(screen.getByLabelText('Телефон')).toHaveAttribute('readonly')
  expect(
    screen.getByRole('textbox', { name: 'Текст наприкінці опису' }),
  ).toHaveAttribute('readonly')
  expect(await screen.findByDisplayValue('Оболонський')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Зберегти' }),
  ).not.toBeInTheDocument()
  expect(api.update).not.toHaveBeenCalled()
})

it('keeps the selected location and other edits through dictionary and save failures', async () => {
  api.city.mockRejectedValueOnce(new Error('catalog unavailable'))
  api.districts.mockRejectedValueOnce(new Error('catalog unavailable'))
  api.update.mockRejectedValueOnce(new Error('save unavailable'))
  render(<OlxListingSettingsPanel canManage />)

  expect(
    await screen.findByText(/Не вдалося отримати міста й райони з OLX/),
  ).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Ім’я контакту'), {
    target: { value: 'Ірина' },
  })
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Текст наприкінці опису' }),
    {
      target: { value: 'Перевірка при отриманні.' },
    },
  )
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

  expect(
    await screen.findByText(/Введений текст не втрачено/),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Ім’я контакту')).toHaveValue('Ірина')
  expect(
    screen.getByRole('textbox', { name: 'Текст наприкінці опису' }),
  ).toHaveValue('Перевірка при отриманні.')
  expect(api.update.mock.lastCall?.[0]).toMatchObject({
    cityId: existing.cityId,
    districtId: existing.districtId,
  })

  fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Місто' })).toHaveTextContent(
      'Київ',
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
  await screen.findByText(/Налаштування збережено/)
  expect(api.update.mock.lastCall?.[0]).toEqual({
    ...existing,
    contactName: 'Ірина',
    descriptionSuffix: 'Перевірка при отриманні.',
  })
  expect(api.update.mock.lastCall?.[1].signal).toBeInstanceOf(AbortSignal)
})

it('loads districts for a selected city and saves the new city and district together', async () => {
  api.cities.mockResolvedValue([
    { id: 2, name: 'Львів', region: 'Львівська область' },
  ])
  api.districts
    .mockResolvedValueOnce([{ id: 11, name: 'Оболонський' }])
    .mockResolvedValueOnce([{ id: 21, name: 'Галицький' }])
  render(<OlxListingSettingsPanel canManage />)

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Місто' })).toHaveTextContent(
      'Київ',
    ),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Місто' }))
  fireEvent.change(screen.getByRole('searchbox'), {
    target: { value: 'Львів' },
  })
  fireEvent.click(await screen.findByRole('option', { name: /Львів/ }))
  const district = await screen.findByRole('combobox', { name: 'Район' })
  expect(district).toHaveValue('')
  fireEvent.change(district, { target: { value: '21' } })
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

  await waitFor(() =>
    expect(api.update.mock.lastCall?.[0]).toEqual({
      ...existing,
      cityId: 2,
      districtId: 21,
    }),
  )
})

it('preserves the draft and associates a rejected phone number with its field', async () => {
  api.update.mockRejectedValueOnce({
    kind: 'validation',
    message: 'Invalid settings',
    fieldErrors: { ContactPhone: ['Invalid phone number'] },
  })
  render(<OlxListingSettingsPanel canManage />)

  const phone = await screen.findByLabelText('Телефон')
  fireEvent.change(phone, { target: { value: '+380 67' } })
  fireEvent.change(screen.getByLabelText('Ім’я контакту'), {
    target: { value: 'Ірина' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

  expect(await screen.findByText(/Виправте позначені поля/)).toBeInTheDocument()
  expect(phone).toHaveAttribute('aria-invalid', 'true')
  expect(phone).toHaveAccessibleDescription(/Перевірте номер телефону/)
  expect(screen.getByLabelText('Ім’я контакту')).toHaveValue('Ірина')
})

it('uses the Polish cabinet locale', async () => {
  render(
    <LocaleProvider locale="pl">
      <OlxListingSettingsPanel canManage />
    </LocaleProvider>,
  )

  expect(
    await screen.findByRole('heading', { name: 'Kontakt i lokalizacja' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Zapisz' })).toBeInTheDocument()
  expect(screen.getByText('Cena sprzedaży z karty części')).toBeInTheDocument()
})

it('cannot submit a draft after the cabinet changes tenant scope', async () => {
  render(<OlxListingSettingsPanel canManage />)
  fireEvent.change(await screen.findByLabelText('Ім’я контакту'), {
    target: { value: 'Ірина' },
  })
  tenantRequestScope.rotate()
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

  expect(api.update).not.toHaveBeenCalled()
})
