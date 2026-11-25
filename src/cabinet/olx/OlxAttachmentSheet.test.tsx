import { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import type { olxMessagesApi } from '@/api/olx-messages'
import { OlxAttachmentSheet } from './OlxAttachmentSheet'

const attachment = vi.hoisted(() => vi.fn<typeof olxMessagesApi.attachment>())

vi.mock('@/api/olx-messages', () => ({
  olxMessagesApi: { attachment },
}))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
})

it.each(['loading', 'ready'] as const)(
  'clears %s attachment data when the tenant scope changes',
  async (phase) => {
    const tenant = new AbortController()
    let resolveFile: (file: Blob) => void = () => undefined
    const response = new Promise<Blob>((resolve) => {
      resolveFile = resolve
    })
    const createObjectURL = vi.fn(() => 'blob:olx-photo')
    const revokeObjectURL = vi.fn()
    class TestURL extends URL {
      static override createObjectURL = createObjectURL
      static override revokeObjectURL = revokeObjectURL
    }
    vi.stubGlobal('URL', TestURL)
    attachment.mockReturnValue(response)

    function OpenAttachment() {
      const [open, setOpen] = useState(true)
      return open ? (
        <OlxAttachmentSheet
          accountId="olx-account"
          threadId="thread"
          attachment={{ messageId: 'message', index: 2, name: 'photo.png' }}
          tenantSignal={tenant.signal}
          onClose={() => setOpen(false)}
          onCloseAutoFocus={() => undefined}
          onAccessFailure={() => undefined}
        />
      ) : null
    }

    const file = new Blob(['photo'], { type: 'image/png' })
    render(<OpenAttachment />)
    expect(attachment).toHaveBeenCalledOnce()
    expect(attachment.mock.calls[0]?.slice(0, 4)).toEqual([
      'thread',
      'message',
      2,
      'olx-account',
    ])
    const requestSignal = attachment.mock.calls[0]?.[4]?.signal
    expect(requestSignal?.aborted).toBe(false)
    if (phase === 'ready') {
      resolveFile(file)
      expect(
        await screen.findByRole('img', { name: 'photo.png' }),
      ).toBeVisible()
    }

    act(() => tenant.abort())
    expect(requestSignal?.aborted).toBe(true)
    expect(
      screen.queryByRole('dialog', { name: 'Вкладення OLX' }),
    ).not.toBeInTheDocument()
    if (phase === 'loading') {
      await act(async () => {
        resolveFile(file)
        await response
      })
      expect(createObjectURL).not.toHaveBeenCalled()
    } else {
      expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:olx-photo')
    }
  },
)
