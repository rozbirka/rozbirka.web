import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { LocaleProvider } from '@/i18n'
import { OlxLiveWorkspace } from './OlxLiveWorkspace'

const api = vi.hoisted(() => ({
  publication: vi.fn(),
  saveDraft: vi.fn(),
  publish: vi.fn(),
  refreshPublication: vi.fn(),
  remove: vi.fn(),
  city: vi.fn(),
  adverts: vi.fn(),
  preparation: vi.fn(),
  categories: vi.fn(),
  attributes: vi.fn(),
  cities: vi.fn(),
  districts: vi.fn(),
  preview: vi.fn(),
}))
vi.mock('@/api/olx-live', () => ({ olxLiveApi: api }))
const coreParts = vi.hoisted(() => ({ get: vi.fn(), compatibilities: vi.fn() }))
vi.mock('@/api/parts', () => ({ partsApi: coreParts }))
vi.mock('@/components/parts/PartSearchPicker', () => ({
  PartSearchPicker: ({
    onSelect,
  }: {
    onSelect: (v: { id: string; name: string }) => void
  }) => (
    <button onClick={() => onSelect({ id: 'part-1', name: 'Фара' })}>
      Вибрати фару
    </button>
  ),
}))
const part = {
  partId: 'part-1',
  title: 'Передня фара Volkswagen Golf',
  status: 'available',
  price: 1200,
  currency: 'UAH',
  photos: ['https://images.example.test/a.jpg'],
}
beforeEach(() => {
  vi.resetAllMocks()
  api.publication.mockResolvedValue({
    partId: 'part-1',
    revision: null,
    state: 'draft',
    advertId: null,
    observedStatus: null,
    error: null,
    removeRequested: false,
    content: null,
    canWrite: true,
  })
  api.adverts.mockResolvedValue({
    items: [
      {
        id: '123',
        title: 'Фара на OLX',
        status: 'new',
        url: 'https://www.olx.ua/d/uk/obyavlenie/test.html',
        price: 1200,
        currency: 'UAH',
      },
    ],
    page: 1,
    hasMore: false,
    checkedAt: '2026-11-18T12:00:00Z',
  })
  api.preparation.mockResolvedValue({
    part,
    suggestions: [
      { id: 2544, name: 'Фари', path: 'Запчастини / Фари', photosLimit: 13 },
    ],
  })
  api.categories.mockResolvedValue([
    { id: 2544, name: 'Фари', path: 'Запчастини / Фари', photosLimit: 13 },
  ])
  api.attributes.mockResolvedValue([
    {
      code: 'state',
      label: 'Стан',
      required: true,
      numeric: false,
      multiple: false,
      values: [{ code: 'used', label: 'Вживане' }],
    },
  ])
  api.preview.mockResolvedValue({
    part,
    category: null,
    issues: [{ field: 'category', code: 'category_required' }],
  })
})
it('reads real adverts on opening and refreshes only after an explicit action', async () => {
  render(<OlxLiveWorkspace canReadParts={false} />)
  expect(await screen.findByRole('link', { name: '№ 123' })).toHaveAttribute(
    'href',
    'https://www.olx.ua/d/uk/obyavlenie/test.html',
  )
  expect(screen.getByText('На модерації')).toBeInTheDocument()
  expect(api.adverts).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Оновити оголошення' }))
  await waitFor(() => expect(api.adverts).toHaveBeenCalledTimes(2))
  expect(api.preparation).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: 'Опублікувати' }),
  ).not.toBeInTheDocument()
})

