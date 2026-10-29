import { useRef, useState, type ChangeEvent } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Field, FormDialog, TextInput } from '@/components/app'
import type { Tenant } from '../api/types'
import { useT } from '@/i18n'
import { cn } from '../lib/utils'
import { shellMessages } from './shell-messages'

export interface TenantSwitcherProps {
  tenant: Tenant
  tenants: readonly Tenant[]
  onSwitch: (tenantId: string) => Promise<void>
  /** The rail's 28px brand square instead of the full row. */
  compact?: boolean
  /** The mobile menu's bordered 44px row. */
  framed?: boolean
}

/**
 * `.rz-sidebar__tenant` from the design system: brand square, name, ⇅. The
 * native select is laid over the row so the choice keeps the platform picker
 * and its accessibility; the row is only what it looks like.
 */
export function TenantSwitcher({
  tenant,
  tenants,
  onSwitch,
  compact = false,
  framed = false,
}: TenantSwitcherProps) {
  const t = useT(shellMessages)
  const navigate = useNavigate()
  const [isSwitching, setIsSwitching] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const [invitationCode, setInvitationCode] = useState('')
  const selectRef = useRef<HTMLSelectElement>(null)
  const switchPending = useRef(false)

  const handleChange = async (event: ChangeEvent<HTMLSelectElement>) => {
    if (switchPending.current || event.target.value === tenant.id) return
    if (event.target.value === '') {
      setInvitationCode('')
      setJoinOpen(true)
      return
    }

    switchPending.current = true
    setIsSwitching(true)
    try {
      await onSwitch(event.target.value)
    } catch {
      // CabinetContext owns and presents tenant-transition failures.
    } finally {
      switchPending.current = false
      setIsSwitching(false)
    }
  }

  const initial = tenant.name.trim().charAt(0).toUpperCase() || '·'
  const planLabel = tenant.planTier ?? tenant.plan ?? null
  const context = [tenant.roleName, planLabel].filter(Boolean).join(' · ')

  return (
    <>
      <div
        className={cn(
          'relative min-w-0 has-[:focus-visible]:bg-app-active',
          compact
            ? 'rounded-control mb-3 grid size-7 place-items-center'
            : 'rz-sidebar__tenant w-full',
          framed && 'border-app-line-2 h-touch border',
          isSwitching && 'opacity-60',
        )}
        title={context || undefined}
      >
        <span
          aria-hidden
          className={cn(
            'rz-avatar',
            compact && 'rounded-control size-7 text-caption',
          )}
        >
          {initial}
        </span>
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">
              {isSwitching ? t('tenant.switching') : tenant.name}
            </span>
            <ChevronsUpDown aria-hidden className="text-app-dim size-3.5" />
          </>
        )}
        <select
          aria-label={t('tenant.switch')}
          className="absolute -inset-px cursor-pointer appearance-none opacity-0 disabled:cursor-default"
          disabled={isSwitching}
          onChange={(event) => void handleChange(event)}
          ref={selectRef}
          value={tenant.id}
        >
          {tenants.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name}
            </option>
          ))}
          <option value="">{t('tenant.join')}</option>
        </select>
      </div>
      <FormDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        title={t('tenant.join')}
        description={t('tenant.joinHint')}
        submitLabel={t('tenant.previewInvitation')}
        submitDisabled={invitationCode.trim().length === 0}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          selectRef.current?.focus()
        }}
        onSubmit={(event) => {
          event.preventDefault()
          const code = invitationCode.trim()
          if (!code) return
          setJoinOpen(false)
          void navigate(`/invite/${encodeURIComponent(code)}`)
        }}
      >
        <Field label={t('tenant.invitationCode')} required>
          <TextInput
            autoComplete="off"
            autoFocus
            spellCheck={false}
            value={invitationCode}
            onChange={(event) => setInvitationCode(event.target.value)}
          />
        </Field>
      </FormDialog>
    </>
  )
}
