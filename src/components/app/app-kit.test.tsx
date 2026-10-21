import { useState } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Button } from './button'
import { ActionMenu } from './action-menu'
import { CodeChip } from './code-chip'
import { ConfirmDialog } from './confirm-dialog'
import { DataTable } from './data-table'
import { Field } from './field'
import { TextInput } from './input'
import { Pagination } from './pagination'
import { EmptyState } from './state-screen'
import { ToastProvider } from './toast'
import { useToast, type ToastRequest } from './toast-context'

it('opens secondary record actions as one vertical menu', async () => {
  const archive = vi.fn()
  const remove = vi.fn()
  const user = userEvent.setup()

  render(
    <ActionMenu
      actions={[
        { key: 'archive', label: 'Архівувати', onSelect: archive },
        {
          key: 'remove',
          label: 'Видалити',
          destructive: true,
          onSelect: remove,
        },
      ]}
      label="Інші дії з записом"
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Інші дії з записом' }))

  const menu = screen.getByRole('menu')
  expect(menu).toHaveClass('rz-menu')
  expect(screen.getByRole('menuitem', { name: 'Архівувати' })).toHaveClass(
    'rz-menu__item',
  )
  expect(screen.getByRole('menuitem', { name: 'Видалити' })).toHaveClass(
    'rz-menu__item--danger',
  )
})

it('names a field control by its label and describes it with the hint', () => {
  render(
    <Field hint="Як на накладній" label="Назва" required>
      <TextInput />
    </Field>,
  )

  const input = screen.getByRole('textbox', { name: 'Назва' })
  expect(input).toHaveAccessibleDescription('Як на накладній')
  expect(input).not.toHaveAttribute('aria-invalid')
})

it('replaces the hint with the error and marks the control invalid', () => {
  render(
    <Field
      error="Вкажіть щонайменше 1"
      hint="Як на накладній"
      label="Кількість"
    >
      <TextInput />
    </Field>,
  )

  const input = screen.getByRole('textbox', { name: 'Кількість' })
  expect(input).toHaveAccessibleDescription('Вкажіть щонайменше 1')
  expect(input).toHaveAttribute('aria-invalid', 'true')
})

it('defaults buttons to type="button" and forwards rendering to a child link', () => {
  render(
    <>
      <Button>Зберегти</Button>
      <Button asChild>
        <a href="/app/koval/parts">Деталі</a>
      </Button>
    </>,
  )

  expect(screen.getByRole('button', { name: 'Зберегти' })).toHaveAttribute(
    'type',
    'button',
  )
  expect(screen.getByRole('link', { name: 'Деталі' })).toHaveAttribute(
    'href',
    '/app/koval/parts',
  )
})

interface Part {
  id: string
  name: string
  price: number
}

const partColumns = [
  {
    key: 'name',
    label: 'Деталь',
    variant: 'primary' as const,
    cell: (part: Part) => part.name,
  },
  {
    key: 'price',
    label: 'Ціна',
    align: 'end' as const,
    cell: (part: Part) => `${String(part.price)} ₴`,
  },
]

it('keeps table semantics and labels every cell for the stacked layout', () => {
  render(
    <DataTable
      caption="Список деталей"
      columns={partColumns}
      rowKey={(part) => part.id}
      rows={[{ id: '1', name: 'Бампер передній', price: 8400 }]}
    />,
  )

  expect(screen.getByRole('table', { name: 'Список деталей' })).toBeVisible()
  expect(
    screen.getByRole('columnheader', { name: 'Деталь' }),
  ).toBeInTheDocument()
  // The identifying column is the row's header, not just another cell.
  const identity = screen.getByRole('rowheader', { name: 'Бампер передній' })
  expect(identity).toHaveAttribute('scope', 'row')
  expect(identity).not.toHaveAttribute('data-label')
  expect(screen.getByRole('cell', { name: '8400 ₴' })).toHaveAttribute(
    'data-label',
    'Ціна',
  )
})

it('embeds a table without drawing a second rounded frame', () => {
  render(
    <DataTable
      caption="Позиції замовлення"
      columns={partColumns}
      embedded
      rowKey={(part) => part.id}
      rows={[{ id: '1', name: 'Бампер передній', price: 8400 }]}
    />,
  )

  const surface = screen.getByRole('table', {
    name: 'Позиції замовлення',
  }).parentElement
  expect(surface).not.toHaveClass('border')
  expect(surface).not.toHaveClass('rounded-panel')
})

it('shows the empty state instead of the body but keeps the footer', () => {
  render(
    <DataTable
      caption="Список деталей"
      columns={partColumns}
      empty={<EmptyState title="Тут поки порожньо" />}
      footer={<p>Сторінка 2 з 3</p>}
      rowKey={(part) => part.id}
      rows={[]}
    />,
  )

  expect(screen.queryByRole('table')).not.toBeInTheDocument()
  expect(screen.getByText('Тут поки порожньо')).toBeVisible()
  expect(screen.getByText('Сторінка 2 з 3')).toBeVisible()
})

function RowSelectionProbe({
  rowClick = false,
  onAction = () => undefined,
  onOpen,
}: {
  rowClick?: boolean | 'always'
  onAction?: () => void
  onOpen?: (row: Part) => void
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  return (
    <DataTable
      caption="Вибір деталей"
      columns={[
        ...partColumns,
        {
          key: 'actions',
          label: 'Дії',
          cell: () => (
            <>
              <Button onClick={onAction}>
                <span>Розмістити</span>
              </Button>
              <a
                href="#details"
                onClick={(event) => {
                  event.preventDefault()
                  onAction()
                }}
              >
                <span>Картка</span>
              </a>
            </>
          ),
        },
      ]}
      rows={[
        { id: '1', name: 'Фара', price: 100 },
        { id: '2', name: 'Крило', price: 200 },
        { id: '3', name: 'Заблокована', price: 300 },
      ]}
      rowKey={(row) => row.id}
      {...(onOpen ? { onRowClick: onOpen } : {})}
      selection={{
        selected,
        onChange: setSelected,
        rowLabel: (row) => row.name,
        selectOnRowClick: rowClick,
        unavailable: (row) => (row.id === '3' ? 'Інвентаризація' : undefined),
      }}
    />
  )
}

it('toggles selection on row background only after a first checkbox, skipping controls and locked rows', async () => {
  const user = userEvent.setup()
  const action = vi.fn()
  render(<RowSelectionProbe rowClick onAction={action} />)
  const first = screen.getByRole('checkbox', { name: 'Фара' })
  const second = screen.getByRole('checkbox', { name: 'Крило' })
  const firstRow = first.closest('tr')!
  const secondRow = second.closest('tr')!
  const locked = screen.getByRole('checkbox', { name: 'Заблокована' })
  await user.click(secondRow)
  expect(second).not.toBeChecked()
  await user.click(first)
  expect(first).toBeChecked()
  await user.click(second.parentElement!)
  expect(second).toBeChecked()
  await user.click(secondRow)
  expect(second).not.toBeChecked()
  await user.click(
    within(secondRow).getByRole('button', { name: 'Розмістити' }),
  )
  await user.click(within(secondRow).getByText('Картка'))
  expect(action).toHaveBeenCalledTimes(2)
  expect(second).not.toBeChecked()
  await user.click(locked.closest('tr')!)
  expect(locked).toBeDisabled()
  expect(locked).not.toBeChecked()
  await user.click(secondRow)
  expect(second).toBeChecked()
  expect(secondRow).toHaveAttribute('aria-selected', 'true')
  second.focus()
  await user.keyboard('[Space]')
  expect(second).not.toBeChecked()
  await user.click(firstRow)
  expect(first).not.toBeChecked()
  await user.click(secondRow)
  expect(second).not.toBeChecked()
})

it('can select rows immediately and again after clearing every row', async () => {
  const user = userEvent.setup()
  const action = vi.fn()
  render(<RowSelectionProbe rowClick="always" onAction={action} />)
  const first = screen.getByRole('checkbox', { name: 'Фара' })
  const row = first.closest('tr')!
  await user.click(row)
  expect(first).toBeChecked()
  await user.click(row)
  expect(first).not.toBeChecked()
  await user.click(first.parentElement!)
  expect(first).toBeChecked()
  await user.click(first)
  expect(first).not.toBeChecked()
  await user.click(within(row).getByRole('button', { name: 'Розмістити' }))
  expect(action).toHaveBeenCalledOnce()
  expect(first).not.toBeChecked()
  const locked = screen.getByRole('checkbox', { name: 'Заблокована' })
  await user.click(locked.closest('tr')!)
  expect(locked).not.toBeChecked()
})

it('preserves the default row opening and checkbox behavior without opting into row selection', async () => {
  const user = userEvent.setup()
  const open = vi.fn()
  render(<RowSelectionProbe onOpen={open} />)
  const first = screen.getByRole('checkbox', { name: 'Фара' })
  await user.click(first)
  expect(open).not.toHaveBeenCalled()
  const second = screen.getByRole('checkbox', { name: 'Крило' })
  await user.click(second.closest('tr')!)
  expect(open).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }))
  expect(second).not.toBeChecked()
})

