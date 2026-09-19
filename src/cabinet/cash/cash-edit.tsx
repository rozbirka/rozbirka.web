import type { ReactNode, RefObject } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, Plus, Trash2 } from 'lucide-react'
import { Button, Field, TextInput } from '@/components/app'
import { cn } from '@/lib/utils'
import type { CashRegister } from '@/api/cash'
import { RedesignShell, RedesignTitle } from '../redesign-shell'
import { money, registerTypeHints, registerTypeLabels } from './cash-labels'

const NO_TYPE_CHANGE =
  'Тип задають при створенні каси й далі не змінюють. Потрібен інший тип — створіть окрему касу.'
const NO_OWNER =
  'Каса належить розбірці, а не людині: відповідального за нею не закріплюють.'
const NO_WAREHOUSE = 'Каса не привʼязана до складу.'
const NO_RECONCILIATION =
  'Звіряння залишку кабінет поки не веде: ні періодичності, ні дати перерахунку, ні розбіжності.'
const NO_RULES =
  'Ліміт залишку, доступність каси в продажах і приховування від колег поки не налаштовуються.'
const NO_TEAM_NOTE = 'Поля для нотатки команді на касі немає.'
const NO_CURRENCY_CATALOGUE =
  'Довідника валют поки немає — введіть код трьома літерами.'

const TYPES = ['cash', 'bank'] as const
const PERIODS = ['Щодня', 'Щотижня', 'Щомісяця', 'Вручну'] as const
const RULES = [
  { label: 'Ліміт залишку', hint: 'Попереджати, коли в касі більше за суму' },
  {
    label: 'Дозволити продажі з цієї каси',
    hint: 'Каса доступна у виборі при оформленні замовлення',
  },
  {
    label: 'Приховати від інших користувачів',
    hint: 'Бачать тільки власник і адміністратор',
  },
] as const

function Step({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-5">
      <div className="flex items-center gap-3">
        <span className="border-app-line text-app-dim inline-flex size-7 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]">
          {number}
        </span>
        <h2 className="text-app-ink text-[15px] font-bold">{title}</h2>
      </div>
      <div className="mt-4 grid gap-3.5">{children}</div>
    </section>
  )
}

/** A choice the server does not store: visible, explained, and not clickable. */
function DeadChip({ children, title }: { children: ReactNode; title: string }) {
  return (
    <button
      className="border-app-line text-app-dim inline-flex min-h-11 cursor-not-allowed items-center rounded-[10px] border px-3.5 text-[13px] font-medium"
      disabled
      title={title}
      type="button"
    >
      {children}
    </button>
  )
}

function Note({ children, tone }: { children: ReactNode; tone?: 'warn' }) {
  return (
    <p
      className={cn(
        'text-[12.5px] leading-5 text-pretty',
        tone === 'warn' ? 'text-state-warn' : 'text-app-dim',
      )}
    >
      {children}
    </p>
  )
}

/**
 * Гроші · Каси · редагування. The server takes a name and the set of
 * currencies, and nothing else: the type is fixed at creation, and the owner,
 * the warehouse, the reconciliation schedule and the till rules from the design
 * have no field to be saved into. They stay on screen, disabled, saying why.
 */
