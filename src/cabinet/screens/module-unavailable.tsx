import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Check, Minus, PackageOpen } from 'lucide-react'
import { Amount, Button, StateScreen } from '@/components/app'
import { billingApi } from '@/api/billing'
import type { BillingState, PublicPlanDto } from '@/api/types'
import { cn } from '@/lib/utils'
import { featureLabel } from '../billing/billing-vocabulary'
import { cabinetPath } from '../cabinet-paths'
import { useCabinet } from '../CabinetContext'
import {
  cabinetModules,
  type CabinetModuleDefinition,
  type CabinetModuleKey,
} from '../module-registry'

const moduleLabel = (definition: CabinetModuleDefinition) =>
  definition.navigation?.label ?? definition.key

/** The support address the cabinet already hands out for billing questions. */
const SUPPORT_MAIL = 'support@rozbirka.app'

const NO_PLAN_PITCH =
  'Тариф описаний переліком можливостей і лімітів — розгорнутого опису в ньому немає.'
const NO_PRORATION =
  'Скільки доплатити за залишок періоду, кабінет не рахує — сума буде видна в рахунку Mono.'
const NO_RETENTION =
  'До якої дати зберігаються дані після зупинки підписки — питання до підтримки.'
const NO_RETRY_DATE =
  'Дати наступної спроби списання кабінет не показує — є лише дата, на яку призначене списання.'

export function ModuleUnavailableScreen({
  definition,
}: {
  definition: CabinetModuleDefinition
}) {
  const { targetTenant } = useCabinet()

  return (
    <StateScreen
      actions={
        targetTenant === null ? undefined : (
          <Button asChild variant="primary">
            <Link to={cabinetPath(targetTenant.slug, 'dashboard')}>
              До головної
            </Link>
          </Button>
        )
      }
      className="min-h-[50dvh] content-center"
      description={`${moduleLabel(definition)} поки недоступний у вашій розбірці. Посилання запрацює, щойно розділ увімкнуть.`}
      icon={<PackageOpen aria-hidden />}
      title="Розділ поки недоступний"
      tone="neutral"
    />
  )
}

/**
 * The paywall. What the module gives is read from the registry, and which plan
 * unlocks it — from the public catalogue: the cheapest plan whose feature list
 * carries this module's `requiredFeature`. Nothing about price or savings is
 * invented; where the catalogue is silent, the screen says so.
 */