it('reports the visible range and blocks the edges of pagination', async () => {
  const onPage = vi.fn()
  const user = userEvent.setup()
  render(
    <Pagination
      onPage={onPage}
      page={1}
      pageSize={30}
      total={1248}
      totalPages={42}
    />,
  )

  expect(screen.getByText('1–30 з 1248')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Попередня сторінка' }),
  ).toBeDisabled()

  await user.click(screen.getByRole('button', { name: 'Наступна сторінка' }))
  expect(onPage).toHaveBeenCalledWith(2)
})

function ToastProbe() {
  const toast = useToast()
  return (
    <Button
      onClick={() => {
        toast.show({ message: 'Деталь збережено', tone: 'ok' })
      }}
    >
      Зберегти
    </Button>
  )
}

it('announces a toast and dismisses it on request', async () => {
  const user = userEvent.setup()
  render(
    <ToastProvider>
      <ToastProbe />
    </ToastProvider>,
  )

  await user.click(screen.getByRole('button', { name: 'Зберегти' }))
  expect(screen.getByRole('status')).toHaveTextContent('Деталь збережено')

  await user.click(screen.getByRole('button', { name: 'Закрити сповіщення' }))
  expect(screen.queryByText('Деталь збережено')).not.toBeInTheDocument()
})

function ToastTrigger({ requests }: { requests: ToastRequest[] }) {
  const toast = useToast()
  return (
    <Button onClick={() => requests.forEach((request) => toast.show(request))}>
      Показати
    </Button>
  )
}