it('combines search and status filters within the loaded OLX page', async () => {
  api.adverts.mockResolvedValue({
    items: [
      {
        id: '88124502',
        title: 'Фара Volkswagen',
        linkedPart: { partId: 'part-1', partName: 'Фара передня ліва' },
        status: 'active',
        price: 1200,
        currency: 'UAH',
      },
      { id: '88124519', title: 'Бампер', status: 'unpaid' },
      { id: '88124526', title: 'Фара права', status: 'new' },
    ],
    page: 1,
    hasMore: true,
    checkedAt: '2026-11-18T12:00:00Z',
  })
  render(<OlxLiveWorkspace canReadParts={false} />)

  expect(
    await screen.findByRole('rowheader', { name: /Фара передня ліва/ }),
  ).toBeInTheDocument()
  const search = screen.getByRole('searchbox', { name: 'Пошук оголошень OLX' })

  fireEvent.change(search, { target: { value: '№ 8812 4502' } })
  expect(
    screen.getByRole('rowheader', { name: /Фара передня ліва/ }),
  ).toBeVisible()
  expect(screen.queryByText('Фара права')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('radio', { name: 'Потребують уваги' }))
  expect(screen.getByText('На цій сторінці збігів немає')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Далі' })).toBeEnabled()

  fireEvent.change(search, { target: { value: '' } })
  expect(screen.getByRole('rowheader', { name: /Бампер/ })).toBeVisible()
  expect(screen.queryByText('На модерації')).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('radio', { name: 'Активні' }))
  fireEvent.change(search, { target: { value: 'ПЕРЕДНЯ' } })
  expect(
    screen.getByRole('rowheader', { name: /Фара передня ліва/ }),
  ).toBeVisible()
  expect(api.adverts).toHaveBeenCalledTimes(1)
})

it('accepts an advert number copied from the localised link', async () => {
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <OlxLiveWorkspace canReadParts={false} />
    </LocaleProvider>,
  )
  const advert = await screen.findByRole('link', { name: 'No. 123' })
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search OLX adverts' }),
    {
      target: { value: 'No. 123' },
    },
  )
  expect(advert).toBeVisible()
})

function choosePartToPrepare() {
  fireEvent.click(
    screen.getByRole('button', { name: 'Підготувати публікацію' }),
  )
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Вибрати фару',
    }),
  )
}

it('fills an editable OLX description from actual part fields and verified fitment', async () => {
  coreParts.get.mockResolvedValue({
    name: part.title,
    condition: 'good',
    oemCode: '5G1941006',
    notes: 'Внутрішня нотатка складу',
  })
  coreParts.compatibilities.mockResolvedValue({
    items: [
      {
        makeName: 'Volkswagen',
        modelName: 'Golf',
        generationName: 'VII',
        yearFrom: 2013,
        yearTo: 2019,
        verificationStatus: 'Verified',
      },
      { makeName: 'Audi', modelName: 'A3', verificationStatus: 'Unverified' },
    ],
  })
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  const description = await screen.findByRole('textbox', {
    name: 'Публічний опис',
  })
  const fill = screen.getByRole('button', { name: 'Заповнити з картки' })
  expect(coreParts.compatibilities).not.toHaveBeenCalled()
  fireEvent.click(fill)
  await waitFor(() =>
    expect(description).toHaveValue(
      [
        part.title,
        'Стан — Хороший.',
        'OEM 5G1941006',
        '',
        'Підтверджена сумісність',
        'Volkswagen Golf VII (2013 – 2019)',
      ].join('\n'),
    ),
  )
  expect(description).toHaveFocus()
  expect(
    screen.queryByRole('button', { name: 'Заповнити з картки' }),
  ).toBeNull()
  fireEvent.change(description, { target: { value: 'Уточнений опис' } })
  expect(description).toHaveValue('Уточнений опис')
  expect(api.saveDraft).not.toHaveBeenCalled()
  expect(api.publish).not.toHaveBeenCalled()
})

it('keeps a description typed while the part details are loading', async () => {
  let complete!: (value: { items: [] }) => void
  const pending = new Promise<{ items: [] }>((resolve) => {
    complete = resolve
  })
  coreParts.get.mockResolvedValue({ condition: 'good', oemCode: null })
  coreParts.compatibilities.mockReturnValue(pending)
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  const description = await screen.findByRole('textbox', {
    name: 'Публічний опис',
  })
  fireEvent.click(screen.getByRole('button', { name: 'Заповнити з картки' }))
  fireEvent.change(description, { target: { value: 'Ввів власний опис' } })
  await act(() => {
    complete({ items: [] })
    return pending
  })
  expect(description).toHaveValue('Ввів власний опис')
})

