import { useState } from 'react'
import { useT } from '@/i18n'
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

const VIN = 'WBAPN71060A123482'
const PRICE = 3200
const SALES = [1450, 820, 380, 240, 210, 180, 160, 95]
const CARS = [
  { name: 'BMW 320d E90 · 2008', invested: 3200, earned: 3535 },
  { name: 'VW Passat B7 · 2012', invested: 2400, earned: 3150 },
  { name: 'Toyota Camry 50 · 2014', invested: 5100, earned: 4300 },
]
const MAX_EARNED = 4300
const BATCH_INVESTED = 10700
const BATCH_EARNED = 10985

/** Cursor path per chapter: `[moment, [x%, y%]]` inside the screen. */
const PATHS: readonly (readonly (readonly [
  number,
  readonly [number, number],
])[])[] = [
  [
    [0, [75, 85]],
    [0.12, [40, 30]],
    [0.42, [40, 30]],
    [0.5, [22, 46]],
    [0.75, [22, 46]],
    [0.85, [55, 75]],
  ],
  [
    [0, [60, 80]],
    [0.12, [45, 30]],
    [0.42, [45, 30]],
    [0.6, [86, 50]],
    [1, [86, 50]],
  ],
  [
    [0, [80, 88]],
    [1, [80, 88]],
  ],
  [
    [0, [70, 85]],
    [0.3, [60, 32]],
    [0.6, [60, 52]],
    [0.9, [60, 72]],
    [1, [60, 72]],
  ],
]
const CLICKS = [[0.14, 0.52], [0.13, 0.64], [], []]
const CAPTION_MOMENTS = [
  [0, 0.12, 0.52],
  [0, 0.66],
  [0, 0.67],
  [0, 0.5],
]
const captionKeys = [
  'carsCaptions0',
  'carsCaptions1',
  'carsCaptions2',
  'carsCaptions3',
] as const

const panel =
  'flex flex-col gap-3.5 rounded-[18px] border border-white/[0.08] bg-lp-inset p-5'
const panelTitle = 'font-unbounded text-[18px] font-semibold'
const fieldLabel = 'text-lp-dim text-[12px]'
const field =
  'bg-lp-bg flex h-[46px] items-center gap-2 rounded-xl border-[1.5px] px-3.5 text-[15px] tabular-nums transition-[border-color] duration-200'
const tile = 'flex flex-col rounded-xl bg-[#181818]'
const pressButton =
  'bg-lp-accent text-lp-bg flex h-11 items-center rounded-full text-[15px] font-semibold transition-transform duration-150'

const border = (on: boolean) => (on ? 'border-lp-accent' : 'border-white/10')

