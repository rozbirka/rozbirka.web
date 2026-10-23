import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Card } from './card'
import { InlineNotes, type InlineNotesProps } from './inline-notes'

const editor = (props: Omit<InlineNotesProps, 'children'>) => (
  <InlineNotes {...props}>
    {({ action, content }) => (
      <Card title="Нотатки" aside={action}>
        {content}
      </Card>
    )}
  </InlineNotes>
)

it('preserves a draft during background refresh and cancels back to the current saved value', async () => {
  const user = userEvent.setup(),
    onSave = vi.fn().mockResolvedValue('saved')
  const { rerender } = render(
    editor({ value: 'Original', canEdit: true, onSave }),
  )
  await user.click(screen.getByRole('button', { name: 'Редагувати' }))
  await user.type(screen.getByRole('textbox'), ' draft')
  rerender(editor({ value: 'New server value', canEdit: true, onSave }))
  expect(screen.getByRole('textbox')).toHaveValue('Original draft')
  await user.click(screen.getByRole('button', { name: 'Скасувати' }))
  expect(screen.getByText('New server value')).toBeVisible()
  expect(onSave).not.toHaveBeenCalled()
})

it('honours the supported note limit without adding a character counter', async () => {
  const user = userEvent.setup(),
    onSave = vi.fn().mockResolvedValue('1234567890')
  render(editor({ value: null, canEdit: true, onSave, maxLength: 10 }))
  await user.click(screen.getByRole('button', { name: 'Редагувати' }))
  await user.type(screen.getByRole('textbox'), '1234567890extra')
  expect(screen.getByRole('textbox')).toHaveValue('1234567890')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(onSave).toHaveBeenCalledWith('1234567890')
})

it('keeps an uncertain draft when lost-save verification also fails', async () => {
  const user = userEvent.setup()
  const onSave = vi
    .fn()
    .mockRejectedValue({ kind: 'network', message: 'offline' })
  const readBack = vi.fn().mockRejectedValue(new Error('offline')),
    onSaved = vi.fn()
  render(
    editor({ value: 'Original', canEdit: true, onSave, readBack, onSaved }),
  )
  await user.click(screen.getByRole('button', { name: 'Редагувати' }))
  await user.type(screen.getByRole('textbox'), ' draft')
  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(await screen.findByRole('alert')).toBeVisible()
  expect(screen.getByRole('textbox')).toHaveValue('Original draft')
  expect(onSaved).not.toHaveBeenCalled()
})

it('blocks repeated submits until saving finishes and uses the canonical server value', async () => {
  const user = userEvent.setup()
  let resolveSave: ((value: string | null) => void) | undefined
  const onSave = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveSave = resolve
        }),
    ),
    onSaved = vi.fn()
  render(editor({ value: null, canEdit: true, onSave, onSaved }))
  await user.click(screen.getByRole('button', { name: 'Редагувати' }))
  await user.type(screen.getByRole('textbox'), '  draft  ')
  const form = screen.getByRole('textbox').closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  expect(onSave).toHaveBeenCalledTimes(1)
  expect(onSave).toHaveBeenCalledWith('draft')
  expect(screen.getByRole('button', { name: 'Скасувати' })).toBeDisabled()
  await act(async () => {
    resolveSave?.('Canonical note')
    await Promise.resolve()
  })
  expect(onSaved).toHaveBeenCalledWith('Canonical note')
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('cannot begin editing while another guarded operation is busy', () => {
  render(
    editor({
      value: 'Original',
      canEdit: true,
      busy: true,
      onSave: vi.fn().mockResolvedValue(null),
    }),
  )
  expect(screen.getByRole('button', { name: 'Редагувати' })).toBeDisabled()
  expect(screen.queryByRole('textbox')).toBeNull()
})