export function FeatureUnavailableScreen({
  definition,
}: {
  definition: CabinetModuleDefinition
}) {
  const { targetTenant, snapshot } = useCabinet()
  const [plans, setPlans] = useState<PublicPlanDto[] | null>(null)
  const required = definition.requiredFeature

  useEffect(() => {
    const controller = new AbortController()
    void billingApi
      .getPlans({ signal: controller.signal })
      .then((loaded) => {
        if (!controller.signal.aborted) setPlans(loaded)
      })
      .catch(() => {
        // Without the catalogue the screen still says what is locked and where
        // to look; it just cannot name the plan that unlocks it.
        if (!controller.signal.aborted) setPlans([])
      })
    return () => controller.abort()
  }, [])

  const currentPlan = snapshot?.subscription?.planName ?? null
  const unlocking =
    required === undefined || plans === null
      ? null
      : (plans
          .filter((plan) => plan.features.includes(required))
          .sort((a, b) => a.amount - b.amount)[0] ?? null)
  const label = moduleLabel(definition)

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[880px] gap-6 px-4 pt-14 pb-16 sm:px-6 md:px-8 md:pt-18 lg:px-12">
        <div>
          <span className="border-state-warn/30 bg-state-warn/10 text-state-warn inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-bold">
            <span aria-hidden className="bg-state-warn size-1.5 rounded-full" />
            {currentPlan === null
              ? 'Недоступно у поточному тарифі'
              : `Недоступно у тарифі ${currentPlan}`}
          </span>
          <h1 className="mt-3.5 text-[32px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
            {unlocking === null
              ? `Розділ «${label}» не входить у ваш тариф`
              : `Розділ «${label}» входить у тариф ${unlocking.name}`}
          </h1>
          <p className="text-app-muted mt-3 max-w-[64ch] text-[14.5px] leading-6 text-pretty">
            Розділ вимкнений тарифом — дані розбірки від цього не змінюються й
            нікуди не зникають. Щойно тариф дозволить, усе буде на місці.
          </p>
        </div>

        <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                {unlocking === null ? 'Тариф із цим модулем' : 'Потрібен тариф'}
              </p>
              {unlocking === null ? (
                <p className="text-app-dim mt-2.5 max-w-[52ch] text-[13.5px] leading-5 text-pretty">
                  {plans === null
                    ? 'Дивимось, який тариф відкриває цей розділ…'
                    : 'Каталог тарифів не називає тарифу з цим модулем — подивіться повний перелік.'}
                </p>
              ) : (
                <>
                  <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
                    <span className="text-app-ink text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
                      {unlocking.name}
                    </span>
                    <Amount
                      className="text-app-muted text-[15px]"
                      currency={unlocking.currency}
                      value={unlocking.amount}
                    />
                  </p>
                  <p className="text-app-dim mt-2 max-w-[52ch] text-[12.5px] leading-5 text-pretty">
                    {currentPlan === null
                      ? ''
                      : `Зараз у вас «${currentPlan}». `}
                    {NO_PRORATION}
                  </p>
                </>
              )}
            </div>
            {targetTenant === null ? null : (
              <div className="flex flex-wrap gap-2.5">
                <Button asChild>
                  <Link to={cabinetPath(targetTenant.slug, 'plans')}>
                    Порівняти тарифи
                  </Link>
                </Button>
                {unlocking !== null && (
                  <Button asChild variant="primary">
                    <Link
                      to={`${cabinetPath(targetTenant.slug, 'plans')}?plan=${encodeURIComponent(unlocking.code)}`}
                    >
                      Перейти на {unlocking.name}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
          {unlocking === null ? null : (
            <ul className="border-app-line mt-5 grid gap-2 border-t pt-4">
              {unlocking.features.map((code) => (
                <li
                  className="text-app-muted flex items-start gap-2.5 text-[13.5px]"
                  key={code}
                >
                  <Check
                    aria-hidden
                    className="text-state-ok mt-0.5 size-4 shrink-0"
                  />
                  {code === required ? (
                    <span className="text-app-ink font-medium">
                      {featureLabel(code)}
                    </span>
                  ) : (
                    featureLabel(code)
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="text-app-dim mt-4 text-[12.5px] leading-5 text-pretty">
            {NO_PLAN_PITCH}
          </p>
        </section>

        <p className="text-app-dim text-[13px]">
          Потрібен лише цей модуль?{' '}
          <a
            className="text-brand underline underline-offset-4"
            href={`mailto:${SUPPORT_MAIL}`}
          >
            Напишіть нам
          </a>{' '}
          — підберемо варіант.
        </p>
      </div>
    </div>
  )
}

const stateCopy: Partial<
  Record<BillingState, { chip: string; title: string; body: string }>
> = {
  pastDue: {
    chip: 'Оплата прострочена',
    title: 'Платіж не пройшов',
    body: 'Списання за підписку не вдалося. Поки платіж не пройде, частина розділів працює лише на перегляд — дані розбірки лишаються на місці.',
  },
  blocked: {
    chip: 'Кабінет у режимі перегляду',
    title: 'Підписка неактивна — дані лише для читання',
    body: 'Склад, замовлення й історія грошей збереглися повністю, але створювати й змінювати записи не можна, доки підписка не відновиться.',
  },
  cancelled: {
    chip: 'Підписку скасовано',
    title: 'Підписка скасована — доступ діє до кінця періоду',
    body: 'Списань більше не буде. Коли сплачений період завершиться, кабінет перейде в режим перегляду.',
  },
  none: {
    chip: 'Підписки ще немає',
    title: 'Щоб відкрити цей розділ, потрібна підписка',
    body: 'Оформіть тариф — усе, що вже є в розбірці, лишиться на місці й стане доступним одразу після оплати.',
  },
}

/**
 * Стан підписки на весь екран. The «що доступно зараз» list is not a promise:
 * it is read from the module registry, which is the same table the router uses
 * to let a module through in this billing state.
 */
export function SubscriptionStateScreen({
  definition,
  state,
}: {
  definition: CabinetModuleDefinition
  state: BillingState
}) {
  const { targetTenant, snapshot } = useCabinet()
  const subscription = snapshot?.subscription ?? null
  const copy = stateCopy[state] ?? {
    chip: 'Підписка потребує уваги',
    title: 'Розділ доступний лише після оплати',
    body: 'Поки підписка неактивна, цей розділ закритий. Історія платежів і тарифи лишаються відкритими.',
  }
  const modules = (Object.keys(cabinetModules) as CabinetModuleKey[])
    .map((key) => cabinetModules[key])
    .filter(
      (one) =>
        one.released &&
        one.navigation !== undefined &&
        (one.viewPermission === undefined ||
          snapshot?.permissions.has(one.viewPermission) === true),
    )
    .map((one) => ({
      label: moduleLabel(one),
      open:
        one.allowedSubscriptionStates === undefined ||
        one.allowedSubscriptionStates.includes(state),
    }))

  return (
    <div className="type-redesign -mx-4 -mt-6 grid content-start sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div className="mx-auto grid w-full max-w-[880px] gap-6 px-4 pt-14 pb-16 sm:px-6 md:px-8 md:pt-18 lg:px-12">
        <div role="alert">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[12px] font-bold',
              state === 'blocked'
                ? 'border-state-danger/30 bg-state-danger/10 text-state-danger'
                : 'border-state-warn/30 bg-state-warn/10 text-state-warn',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'size-1.5 rounded-full',
                state === 'blocked' ? 'bg-state-danger' : 'bg-state-warn',
              )}
            />
            {copy.chip}
          </span>
          <h1 className="mt-3.5 text-[32px] leading-[1.04] font-extrabold tracking-[-0.03em] text-white sm:text-[40px]">
            {copy.title}
          </h1>
          <p className="text-app-muted mt-3 max-w-[64ch] text-[14.5px] leading-6 text-pretty">
            {copy.body} Ви намагалися відкрити «{moduleLabel(definition)}».
          </p>
        </div>

        <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                Сума до сплати
              </dt>
              <dd className="text-app-ink mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                {typeof subscription?.amount === 'number' ? (
                  <Amount
                    currency={subscription.currency}
                    value={subscription.amount}
                  />
                ) : (
                  <span className="text-app-dim">—</span>
                )}
              </dd>
              <dd className="text-app-dim mt-1 text-[12.5px]">
                {subscription?.planName ?? 'тариф не вказано'}
              </dd>
            </div>
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                Наступне списання
              </dt>
              <dd className="text-app-ink mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                {subscription?.nextChargeAt === null ||
                subscription?.nextChargeAt === undefined ? (
                  <span className="text-app-dim" title={NO_RETRY_DATE}>
                    —
                  </span>
                ) : (
                  new Date(subscription.nextChargeAt).toLocaleDateString(
                    'uk-UA',
                  )
                )}
              </dd>
              <dd className="text-app-dim mt-1 text-[12.5px]">
                {NO_RETRY_DATE}
              </dd>
            </div>
            <div>
              <dt className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
                Доступ до
              </dt>
              <dd className="text-app-ink mt-2 text-[20px] font-extrabold tracking-[-0.02em]">
                {subscription?.currentPeriodEnd === null ||
                subscription?.currentPeriodEnd === undefined ? (
                  <span className="text-app-dim">—</span>
                ) : (
                  new Date(subscription.currentPeriodEnd).toLocaleDateString(
                    'uk-UA',
                  )
                )}
              </dd>
              <dd className="text-app-dim mt-1 text-[12.5px]">
                {NO_RETENTION}
              </dd>
            </div>
          </dl>
          {targetTenant === null ? null : (
            <div className="border-app-line mt-5 flex flex-wrap gap-2.5 border-t pt-4">
              <Button asChild variant="primary">
                <Link to={cabinetPath(targetTenant.slug, 'billing')}>
                  Перейти до підписки
                </Link>
              </Button>
              <Button asChild>
                <Link to={cabinetPath(targetTenant.slug, 'plans')}>
                  Порівняти тарифи
                </Link>
              </Button>
              <Button asChild>
                <Link to={cabinetPath(targetTenant.slug, 'payments')}>
                  Історія платежів
                </Link>
              </Button>
            </div>
          )}
        </section>

        <section className="border-app-line bg-app-raised min-w-0 rounded-[20px] border px-5.5 py-5">
          <h2 className="text-app-ink text-[15px] font-bold">
            Що доступно зараз
          </h2>
          <ul className="mt-3.5 grid gap-2 sm:grid-cols-2">
            {modules.map((one) => (
              <li
                className={cn(
                  'flex items-start gap-2.5 text-[13.5px]',
                  one.open ? 'text-app-muted' : 'text-app-dim',
                )}
                key={one.label}
              >
                {one.open ? (
                  <Check
                    aria-label="доступний"
                    className="text-state-ok mt-0.5 size-4 shrink-0"
                  />
                ) : (
                  <Minus
                    aria-label="закритий"
                    className="text-app-dim mt-0.5 size-4 shrink-0"
                  />
                )}
                {one.label}
              </li>
            ))}
          </ul>
          <p className="text-app-dim mt-4 text-[12.5px] leading-5 text-pretty">
            Перелік зібраний з тих самих правил, за якими кабінет пускає в
            розділ, — це не обіцянка, а те, що застосується прямо зараз.
          </p>
        </section>

        <p className="text-app-dim text-[13px]">
          Питання щодо оплати —{' '}
          <a
            className="text-brand underline underline-offset-4"
            href={`mailto:${SUPPORT_MAIL}`}
          >
            {SUPPORT_MAIL}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
