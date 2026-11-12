/* eslint-disable @typescript-eslint/unbound-method -- mock API assertions */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ActionMenu, FactRows } from '@/components/app'
import { providerReturnApi } from '@/api/provider-return'
import { ProviderReturnPanel } from './ProviderReturnPanel'

vi.mock('@/api/provider-return', () => ({
  providerReturnApi: {
    get: vi.fn(),
    options: vi.fn(),
    subtypes: vi.fn(),
    quote: vi.fn(),
    create: vi.fn(),
    refresh: vi.fn(),
    candidates: vi.fn(),
    confirm: vi.fn(),
    settlements: vi.fn(),
    divisions: vi.fn(),
    externalCandidates: vi.fn(),
    attachExternal: vi.fn(),
  },
}))

const accepted = {
  capability: { canCreate: false, blockReason: null },
  sourceVersion: 'source-v',
  version: 'request-v',
  state: 'Accepted',
  requestStatus: 'Прийняте',
  requestRef: 'request-ref',
  requestNumber: '102-001',
  reverse: null,
}
const props = {
  integrationId: 'i',
  shipmentId: 's',
  sourceNumber: '20400000000001',
  canManage: true,
  enabled: true,
}

it('hides an unused return card after the buyer received the parcel', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    capability: { canCreate: false, blockReason: 'buyer_received' },
    state: null,
    requestRef: null,
    requestNumber: null,
    requestStatus: null,
    version: null,
  })
  const { rerender } = render(<ProviderReturnPanel {...props} />)
  await waitFor(() =>
    expect(
      screen.queryByRole('region', { name: 'Повернення посилки · Нова пошта' }),
    ).not.toBeInTheDocument(),
  )
  expect(screen.queryByText('Не оформлено')).not.toBeInTheDocument()
  expect(screen.queryByText(/Посилку вже отримано/)).not.toBeInTheDocument()

  rerender(
    <ProviderReturnPanel
      {...props}
      renderActions={() => <div>Картка доставки</div>}
    />,
  )
  expect(screen.getByText('Картка доставки')).toBeVisible()
})

it('keeps an existing return visible after the buyer received the parcel', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    capability: { canCreate: false, blockReason: 'buyer_received' },
  })
  render(<ProviderReturnPanel {...props} />)
  expect(
    await screen.findByRole('button', { name: 'Оновити повернення' }),
  ).toBeVisible()
})

it('explains an unavailable return and separates searching for an existing carrier request', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    capability: {
      canCreate: false,
      canFindExternal: true,
      blockReason: 'source_not_eligible',
    },
    version: null,
    state: null,
    requestRef: null,
    requestNumber: null,
  })
  vi.mocked(providerReturnApi.externalCandidates).mockResolvedValue({
    sourceVersion: 'source-v',
    candidates: [],
  })
  render(<ProviderReturnPanel {...props} />)
  expect(await screen.findByText('Повернення ще недоступне')).toBeVisible()
  expect(screen.getByText('Не оформлено')).toBeVisible()
  expect(
    screen.getByText(/Якщо повернення вже оформлено в кабінеті НП/),
  ).toBeVisible()
  expect(
    screen.queryByRole('button', { name: 'Оформити повернення НП' }),
  ).toBeNull()
  expect(screen.queryByText(/Після повернення й огляду посилки/)).toBeNull()
  await user.click(
    screen.getByRole('button', { name: 'Знайти повернення в НП' }),
  )
  await waitFor(() =>
    expect(providerReturnApi.externalCandidates).toHaveBeenCalledWith('i', 's'),
  )
  expect(providerReturnApi.create).not.toHaveBeenCalled()
})

