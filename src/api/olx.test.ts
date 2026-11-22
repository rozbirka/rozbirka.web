import { afterEach, expect, it, vi } from 'vitest'
import { launchOlxOAuth } from './olx'

afterEach(() => vi.restoreAllMocks())

it('posts the single-use launch ticket to the callback host without putting it in a URL', () => {
  const submit = vi
    .spyOn(HTMLFormElement.prototype, 'submit')
    .mockImplementation(function (this: HTMLFormElement) {
      expect(this.method).toBe('post')
      expect(this.action).toBe(
        'https://api.example.test/api/v1/integrations/olx/oauth/launch',
      )
      expect(new FormData(this).get('ticket')).toBe('ephemeral-ticket')
      expect(this.action).not.toContain('ephemeral-ticket')
    })
  launchOlxOAuth({
    expiresAt: '2026-11-17T18:00:00Z',
    launchUrl: 'https://api.example.test/api/v1/integrations/olx/oauth/launch',
    ticket: 'ephemeral-ticket',
  })
  expect(submit).toHaveBeenCalledTimes(1)
  expect(document.querySelector('form')).toBeNull()
})

it.each([
  'https://attacker.example/other-path',
  'javascript:alert(1)',
  'http://api.example.test/api/v1/integrations/olx/oauth/launch',
])('rejects an invalid launch destination %s', (launchUrl) => {
  const submit = vi.spyOn(HTMLFormElement.prototype, 'submit')
  expect(() =>
    launchOlxOAuth({
      launchUrl,
      ticket: 'ephemeral-ticket',
      expiresAt: '2026-11-17T18:00:00Z',
    }),
  ).toThrow()
  expect(submit).not.toHaveBeenCalled()
})
