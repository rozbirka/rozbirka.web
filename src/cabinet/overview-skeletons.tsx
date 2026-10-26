import type { ReactNode } from 'react'
import {
  PanelFooter,
  SectionPanel,
  Skeleton,
  SkeletonFields,
  SkeletonRows,
} from '@/components/app'
import { BillingCard, RecordColumns } from './billing/billing-shell'
import { useT } from '@/i18n'
import { teamMessages } from './team/messages'
import { plansMessages } from './billing/plans-messages'

function Panel({
  children,
  action = false,
}: {
  children: ReactNode
  action?: boolean
}) {
  return (
    <SectionPanel
      title={<Skeleton className="h-3 w-36" />}
      {...(action ? { aside: <Skeleton className="h-5 w-16" /> } : {})}
    >
      {children}
    </SectionPanel>
  )
}

function Metrics({ count }: { count: number }) {
  return (
    <div className="rz-kpis">
      {Array.from({ length: count }, (_, index) => (
        <div className="rz-kpi grid gap-3" key={index}>
          <Skeleton className="w-2/5" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-2 w-3/5" />
        </div>
      ))}
    </div>
  )
}

function Rows({
  count,
  columns,
  header = false,
  thumbnails = false,
}: {
  count: number
  columns: readonly string[]
  header?: boolean
  thumbnails?: boolean
}) {
  return (
    <div>
      {header ? (
        <div
          aria-hidden
          className="border-app-line hidden gap-4 border-b px-4 py-3 sm:grid"
          style={{
            gridTemplateColumns: columns
              .map((track) => `minmax(0, ${track})`)
              .join(' '),
          }}
        >
          {columns.map((_, index) => (
            <Skeleton className="h-2 w-2/3" key={index} />
          ))}
        </div>
      ) : null}
      <SkeletonRows
        announce={false}
        embedded
        rows={count}
        columnWidths={columns}
        details
        thumbnails={thumbnails}
        variant="content"
      />
    </div>
  )
}

function FormFields() {
  return (
    <div className="rz-form-grid">
      <SkeletonFields count={1} />
      <SkeletonFields count={1} />
    </div>
  )
}

function Facts({ count }: { count: number }) {
  return (
    <div>
      {Array.from({ length: count }, (_, index) => (
        <div
          className="border-app-line grid grid-cols-2 items-center gap-4 border-t py-3 first:border-t-0"
          key={index}
        >
          <Skeleton className="w-2/3" />
          <Skeleton className="w-3/5" />
        </div>
      ))}
    </div>
  )
}

function Actions() {
  return (
    <PanelFooter>
      <Skeleton className="h-control w-24" />
      <Skeleton className="h-control w-28" />
    </PanelFooter>
  )
}

