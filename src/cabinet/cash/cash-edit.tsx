import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button, Field, TextInput } from '@/components/app'
import type { CashRegister } from '@/api/cash'
import { RedesignShell, RedesignTitle } from '../redesign-shell'

/** The edit endpoint currently accepts only a register name. */
export function CashEditView({
  backTo,
  register,
  name,
  onName,
  onSave,
  canManage,
  busy,
  notice,
}: {
  backTo: string
  register: CashRegister
  name: string
  onName: (value: string) => void
  onSave: () => void
  canManage: boolean
  busy: boolean
  notice: ReactNode
}) {
  const named = name.trim().length > 1
  const ready = named && name.trim() !== register.name

  return (
    <RedesignShell
      actions={
        <>
          <Button asChild>
            <Link to={backTo}>Скасувати</Link>
          </Button>
          {canManage ? (
            <Button
              aria-busy={busy}
              className="px-5 text-sm font-bold"
              disabled={busy || !ready}
              onClick={onSave}
              variant="primary"
            >
              {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
            </Button>
          ) : null}
        </>
      }
      crumb={
        <>
          <Link
            className="hover:text-app-muted inline-flex items-center gap-1.5"
            to={backTo}
          >
            <ChevronLeft aria-hidden className="size-3" />
            До картки каси
          </Link>
          <span aria-hidden> · </span>
          <span className="text-app-muted">{register.name}</span>
        </>
      }
    >
      <RedesignTitle lead={register.name} title="Редагування каси" />

      {notice}

      <section className="border-app-line bg-app-raised mx-auto grid w-full max-w-[720px] gap-4 rounded-[20px] border px-5 py-5">
        <Field
          hint="Так каса підписана у звітах, переказах і журналі"
          label="Назва каси"
        >
          <TextInput
            disabled={!canManage}
            onChange={(event) => onName(event.target.value)}
            placeholder="Основна каса"
            value={name}
          />
        </Field>
        {!named ? (
          <p className="text-state-warn text-[12.5px]">
            Назва не може бути порожньою.
          </p>
        ) : null}
        {canManage ? (
          <div className="border-app-line flex justify-end border-t pt-4">
            <Button
              aria-busy={busy}
              disabled={busy || !ready}
              onClick={onSave}
              variant="primary"
            >
              {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
            </Button>
          </div>
        ) : null}
      </section>
    </RedesignShell>
  )
}
