import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { StickerSelectionRow } from './StickerWorkspace'

function Row() {
  const [selected, setSelected] = useState(false)
  return (
    <ul>
      <StickerSelectionRow
        label="Section A"
        checkboxLabel="Choose Section A"
        selected={selected}
        onToggle={() => setSelected((value) => !value)}
        name="Section A"
        detail="Warehouse"
        controls={<button type="button">Quantity</button>}
      />
    </ul>
  )
}
it('selects once through the row, the checkbox and the keyboard; controls do not toggle selection', async () => {
  const user = userEvent.setup()
  render(<Row />)
  const checkbox = screen.getByRole('checkbox', { name: 'Choose Section A' })
  await user.click(screen.getByRole('listitem'))
  expect(checkbox).toBeChecked()
  await user.click(checkbox)
  expect(checkbox).not.toBeChecked()
  await user.keyboard(' ')
  expect(checkbox).toBeChecked()
  await user.click(screen.getByRole('button', { name: 'Quantity' }))
  expect(checkbox).toBeChecked()
})
it('keeps an unavailable row unselected', async () => {
  const user = userEvent.setup()
  render(
    <ul>
      <StickerSelectionRow
        label="Queued shelf"
        checkboxLabel="Choose shelf"
        selected={false}
        disabled
        onToggle={() => {
          throw new Error('disabled row toggled')
        }}
        name="Shelf"
        detail="Already queued"
      />
    </ul>,
  )
  await user.click(screen.getByRole('listitem'))
  expect(screen.getByRole('checkbox')).not.toBeChecked()
  expect(screen.getByRole('checkbox')).toBeDisabled()
})