it('attaches a provider-created return only after the manager confirms its details', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    capability: {
      canCreate: false,
      blockReason: 'native_return_exists',
      canFindExternal: true,
    },
    version: null,
    state: null,
    requestRef: null,
    requestNumber: null,
  })
  const candidate = {
    ref: 'external-ref',
    number: '102-EXTERNAL',
    sourceNumber: props.sourceNumber,
    status: 'Прийняте',
    reverseNumber: '20400000000002',
    addressRecipient: 'Львів · Відділення №2',
    contactPersonRecipient: 'Відправник',
  }
  vi.mocked(providerReturnApi.externalCandidates).mockResolvedValue({
    sourceVersion: 'fresh-source-v',
    candidates: [candidate],
  })
  vi.mocked(providerReturnApi.attachExternal).mockResolvedValue({
    ...accepted,
    isExternal: true,
    requestNumber: candidate.number,
  })
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Знайти повернення в НП' }),
  )
  expect(
    await screen.findByText(candidate.addressRecipient),
  ).toBeInTheDocument()
  expect(providerReturnApi.attachExternal).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Це наше повернення' }))
  await waitFor(() =>
    expect(providerReturnApi.attachExternal).toHaveBeenCalledWith(
      'i',
      's',
      'fresh-source-v',
      candidate,
    ),
  )
  expect(await screen.findByText('Прив’язано з НП')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Це наше повернення' }),
  ).not.toBeInTheDocument()
  expect(providerReturnApi.create).not.toHaveBeenCalled()
})
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    capability: { canCreate: true, blockReason: null },
    sourceVersion: 'source-v',
    version: null,
    state: null,
    requestStatus: null,
    requestRef: null,
    requestNumber: null,
    reverse: null,
  })
  vi.mocked(providerReturnApi.options).mockResolvedValue({
    addresses: [
      {
        ref: 'a',
        city: 'Львів',
        address: 'Відділення №1',
        phone: '',
        counterparty: '',
        contactPerson: '',
        nonCash: false,
      },
    ],
    reasons: [{ ref: 'r', description: 'Відмова отримувача' }],
  })
  vi.mocked(providerReturnApi.subtypes).mockResolvedValue([
    { ref: 'sub', description: 'Не потрібний товар', reasonRef: 'r' },
  ])
  vi.mocked(providerReturnApi.quote).mockResolvedValue({
    cost: 93,
    scheduledDeliveryDate: null,
  })
  vi.mocked(providerReturnApi.create).mockResolvedValue(accepted)
  vi.mocked(providerReturnApi.settlements).mockResolvedValue({
    items: [
      {
        ref: 'city-2',
        name: 'Київ',
        prohibitedSending: false,
        prohibitedIssuance: false,
      },
    ],
    page: 1,
    lastPage: 1,
  })
  vi.mocked(providerReturnApi.divisions).mockResolvedValue({
    items: [
      {
        ref: 'branch-2',
        name: 'Відділення №2',
        settlementRef: 'city-2',
        countryCode: 'UA',
        sendingAllowed: true,
        receivingAllowed: true,
      },
    ],
    page: 1,
    lastPage: 1,
  })
})

it('quotes another branch and shows its actual destination before explicit submission', async () => {
  const user = userEvent.setup()
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Оформити повернення НП' }),
  )
  await user.click(screen.getByRole('radio', { name: 'В інше відділення' }))
  await user.type(
    screen.getByRole('combobox', { name: 'Населений пункт повернення' }),
    'Ки',
  )
  await user.click(await screen.findByRole('button', { name: 'Київ' }))
  await screen.findByRole('option', { name: 'Відділення №2' })
  await user.selectOptions(
    screen.getByLabelText('Відділення повернення'),
    'branch-2',
  )
  await user.selectOptions(screen.getByLabelText('Причина повернення'), 'r')
  await user.selectOptions(
    await screen.findByLabelText('Уточнення причини'),
    'sub',
  )
  await user.click(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  )
  expect(providerReturnApi.quote).toHaveBeenCalledWith(
    'i',
    's',
    expect.objectContaining({
      returnAddressRef: '',
      recipientSettlementRef: 'city-2',
      recipientWarehouseRef: 'branch-2',
    }),
  )
  expect(await screen.findByText('Київ · Відділення №2')).toBeInTheDocument()
  expect(providerReturnApi.create).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Змінити дані' }))
  await user.click(screen.getByRole('radio', { name: 'На початкову адресу' }))
  await user.click(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  )
  expect(providerReturnApi.quote).toHaveBeenLastCalledWith(
    'i',
    's',
    expect.objectContaining({
      returnAddressRef: 'a',
      recipientWarehouseRef: undefined,
      recipientSettlementRef: undefined,
    }),
  )
})