it('shows remaining publication fields and moves focus to the matching control', async () => {
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  const checklist = within(
    await screen.findByRole('region', { name: 'Залишилося заповнити' }),
  )
  fireEvent.click(checklist.getByRole('button', { name: 'Оберіть категорію' }))
  expect(screen.getByRole('button', { name: 'Категорія OLX' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: /^Фари.*Запчастини/ }))

  const condition = await checklist.findByRole('button', {
    name: 'Оберіть стан',
  })
  expect(
    checklist.queryByRole('button', { name: 'Оберіть категорію' }),
  ).toBeNull()
  fireEvent.click(condition)
  const state = screen.getByRole('button', { name: 'Стан' })
  expect(state).toHaveFocus()
  fireEvent.click(state)
  fireEvent.click(await screen.findByRole('option', { name: 'Вживане' }))
  expect(checklist.queryByRole('button', { name: 'Оберіть стан' })).toBeNull()

  fireEvent.click(checklist.getByRole('button', { name: 'Заповніть опис' }))
  const description = screen.getByRole('textbox', { name: 'Публічний опис' })
  expect(description).toHaveFocus()
  fireEvent.change(description, {
    target: { value: 'Вживана оригінальна фара. '.repeat(4) },
  })
  expect(checklist.queryByRole('button', { name: /опис/ })).toBeNull()
  expect(api.preview).not.toHaveBeenCalled()
})

it('flags a saved free-text compatibility list before sending a preview', async () => {
  api.publication.mockResolvedValue({
    partId: 'part-1',
    revision: 'draft-1',
    state: 'draft',
    advertId: null,
    canWrite: true,
    content: {
      publicDescription: '',
      categoryId: 2544,
      categoryConfirmed: true,
      attributes: { compatibility_list: ['ID 4'] },
      advertiserType: '',
      contactName: '',
      contactPhone: '',
      cityId: null,
      districtId: null,
    },
  })
  api.attributes.mockResolvedValue([
    {
      code: 'compatibility_list',
      label: 'Список сумісності',
      required: false,
      numeric: false,
      multiple: false,
      values: [],
    },
  ])
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()

  const field = await screen.findByRole('textbox', {
    name: 'Список сумісності',
  })
  expect(field).toHaveValue('ID 4')
  expect(field).toHaveAttribute('readonly')
  expect(field).toHaveAccessibleDescription(/OLX очікує авто з каталогу/)
  const preview = screen.getByRole('button', { name: 'Перевірити дані' })
  expect(preview).toBeDisabled()
  expect(api.preview).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Очистити список' }))
  expect(field).toHaveValue('')
  expect(field).toHaveAccessibleDescription(/Залиште поле порожнім/)
  expect(preview).toBeEnabled()
  fireEvent.click(preview)
  await waitFor(() =>
    expect(api.preview.mock.calls[0]?.[1]).toMatchObject({
      attributes: { compatibility_list: [] },
    }),
  )
})