function renderToasts(requests: ToastRequest[]) {
  render(
    <ToastProvider>
      <ToastTrigger requests={requests} />
    </ToastProvider>,
  )
  act(() => screen.getByRole('button', { name: 'Показати' }).click())
}

it('keeps at most three toasts with the newest at the bottom', () => {
  renderToasts([
    { message: 'Перший.', tone: 'ok' },
    { message: 'Замовлення створено.', tone: 'ok' },
    { message: 'Оплату записано.', tone: 'ok' },
    { message: 'Браузер заблокував вікно друку.', tone: 'danger' },
  ])
  expect(screen.queryByText('Перший.')).not.toBeInTheDocument()
  const stack = [...document.querySelectorAll('.rz-toast .rz-toast__msg')].map(
    (node) => node.textContent,
  )
  expect(stack).toEqual([
    'Замовлення створено.',
    'Оплату записано.',
    'Браузер заблокував вікно друку.',
  ])
  expect(screen.getAllByRole('status')).toHaveLength(2)
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Браузер заблокував вікно друку.',
  )
})

it('times toasts by the rule: 6 s, 10 s with undo, danger retry until closed', () => {
  vi.useFakeTimers()
  try {
    renderToasts([
      { message: 'Замовлення створено.', tone: 'ok' },
      {
        message: 'Позицію видалено.',
        tone: 'ok',
        action: { label: 'Скасувати', onAction: vi.fn(), kind: 'undo' },
      },
      {
        message: 'Браузер заблокував вікно друку.',
        tone: 'danger',
        action: { label: 'Повторити', onAction: vi.fn(), kind: 'retry' },
      },
    ])
    act(() => {
      vi.advanceTimersByTime(5999)
    })
    expect(screen.getByText('Замовлення створено.')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText('Замовлення створено.')).not.toBeInTheDocument()
    expect(screen.getByText('Позицію видалено.')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Позицію видалено.')).not.toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Браузер заблокував вікно друку.',
    )
  } finally {
    vi.useRealTimers()
  }
})