/** Team filters, member rows, seat usage and the separate invitation card. */
export function TeamSkeleton() {
  const t = useT(teamMessages)
  return (
    <div aria-hidden className="grid min-w-0 gap-4" data-screen-skeleton="team">
      <div className="rz-toolbar">
        <Skeleton className="h-control w-full sm:w-64" />
        <Skeleton className="h-control w-full sm:w-44" />
        <Skeleton className="h-control w-56 max-w-full" />
        <Skeleton className="rz-toolbar__end h-2 w-36" />
      </div>
      <section className="rz-table-wrap min-w-0">
        <div className="rz-table-scroll">
          <table className="rz-table">
            <caption>{t('membersCaption')}</caption>
            <thead>
              <tr>
                <th className="w-1/3" scope="col">
                  {t('columnUser')}
                </th>
                <th className="w-1/5" scope="col">
                  {t('columnRole')}
                </th>
                <th className="w-1/5" scope="col">
                  {t('columnActivity')}
                </th>
                <th className="w-1/5" scope="col">
                  {t('columnStatus')}
                </th>
                <th className="w-8" scope="col">
                  <Skeleton className="h-2 w-4" />
                </th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3].map((index) => (
                <tr key={index}>
                  <th className="py-1.5" scope="row">
                    <div className="grid gap-2">
                      <Skeleton className={index % 2 ? 'w-24' : 'w-32'} />
                      <Skeleton className="h-2 w-28" />
                    </div>
                  </th>
                  <td className="py-1.5" data-label={t('columnRole')}>
                    <Skeleton className="w-20" />
                  </td>
                  <td className="py-1.5" data-label={t('columnActivity')}>
                    <Skeleton className="h-2 w-16" />
                  </td>
                  <td className="py-1.5" data-label={t('columnStatus')}>
                    <Skeleton className="h-5 w-24 rounded-full" />
                  </td>
                  <td className="py-1.5">
                    <Skeleton className="ml-auto size-5" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rz-pager">
          <Skeleton className="h-2 w-20" />
          <div className="rz-pager__nav">
            <Skeleton className="h-control w-16" />
            <Skeleton className="h-control w-16" />
          </div>
        </div>
        <div className="rz-card__foot flex-wrap">
          <Skeleton className="h-2 w-64 max-w-full" />
          <Skeleton className="ml-auto h-2 w-24" />
        </div>
      </section>
      <SectionPanel
        title={<Skeleton className="w-28" />}
        description={<Skeleton className="h-2 w-64 max-w-full" />}
        aside={<Skeleton className="h-2 w-12" />}
      >
        <div className="flex min-w-0 items-center gap-3 py-1">
          <div className="grid min-w-0 flex-1 gap-2">
            <Skeleton className="w-28" />
            <Skeleton className="h-2 w-56 max-w-full" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="size-5" />
        </div>
        <div className="border-app-line border-t pt-3">
          <Skeleton className="h-control w-36" />
        </div>
      </SectionPanel>
    </div>
  )
}

export function DashboardChartSkeleton() {
  return (
    <div aria-hidden>
      <Panel>
        <Skeleton className="h-5 w-32" />
        <div className="border-app-line flex h-[160px] items-end gap-2.5 border-b">
          {['h-12', 'h-20', 'h-16', 'h-28', 'h-24', 'h-14', 'h-32'].map(
            (height, index) => (
              <Skeleton className={`${height} min-w-0 flex-1`} key={index} />
            ),
          )}
        </div>
        <div className="flex justify-between gap-4">
          {[0, 1, 2, 3, 4, 5, 6].map((index) => (
            <Skeleton className="h-2 w-6" key={index} />
          ))}
        </div>
      </Panel>
    </div>
  )
}

export function DashboardSkeleton({
  showOrders = true,
  showCars = true,
  showCash = true,
}: {
  showOrders?: boolean
  showCars?: boolean
  showCash?: boolean
}) {
  return (
    <div
      aria-hidden
      className="grid w-full min-w-0 gap-4"
      data-screen-skeleton="dashboard"
    >
      <Metrics count={3} />
      <div className="flex min-w-0 flex-wrap items-start gap-4">
        <div className="grid min-w-0 flex-[1_1_480px] gap-4">
          <DashboardChartSkeleton />
          {showOrders ? (
            <Panel action>
              <Rows count={5} columns={['1fr', '3fr', '1fr', '1fr']} />
            </Panel>
          ) : null}
          <Panel>
            <Rows count={2} columns={['3fr', '1fr']} />
          </Panel>
        </div>
        <aside className="grid min-w-0 flex-[1_1_280px] gap-4 xl:max-w-[380px]">
          <Panel>
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-2 w-3/5" />
          </Panel>
          <Panel>
            <Skeleton className="w-3/5" />
            <Skeleton className="h-2 w-2/5" />
          </Panel>
          {showCars ? (
            <Panel action>
              {[0, 1, 2, 3, 4].map((index) => (
                <div
                  className="border-app-line grid gap-2 border-t py-2 first:border-t-0"
                  key={index}
                >
                  <div className="flex justify-between gap-4">
                    <Skeleton className="w-2/3" />
                    <Skeleton className="w-8" />
                  </div>
                  <Skeleton className="h-1 w-full" />
                  <Skeleton className="h-2 w-4/5" />
                  <Skeleton className="h-2 w-2/3" />
                </div>
              ))}
            </Panel>
          ) : null}
          {showCash ? (
            <Panel action>
              <Facts count={3} />
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  )
}

export function CashOverviewSkeleton() {
  return (
    <div aria-hidden className="grid min-w-0 gap-4" data-screen-skeleton="cash">
      <Metrics count={2} />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-control w-60 max-w-full" />
        <Skeleton className="h-control w-52 max-w-full" />
        <Skeleton className="w-28" />
      </div>
      <div className="rz-table-wrap">
        <div className="border-app-line grid grid-cols-4 gap-4 border-b px-4 py-3">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton className="h-2 w-2/3" key={index} />
          ))}
        </div>
        <Rows count={6} columns={['3fr', '1fr', '2fr', '1fr']} />
      </div>
      <Panel>
        <Rows header count={8} columns={['2fr', '3fr', '2fr', '2fr', '1fr']} />
        <Skeleton className="h-2 w-4/5" />
      </Panel>
    </div>
  )
}