it('clears a selected branch when the return city is edited', async () => {
  const user = userEvent.setup()
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Оформити повернення НП' }),
  )
  await user.click(screen.getByRole('radio', { name: 'В інше відділення' }))
  const city = screen.getByRole('combobox', {
    name: 'Населений пункт повернення',
  })
  await user.type(city, 'Ки')
  await user.click(await screen.findByRole('button', { name: 'Київ' }))
  await screen.findByRole('option', { name: 'Відділення №2' })
  await user.selectOptions(
    screen.getByLabelText('Відділення повернення'),
    'branch-2',
  )
  await user.selectOptions(screen.getByLabelText('Причина повернення'), 'r')
  await user.selectOptions(
    await screen.findByLabelText('Уточнення причини'),
    'sub',
  )
  expect(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  ).toBeEnabled()
  await user.clear(city)
  expect(screen.getByLabelText('Відділення повернення')).toHaveValue('')
  expect(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  ).toBeDisabled()
  expect(providerReturnApi.quote).not.toHaveBeenCalled()
})

it('loads subsequent branch pages and retries a failed page without losing the city', async () => {
  const user = userEvent.setup()
  const second = {
    ref: 'branch-3',
    name: 'Відділення №3',
    settlementRef: 'city-2',
    countryCode: 'UA',
    sendingAllowed: true,
    receivingAllowed: true,
  }
  vi.mocked(providerReturnApi.divisions)
    .mockResolvedValueOnce({ items: [], page: 1, lastPage: 2 })
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockResolvedValueOnce({ items: [second], page: 2, lastPage: 2 })
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Оформити повернення НП' }),
  )
  await user.click(screen.getByRole('radio', { name: 'В інше відділення' }))
  await user.type(
    screen.getByRole('combobox', { name: 'Населений пункт повернення' }),
    'Ки',
  )
  await user.click(await screen.findByRole('button', { name: 'Київ' }))
  await user.click(
    await screen.findByRole('button', { name: 'Показати ще відділення' }),
  )
  expect(
    await screen.findByText(
      'Не вдалося завантажити відділення. Спробуйте ще раз.',
    ),
  ).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Спробувати ще раз' }))
  await screen.findByRole('option', { name: 'Відділення №3' })
  expect(
    screen.getByRole('combobox', { name: 'Населений пункт повернення' }),
  ).toHaveValue('Київ')
  await user.selectOptions(
    screen.getByLabelText('Відділення повернення'),
    'branch-3',
  )
  expect(providerReturnApi.divisions).toHaveBeenLastCalledWith(
    'i',
    's',
    'city-2',
    2,
    expect.anything(),
  )
})

it('separates accepted request from actual reverse TTN and refreshes it', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue(accepted)
  vi.mocked(providerReturnApi.refresh).mockResolvedValue({
    ...accepted,
    reverse: {
      number: '20400000000002',
      status: 'Прибула у відділення',
      statusAt: null,
    },
  })
  render(<ProviderReturnPanel {...props} />)
  expect(await screen.findByText('102-001')).toBeInTheDocument()
  expect(
    screen.getByText('НП ще не створила зворотну ТТН.'),
  ).toBeInTheDocument()
  await userEvent.click(
    screen.getByRole('button', { name: 'Оновити повернення' }),
  )
  expect(await screen.findByText('20400000000002')).toBeInTheDocument()
  expect(
    screen.getByText('Зворотна доставка: Прибула у відділення'),
  ).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Прийняти товар' }),
  ).not.toBeInTheDocument()
})

it('quotes first, requires explicit confirmation and prevents duplicate clicks', async () => {
  render(<ProviderReturnPanel {...props} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Оформити повернення НП' }),
  )
  await userEvent.selectOptions(
    await screen.findByLabelText('Причина повернення'),
    'r',
  )
  await userEvent.selectOptions(
    await screen.findByLabelText('Уточнення причини'),
    'sub',
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  )
  expect(providerReturnApi.create).not.toHaveBeenCalled()
  await userEvent.dblClick(
    await screen.findByRole('button', { name: 'Підтвердити повернення НП' }),
  )
  await waitFor(() => expect(providerReturnApi.create).toHaveBeenCalledTimes(1))
  expect(await screen.findByText('102-001')).toBeInTheDocument()
})

it('does not book a return from a double click on calculate', async () => {
  const user = userEvent.setup()
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Оформити повернення НП' }),
  )
  await user.selectOptions(
    await screen.findByLabelText('Причина повернення'),
    'r',
  )
  await user.selectOptions(
    await screen.findByLabelText('Уточнення причини'),
    'sub',
  )
  await user.dblClick(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  )
  expect(
    await screen.findByRole('button', { name: 'Підтвердити повернення НП' }),
  ).toBeInTheDocument()
  expect(providerReturnApi.create).not.toHaveBeenCalled()
})

