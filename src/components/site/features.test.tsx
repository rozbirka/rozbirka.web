import { act, render, screen, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Features } from './features'

const modules = [
  'Авто',
  'Партії',
  'Запчастини',
  'Склади',
  'Інвентаризація',
  'Стікери',
  'Замовлення',
  'Клієнти',
  'Каси',
  'Звіти',
  'Команда',
  'Нова Пошта',
  'OLX',
]

describe('Features scroll story', () => {
  it('lists all thirteen modules as headings with their lead', () => {
    render(<Features />)
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: '13 модулів в одній системі',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['Облік і склад', 'Продажі й гроші', 'Інтеграції'])
    expect(
      screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent),
    ).toEqual(modules)

    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(steps).toHaveLength(13)
    expect(
      within(steps[1]!).getByText(
        'Купив запчастини партією — заводиш її як джерело і кладеш туди всі деталі',
      ),
    ).toBeInTheDocument()
    expect(
      within(steps[10]!).getByText(
        'Додаєш співробітників — кожному своя роль і доступ',
      ),
    ).toBeInTheDocument()
  })

  it('server HTML shows module 1 active in a decorative window', () => {
    const html = renderToString(<Features />)
    for (const name of modules) expect(html).toContain(name)
    expect(html).toContain('rozbirka.pro/cars')
    expect(html).toContain('01 / 13')
    expect(html).toContain('Окупність · Tesla Model Y 2021')
    expect(html).not.toContain('animation:lp-story-in')

    const { container } = render(<Features />)
    const mock = container.querySelector('[data-story-window]')!
    expect(mock).toHaveAttribute('aria-hidden', 'true')
    expect(mock).toHaveTextContent('LIVE')
    expect(mock).toHaveTextContent('Прозорий прибуток по кожному кузову')
    expect(
      within(screen.getByRole('list'))
        .getAllByRole('listitem')
        .map((step) => step.hasAttribute('data-active')),
    ).toEqual(modules.map((_, index) => index === 0))
  })

  it('switches the window to the step nearest the middle of the screen', async () => {
    const { container } = render(<Features />)
    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    steps.forEach((step, index) => {
      step.getBoundingClientRect = () =>
        ({ top: (index - 2) * 400 + 200, height: 400 }) as DOMRect
    })
    await act(async () => {
      window.dispatchEvent(new Event('scroll'))
      await new Promise((resolve) => setTimeout(resolve, 50))
    })
    // Without IntersectionObserver in jsdom the listener is always on.
    const mock = container.querySelector('[data-story-window]')!
    expect(mock).toHaveTextContent('rozbirka.pro/parts')
    expect(mock).toHaveTextContent('03 / 13')
    expect(mock).toHaveTextContent('Веб + iPhone')
    expect(mock).toHaveTextContent('942 поз.')
    expect(steps[2]).toHaveAttribute('data-active')
  })
})