it('prepares a Core part, requires an explicit category choice and shows server preview issues', async () => {
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  choosePartToPrepare()
  expect(await screen.findByText(part.title)).toBeInTheDocument()
  expect(api.attributes).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /^Фари.*Запчастини/ }))
  expect(
    await screen.findByRole('button', { name: /^Стан$/ }),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити дані' }))
  await waitFor(() => expect(api.preview).toHaveBeenCalled())
  expect(api.preview.mock.calls[0]?.[1]).toMatchObject({
    categoryId: 2544,
    categoryConfirmed: true,
    publicDescription: '',
    attributes: {},
  })
  expect(await screen.findByText('Оберіть категорію OLX.')).toBeInTheDocument()
  expect(screen.getByText(/Збережіть чернетку/)).toBeInTheDocument()
})
it('shows a retryable error and never treats a failed read as an empty seller account', async () => {
  api.adverts.mockRejectedValueOnce(new Error('network'))
  render(<OlxLiveWorkspace canReadParts={false} />)
  expect(
    await screen.findByText('Не вдалося завантажити оголошення'),
  ).toBeInTheDocument()
  expect(screen.queryByText('Оголошень поки немає')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(await screen.findByRole('link', { name: '№ 123' })).toBeInTheDocument()
})

it('retries failed attributes without clearing the selected category or entered description', async () => {
  api.attributes.mockRejectedValueOnce(new Error('network'))
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  fireEvent.click(
    await screen.findByRole('button', { name: /^Фари.*Запчастини/ }),
  )
  await screen.findByText(/Не вдалося завантажити характеристики/)
  fireEvent.change(screen.getByLabelText(/Публічний опис/), {
    target: { value: 'Збережений опис' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  expect(
    await screen.findByRole('button', { name: /^Стан$/ }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText(/Публічний опис/)).toHaveValue('Збережений опис')
  expect(api.attributes).toHaveBeenCalledTimes(2)
})

it('preserves every value of a free-text multi-value attribute', async () => {
  api.attributes.mockResolvedValue([
    {
      code: 'part_num',
      label: 'Оригінальні номери',
      required: false,
      numeric: false,
      multiple: true,
      values: [],
    },
  ])
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  fireEvent.click(
    await screen.findByRole('button', { name: /^Фари.*Запчастини/ }),
  )
  const field = await screen.findByLabelText('Оригінальні номери')
  expect(field.tagName).toBe('TEXTAREA')
  fireEvent.change(field, { target: { value: 'ABC123\nDEF456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити дані' }))
  await waitFor(() => expect(api.preview).toHaveBeenCalled())
  expect(api.preview.mock.calls[0]?.[1]).toMatchObject({
    attributes: { part_num: ['ABC123', 'DEF456'] },
  })
})

it('confirms a real publish, saves one revision and keeps moderation withdrawal pending until confirmed', async () => {
  api.preview.mockResolvedValue({
    part,
    category: {
      id: 2544,
      name: 'Фари',
      path: 'Запчастини / Фари',
      photosLimit: 13,
    },
    issues: [],
  })
  const saved = {
    partId: 'part-1',
    revision: 'draft-revision',
    state: 'draft',
    advertId: null,
    observedStatus: null,
    error: null,
    removeRequested: false,
    content: null,
    canWrite: true,
  }
  api.saveDraft.mockResolvedValue(saved)
  api.publish.mockResolvedValue({
    ...saved,
    revision: 'created-revision',
    state: 'linked',
    advertId: '999',
    observedStatus: 'new',
  })
  api.remove.mockResolvedValue({
    ...saved,
    revision: 'pending-revision',
    state: 'remove_pending',
    advertId: '999',
    observedStatus: 'new',
    removeRequested: true,
  })
  api.refreshPublication.mockResolvedValue({
    ...saved,
    revision: 'removed-revision',
    state: 'removed',
    advertId: '999',
    observedStatus: 'removed_by_user',
    removeRequested: true,
  })
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  fireEvent.click(
    await screen.findByRole('button', { name: /^Фари.*Запчастини/ }),
  )
  await screen.findByRole('button', { name: /^Стан$/ })
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити дані' }))
  await screen.findByText('Структурна перевірка пройшла')
  fireEvent.click(screen.getByRole('button', { name: 'Опублікувати на OLX' }))
  expect(api.publish).not.toHaveBeenCalled()
  const dialog = screen.getByRole('dialog')
  expect(dialog).toHaveTextContent(part.title)
  fireEvent.click(
    within(dialog).getByRole('button', { name: 'Опублікувати на OLX' }),
  )
  await waitFor(() =>
    expect(api.publish).toHaveBeenCalledWith(
      'part-1',
      'draft-revision',
      expect.anything(),
    ),
  )
  fireEvent.keyDown(
    await screen.findByRole('button', { name: 'Інші дії з оголошенням OLX' }),
    { key: 'Enter' },
  )
  fireEvent.click(
    await screen.findByRole('menuitem', { name: 'Зняти з публікації' }),
  )
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Зняти з публікації',
    }),
  )
  expect(
    await screen.findByText('Зняття очікує підтвердження OLX'),
  ).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Оновити статус' }))
  expect(await screen.findByText('Знято з публікації')).toBeInTheDocument()
  expect(api.publish).toHaveBeenCalledTimes(1)
})

it('shows the provider reason against the affected fields and clears only the field edited', async () => {
  api.preview.mockResolvedValue({ part, category: null, issues: [] })
  const saved = {
    partId: 'part-1',
    revision: 'draft-revision',
    state: 'draft',
    advertId: null,
    error: null,
    canWrite: true,
  }
  api.saveDraft.mockResolvedValue(saved)
  api.publish.mockResolvedValue({
    ...saved,
    state: 'rejected',
    error: 'OLX_WRITE_REJECTED',
    errorFields: [
      'attributes.state:invalid',
      'description:contact_links',
      'images:image_unavailable',
    ],
  })

  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  fireEvent.click(
    await screen.findByRole('button', { name: /^Фари.*Запчастини/ }),
  )
  const state = await screen.findByRole('button', { name: /^Стан$/ })
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити дані' }))
  await screen.findByText('Структурна перевірка пройшла')
  fireEvent.click(screen.getByRole('button', { name: 'Опублікувати на OLX' }))
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Опублікувати на OLX',
    }),
  )

  const description = await waitFor(() => {
    const field = screen.getByRole('textbox', { name: 'Публічний опис' })
    expect(field).toHaveAttribute('aria-invalid', 'true')
    return field
  })
  expect(description).toHaveAccessibleDescription(/посилання й адреси/)
  expect(state).toHaveAccessibleDescription(/OLX не прийняв це значення/)
  expect(screen.getByText(/OLX не зміг завантажити фото/)).toBeVisible()

  fireEvent.change(description, { target: { value: 'Виправлений опис.' } })
  expect(description).not.toHaveAttribute('aria-invalid')
  expect(state).toHaveAttribute('aria-invalid', 'true')
  expect(api.publish).toHaveBeenCalledTimes(1)
})