it.each([
  new TypeError('Failed to fetch'),
  {
    kind: 'conflict',
    code: 'nova_poshta_outcomeunknown',
    status: 409,
    message: 'Unknown',
  },
])(
  'freezes repeat submission after a lost create response: %j',
  async (problem) => {
    vi.mocked(providerReturnApi.create).mockRejectedValue(problem)
    render(<ProviderReturnPanel {...props} />)
    await userEvent.click(
      await screen.findByRole('button', { name: 'Оформити повернення НП' }),
    )
    await userEvent.selectOptions(
      await screen.findByLabelText('Причина повернення'),
      'r',
    )
    await userEvent.selectOptions(
      await screen.findByLabelText('Уточнення причини'),
      'sub',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
    )
    await userEvent.click(
      await screen.findByRole('button', { name: 'Підтвердити повернення НП' }),
    )
    expect(
      await screen.findByText(/Повторне оформлення заблоковано/),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Оформити повернення НП' }),
    ).not.toBeInTheDocument()
    expect(providerReturnApi.create).toHaveBeenCalledTimes(1)
  },
)

it('provides a direct unknown return result action without opening More', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    state: 'Unknown',
    requestRef: null,
    requestNumber: null,
  })
  render(
    <ProviderReturnPanel
      {...props}
      renderActions={(_actions, facts, primaryAction) => (
        <>
          <FactRows rows={facts} />
          {primaryAction}
        </>
      )}
    />,
  )
  const check = await screen.findByRole('button', {
    name: 'Перевірити результат',
  })
  await userEvent.click(check)
  expect(
    await screen.findByRole('dialog', {
      name: 'Повернення посилки · Нова пошта',
    }),
  ).toBeVisible()
  expect(providerReturnApi.create).not.toHaveBeenCalled()
  await userEvent.keyboard('{Escape}')
  await waitFor(() => expect(check).toHaveFocus())
})

it.each([
  ['Посилка прибула у відділення', 'Зворотна посилка прибула у відділення'],
  ['Посилку отримано', 'Зворотну посилку отримано'],
  [
    'ТТН створена, посилку ще не передано',
    'Зворотна ТТН створена, посилку ще не передано',
  ],
  ['В дорозі', 'Зворотна доставка: В дорозі'],
])('makes the return direction explicit for %s', async (status, expected) => {
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    reverse: { number: '99000000000023', status, statusAt: null },
  })
  render(<ProviderReturnPanel {...props} />)
  expect(await screen.findByText(expected)).toBeVisible()
})

it('keeps history readable without manage permission and disables carrier actions when disconnected', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue(accepted)
  render(<ProviderReturnPanel {...props} canManage={false} enabled={false} />)
  expect(await screen.findByText('102-001')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Оновити повернення' }),
  ).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Оформити повернення НП' }),
  ).not.toBeInTheDocument()
})

it('recovers a lost response with the stored operation version and explicit candidate confirmation', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get)
    .mockResolvedValueOnce({
      capability: { canCreate: false, blockReason: 'request_exists' },
      sourceVersion: 'source-v',
      version: null,
      state: 'Unknown',
      requestStatus: null,
      requestRef: null,
      requestNumber: null,
      reverse: null,
    })
    .mockResolvedValue({
      ...accepted,
      state: 'Unknown',
      version: 'unknown-v',
      requestNumber: null,
      requestRef: null,
    })
  vi.mocked(providerReturnApi.candidates).mockResolvedValue([
    {
      ref: 'candidate',
      number: '102-001',
      sourceNumber: props.sourceNumber,
      status: 'Прийняте',
      reverseNumber: null,
      addressRecipient: 'Львів · Відділення №1',
      contactPersonRecipient: 'Відправник',
    },
  ])
  vi.mocked(providerReturnApi.confirm).mockResolvedValue(accepted)
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Знайти заявку в НП' }),
  )
  expect(await screen.findByText('Львів · Відділення №1')).toBeInTheDocument()
  expect(providerReturnApi.confirm).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Це наша заявка' }))
  await waitFor(() =>
    expect(providerReturnApi.confirm).toHaveBeenCalledWith(
      'i',
      's',
      'candidate',
      'unknown-v',
    ),
  )
  expect(providerReturnApi.create).not.toHaveBeenCalled()
})

