import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('SiteHeader page tracking', () => {
  const added: HTMLElement[] = []

  function addSection(
    attrs: Record<string, string>,
    top: number,
    bottom: number,
  ) {
    const element = document.createElement('section')
    for (const [name, value] of Object.entries(attrs))
      element.setAttribute(name, value)
    element.getBoundingClientRect = () =>
      ({ top, bottom, height: bottom - top }) as DOMRect
    document.body.append(element)
    added.push(element)
    return element
  }

  function renderHeader() {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    )
    return screen.getByRole('banner')
  }

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

  afterEach(() => {
    for (const element of added.splice(0)) element.remove()
    vi.unstubAllGlobals()
  })

  it('starts dark with no current section at the top of the page', () => {
    const header = renderHeader()
    expect(header).toHaveAttribute('data-hdrtone', 'dark')
    const nav = screen.getByRole('navigation', { name: 'Головна навігація' })
    expect(within(nav).queryByRole('link', { current: 'location' })).toBeNull()
  })

  it('turns light over a light section and dark again past it', async () => {
    const light = addSection({ 'data-tone': 'light' }, -200, 600)
    const header = renderHeader()
    expect(header).toHaveAttribute('data-hdrtone', 'light')

    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
    )
    light.getBoundingClientRect = () =>
      ({ top: 300, bottom: 900, height: 600 }) as DOMRect
    fireEvent.scroll(window)
    await waitFor(() => expect(header).toHaveAttribute('data-hdrtone', 'dark'))
  })

  it('highlights the section that has scrolled into view', () => {
    addSection({ id: 'reviews' }, -900, -100)
    addSection({ id: 'how' }, 100, 800)
    addSection({ id: 'features' }, 2000, 2800)
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Головна навігація' })
    expect(
      within(nav).getByRole('link', { current: 'location' }),
    ).toHaveTextContent('Як це працює')
  })
})
