import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PartNotesCard } from './PartNotesCard'
import { partsApi } from '@/api/parts'
import type { PartDetail } from '@/api/parts'

vi.mock('@/api/parts', () => ({ partsApi: { update: vi.fn(), get: vi.fn() } }))

it('does not update another screen after the note editor unmounts during a save', async () => {
  const user = userEvent.setup()
  let resolveSave: ((value: PartDetail) => void) | undefined
  vi.spyOn(partsApi, 'update').mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSave = resolve
      }),
  )
  const onSaved = vi.fn()
  const { unmount } = render(
    <PartNotesCard
      partId="p1"
      notes="Old note"
      canEdit
      beforeSave={() => ({
        signal: new AbortController().signal,
        tenantId: 't1',
        generation: 1,
      })}
      onSaved={onSaved}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Редагувати' }))
  await user.type(screen.getByRole('textbox', { name: 'Нотатки' }), ' edited')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  unmount()
  await act(async () => {
    resolveSave?.({ notes: 'Old note edited' } as PartDetail)
    await Promise.resolve()
  })
  expect(onSaved).not.toHaveBeenCalled()
})
