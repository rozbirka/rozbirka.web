import { act, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HERO_SALE_MS, HERO_TAB_MS, Hero } from './hero'

function renderHero() {
  return render(
    <MemoryRouter>
      <Hero />
    </MemoryRouter>,
  )
}

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: reduce,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

const selectedTab = () =>
  screen.getByRole('tab', { selected: true }).textContent

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Hero conversion', () => {
  it('exposes a stable heading and real registration destinations', () => {
    renderHero()
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'Програма для авторозбірки — CRM і ERP Знаєш, де кожна деталь і де твої гроші',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Програма для авторозбірки')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: '14 днів безкоштовно' }),
    ).toHaveAttribute('href', '/login?purpose=registration&plan=pro_monthly')
    expect(
      screen.getByRole('link', { name: 'Спробувати безкоштовно' }),
    ).toHaveAttribute('href', '/login?purpose=registration')
    expect(
      screen.getByRole('link', { name: 'Завантажити в App Store' }),
    ).toHaveAttribute(
      'href',
      'https://apps.apple.com/ua/app/rozbirka/id6762130912',
    )
    expect(
      screen.getByText('Інтерфейс rozbirka. Дані вигадані.'),
    ).toBeInTheDocument()
  })
})

describe('Hero app preview', () => {
  it('renders the «Авто» tab with final figures on the server', () => {
    const html = renderToString(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    )
    const container = document.createElement('div')
    container.innerHTML = html
    const selected = container.querySelector(
      '[role="tab"][aria-selected="true"]',
    )
    expect(selected?.textContent).toBe('Авто')
    expect(container.querySelector('[data-progress]')).toBeNull()
    const counts = [...container.querySelectorAll('[data-count]')].map(
      (element) => element.textContent?.replace(/\s/g, ' '),
    )
    expect(counts).toEqual(['$3 200', '$5 870', '+83%'])
    expect(container.textContent).toContain('131 з 184')
    expect(container.textContent).toContain('BMW 320d E90 · 2008')
  })

  it('rotates the tabs every 6.5 s and stops once a tab is chosen', () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    renderHero()
    expect(selectedTab()).toBe('Авто')
    expect(document.querySelector('[data-progress]')).not.toBeNull()

    act(() => {
      vi.advanceTimersByTime(HERO_TAB_MS)
    })
    expect(selectedTab()).toBe('Запчастини')
    expect(screen.getByText('Сканувати QR')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Звіти' }))
    expect(selectedTab()).toBe('Звіти')
    expect(screen.getByText('Продажі по місяцях')).toBeInTheDocument()
    expect(document.querySelector('[data-progress]')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(HERO_TAB_MS * 3)
    })
    expect(selectedTab()).toBe('Звіти')
  })

  it('lands new sales in the feed while autoplaying', () => {
    vi.useFakeTimers()
    stubReducedMotion(false)
    renderHero()
    act(() => {
      vi.advanceTimersByTime(HERO_SALE_MS)
    })
    expect(screen.getByText('132 з 184')).toBeInTheDocument()
    expect(screen.getByText('Блок ABS')).toBeInTheDocument()
    expect(screen.getByText('+$240')).toBeInTheDocument()
  })

  it('keeps the first tab and figures still under reduced motion', () => {
    vi.useFakeTimers()
    stubReducedMotion(true)
    renderHero()
    act(() => {
      vi.advanceTimersByTime(HERO_TAB_MS * 2)
    })
    expect(selectedTab()).toBe('Авто')
    expect(screen.getByText('131 з 184')).toBeInTheDocument()
    expect(document.querySelector('[data-progress]')).toBeNull()
  })

  it('shows a light window without the sidebar and with the short tables', () => {
    stubReducedMotion(true)
    const { container } = renderHero()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Авто',
      'Запчастини',
      'Замовлення',
      'Звіти',
    ])
    const panel = screen.getByRole('tabpanel')
    expect(panel.closest('.lp-light-ui')).not.toBeNull()
    // No app sidebar and no «Усі авто» column in the hero.
    expect(screen.queryByText('Партії')).toBeNull()
    expect(screen.queryByText('Усі авто')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Запчастини' }))
    for (const column of ['Деталь', 'Статус', 'Ціна'])
      expect(screen.getByText(column)).toBeInTheDocument()
    expect(screen.queryByText('Полиця')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Замовлення' }))
    expect(screen.getByText('Андрій М.')).toBeInTheDocument()
    expect(screen.queryByText('Разом')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Звіти' }))
    expect(screen.getByText('Чистий прибуток · 6 міс')).toBeInTheDocument()
    expect(screen.queryByText('Найкраще авто')).toBeNull()
    expect(container.querySelector('h1')?.className).toContain('text-left')
  })

  it('moves between tabs with the arrow keys', () => {
    stubReducedMotion(true)
    renderHero()
    const first = screen.getByRole('tab', { name: 'Авто' })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowLeft' })
    const last = screen.getByRole('tab', { name: 'Звіти' })
    expect(last).toHaveAttribute('aria-selected', 'true')
    expect(last).toHaveFocus()
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      last.id,
    )
    fireEvent.keyDown(last, { key: 'ArrowRight' })
    expect(selectedTab()).toBe('Авто')
  })
})