it('honours an explicit duration over the rule', () => {
  vi.useFakeTimers()
  try {
    renderToasts([{ message: 'Мову збережено.', tone: 'ok', duration: 4000 }])
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Мову збережено.')).not.toBeInTheDocument()
  } finally {
    vi.useRealTimers()
  }
})

function ConfirmProbe({
  onConfirm,
  pending = false,
}: {
  onConfirm: () => void
  pending?: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Видалити</Button>
      <ConfirmDialog
        confirmLabel="Видалити деталь"
        consequence="Історія продажів і резерви зникнуть назавжди."
        onConfirm={onConfirm}
        onOpenChange={setOpen}
        open={open}
        pending={pending}
        title="Видалити деталь?"
      />
    </>
  )
}

it('keeps a pending confirmation open when Escape requests dismissal', async () => {
  const user = userEvent.setup()
  render(<ConfirmProbe onConfirm={vi.fn()} pending />)

  await user.click(screen.getByRole('button', { name: 'Видалити' }))
  await user.keyboard('{Escape}')

  expect(screen.getByRole('dialog', { name: 'Видалити деталь?' })).toBeVisible()
})

it('confirms a destructive action through its consequence', async () => {
  const onConfirm = vi.fn()
  const user = userEvent.setup()
  render(<ConfirmProbe onConfirm={onConfirm} />)

  await user.click(screen.getByRole('button', { name: 'Видалити' }))
  expect(
    screen.getByRole('dialog', { name: 'Видалити деталь?' }),
  ).toHaveAccessibleDescription('Історія продажів і резерви зникнуть назавжди.')
  // A destructive question opens on the way out of it.
  expect(screen.getByRole('button', { name: 'Скасувати' })).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'Видалити деталь' }))
  expect(onConfirm).toHaveBeenCalledOnce()
})

it('shows a pressed and a busy state, not only hover and disabled', () => {
  render(
    <>
      <Button variant="primary">Зберегти</Button>
      <Button aria-busy>Зберігаємо…</Button>
    </>,
  )

  // `.rz-btn` carries :active and [aria-busy] in the design system kit.
  expect(screen.getByRole('button', { name: 'Зберегти' })).toHaveClass(
    'rz-btn',
    'rz-btn--primary',
  )
  expect(screen.getByRole('button', { name: 'Зберігаємо…' })).toHaveClass(
    'rz-btn',
  )
})

it('keeps the copy chip small while the button stays easy to hit', async () => {
  const onCopy = vi.fn()
  const user = userEvent.setup()

  render(<CodeChip code="RZB-26-023C" label="Копіювати код" onCopy={onCopy} />)

  const button = screen.getByRole('button', { name: 'Копіювати код' })
  expect(button.closest('.rz-code')).not.toBeNull()
  // The 44px target comes from an overlay, so the chip itself stays 24px tall.
  expect(button.className).toContain('after:-inset-3')

  await user.click(button)

  expect(onCopy).toHaveBeenCalledOnce()
})
