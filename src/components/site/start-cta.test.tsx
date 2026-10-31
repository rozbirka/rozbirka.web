import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supportApi } from '@/api/support'
import { StartCta } from './start-cta'

vi.mock('@/api/support', () => ({ supportApi: { createLead: vi.fn() } }))

// eslint-disable-next-line @typescript-eslint/unbound-method
const createLead = vi.mocked(supportApi.createLead)

function renderForm() {
  render(
    <MemoryRouter>
      <StartCta />
    </MemoryRouter>,
  )
}

async function fillAndSubmit() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText("Ім'я"), 'Олег')
  await user.type(
    screen.getByLabelText('Телефон або Telegram'),
    '+380 67 123 45 67',
  )
  await user.selectOptions(
    screen.getByLabelText('Скільки авто зараз на розбірці'),
    '5–20',
  )
  await user.click(
    screen.getByRole('button', { name: 'Отримати 14 днів безкоштовно' }),
  )
}

describe('landing lead form', () => {
  beforeEach(() => {
    createLead.mockReset()
  })

  it('sends the lead to Core and thanks the visitor', async () => {
    createLead.mockResolvedValue(undefined)
    renderForm()

    await fillAndSubmit()

    expect(createLead).toHaveBeenCalledWith({
      name: 'Олег',
      contact: '+380 67 123 45 67',
      cars: '5–20',
      locale: 'uk',
      website: '',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Дякуємо!')
  })

  it('keeps the form and explains the failure when sending fails', async () => {
    createLead.mockRejectedValue(new Error('offline'))
    renderForm()

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Не вдалося надіслати заявку',
    )
    expect(screen.getByLabelText("Ім'я")).toHaveValue('Олег')
    expect(screen.queryByText('Дякуємо!')).toBeNull()
  })

  it('keeps the bot honeypot out of reach of people', () => {
    renderForm()

    const honeypot = document.querySelector('input[name="website"]')
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(honeypot).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('textbox', { name: /website/i })).toBeNull()
  })
})
