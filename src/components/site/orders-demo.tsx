import { useEffect, useRef, useState } from 'react'
import { intlLocale, useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import {
  DemoCaption,
  DemoChapters,
  DemoCursor,
  DemoPlayerCard,
} from './demo-player'
import {
  along,
  around,
  captionAt,
  typed,
  useDemoPlayer,
  type DemoPlayer,
} from './use-demo-player'
import { demoMessages } from './demo-messages'
import { useMoney } from './landing-hooks'
import { landingMessages, listOf, rowsOf } from './landing-messages'
import { Eyebrow, SectionTitle } from './landing-ui'

const ITEMS = [
  { code: 'A-0142', price: 180 },
  { code: 'B-0217', price: 95 },
  { code: 'C-0309', price: 240 },
]
const ORDER_SUM = 515
const UAH_PAYMENT = 8300
const USD_PAYMENT = 315
const CURRENCIES = ['UAH', 'USD', 'EUR'] as const
type Currency = (typeof CURRENCIES)[number]

/**
 * Cursor path per chapter: `[moment, target]`, where the target is the
 * `data-ot` element of the screen the pointer moves to (`rest` = corner).
 */
const PATHS: readonly (readonly (readonly [number, string])[])[] = [
  [
    [0, 'rest'],
    [0.12, 'scan'],
    [1, 'scan'],
  ],
  [
    [0, 'rest'],
    [0.1, 'cur-uah'],
    [0.18, 'cur-uah'],
    [0.24, 'amount'],
    [0.44, 'amount'],
    [0.51, 'post'],
    [1, 'post'],
  ],
  [
    [0, 'post'],
    [0.1, 'cur-usd'],
    [0.18, 'cur-usd'],
    [0.24, 'amount'],
    [0.44, 'amount'],
    [0.51, 'post'],
    [1, 'post'],
  ],
  [
    [0, 'rest'],
    [0.18, 'kasa-usd'],
    [0.6, 'kasa-usd'],
    [0.75, 'tx0'],
    [1, 'tx0'],
  ],
]
const CLICKS = [
  [0.18, 0.38, 0.58],
  [0.13, 0.24, 0.53],
  [0.13, 0.24, 0.53],
  [0.2],
]
const CAPTION_MOMENTS = [
  [0, 0.65],
  [0, 0.24, 0.54],
  [0, 0.54],
  [0, 0.2, 0.6],
]
const captionKeys = [
  'ordersCaptions0',
  'ordersCaptions1',
  'ordersCaptions2',
  'ordersCaptions3',
] as const

/** Moves the pointer between the measured `data-ot` targets of the screen. */
function placeCursor(
  screen: HTMLElement,
  cursor: HTMLElement,
  step: number,
  t: number,
) {
  const box = screen.getBoundingClientRect()
  const at = (target: string): [number, number] => {
    const element =
      target === 'rest' ? null : screen.querySelector(`[data-ot="${target}"]`)
    if (!element) return [box.width * 0.8, box.height * 0.88]
    const rect = element.getBoundingClientRect()
    return [
      rect.left - box.left + Math.min(rect.width * 0.5, 60),
      rect.top - box.top + rect.height * 0.55,
    ]
  }
  const path = PATHS[step]!.map(
    ([moment, target]) => [moment, at(target)] as const,
  )
  const [x, y] = along(path, t, (a, b, u) => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
  ])
  cursor.style.left = `${x.toFixed(1)}px`
  cursor.style.top = `${y.toFixed(1)}px`
}

const panel =
  'flex flex-col gap-3 rounded-[18px] border border-white/[0.08] bg-lp-inset p-4'
const row =
  'lp-demo-row-in flex items-center justify-between gap-3 rounded-xl bg-lp-inset px-3 py-2.5 text-[14px]'
const pressButton =
  'bg-lp-accent text-[#0b0b0b] flex h-10 items-center justify-center rounded-full px-4 text-[14px] font-semibold whitespace-nowrap transition-transform duration-150'

