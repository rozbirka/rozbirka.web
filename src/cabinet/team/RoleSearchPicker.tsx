import type { ReactNode } from 'react'
import type { RoleDto } from '@/api/team'
import { SelectPicker } from '@/components/app'
import { useLocale, useT } from '@/i18n'
import { roleLabel, teamMessages } from './messages'

/** Role selection uses the same field and result rows as the order pickers. */
export function RoleSearchPicker({
  label,
  roles,
  value,
  onSelect,
  allLabel,
  disabled = false,
  busy = false,
  compact = false,
  showLabel = false,
  required = false,
  hint,
  className,
}: {
  label: string
  roles: readonly RoleDto[]
  value: string
  onSelect: (value: string) => void
  allLabel?: string
  disabled?: boolean
  busy?: boolean
  compact?: boolean
  showLabel?: boolean
  required?: boolean
  hint?: ReactNode
  className?: string
}) {
  const t = useT(teamMessages)
  const { locale } = useLocale()
  const options = roles.map((role) => ({
    value: role.id,
    label: roleLabel(role, locale),
  }))
  if (allLabel !== undefined) options.unshift({ value: '', label: allLabel })
  return (
    <SelectPicker
      label={label}
      options={options}
      value={value}
      onValueChange={onSelect}
      heading={t('roles')}
      resultsLabel={t('roleOptions')}
      searchPlaceholder={t('searchRoles')}
      searchable={options.length > 5}
      emptyLabel={t('noMatchingRoles')}
      disabled={disabled || options.length === 0}
      busy={busy}
      compact={compact}
      showLabel={showLabel}
      required={required}
      hint={hint}
      className={className ?? ''}
    />
  )
}
