import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/auth/AuthContext'
import { SiteHeader } from './header'

vi.mock('@/auth/AuthContext', () => ({ useAuth: vi.fn() }))

describe('SiteHeader mobile menu', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      status: 'guest',
      user: null,
      tenant: null,
      tenants: [],
      hydrate: vi.fn(),
      commitTenant: vi.fn(),
      updateName: vi.fn(),
      signOut: vi.fn(),
    })
  })

  it('opens and closes an accessible navigation disclosure', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Відкрити меню' })
    await user.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('navigation', { name: 'Мобільна навігація' }),
    ).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveFocus()
  })

  it('closes after a landing navigation link is selected', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Відкрити меню' }))
    const mobileNav = screen.getByRole('navigation', {
      name: 'Мобільна навігація',
    })
    await user.click(
      within(mobileNav).getByRole('link', { name: 'Можливості' }),
    )
    expect(
      screen.getByRole('button', { name: 'Відкрити меню' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes after the mobile log-in link is selected', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Відкрити меню' })
    await user.click(trigger)
    const mobileNav = screen.getByRole('navigation', {
      name: 'Мобільна навігація',
    })

    await user.click(within(mobileNav).getByRole('link', { name: 'Увійти' }))

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByRole('navigation', { name: 'Мобільна навігація' }),
    ).not.toBeInTheDocument()
  })

  it('closes after the mobile App Store badge is selected', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )
    const trigger = screen.getByRole('button', { name: 'Відкрити меню' })
    await user.click(trigger)
    const mobileNav = screen.getByRole('navigation', {
      name: 'Мобільна навігація',
    })

    await user.click(
      within(mobileNav).getByRole('link', {
        name: 'Завантажити в App Store',
      }),
    )

    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the App Store badge in the desktop header', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Головна навігація' })
    expect(
      within(nav).getByRole('link', { name: 'Завантажити в App Store' }),
    ).toHaveAttribute(
      'href',
      'https://apps.apple.com/ua/app/rozbirka/id6762130912',
    )
  })
})
