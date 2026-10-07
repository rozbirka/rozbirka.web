import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AccountSecurityScreen } from './account-security'
import { useAuth } from '@/auth/AuthContext'
import { LocaleProvider } from '@/i18n'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

const mockUser = () =>
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'user',
      phone: '+380501234567',
      displayName: 'Користувач',
      effectiveLanguage: 'uk',
    },
    tenant: null,
    tenants: [],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    signOut: vi.fn(),
  })

it('shows deletion and privacy without membership or a cabinet provider', () => {
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'user',
      phone: '+380501234567',
      displayName: 'Користувач',
      effectiveLanguage: 'uk',
    },
    tenant: null,
    tenants: [],
    hydrate: vi.fn(),
    commitTenant: vi.fn(),
    updateName: vi.fn(),
    signOut: vi.fn(),
  })
  render(
    <MemoryRouter>
      <AccountSecurityScreen />
    </MemoryRouter>,
  )
  expect(screen.getByRole('button', { name: 'Видалити акаунт' })).toBeEnabled()
  expect(
    screen.getByRole('link', { name: 'Політика конфіденційності' }),
  ).toHaveAttribute('href', '/privacy')
  expect(screen.getByRole('button', { name: 'Вийти' })).toBeEnabled()
})

it('speaks English (UK) and asks for an English confirmation word', async () => {
  const user = userEvent.setup()
  mockUser()
  render(
    <LocaleProvider locale="en-GB" syncDocumentLang={false}>
      <MemoryRouter>
        <AccountSecurityScreen />
      </MemoryRouter>
    </LocaleProvider>,
  )
  expect(
    screen.getByRole('heading', { name: 'Personal account' }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Log out' })).toBeEnabled()
  await user.click(screen.getByRole('button', { name: 'Delete account' }))
  expect(screen.getByLabelText('Type DELETE to confirm')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
})
