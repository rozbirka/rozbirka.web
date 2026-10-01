import { StrictMode } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ImportReferencePicker } from './ImportReferencePicker'
import { importReferences } from '@/api/import-references'
vi.mock('@/api/import-references', () => ({ importReferences: vi.fn() }))
it('loads references after StrictMode remount and aborts on unmount', async () => {
  vi.mocked(importReferences).mockResolvedValue([
    { id: 'car', name: 'Донор Tesla' },
  ])
  const view = render(
    <StrictMode>
      <ImportReferencePicker field="CarId" value="" onChange={vi.fn()} />
    </StrictMode>,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Знайти' }))
  expect(
    await screen.findByRole('option', { name: 'Донор Tesla' }),
  ).toBeInTheDocument()
  const signal = vi.mocked(importReferences).mock.calls.at(-1)![2].signal!
  expect(signal.aborted).toBe(false)
  view.unmount()
  expect(signal.aborted).toBe(true)
})
