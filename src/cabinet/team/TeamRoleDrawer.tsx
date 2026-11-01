import { useId } from 'react'
import type { RoleDto } from '@/api/team'
import { Button, Notice, Sheet, SkeletonFields } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { RoleSearchPicker } from './RoleSearchPicker'
import { teamMessages } from './messages'

export function TeamRoleDrawer({
  name,
  roles,
  roleId,
  loadFailed,
  onRetry,
  onRoleChange,
  onSubmit,
  onClose,
  returnFocus,
  pending,
  error,
  canManage,
  valid,
}: {
  name: string
  roles: readonly RoleDto[] | null
  roleId: string
  loadFailed: boolean
  onRetry: () => void
  onRoleChange: (roleId: string) => void
  onSubmit: () => void
  onClose: () => void
  returnFocus: () => void
  pending: boolean
  error: string | null
  canManage: boolean
  valid: boolean
}) {
  const t = useT(teamMessages)
  const tc = useT(commonMessages)
  const formId = useId()
  const loading = roles === null && !loadFailed
  return (
    <Sheet
      open
      title={t('changeRole')}
      description={t('changeRoleDescription', { name })}
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault()
        returnFocus()
      }}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="lg" type="button">
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending || loading || loadFailed || !canManage || !valid}
            form={formId}
            size="lg"
            type="submit"
            variant="primary"
          >
            {pending ? tc('saving') : tc('save')}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        aria-busy={loading || pending}
        className="grid content-start gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (!loading && !loadFailed && !pending && canManage && valid)
            onSubmit()
        }}
      >
        {loadFailed ? (
          <Notice tone="danger">
            <p className="m-0">{t('rolesLoadFailed')}</p>
            <Button className="mt-2" onClick={onRetry} type="button">
              {tc('retry')}
            </Button>
          </Notice>
        ) : null}
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {loading ? (
          <SkeletonFields count={1} label={tc('loading')} />
        ) : roles !== null ? (
          <RoleSearchPicker
            label={t('roleFor', { name })}
            showLabel
            busy={pending}
            disabled={!canManage}
            roles={roles}
            value={roleId}
            onSelect={onRoleChange}
          />
        ) : null}
      </form>
    </Sheet>
  )
}
