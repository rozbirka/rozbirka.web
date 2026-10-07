import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { expect, it } from 'vitest'
import { useHashTarget } from './use-hash-target'

function Screen({ ready }: { ready: boolean }) {
  useHashTarget()
  return (
    <>
      <input aria-label="Назва" />
      {ready ? (
        <section id="accounting-currency">
          <select aria-label="Валюта обліку" />
        </section>
      ) : null}
    </>
  )
}

function Later() {
  const [ready, setReady] = useState(false)
  return (
    <>
      <button onClick={() => setReady(true)} type="button">
        Завантажити
      </button>
      <Screen ready={ready} />
    </>
  )
}

it('focuses the first field of the section named by the fragment', () => {
  render(
    <MemoryRouter initialEntries={['/settings/business#accounting-currency']}>
      <Screen ready />
    </MemoryRouter>,
  )
  expect(screen.getByLabelText('Валюта обліку')).toHaveFocus()
})

it('waits for a section that appears once its data has loaded', async () => {
  render(
    <MemoryRouter initialEntries={['/settings/business#accounting-currency']}>
      <Later />
    </MemoryRouter>,
  )
  expect(document.body).toHaveFocus()
  await act(async () => {
    screen.getByRole('button', { name: 'Завантажити' }).click()
    await Promise.resolve()
  })
  expect(screen.getByLabelText('Валюта обліку')).toHaveFocus()
})

it('does nothing without a matching section', () => {
  render(
    <MemoryRouter initialEntries={['/settings/business#region']}>
      <Screen ready />
    </MemoryRouter>,
  )
  expect(document.body).toHaveFocus()
})
