/* eslint-disable @typescript-eslint/unbound-method -- Vitest mock methods are asserted directly. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { integrationsApi } from '@/api/integrations'
import { SettlementPicker } from './settlement-picker'

vi.mock('@/api/integrations', () => ({
  integrationsApi: { settlements: vi.fn() },
}))

const page = (
  items: {
    ref: string
    name: string
    prohibitedSending?: boolean | null
    prohibitedIssuance?: boolean | null
  }[],
) => ({
  items: items.map((item) => ({
    prohibitedSending: null,
    prohibitedIssuance: null,
    ...item,
  })),
  page: 1,
  lastPage: 1,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(integrationsApi.settlements).mockResolvedValue(
    page([
      { ref: '8d5a980d-391c-11dd-90d9-001a92567626', name: 'Житомир' },
      {
        ref: '1ec09d2e-e1c2-11e3-8c4a-0050568002cf',
        name: 'Житомирка',
        prohibitedSending: true,
      },
    ]),
  )
})

const renderPicker = (onPick = vi.fn()) => {
  render(
    <SettlementPicker
      integrationId="integration-1"
      onPick={onPick}
      picked={null}
      use="sending"
    />,
  )
  return onPick
}

it('names the catalogue the suggestions come from', async () => {
  const user = userEvent.setup()
  renderPicker()

  await user.type(screen.getByLabelText(/Населений пункт/), 'Жито')

  expect(await screen.findByText('2 збіг.')).toBeVisible()
  expect(screen.getByText('Довідник Нової пошти')).toBeVisible()
})

it('reports a settlement the carrier will not send from', async () => {
  const user = userEvent.setup()
  renderPicker()

  await user.type(screen.getByLabelText(/Населений пункт/), 'Жито')

  const option = await screen.findByRole('button', { name: /Житомирка/ })
  expect(option).toHaveTextContent('не приймає відправлень')
})

it('counts only a pick from the list as a choice', async () => {
  const user = userEvent.setup()
  const onPick = renderPicker()

  const input = screen.getByLabelText(/Населений пункт/)
  await user.type(input, 'Житомир')
  const option = await screen.findByRole('button', { name: /^Житомир$/ })
  expect(onPick).not.toHaveBeenCalledWith(expect.objectContaining({ id: 10 }))

  await user.click(option)

  expect(onPick).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ref: '8d5a980d-391c-11dd-90d9-001a92567626',
      name: 'Житомир',
    }),
  )
  expect(input).toHaveValue('Житомир')
})

it('says so plainly when the catalogue has nothing by that name', async () => {
  vi.mocked(integrationsApi.settlements).mockResolvedValue(page([]))
  const user = userEvent.setup()
  renderPicker()

  await user.type(screen.getByLabelText(/Населений пункт/), 'Жжж')

  expect(await screen.findByText('без збігів')).toBeVisible()
  expect(
    screen.getByText(/немає населеного пункту з такою назвою/),
  ).toBeVisible()
})

it('picks the highlighted suggestion from the keyboard', async () => {
  const user = userEvent.setup()
  const onPick = renderPicker()

  await user.type(screen.getByLabelText(/Населений пункт/), 'Жито')
  await screen.findByRole('button', { name: /Житомирка/ })
  await user.keyboard('{ArrowDown}{Enter}')

  expect(onPick).toHaveBeenLastCalledWith(
    expect.objectContaining({
      ref: '1ec09d2e-e1c2-11e3-8c4a-0050568002cf',
      name: 'Житомирка',
    }),
  )
})