export function PaymentHistorySkeleton({ label }: { label: string }) {
  return (
    <div aria-busy="true" data-payment-history-loading>
      <p className="sr-only" role="status">
        {label}
      </p>
      <Rows header count={4} columns={['2fr', '4fr', '1fr', '1fr']} />
    </div>
  )
}

/** Two full plan cards followed by the limits/features comparison table. */
export function PlansSkeleton({ tabs = false }: { tabs?: boolean }) {
  const t = useT(plansMessages)
  return (
    <div
      aria-hidden
      className="grid min-w-0 gap-4"
      data-screen-skeleton="plans"
    >
      {tabs ? (
        <div className="border-app-line flex gap-4 border-b pb-3">
          {[0, 1, 2].map((index) => (
            <Skeleton className="h-3 w-20" key={index} />
          ))}
        </div>
      ) : null}
      <Skeleton className="h-10 w-full" />
      <div
        className="grid min-w-0 items-start gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))]"
        data-plan-cards
      >
        {[0, 1].map((index) => (
          <SectionPanel
            key={index}
            title={<Skeleton className="w-20" />}
            {...(index === 1
              ? {
                  aside: <Skeleton className="h-5 w-28 rounded-full" />,
                  footer: <Skeleton className="h-2 w-44" />,
                }
              : {})}
          >
            <div className="grid gap-2">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-2 w-16" />
              </div>
              <Skeleton className="h-2 w-28" />
            </div>
            <dl className="rz-facts px-0 py-0">
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <div key={row}>
                  <dt>
                    <Skeleton className="h-2 w-24 max-w-full" />
                  </dt>
                  <dd>
                    <Skeleton className="ml-auto h-3 w-8" />
                  </dd>
                </div>
              ))}
            </dl>
            <ul className="border-app-line m-0 grid list-none gap-1.5 border-t p-0 pt-3">
              {[0, 1, 2, 3, 4].map((row) => (
                <li className="flex items-center gap-2" key={row}>
                  <Skeleton className="size-3.5 shrink-0" />
                  <Skeleton className={row % 2 ? 'w-3/5' : 'w-4/5'} />
                </li>
              ))}
            </ul>
          </SectionPanel>
        ))}
      </div>
      <BillingCard title={t('whatsIncluded')} bodyClassName="p-0">
        <div className="rz-table-scroll">
          <table className="rz-table">
            <caption>{t('comparison')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('feature')}</th>
                <th scope="col">
                  <Skeleton className="ml-auto h-2 w-16" />
                </th>
                <th scope="col">
                  <Skeleton className="ml-auto h-2 w-20" />
                </th>
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((row) => (
                <tr key={row}>
                  <th scope="row">
                    <Skeleton
                      className={
                        row % 2 ? 'w-32 max-w-full' : 'w-44 max-w-full'
                      }
                    />
                  </th>
                  {[0, 1].map((column) => (
                    <td key={column}>
                      <Skeleton
                        className={
                          row < 5 ? 'ml-auto h-3 w-6' : 'ml-auto size-3.5'
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BillingCard>
      <Skeleton className="h-2 w-4/5" />
    </div>
  )
}

export function SubscriptionSkeleton() {
  return (
    <div
      aria-hidden
      className="grid min-w-0 gap-4"
      data-screen-skeleton="billing"
    >
      <Skeleton className="h-5 w-20 rounded-full" />
      <div className="border-app-line flex gap-4 border-b pb-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Metrics count={3} />
      <RecordColumns
        main={
          <>
            <Panel>
              <Facts count={5} />
            </Panel>
            <Panel action>
              <Rows header count={4} columns={['2fr', '4fr', '1fr', '1fr']} />
              <Skeleton className="h-2 w-4/5" />
            </Panel>
          </>
        }
        aside={
          <Panel>
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="grid gap-4 py-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <div className="flex items-center gap-2" key={index}>
                  <Skeleton className="size-3 rounded-full" />
                  <Skeleton className="w-3/4" />
                </div>
              ))}
            </div>
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-2 w-4/5" />
            <Actions />
          </Panel>
        }
      />
    </div>
  )
}

export function BusinessSkeleton() {
  return (
    <div aria-hidden data-screen-skeleton="business">
      <RecordColumns
        main={
          <>
            <Panel>
              <FormFields />
              <Skeleton className="h-2 w-1/3" />
            </Panel>
            <Panel>
              <Skeleton className="h-16 w-full" />
              <Facts count={2} />
              <Skeleton className="w-32" />
              <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton className="h-control w-full" key={index} />
                ))}
              </div>
              <Skeleton className="h-2 w-4/5" />
              <div className="rz-inset grid gap-3">
                <Skeleton className="h-2 w-40" />
                <div className="grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((index) => (
                    <div className="grid gap-2" key={index}>
                      <Skeleton className="h-2 w-1/3" />
                      <Skeleton className="w-4/5" />
                    </div>
                  ))}
                </div>
              </div>
              <Actions />
            </Panel>
            <Panel>
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-2 w-4/5" />
            </Panel>
          </>
        }
        aside={
          <Panel>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-2 w-1/3" />
            <Facts count={1} />
            <Skeleton className="h-control w-full" />
            <Skeleton className="h-2 w-3/4" />
          </Panel>
        }
      />
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div aria-hidden data-screen-skeleton="profile">
      <RecordColumns
        main={
          <Panel>
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="w-1/3" />
                <Skeleton className="h-2 w-1/4" />
              </div>
            </div>
            <FormFields />
            <Skeleton className="h-3 w-20" />
            <Facts count={2} />
            <PanelFooter leading={<Skeleton className="h-control w-28" />}>
              <Skeleton className="h-control w-28" />
              <Skeleton className="h-control w-20" />
            </PanelFooter>
          </Panel>
        }
        aside={
          <>
            <Panel>
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-4/5" />
              {[0, 1, 2, 3].map((index) => (
                <div className="rz-inset flex items-center gap-3" key={index}>
                  <Skeleton className="size-3 shrink-0 rounded-full" />
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Skeleton className="w-1/2" />
                    <Skeleton className="h-2 w-4/5" />
                  </div>
                </div>
              ))}
              <div className="flex justify-end">
                <Skeleton className="h-control w-36" />
              </div>
              <div className="border-app-line border-t pt-3">
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Panel>
            <div className="rz-card flex items-center justify-between gap-3 p-3">
              <Skeleton className="w-1/3" />
              <Skeleton className="h-control w-32" />
            </div>
          </>
        }
      />
    </div>
  )
}

