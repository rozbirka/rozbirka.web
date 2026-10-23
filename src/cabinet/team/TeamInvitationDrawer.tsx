import { useId } from 'react'
import { KeyRound, UserPlus } from 'lucide-react'
import type { RoleDto } from '@/api/team'
import { Button, Card, Notice, Sheet } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { RoleSearchPicker } from './RoleSearchPicker'
import { teamMessages } from './messages'

export function TeamInvitationDrawer({
  roles,
  roleId,
  onRoleChange,
  onSubmit,
  onClose,
  pending,
  error,
  canManage,
}: {
  roles: readonly RoleDto[]
  roleId: string
  onRoleChange: (roleId: string) => void
  onSubmit: () => void
  onClose: () => void
  pending: boolean
  error: string | null
  canManage: boolean
}) {
  const t = useT(teamMessages)
  const tc = useT(commonMessages)
  const formId = useId()
  return (
    <Sheet
      open
      title={t('newInvitation')}
      description={t('newInvitationDescription')}
      bodyClassName="[&_[data-slot=field-hint]]:text-app-muted"
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      footer={
        <>
          <Button disabled={pending} onClick={onClose} size="lg" type="button">
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending || !canManage || !roleId}
            form={formId}
            size="lg"
            type="submit"
            variant="primary"
          >
            <UserPlus aria-hidden />
            {t('createInvitation')}
          </Button>
        </>
      }
    >
      <form
        aria-busy={pending}
        className="grid content-start gap-6"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        {error !== null && <Notice tone="danger">{error}</Notice>}
        <RoleSearchPicker
          label={t('invitationRole')}
          hint={t('invitationRoleHint')}
          roles={roles}
          value={roleId}
          onSelect={onRoleChange}
          disabled={!canManage}
          busy={pending}
          showLabel
          required
        />
        <div className="grid gap-3">
          <Card
            title={t('invitationCodeTitle')}
            aside={<KeyRound aria-hidden className="text-app-muted size-4" />}
          >
            <p className="text-app-muted m-0 text-pretty">
              {t('invitationCodeDescription')}
            </p>
          </Card>
          <p className="text-app-muted m-0 text-caption text-pretty">
            {t('invitationSeatsHint')}
          </p>
        </div>
      </form>
    </Sheet>
  )
}
