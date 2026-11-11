import { render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useLandingMotion } from './use-landing-motion'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('measures every reveal block before writing animation styles', () => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
    },
  )
  const measurements: string[] = []
  const rect = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      // The first block must still have its server-rendered styles when the
      // next block is measured; otherwise each read invalidates layout.
      expect(
        document.querySelector('[data-reveal]')?.getAttribute('style'),
      ).toBeNull()
      measurements.push(this.id)
      return { top: 2000 } as DOMRect
    })
  function Page() {
    useLandingMotion('uk-UA')
    return (
      <>
        <section id="first" data-reveal="" />
        <section id="second" data-reveal="" />
      </>
    )
  }
  const { unmount } = render(<Page />)
  expect(measurements).toEqual(['first', 'second'])
  expect(document.getElementById('first')?.style.opacity).toBe('0')
  unmount()
  rect.mockRestore()
})