/** Customer metrics and order history share the main column; contact facts sit beside it. */
export function CustomerRecordSkeleton() {
  return (
    <div
      aria-hidden
      className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      data-screen-skeleton="customer-record"
    >
      <div className="grid min-w-0 gap-3.5">
        <Metrics count={3} />
        <Panel action>
          <Rows header count={3} columns={['3fr', '2fr', '2fr']} />
        </Panel>
        <Panel action>
          <Skeleton className="w-2/3" />
        </Panel>
      </div>
      <aside className="grid min-w-0 gap-3.5">
        <Panel>
          <Facts count={6} />
        </Panel>
      </aside>
    </div>
  )
}

/** An order's item/payment/history cards with four separate summary cards. */
export function OrderRecordSkeleton() {
  return (
    <div
      aria-hidden
      className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]"
      data-screen-skeleton="order-record"
    >
      <div className="grid min-w-0 gap-3.5">
        <Panel action>
          <Rows
            header
            thumbnails
            count={1}
            columns={['4fr', '1fr', '2fr', '2fr']}
          />
          <div className="border-app-line flex items-center justify-between border-t pt-3">
            <Skeleton className="w-16" />
            <Skeleton className="w-28" />
          </div>
        </Panel>
        <Panel action>
          <Skeleton className="w-2/3" />
        </Panel>
        <Panel>
          {[0, 1, 2].map((index) => (
            <div
              className="border-app-line flex items-start gap-3 border-t py-3 first:border-t-0"
              key={index}
            >
              <Skeleton className="size-3 shrink-0 rounded-full" />
              <div className="grid min-w-0 flex-1 gap-2">
                <Skeleton className="w-1/2" />
                <Skeleton className="h-2 w-1/4" />
              </div>
              <Skeleton className="h-2 w-28 max-w-[30%]" />
            </div>
          ))}
          <div className="border-app-line flex justify-center border-t pt-3">
            <Skeleton className="h-control w-40" />
          </div>
        </Panel>
      </div>
      <aside className="grid min-w-0 gap-3.5">
        <Panel>
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-2 w-1/2" />
          <Facts count={1} />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-4/5" />
        </Panel>
        <Panel action>
          <div className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="grid min-w-0 flex-1 gap-2">
              <Skeleton className="w-2/3" />
              <Skeleton className="h-2 w-1/2" />
            </div>
          </div>
          <Facts count={2} />
        </Panel>
        <Panel action>
          <Skeleton className="w-full" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-2 w-3/4" />
        </Panel>
        <Panel action>
          <Skeleton className="w-3/5" />
        </Panel>
      </aside>
    </div>
  )
}
