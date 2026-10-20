import { useState, type FormEvent } from 'react'
import { Button, Field, Notice, Sheet, TextInput } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { warehouseMessages } from './warehouse-messages'
import { toZoneCode } from './zone-code'

export interface ZoneDraft {
  name: string
  code: string
}

const FORM_ID = 'inventory-zone-editor-form'

export function ZoneEditorSheet({
  initial,
  description,
  eyebrow,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  initial?: ZoneDraft
  description?: string
  eyebrow?: string | undefined
  pending: boolean
  error: string | null
  onClose: () => void
  onSubmit: (draft: ZoneDraft) => void
}) {
  const t = useT(warehouseMessages)
  const tc = useT(commonMessages)
  const [name, setName] = useState(initial?.name ?? '')
  const [code, setCode] = useState(initial?.code ?? '')
  const valid = name.trim() !== '' && code.trim() !== ''
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!valid || pending) return
    onSubmit({ name: name.trim(), code: code.trim() })
  }

  return (
    <Sheet
      /* Scheme 1b keeps one muted line under the title: the warehouse it
         belongs to leads it, so the context is not lost with the eyebrow. */
      description={
        description ?? [eyebrow, t('newZoneHint')].filter(Boolean).join(' · ')
      }
      footer={
        <>
          <Button disabled={pending} onClick={onClose} type="button">
            {tc('cancel')}
          </Button>
          <Button
            aria-busy={pending}
            disabled={pending || !valid}
            form={FORM_ID}
            type="submit"
            variant="primary"
          >
            {initial ? tc('save') : t('addZone')}
          </Button>
        </>
      }
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
      open
      title={initial ? t('editZoneTitle') : t('newZoneTitle')}
    >
      <form
        aria-busy={pending}
        className="grid content-start gap-4"
        id={FORM_ID}
        onSubmit={submit}
      >
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Field label={t('name')} required>
          <TextInput
            autoFocus
            onChange={(event) => {
              const next = event.target.value
              setName(next)
              setCode(toZoneCode(next))
            }}
            value={name}
          />
        </Field>
        <Field hint={t('codeAutoHint')} label={t('codeLabel')} required>
          <TextInput
            className="font-mono"
            onChange={(event) => setCode(toZoneCode(event.target.value))}
            value={code}
          />
        </Field>
      </form>
    </Sheet>
  )
}