export function CashEditView({
  register,
  name,
  onName,
  newCurrency,
  onNewCurrency,
  onAddCurrency,
  onRemoveCurrency,
  onSave,
  onToggleActive,
  onDelete,
  deleteRef,
  canManage,
  busy,
  notice,
  dialog,
}: {
  register: CashRegister
  name: string
  onName: (value: string) => void
  newCurrency: string
  onNewCurrency: (value: string) => void
  onAddCurrency: () => void
  onRemoveCurrency: (code: string) => void
  onSave: () => void
  onToggleActive: () => void
  onDelete: () => void
  deleteRef: RefObject<HTMLButtonElement | null>
  canManage: boolean
  busy: boolean
  notice: ReactNode
  dialog: ReactNode
}) {
  const currencies = Object.entries(register.balances)
  const named = name.trim().length > 1
  const ready = named && name.trim() !== register.name

  return (
    <RedesignShell
      actions={
        <>
          <Button asChild>
            <Link to={`../${register.id}`}>Скасувати</Link>
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
            to={`../${register.id}`}
          >
            <ChevronLeft aria-hidden className="size-3" />
            До картки каси
          </Link>
          <span aria-hidden> · </span>
          <span className="text-app-muted">{register.name}</span>
        </>
      }
    >
      <RedesignTitle
        lead={
          <>
            {register.name}
            <span aria-hidden> · </span>
            {registerTypeLabels[register.type] ?? register.type}
            <span aria-hidden> · </span>
            {register.isActive ? 'активна' : 'неактивна'}
          </>
        }
        title="Редагування каси"
      />

      {notice}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid min-w-0 content-start gap-5">
          <Step number="01" title="Тип каси">
            <div className="flex flex-wrap gap-2.5">
              {TYPES.map((code) => (
                <button
                  aria-pressed={register.type === code}
                  className={cn(
                    'min-w-0 flex-[1_1_180px] cursor-not-allowed rounded-[14px] border px-4 py-3 text-left',
                    register.type === code
                      ? 'border-app-line-2 bg-white/[0.06]'
                      : 'border-app-line',
                  )}
                  disabled
                  key={code}
                  title={NO_TYPE_CHANGE}
                  type="button"
                >
                  <span
                    className={cn(
                      'block text-[14px] font-bold',
                      register.type === code ? 'text-app-ink' : 'text-app-dim',
                    )}
                  >
                    {registerTypeLabels[code]}
                  </span>
                  <span className="text-app-dim mt-1 block text-[12.5px]">
                    {registerTypeHints[code]}
                  </span>
                </button>
              ))}
            </div>
            <Note>{NO_TYPE_CHANGE}</Note>
          </Step>

          <Step number="02" title="Назва й відповідальний">
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
            {named ? null : (
              <Note tone="warn">Назва не може бути порожньою.</Note>
            )}
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <p className="text-app-muted text-[13px] font-medium">
                  Відповідальний
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <DeadChip title={NO_OWNER}>Не зберігається</DeadChip>
                </div>
              </div>
              <div>
                <p className="text-app-muted text-[13px] font-medium">Склад</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <DeadChip title={NO_WAREHOUSE}>Не зберігається</DeadChip>
                </div>
              </div>
            </div>
            <Note>
              Ні відповідального, ні склад каса не тримає — таких полів у неї
              просто немає.
            </Note>
          </Step>

          <Step number="03" title="Валюти">
            <Note>
              Кожна валюта має власний залишок. Конвертація не виконується.
              Зміна валют застосовується одразу, окремо від кнопки «Зберегти
              зміни».
            </Note>
            <div className="flex flex-wrap gap-2">
              {currencies.length === 0 ? (
                <p className="text-app-dim text-[13.5px]">
                  Валют ще немає — додайте першу нижче.
                </p>
              ) : (
                currencies.map(([code, balance]) => (
                  <span
                    className="border-app-line-2 text-app-ink inline-flex min-h-11 items-center gap-2.5 rounded-[10px] border bg-white/[0.06] px-3.5 text-[13px] font-bold"
                    key={code}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'size-1.5 rounded-full',
                        balance === 0 ? 'bg-app-dim' : 'bg-state-ok',
                      )}
                    />
                    <span className="font-mono">{code}</span>
                    {canManage ? (
                      <button
                        aria-label={`Видалити валюту ${code}`}
                        className="text-app-dim hover:text-state-danger disabled:cursor-not-allowed"
                        disabled={busy || balance !== 0}
                        onClick={() => onRemoveCurrency(code)}
                        title={
                          balance === 0
                            ? `Видалити ${code}`
                            : `У касі є залишок ${money(balance, code)}. Валюту з ненульовим залишком видалити не можна.`
                        }
                        type="button"
                      >
                        <Trash2 aria-hidden className="size-3.5" />
                      </button>
                    ) : null}
                  </span>
                ))
              )}
            </div>
            {canManage ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field
                  className="min-w-36 flex-1"
                  hint={NO_CURRENCY_CATALOGUE}
                  label="Нова валюта"
                >
                  <TextInput
                    onChange={(event) => onNewCurrency(event.target.value)}
                    placeholder="USD"
                    value={newCurrency}
                  />
                </Field>
                <Button
                  disabled={busy || newCurrency.trim() === ''}
                  onClick={onAddCurrency}
                >
                  <Plus aria-hidden />
                  Додати валюту
                </Button>
              </div>
            ) : null}
          </Step>

          <Step number="04" title="Звіряння й доступ">
            <div>
              <p className="text-app-muted text-[13px] font-medium">
                Періодичність звіряння
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PERIODS.map((label) => (
                  <DeadChip key={label} title={NO_RECONCILIATION}>
                    {label}
                  </DeadChip>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              {RULES.map((rule) => (
                <div
                  className="border-app-line flex items-start gap-3 rounded-[14px] border px-3.5 py-3"
                  key={rule.label}
                  title={NO_RULES}
                >
                  <span
                    aria-hidden
                    className="bg-app-line mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full px-0.5"
                  >
                    <span className="bg-app-dim size-4 rounded-full" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-app-dim block text-[13.5px] font-medium">
                      {rule.label}
                    </span>
                    <span className="text-app-dim mt-0.5 block text-[12.5px]">
                      {rule.hint}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <Note>
              {NO_RECONCILIATION} {NO_RULES} {NO_TEAM_NOTE} Ці перемикачі
              лишаються вимкненими, доки такі правила не зʼявляться в кабінеті.
            </Note>
          </Step>
        </div>

        <div className="grid min-w-0 content-start gap-5">
          <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
            <h2 className="text-app-ink text-[15px] font-bold">Зведення</h2>
            <p
              className={cn(
                'mt-3.5 text-[17px] font-bold',
                named ? 'text-app-ink' : 'text-app-dim',
              )}
            >
              {named ? name.trim() : 'Назва каси'}
            </p>
            <p className="text-app-muted mt-1 text-[13px]">
              {registerTypeLabels[register.type] ?? register.type}
              <span aria-hidden> · </span>
              {register.isActive ? 'активна' : 'неактивна'}
            </p>
            <dl className="mt-4 grid gap-2.5 text-[13.5px]">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Валюти</dt>
                <dd className="text-app-ink text-right font-mono font-medium">
                  {currencies.length === 0
                    ? '—'
                    : currencies.map(([code]) => code).join(', ')}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-app-muted">Звіряння</dt>
                <dd className="text-app-dim text-right">
                  <span title={NO_RECONCILIATION}>—</span>
                </dd>
              </div>
            </dl>
            <p className="text-app-muted mt-4 font-mono text-[10px] tracking-[0.14em] uppercase">
              Поточні залишки
            </p>
            <dl className="mt-2.5 grid gap-1.5">
              {currencies.length === 0 ? (
                <p className="text-app-dim text-[13.5px]">Валют ще немає</p>
              ) : (
                currencies.map(([code, balance]) => (
                  <div
                    className="flex items-baseline justify-between gap-4"
                    key={code}
                  >
                    <dt className="text-app-muted font-mono text-[12px] tracking-[0.1em]">
                      {code}
                    </dt>
                    <dd
                      className={cn(
                        'font-mono text-[15px] tabular-nums',
                        balance === 0
                          ? 'text-app-dim'
                          : 'text-app-ink font-medium',
                      )}
                    >
                      {money(balance, code)}
                    </dd>
                  </div>
                ))
              )}
            </dl>
            {canManage ? (
              <Button
                aria-busy={busy}
                className="mt-5 w-full justify-center"
                disabled={busy || !ready}
                onClick={onSave}
                variant="primary"
              >
                {busy ? 'Зберігаємо…' : 'Зберегти зміни'}
              </Button>
            ) : null}
            <Note>
              {!named
                ? 'Вкажіть назву каси.'
                : ready
                  ? 'Зберігається лише назва — історія й залишки не змінюються.'
                  : 'Назву не змінено: зберігати нічого.'}
            </Note>
          </section>

          {canManage ? (
            <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5 py-4.5">
              <h2 className="text-app-ink text-[15px] font-bold">
                {register.isActive ? 'Закрити касу' : 'Відкрити касу'}
              </h2>
              <p className="text-app-muted mt-2.5 text-[13px] leading-5 text-pretty">
                {register.isActive
                  ? 'Закрита каса лишається в журналі й звітах, але нових операцій і переказів у неї не проведеш.'
                  : 'Каса закрита: операції та перекази в неї недоступні, поки її не відкрити.'}
              </p>
              <Button
                className="mt-3.5 w-full justify-center"
                disabled={busy}
                onClick={onToggleActive}
              >
                {register.isActive ? 'Закрити касу' : 'Відкрити касу'}
              </Button>
              <p className="text-app-dim mt-4 text-[12.5px] leading-5 text-pretty">
                Видалення прибирає касу разом із журналом назавжди. Якщо по касі
                вже були операції, видалити її не вийде — тоді закривайте.
              </p>
              <Button
                className="mt-2.5 w-full justify-center"
                disabled={busy}
                onClick={onDelete}
                ref={deleteRef}
                variant="danger"
              >
                <Trash2 aria-hidden />
                Видалити касу
              </Button>
            </section>
          ) : null}

          {dialog}
        </div>
      </div>
    </RedesignShell>
  )
}
