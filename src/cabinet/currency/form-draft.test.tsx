import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  saveCurrencyDraft,
  takeCurrencyDraft,
  useCurrencyDraft,
} from './form-draft'

vi.mock('../CabinetContext', () => ({
  useCabinet: () => ({ targetTenant: { slug: 'yard' } }),
}))

afterEach(() => sessionStorage.clear())

function Probe({ kind }: { kind: string }) {
  const draft = useCurrencyDraft<{ price: string }>(kind)
  return (
    <>
      <output aria-label="restored">{draft.initial?.price ?? 'none'}</output>
      <button onClick={() => draft.keep({ price: '125.50' })} type="button">
        leave
      </button>
    </>
  )
}

describe('price form drafts across the currency setting', () => {
  it('keeps a draft per form and per cabinet', () => {
    saveCurrencyDraft('car-form:new', '/app/yard', { price: '1' })
    expect(takeCurrencyDraft('car-form:new', '/app/yard')).toEqual({
      price: '1',
    })
    expect(takeCurrencyDraft('car-form:new', '/app/other')).toBeNull()
    expect(takeCurrencyDraft('intake-form:new', '/app/yard')).toBeNull()
  })

  it('restores on the way back, also when the form mounts again', () => {
    saveCurrencyDraft('order-form:new', '/app/yard', { price: '99' })
    const first = render(
      <MemoryRouter initialEntries={['/app/yard/orders/new?draft=1']}>
        <Probe kind="order-form:new" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('restored')).toHaveTextContent('99')
    // Taken out of storage: an ordinary visit starts clean.
    expect(takeCurrencyDraft('order-form:new', '/app/yard')).toBeNull()
    first.unmount()

    // A loading state that remounts the form on the same return keeps it.
    const second = render(
      <MemoryRouter initialEntries={['/app/yard/orders/new?draft=1']}>
        <Probe kind="order-form:new" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('restored')).toHaveTextContent('99')
    second.unmount()

    render(
      <MemoryRouter initialEntries={['/app/yard/orders/new']}>
        <Probe kind="order-form:new" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('restored')).toHaveTextContent('none')
  })

  it('ignores a stored draft on an ordinary visit', () => {
    saveCurrencyDraft('car-form:new', '/app/yard', { price: '5' })
    render(
      <MemoryRouter initialEntries={['/app/yard/cars/new']}>
        <Probe kind="car-form:new" />
      </MemoryRouter>,
    )
    expect(screen.getByLabelText('restored')).toHaveTextContent('none')
  })

  it('stores what is typed right before leaving', () => {
    render(
      <MemoryRouter initialEntries={['/app/yard/cars/new']}>
        <Probe kind="car-form:new" />
      </MemoryRouter>,
    )
    screen.getByRole('button', { name: 'leave' }).click()
    expect(takeCurrencyDraft('car-form:new', '/app/yard')).toEqual({
      price: '125.50',
    })
  })
})
