import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { TrackingSyncDetails } from './TrackingSyncDetails'

it('distinguishes queued work, pause and completion from an actual next check', () => {
  const { rerender } = render(
    <TrackingSyncDetails
      state={{ trackingPending: true, trackingCompleted: false }}
    />,
  )
  expect(screen.getByText('Перевірка в черзі')).toBeInTheDocument()
  rerender(
    <TrackingSyncDetails
      state={{ trackingPending: false, trackingCompleted: true }}
    />,
  )
  expect(screen.getByText('Відстеження завершене')).toBeInTheDocument()
  rerender(
    <TrackingSyncDetails
      state={{ trackingPending: false, trackingPaused: true }}
    />,
  )
  expect(screen.getByText('Призупинено')).toBeInTheDocument()
})
it('keeps the historical failure visible after recovery without a failure alert', () => {
  render(
    <TrackingSyncDetails
      state={{
        trackingPending: false,
        trackingLastSuccessAt: '2026-11-09T12:00:00Z',
        trackingLastError: 'tracking_unauthorized',
        trackingLastErrorAt: '2026-11-09T11:00:00Z',
      }}
    />,
  )
  expect(screen.getByText(/Нова пошта не приймає API-ключ/)).toBeInTheDocument()
  expect(screen.getByText('Остання успішна перевірка')).toBeInTheDocument()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
it('does not fabricate diagnostics when an older API omits them', () => {
  const { container } = render(<TrackingSyncDetails state={{}} />)
  expect(container).toBeEmptyDOMElement()
})
