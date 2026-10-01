import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, it, vi } from 'vitest'
import { AccountSecurityScreen } from './account-security'
import { useAuth } from '@/auth/AuthContext'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

it('shows deletion and privacy without membership or a cabinet provider', () => {
  vi.mocked(useAuth).mockReturnValue({
    status: 'authenticated',
    user: {
      id: 'user',
      phone: '+380501234567',
      displayName: 'Користувач',
      isActive: true,
      role: 'user',
      lastLoginAt: null,
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