function CarsScreen({ player }: { player: DemoPlayer }) {
  const d = useT(demoMessages)
  const money = useMoney()
  const { step, t } = player
  const [x, y] = along(PATHS[step]!, t, (a, b, u) => [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
  ])
  const click = around(t, CLICKS[step]!, 0.06)
  const caption = captionAt(
    t,
    CAPTION_MOMENTS[step]!,
    listOf(d(captionKeys[step]!)),
  )

  return (
    <>
      {step === 0 && (
        <div className={panel}>
          <span className={panelTitle}>{d('newCar')}</span>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{d('vinLabel')}</span>
            <span
              className={cn(
                field,
                'font-mono tracking-[0.04em]',
                border(t < 0.5),
              )}
            >
              {typed(VIN, t, 0.15, 0.42)}
              <span
                className="lp-demo-caret bg-lp-accent h-[18px] w-[1.5px]"
                style={{ opacity: t < 0.5 ? 1 : 0 }}
              />
            </span>
          </div>
          <span
            className={cn(pressButton, 'self-start px-5')}
            style={{ transform: t >= 0.5 && t < 0.56 ? 'scale(.94)' : 'none' }}
          >
            {d('decodeVin')}
          </span>
          {t > 0.58 && (
            <div className="lp-demo-row-in-slow grid grid-cols-2 gap-2">
              {rowsOf(d('vinSpecs')).map(([label, value]) => (
                <span key={label} className={cn(tile, 'gap-0.5 px-3 py-2.5')}>
                  <span className={fieldLabel}>{label}</span>
                  <span className="font-semibold">{value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      {step === 1 && (
        <div className={panel}>
          <span className={panelTitle}>{CARS[0]!.name}</span>
          <div className="flex flex-col gap-1.5">
            <span className={fieldLabel}>{d('purchasePrice')}</span>
            <span className={cn(field, border(t > 0.1 && t < 0.46))}>
              $ {typed(String(PRICE), t, 0.15, 0.38)}
            </span>
          </div>
          <span
            className={cn(pressButton, 'self-end px-[22px]')}
            style={{
              transform: t >= 0.64 && t < 0.7 ? 'scale(.94)' : 'none',
            }}
          >
            {d('save')}
          </span>
          {t > 0.7 && (
            <span className="lp-demo-row-in text-lp-ok-text flex items-center gap-2.5 rounded-xl bg-[rgba(62,207,110,0.12)] px-3.5 py-3 text-[14px] font-semibold">
              {d('saved')}
            </span>
          )}
        </div>
      )}
      {step === 2 && <SalesPanel t={t} />}
      {step === 3 && (
        <div className={panel}>
          <span className={panelTitle}>{d('allCars')}</span>
          {CARS.map((car) => {
            const roi = Math.round(
              ((car.earned - car.invested) / car.invested) * 100,
            )
            const positive = roi >= 0
            return (
              <div
                key={car.name}
                className="lp-demo-row-in flex flex-col gap-2.5 rounded-[14px] bg-[#181818] p-3.5"
              >
                <div className="flex justify-between gap-2.5 text-[14px]">
                  <span className="font-semibold">{car.name}</span>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      positive ? 'text-lp-accent-hover' : 'text-lp-muted',
                    )}
                  >
                    {positive ? '+' : '−'}
                    {Math.abs(roi)}%
                  </span>
                </div>
                <div className="h-[5px] overflow-hidden rounded-full bg-[#262626]">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      positive ? 'bg-lp-accent' : 'bg-lp-off',
                    )}
                    style={{
                      width: `${Math.round((car.earned / MAX_EARNED) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )
          })}
          <div className="lp-demo-row-in flex items-center justify-between gap-3 rounded-[14px] border border-dashed border-[rgba(255,106,26,0.45)] bg-[rgba(255,106,26,0.06)] p-3.5 [animation-delay:.2s]">
            <span className="flex flex-col gap-0.5">
              <span className={fieldLabel}>{d('batchName')}</span>
              <span className="text-[14px] font-semibold">
                {d('batchSummary', { amount: money(BATCH_INVESTED) })}
              </span>
            </span>
            <span className="text-lp-accent-hover font-semibold tabular-nums">
              +
              {Math.round(
                ((BATCH_EARNED - BATCH_INVESTED) / BATCH_INVESTED) * 100,
              )}
              %
            </span>
          </div>
        </div>
      )}
      <DemoCaption step={step} text={caption} />
      <DemoCursor
        click={click}
        className="transition-[left,top] duration-[120ms] ease-linear"
        style={{ left: `${x}%`, top: `${y}%` }}
      />
    </>
  )
}

function SalesPanel({ t }: { t: number }) {
  const d = useT(demoMessages)
  const money = useMoney()
  const names = listOf(d('soldParts'))
  const sold = Math.min(SALES.length, Math.floor(t * 9))
  const earned = SALES.slice(0, sold).reduce((sum, price) => sum + price, 0)
  const share = earned / PRICE
  const paid = earned >= PRICE
  const recent = SALES.slice(0, sold)
    .map((price, index) => ({ price, name: names[index] ?? '' }))
    .reverse()
    .slice(0, 4)
  return (
    <div className={panel}>
      <div className="grid grid-cols-3 gap-2">
        <span className={cn(tile, 'gap-1 p-3')}>
          <span className={fieldLabel}>{d('invested')}</span>
          <span className="text-[18px] font-semibold tabular-nums">
            {money(PRICE)}
          </span>
        </span>
        <span className={cn(tile, 'gap-1 p-3')}>
          <span className={fieldLabel}>{d('earned')}</span>
          <span className="text-[18px] font-semibold tabular-nums">
            {money(earned)}
          </span>
        </span>
        <span
          className={cn(
            'flex flex-col gap-1 rounded-xl p-3 transition-[background] duration-[400ms]',
            paid ? 'bg-lp-accent text-lp-bg' : 'text-lp-ink bg-[#181818]',
          )}
        >
          <span className="text-[12px]">
            {paid ? d('paidOffRoi') : d('payback')}
          </span>
          <span className="text-[18px] font-semibold tabular-nums">
            {paid
              ? `+${Math.round((share - 1) * 100)}%`
              : `${Math.round(share * 100)}%`}
          </span>
        </span>
      </div>
      <div className="bg-lp-track relative h-2.5 overflow-hidden rounded-full">
        <span
          className={cn(
            'absolute inset-y-0 left-0 rounded-full transition-[width] duration-[400ms] ease-out',
            paid ? 'bg-lp-ok' : 'bg-lp-accent',
          )}
          style={{ width: `${Math.min(100, share * 100).toFixed(1)}%` }}
        />
      </div>
      <div className="flex flex-col">
        {recent.map((sale) => (
          <div
            key={sale.name}
            className="flex justify-between gap-3 border-t border-white/[0.06] py-2.5 text-[14px]"
          >
            <span className="text-lp-soft">{sale.name}</span>
            <span className="text-lp-accent-hover font-semibold tabular-nums">
              +{money(sale.price)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** «Авто та партії»: the cars demo with its chapter list. */
export function CarsSpotlight() {
  const l = useT(landingMessages)
  const d = useT(demoMessages)
  const chapters = listOf(d('carsChapters'))
  const [card, setCard] = useState<HTMLDivElement | null>(null)
  const player = useDemoPlayer(chapters.length, card)
  return (
    <section
      data-reveal=""
      className="lp-sec mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))] items-center gap-16 px-6 py-28 max-[960px]:grid-cols-1 max-sm:gap-10 max-sm:px-5 max-sm:py-16"
    >
      <div className="flex flex-col gap-6">
        <Eyebrow>{l('carsEyebrow')}</Eyebrow>
        <SectionTitle>{l('carsTitle')}</SectionTitle>
        <p className="text-lp-muted m-0 text-[18px] leading-normal">
          {d('carsIntro')}
        </p>
        <DemoChapters player={player} titles={chapters} />
      </div>
      <DemoPlayerCard
        player={player}
        cardRef={setCard}
        title={chapters[player.step] ?? ''}
        screenClassName="h-[400px] p-[22px]"
      >
        <CarsScreen player={player} />
      </DemoPlayerCard>
    </section>
  )
}