it('allows an explicit retry when durable state proves the request was not submitted', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get)
    .mockResolvedValueOnce({
      ...accepted,
      capability: { canCreate: true, blockReason: null },
      state: null,
      version: null,
      requestRef: null,
      requestNumber: null,
    })
    .mockResolvedValue({
      ...accepted,
      state: 'Rejected',
      version: 'rejected-v',
      capability: { canCreate: true, blockReason: null },
      requestRef: null,
      requestNumber: null,
    })
  vi.mocked(providerReturnApi.create).mockRejectedValue(new TypeError('lost'))
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Оформити повернення НП' }),
  )
  await user.selectOptions(
    await screen.findByLabelText('Причина повернення'),
    'r',
  )
  await user.selectOptions(
    await screen.findByLabelText('Уточнення причини'),
    'sub',
  )
  await user.click(
    screen.getByRole('button', { name: 'Перевірити й розрахувати' }),
  )
  await user.click(
    await screen.findByRole('button', { name: 'Підтвердити повернення НП' }),
  )
  expect(await screen.findByText(/НП не прийняла заявку/)).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Оформити повернення НП' }),
  ).toBeInTheDocument()
  expect(providerReturnApi.create).toHaveBeenCalledTimes(1)
})

it('reloads the persisted pause reason after a failed manual return refresh', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get)
    .mockResolvedValueOnce(accepted)
    .mockResolvedValue({
      ...accepted,
      trackingPaused: true,
      trackingFailures: 1,
      syncProblem: 'tracking_unauthorized',
    })
  vi.mocked(providerReturnApi.refresh).mockRejectedValue(
    new Error('Unavailable'),
  )
  render(<ProviderReturnPanel {...props} />)
  await user.click(
    await screen.findByRole('button', { name: 'Оновити повернення' }),
  )
  expect(
    await screen.findByText(/Автоматичні перевірки призупинено/),
  ).toBeVisible()
  expect(screen.getByText(/Нова пошта не приймає API-ключ/)).toBeVisible()
  expect(screen.getByText(/натисніть «Оновити повернення»/)).toBeVisible()
})

it('prioritises the return waybill and keeps request metadata behind a disclosure', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    reverse: {
      number: '99000000000023',
      status: 'ТТН створена, посилку ще не передано',
      statusAt: '2026-11-05T14:44:00Z',
    },
    trackingPending: false,
    trackingCompleted: false,
  })
  render(<ProviderReturnPanel {...props} />)
  expect(await screen.findByText('99000000000023')).toBeVisible()
  expect(
    screen.getByText('Зворотна ТТН створена, посилку ще не передано'),
  ).toBeVisible()
  expect(screen.getByText('102-001')).not.toBeVisible()
  expect(screen.getByText(props.sourceNumber)).not.toBeVisible()
  await userEvent.click(screen.getByText('Дані заявки'))
  expect(screen.getByText('102-001')).toBeVisible()
  expect(screen.getByText(props.sourceNumber)).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Оновити повернення' }),
  ).toBeEnabled()
})

it('keeps a return without a carrier status honest instead of inventing a delivery milestone', async () => {
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    reverse: { number: '99000000000023', status: null, statusAt: null },
  })
  render(<ProviderReturnPanel {...props} />)
  expect(await screen.findByText('99000000000023')).toBeVisible()
  expect(screen.getByText('НП ще не передала статус повернення.')).toBeVisible()
  expect(screen.queryByText('Оновлено')).not.toBeInTheDocument()
})

