import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConnectionNotice } from './ConnectionNotice'

const setOnline = (value: boolean) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

afterEach(() => {
  vi.restoreAllMocks()
})

it('stays out of the way while there is a connection', () => {
  setOnline(true)
  render(<ConnectionNotice />)

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

it('says the connection is gone and what happens to unsent work', () => {
  setOnline(false)
  render(<ConnectionNotice />)

  const notice = screen.getByRole('status')
  expect(notice).toHaveTextContent('Немає звʼязку')
  expect(notice).toHaveTextContent('введене — у формі')
})

it('clears itself when the network comes back', () => {
  setOnline(false)
  render(<ConnectionNotice />)
  expect(screen.getByRole('status')).toBeVisible()

  setOnline(true)
  act(() => {
    window.dispatchEvent(new Event('online'))
  })

  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