it('recovers a lost publish response by reading saved state without sending another create', async () => {
  api.preview.mockResolvedValue({
    part,
    category: {
      id: 2544,
      name: 'Фари',
      path: 'Запчастини / Фари',
      photosLimit: 13,
    },
    issues: [],
  })
  api.saveDraft.mockResolvedValue({
    partId: 'part-1',
    revision: 'saved-revision',
    state: 'draft',
    canWrite: true,
  })
  api.publish.mockRejectedValueOnce(new Error('lost response'))
  api.publication
    .mockResolvedValueOnce({
      partId: 'part-1',
      revision: null,
      state: 'draft',
      canWrite: true,
      content: null,
    })
    .mockResolvedValueOnce({
      partId: 'part-1',
      revision: 'created-revision',
      state: 'linked',
      canWrite: true,
      advertId: '999',
      observedStatus: 'new',
    })
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  fireEvent.click(
    await screen.findByRole('button', { name: /^Фари.*Запчастини/ }),
  )
  await screen.findByRole('button', { name: /^Стан$/ })
  fireEvent.click(screen.getByRole('button', { name: 'Перевірити дані' }))
  await screen.findByText('Структурна перевірка пройшла')
  fireEvent.click(screen.getByRole('button', { name: 'Опублікувати на OLX' }))
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Опублікувати на OLX',
    }),
  )
  expect(
    await screen.findByText('На модерації', {
      exact: true,
      selector: '[role="status"] span',
    }),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Оновити статус' })).toBeEnabled()
  expect(api.publish).toHaveBeenCalledTimes(1)
  expect(api.publication).toHaveBeenCalledTimes(2)
})

it('saves only the linked public description for synchronization without creating another advert', async () => {
  const content = {
    publicDescription: 'a'.repeat(80),
    categoryId: 2544,
    categoryConfirmed: true,
    attributes: { state: ['used'] },
    advertiserType: 'business',
    contactName: 'Existing seller',
    contactPhone: '',
    cityId: 1,
    districtId: null,
  }
  const linked = {
    partId: 'part-1',
    revision: 'linked-revision',
    state: 'linked',
    advertId: '123',
    observedStatus: 'active',
    error: null,
    removeRequested: false,
    content,
    canWrite: true,
  }
  api.publication.mockResolvedValue(linked)
  api.city.mockResolvedValue({ id: 1, name: 'Київ', region: 'Київ' })
  api.districts.mockResolvedValue([])
  api.saveDraft.mockResolvedValue({
    ...linked,
    state: 'update_pending',
    revision: 'new-revision',
    content: { ...content, publicDescription: 'b'.repeat(80) },
  })
  render(<OlxLiveWorkspace canReadParts canEditParts />)
  choosePartToPrepare()
  fireEvent.click(
    await screen.findByRole('button', { name: 'Редагувати опис' }),
  )
  const description = await screen.findByLabelText(/Публічний опис/)
  expect(description).toBeEnabled()
  expect(
    screen.queryByRole('button', { name: /^Фари.*Запчастини/ }),
  ).not.toBeInTheDocument()
  fireEvent.change(description, { target: { value: 'b'.repeat(80) } })
  fireEvent.click(screen.getByRole('button', { name: 'Зберегти зміни' }))
  await waitFor(() =>
    expect(api.saveDraft).toHaveBeenCalledWith(
      'part-1',
      { ...content, publicDescription: 'b'.repeat(80) },
      'linked-revision',
      expect.anything(),
    ),
  )
  expect(
    await screen.findByText('Зміни збережено й передано на оновлення OLX.'),
  ).toBeInTheDocument()
  expect(api.publish).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: 'Опублікувати в OLX' }),
  ).not.toBeInTheDocument()
})