it('shows the latest successful check even when the carrier status has not changed', async () => {
  const reverse = {
    number: '99000000000023',
    status: 'ТТН створена, посилку ще не передано',
    statusAt: '2026-11-05T14:44:00Z',
  }
  vi.mocked(providerReturnApi.get).mockResolvedValue({ ...accepted, reverse })
  let finish!: (
    value: Awaited<ReturnType<typeof providerReturnApi.refresh>>,
  ) => void
  vi.mocked(providerReturnApi.refresh).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve
    }),
  )
  render(<ProviderReturnPanel {...props} />)
  await userEvent.click(
    await screen.findByRole('button', { name: 'Оновити повернення' }),
  )
  expect(screen.getByRole('button', { name: 'Оновлюємо…' })).toBeDisabled()
  finish({
    ...accepted,
    reverse,
    trackingLastSuccessAt: '2026-11-10T12:40:27Z',
  })
  const checked = await screen.findByText('Перевірено')
  expect(checked).toBeVisible()
  expect(checked.closest('p')?.querySelector('time')).toHaveAttribute(
    'dateTime',
    '2026-11-10T12:40:27Z',
  )
  expect(checked.closest('p')).toHaveTextContent('14:40:27')
  expect(
    screen.getByText('Зворотна ТТН створена, посилку ще не передано'),
  ).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Оновити повернення' }),
  ).toBeEnabled()
})

it('offers return actions in the waybill menu without a standalone card', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get).mockResolvedValue({
    ...accepted,
    capability: { canCreate: true, canFindExternal: true, blockReason: null },
    state: null,
    requestRef: null,
    requestNumber: null,
    version: null,
  })
  vi.mocked(providerReturnApi.externalCandidates).mockResolvedValue({
    sourceVersion: 'source-v',
    candidates: [],
  })
  render(
    <ProviderReturnPanel
      {...props}
      renderActions={(actions) => <ActionMenu label="Ще" actions={actions} />}
    />,
  )
  expect(
    screen.queryByRole('region', { name: 'Повернення посилки · Нова пошта' }),
  ).not.toBeInTheDocument()
  await user.click(await screen.findByRole('button', { name: 'Ще' }))
  await user.click(
    await screen.findByRole('menuitem', { name: 'Знайти повернення в НП' }),
  )
  expect(
    await screen.findByRole('dialog', {
      name: 'Повернення посилки · Нова пошта',
    }),
  ).toBeVisible()
  expect(
    await screen.findByText(/Заявку не знайдено в перевіреній частині списку/),
  ).toBeVisible()
  expect(providerReturnApi.externalCandidates).toHaveBeenCalledWith('i', 's')
  expect(providerReturnApi.create).not.toHaveBeenCalled()
})

it('keeps an existing return readable from the menu with the integration disconnected', async () => {
  const user = userEvent.setup()
  vi.mocked(providerReturnApi.get).mockResolvedValue(accepted)
  render(
    <ProviderReturnPanel
      {...props}
      enabled={false}
      canManage={false}
      renderActions={(actions) => <ActionMenu label="Ще" actions={actions} />}
    />,
  )
  await user.click(await screen.findByRole('button', { name: 'Ще' }))
  await user.click(
    await screen.findByRole('menuitem', {
      name: 'Повернення посилки · Нова пошта',
    }),
  )
  const sheet = await screen.findByRole('dialog', {
    name: 'Повернення посилки · Нова пошта',
  })
  expect(sheet).not.toHaveTextContent('Заявку подано')
  await user.click(screen.getByText('Дані заявки'))
  expect(sheet).toHaveTextContent('102-001')
  expect(
    screen.queryByRole('button', { name: 'Оновити повернення' }),
  ).not.toBeInTheDocument()
  expect(providerReturnApi.create).not.toHaveBeenCalled()
})

it.each([
  ['Submitting', 'Заявка надсилається'],
  ['Unknown', 'Результат заявки невідомий'],
  ['Rejected', 'НП відхилила заявку'],
  ['Accepted', 'Заявку прийнято · Очікуємо зворотну ТТН'],
])(
  'exposes the %s return status to the existing delivery card',
  async (state, label) => {
    vi.mocked(providerReturnApi.get).mockResolvedValue({
      ...accepted,
      state,
      reverse: null,
      capability: {
        canCreate: false,
        canFindExternal: false,
        blockReason: 'request_exists',
      },
      requestRef: state === 'Accepted' ? 'r' : null,
      requestNumber: state === 'Accepted' ? '102-001' : null,
    })
    render(
      <ProviderReturnPanel
        {...props}
        renderActions={(_actions, facts) => <FactRows rows={facts} />}
      />,
    )
    expect(await screen.findByText(label)).toBeVisible()
    expect(screen.getByText('Повернення')).toBeVisible()
    expect(screen.queryByText('Зворотна ТТН')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Повернення посилки · Нова пошта' }),
    ).not.toBeInTheDocument()
  },
)
