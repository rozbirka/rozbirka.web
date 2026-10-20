import type { ReactNode, Ref } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface MenuAction {
  key: string
  label: string
  onSelect: () => void
  icon?: ReactNode
  /** Marks an action that removes or ends something. */
  destructive?: boolean
  disabled?: boolean
  /** Explains why an unavailable action cannot be used. */
  title?: string
}

/**
 * The actions a record has that are not the one people came for. Keeping
 * archive and delete out of the header stops a destructive click from sitting
 * next to the everyday one, without hiding them behind a different screen.
 */
export function ActionMenu({
  label,
  actions,
  triggerRef,
}: {
  /** Names the trigger: "Інші дії з автомобілем". */
  label: string
  actions: readonly MenuAction[]
  triggerRef?: Ref<HTMLButtonElement>
}) {
  if (actions.length === 0) return null

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button aria-label={label} ref={triggerRef} size="icon">
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="rz-menu z-50"
          collisionPadding={16}
          sideOffset={6}
        >
          {actions.map((action) => (
            <DropdownMenu.Item
              className={cn(
                'rz-menu__item outline-none select-none',
                'data-[disabled]:pointer-events-none data-[disabled]:opacity-55',
                action.destructive && 'rz-menu__item--danger',
              )}
              {...(action.disabled === undefined
                ? {}
                : { disabled: action.disabled })}
              key={action.key}
              onSelect={action.onSelect}
              title={action.title}
            >
              {action.icon}
              {action.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
