import { act, fireEvent, render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CarsSpotlight } from './cars-demo'
import { OrdersSpotlight } from './orders-demo'

const carChapters = [
  'Додаєш авто за VIN',
  'Вказуєш, скільки вклав',
  'Продаєш деталі — прибуток росте',
  'Порівнюєш авто й партії',
]

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string): Partial<MediaQueryList> => ({
      matches: reduce && query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  )
}

const clock = (container: HTMLElement) =>
  [...container.querySelectorAll('span')].find((span) =>
    /^\d:\d\d \/ 0:28$/.test(span.textContent ?? ''),
  )?.textContent

const current = () =>
  screen
    .getAllByRole('button')
    .find((button) => button.getAttribute('aria-current') === 'step')
    ?.textContent

const tick = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms)
  })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('Cars demo player', () => {
  it('prerenders the finished first chapter with real text and chapters', () => {
    const html = renderToString(<CarsSpotlight />)
    expect(html).toContain('Прозорий прибуток по кожному кузову')
    expect(html).toContain('WBAPN71060A123482')
    expect(html).toContain('N47D20 · 2.0 дизель')
    expect(html).toContain('Система розшифровує марку, модель і двигун')
    expect(html).toContain('0:07 / 0:28')
    expect(html).toContain('aria-label="Пауза"')
  })

  it('exposes a heading, chapter buttons and hides the fake screen', () => {
    const { container } = render(<CarsSpotlight />)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Прозорий прибуток по кожному кузову',
      }),
    ).toBeInTheDocument()
    for (const title of carChapters) {
      expect(
        screen.getByRole('button', { name: new RegExp(title) }),
      ).toBeInTheDocument()
    }
    expect(current()).toContain(carChapters[0])
    expect(
      screen.getByRole('group', { name: `Демо: ${carChapters[0]}` }),
    ).toBeInTheDocument()
    expect(
      container.querySelector('[aria-hidden="true"].relative'),
    ).not.toBeNull()
  })

  it('plays chapter by chapter, 7 seconds each', () => {
    stubReducedMotion(false)
    const { container } = render(<CarsSpotlight />)
    tick(100) // first visible tick rewinds the server frame
    expect(clock(container)).toBe('0:00 / 0:28')
    tick(3000)
    expect(clock(container)).toBe('0:03 / 0:28')
    tick(4000)
    expect(current()).toContain(carChapters[1])
    expect(clock(container)).toBe('0:07 / 0:28')
    tick(21_000)
    expect(current()).toContain(carChapters[0])
  })

  it('jumps to a chapter on click and plays it', () => {
    stubReducedMotion(true)
    const { container } = render(<CarsSpotlight />)
    fireEvent.click(screen.getByRole('button', { name: /Порівнюєш авто/ }))
    expect(current()).toContain(carChapters[3])
    expect(screen.getByRole('button', { name: 'Пауза' })).toBeInTheDocument()
    expect(container.textContent).toContain('Усі авто')
    tick(7000)
    expect(current()).toContain(carChapters[0])
  })

  it('pauses and resumes with an accessible toggle', () => {
    stubReducedMotion(false)
    const { container } = render(<CarsSpotlight />)
    tick(1100)
    fireEvent.click(screen.getByRole('button', { name: 'Пауза' }))
    const paused = clock(container)
    tick(5000)
    expect(clock(container)).toBe(paused)
    fireEvent.click(screen.getByRole('button', { name: 'Відтворити' }))
    tick(2000)
    expect(clock(container)).not.toBe(paused)
  })

  it('keeps the finished frame still under reduced motion', () => {
    stubReducedMotion(true)
    const { container } = render(<CarsSpotlight />)
    expect(
      screen.getByRole('button', { name: 'Відтворити' }),
    ).toBeInTheDocument()
    tick(30_000)
    expect(clock(container)).toBe('0:07 / 0:28')
    expect(current()).toContain(carChapters[0])
    expect(container.textContent).toContain('WBAPN71060A123482')
    expect(container.textContent).toContain('BMW 320d E90')
  })
})

describe('Orders demo player', () => {
  it('prerenders the collected order of the first chapter', () => {
    const html = renderToString(<OrdersSpotlight />)
    expect(html).toContain(
      'Оплата гнучка: кілька платежів, різні валюти й рахунки',
    )
    expect(html).toContain('Блок ABS')
    expect(html).toContain('$515')
    expect(html).toContain('Деталі зарезервовані за клієнтом')
  })

  it('shows the payment and the till chapters on click', () => {
    stubReducedMotion(true)
    const { container } = render(<OrdersSpotlight />)
    fireEvent.click(screen.getByRole('button', { name: /Доплата в доларах/ }))
    expect(current()).toContain('Доплата в доларах')
    expect(container.textContent).toContain('Новий платіж')
    expect(container.textContent).toContain('Готівка · UAH')
    fireEvent.click(screen.getByRole('button', { name: /Бачиш платіж у касі/ }))
    expect(container.textContent).toContain('Оберіть касу')
    tick(3000)
    expect(container.textContent).toContain('Рухи · Готівка USD')
    expect(container.textContent).toContain('Замовлення #1050')
  })

  it('stays on the finished first chapter under reduced motion', () => {
    stubReducedMotion(true)
    const { container } = render(<OrdersSpotlight />)
    tick(30_000)
    expect(current()).toContain('Збираєш замовлення скануванням QR')
    expect(container.textContent).toContain('✓ Резерв')
  })
})