function OrdersScreen({ player }: { player: DemoPlayer }) {
  const d = useT(demoMessages)
  const money = useMoney()
  const { locale } = useLocale()
  const number = new Intl.NumberFormat(intlLocale(locale))
  const hryvnia = (value: number) => `${number.format(value)} ₴`
  const { step, t } = player

  const click = around(t, CLICKS[step]!, 0.06)
  const hit = (moment: number) => around(t, [moment], 0.05)
  const caption = captionAt(
    t,
    CAPTION_MOMENTS[step]!,
    listOf(d(captionKeys[step]!)),
  )

  const itemNames = listOf(d('orderItems'))
  const itemCount =
    step === 0 ? [0.22, 0.42, 0.62].filter((moment) => t >= moment).length : 3
  const items = ITEMS.slice(0, itemCount)

  const uahPayment = {
    till: d('cashTill', { code: 'UAH' }),
    note: d('noteUah'),
    amount: hryvnia(UAH_PAYMENT),
  }
  const usdPayment = {
    till: d('cashTill', { code: 'USD' }),
    note: d('noteUsd'),
    amount: money(USD_PAYMENT),
  }
  const payments =
    step === 1
      ? t > 0.58
        ? [uahPayment]
        : []
      : step === 2
        ? t > 0.58
          ? [usdPayment, uahPayment]
          : [uahPayment]
        : step === 3
          ? [usdPayment, uahPayment]
          : []
  const paidUp = (step === 2 && t > 0.58) || step === 3
  const received =
    payments
      .map((payment) => payment.amount)
      .reverse()
      .join(' + ') || '—'
  const currency: Currency =
    step === 1 ? (t > 0.13 ? 'UAH' : 'USD') : t > 0.13 ? 'USD' : 'UAH'
  const amount =
    step === 1
      ? typed(number.format(UAH_PAYMENT), t, 0.26, 0.44) +
        (t > 0.26 ? ' ₴' : '')
      : step === 2
        ? (t > 0.26 ? '$' : '') +
          typed(number.format(USD_PAYMENT), t, 0.26, 0.42)
        : ''
  const typing = t > 0.22 && t < 0.5
  const picked = step === 3 && t > 0.24

  const chips =
    step === 3
      ? []
      : [
          { label: d('chipReserved'), on: step > 0 || t > 0.62 },
          { label: d('chipPaid'), on: paidUp },
        ]

  const tills = [
    {
      name: d('cashTill', { code: 'UAH' }),
      balance: `₴${number.format(86240)}`,
      ot: 'k-uah',
    },
    {
      name: d('businessTill'),
      balance: `₴${number.format(214900)}`,
      ot: 'k-fop',
    },
    {
      name: d('cashTill', { code: 'USD' }),
      balance: money(picked ? 12795 : 12480),
      ot: 'kasa-usd',
    },
  ]
  const transactions = rowsOf(d('tillTransactions'))
  const amounts = [`+${money(315)}`, `+${money(480)}`, `−${money(1000)}`]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-unbounded text-[16px] font-semibold">
          {step === 3 ? d('tillsHead') : d('orderHead')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={cn(
                'rounded-full border px-2.5 py-[5px] text-[12px] whitespace-nowrap transition-all duration-300',
                chip.on
                  ? 'border-lp-accent bg-lp-accent text-[#0b0b0b] font-semibold'
                  : 'text-lp-muted border-white/20 bg-transparent',
              )}
            >
              {chip.on ? `✓ ${chip.label}` : chip.label}
            </span>
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className={panel}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col gap-0.5">
              <span className="text-lp-dim text-[12px]">{d('customer')}</span>
              <span className="font-semibold">{d('customerName')}</span>
            </span>
            <span
              data-ot="scan"
              className={pressButton}
              style={{
                transform: around(t, CLICKS[0]!, 0.05) ? 'scale(.94)' : 'none',
              }}
            >
              {d('scanQr')}
            </span>
          </div>
          {items.map((item, index) => (
            <div key={item.code} className={row}>
              <span className="flex items-center gap-2.5">
                <span className="text-lp-dim font-mono text-[11px]">
                  {item.code}
                </span>
                {itemNames[index]}
              </span>
              <span className="font-semibold tabular-nums">
                {money(item.price)}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-white/10 pt-2 font-semibold">
            <span>{d('total')}</span>
            <span className="tabular-nums">
              {money(items.reduce((sum, item) => sum + item.price, 0))}
            </span>
          </div>
        </div>
      )}

      {(step === 1 || step === 2) && (
        <div className={panel}>
          <div className="grid grid-cols-2 gap-2">
            <span className="flex flex-col gap-0.5 rounded-xl bg-lp-inset px-3 py-2.5">
              <span className="text-lp-dim text-[12px]">{d('orderSum')}</span>
              <span className="text-[17px] font-semibold tabular-nums">
                {money(ORDER_SUM)}
              </span>
            </span>
            <span
              className={cn(
                'flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-[background] duration-[400ms]',
                paidUp
                  ? 'bg-lp-accent text-[#0b0b0b]'
                  : 'text-lp-ink bg-lp-inset',
              )}
            >
              <span className="text-[12px]">
                {paidUp ? d('receivedPaid') : d('received')}
              </span>
              <span className="text-[17px] font-semibold tabular-nums">
                {received}
              </span>
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-lp-dim text-[12px]">{d('newPayment')}</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-lp-bg flex gap-0.5 rounded-xl border border-white/10 p-[3px]">
                {CURRENCIES.map((code) => (
                  <span
                    key={code}
                    data-ot={`cur-${code.toLowerCase()}`}
                    className={cn(
                      'flex h-9 min-w-[52px] items-center justify-center rounded-[9px] px-2.5 text-[13px] font-bold transition-[background,color] duration-200',
                      currency === code
                        ? 'bg-lp-accent text-[#0b0b0b]'
                        : 'text-lp-muted bg-transparent',
                    )}
                  >
                    {code}
                  </span>
                ))}
              </div>
              <span
                data-ot="amount"
                className={cn(
                  'bg-lp-bg flex h-[42px] min-w-[110px] flex-1 items-center gap-1.5 rounded-xl border-[1.5px] px-3 text-[16px] font-semibold tabular-nums',
                  typing ? 'border-lp-accent' : 'border-white/10',
                )}
              >
                {amount}
                <span
                  className="lp-demo-caret bg-lp-accent h-[18px] w-[1.5px]"
                  style={{ opacity: typing ? 1 : 0 }}
                />
              </span>
              <span
                data-ot="post"
                className={pressButton}
                style={{ transform: hit(0.53) ? 'scale(.94)' : 'none' }}
              >
                {d('post')}
              </span>
            </div>
            <span className="text-lp-muted text-[12px]">
              {d('tillLabel')}{' '}
              <b className="text-lp-ink font-semibold">
                {d('cashTill', { code: currency })}
              </b>
            </span>
          </div>
          {payments.map((payment) => (
            <div key={payment.till} className={row}>
              <span className="flex flex-col gap-px">
                <span className="font-semibold">{payment.till}</span>
                <span className="text-lp-dim text-[12px]">{payment.note}</span>
              </span>
              <span className="text-lp-ok-text font-semibold tabular-nums">
                +{payment.amount}
              </span>
            </div>
          ))}
        </div>
      )}

      {step === 3 && (
        <div className="grid min-h-0 grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-3 max-[960px]:grid-cols-1">
          <div className="flex flex-col gap-1.5">
            {tills.map((till) => {
              const on = picked && till.ot === 'kasa-usd'
              return (
                <div
                  key={till.ot}
                  data-ot={till.ot}
                  className={cn(
                    'flex flex-col gap-0.5 rounded-xl border-[1.5px] p-3 transition-all duration-[250ms]',
                    on
                      ? 'border-lp-accent bg-[rgba(255,106,26,0.1)]'
                      : 'bg-lp-inset border-white/[0.08]',
                  )}
                >
                  <span className="text-lp-muted text-[13px]">{till.name}</span>
                  <span className="text-[17px] font-semibold tabular-nums">
                    {till.balance}
                  </span>
                </div>
              )
            })}
          </div>
          <div className={cn(panel, 'p-3.5')}>
            <span className="text-lp-dim text-[12px]">
              {picked ? d('tillMoves') : d('pickTill')}
            </span>
            {picked && (
              <div className="flex flex-col gap-1.5">
                {transactions.map(([title, when], index) => (
                  <div
                    key={title}
                    data-ot={index === 0 ? 'tx0' : undefined}
                    className={cn(
                      row,
                      index === 0 &&
                        'border border-[rgba(255,106,26,0.45)] bg-[rgba(255,106,26,0.1)]',
                    )}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <span className="flex min-w-0 flex-col gap-px">
                      <span
                        className={index === 0 ? 'font-semibold' : undefined}
                      >
                        {title}
                      </span>
                      <span
                        className={cn(
                          'text-[12px]',
                          index === 0 ? 'text-lp-muted' : 'text-lp-dim',
                        )}
                      >
                        {when}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'tabular-nums',
                        index === 2 ? 'text-lp-muted' : 'text-lp-ok-text',
                        index === 0 && 'font-bold',
                      )}
                    >
                      {amounts[index]}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      <DemoCaption step={step} text={caption} />
      <DemoCursor
        click={click}
        className="top-[88%] left-[80%] transition-[left,top] duration-100 ease-linear"
      />
    </>
  )
}

/** «Замовлення і каси»: the orders demo with its chapter list (light chapter). */
export function OrdersSpotlight() {
  const l = useT(landingMessages)
  const d = useT(demoMessages)
  const chapters = listOf(d('ordersChapters'))
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  const player = useDemoPlayer(chapters.length, card)
  const screen = useRef<HTMLDivElement>(null)
  const { step, t } = player

  useEffect(() => {
    const element = screen.current
    const cursor = element?.querySelector<HTMLElement>('[data-cursor]')
    if (element && cursor) placeCursor(element, cursor, step, t)
  }, [step, t])

  return (
    <section
      data-reveal=""
      data-tone="light"
      className="lp-light lp-chap grid grid-cols-2 items-center gap-16 max-[960px]:grid-cols-1 max-sm:gap-10"
    >
      <DemoPlayerCard
        player={player}
        cardRef={setCard}
        title={chapters[step] ?? ''}
        className="max-[960px]:order-1"
        screenRef={screen}
        screenClassName="flex h-[440px] flex-col gap-3 p-[18px]"
      >
        <OrdersScreen player={player} />
      </DemoPlayerCard>
      <div className="flex flex-col gap-6">
        <Eyebrow>{l('ordersEyebrow')}</Eyebrow>
        <SectionTitle>{l('ordersTitle')}</SectionTitle>
        <p className="text-lp-muted m-0 text-[18px] leading-normal">
          {d('ordersIntro')}
        </p>
        <DemoChapters player={player} titles={chapters} />
      </div>
    </section>
  )
}
