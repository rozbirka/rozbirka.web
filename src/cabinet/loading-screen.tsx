import { useLocation } from 'react-router'
import {
  Skeleton,
  SkeletonFields as LoadingFields,
  SkeletonRows,
} from '@/components/app'
import { useLocale, useT } from '@/i18n'
import { appMessages } from '@/components/app/app-messages'
import { cn } from '@/lib/utils'
import type { CabinetModuleKey } from './module-registry'
import { moduleLabel } from './module-messages'
import { RedesignShell } from './redesign-shell'
import { loadingLayout, loadingModule } from './loading-layout'
import {
  CarFormSkeleton,
  IntakeFormSkeleton,
  PartFormSkeleton,
} from './form-skeletons'
import { PartRecordSkeleton } from './parts/PartRecordSkeleton'
import { PlacementSkeleton } from './inventory/PlacementSkeleton'
import {
  CustomerRecordSkeleton,
  OrderRecordSkeleton,
  BusinessSkeleton,
  CashOverviewSkeleton,
  DashboardSkeleton,
  ProfileSkeleton,
  SubscriptionSkeleton,
  PlansSkeleton,
  TeamSkeleton,
} from './overview-skeletons'

/** The existing skeleton primitives, composed to match this route's content. */
export function CabinetLoadingContent({
  module,
  heading = true,
  layout: override,
  label,
}: {
  module?: CabinetModuleKey
  heading?: boolean
  layout?: 'list' | 'record'
  label?: string
}) {
  const { pathname } = useLocation()
  const { locale } = useLocale()
  const t = useT(appMessages)
  const key = module ?? loadingModule(pathname)
  const profile = loadingLayout(key, pathname)
  const kind = override ?? profile.kind
  const specialized = /\/parts\/[^/]+\/inventory\/?$/.test(pathname) ? (
    <PlacementSkeleton page announce={false} />
  ) : key === 'team' && kind === 'list' ? (
    <TeamSkeleton />
  ) : key === 'plans' && kind === 'plans' ? (
    <PlansSkeleton tabs={heading} />
  ) : key === 'customers' && kind === 'record' ? (
    <CustomerRecordSkeleton />
  ) : key === 'orders' && kind === 'record' ? (
    <OrderRecordSkeleton />
  ) : key === 'dashboard' && kind === 'dashboard' ? (
    <DashboardSkeleton />
  ) : key === 'cash' && kind === 'list' ? (
    <CashOverviewSkeleton />
  ) : key === 'billing' && kind === 'settings' ? (
    <SubscriptionSkeleton />
  ) : key === 'business' && kind === 'settings' ? (
    <BusinessSkeleton />
  ) : key === 'profile' && kind === 'settings' ? (
    <ProfileSkeleton />
  ) : null
  const rows = (count = profile.rows, embedded = false) => (
    <SkeletonRows
      announce={false}
      columnWidths={profile.columns}
      details
      embedded={embedded}
      rows={count}
      thumbnails={profile.thumbnails}
      variant="lines"
    />
  )
  return (
    <div
      aria-busy="true"
      className={cn(
        'grid min-w-0 gap-4',
        profile.form === 'part' && 'w-full max-w-[960px]',
      )}
      data-loading-layout={`${key}:${kind}`}
    >
      <p className="sr-only" role="status">
        {label ?? t('loadingData')}
      </p>
      {heading ? (
        <div className="grid min-w-0 gap-3">
          {kind === 'record' || kind === 'form' ? (
            <Skeleton className="h-5 w-2/5 max-w-80" />
          ) : (
            <h1 className="rz-h-page">{moduleLabel(key, locale)}</h1>
          )}
          {kind === 'record' && (key === 'customers' || key === 'orders') ? (
            <div aria-hidden className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton
                className={
                  key === 'customers' ? 'h-5 w-20 rounded-full' : 'h-2 w-40'
                }
              />
            </div>
          ) : (
            <Skeleton className="w-1/3 max-w-64" />
          )}
        </div>
      ) : null}
      {specialized ?? (
        <>
          {heading && profile.stats > 0 ? (
            <div
              className={cn(
                'rz-card grid grid-cols-2 divide-x divide-app-line',
                profile.stats === 3 && 'sm:grid-cols-3',
                profile.stats === 4 && 'sm:grid-cols-4',
              )}
              aria-hidden
            >
              {Array.from({ length: profile.stats }, (_, index) => (
                <div className="grid min-w-0 gap-4 p-4" key={index}>
                  <Skeleton className="w-3/5" />
                  <Skeleton className="h-7 w-2/5" />
                </div>
              ))}
            </div>
          ) : null}
          {kind === 'record' && key === 'parts' ? <PartRecordSkeleton /> : null}
          {kind === 'form' && profile.form === 'car' ? (
            <CarFormSkeleton />
          ) : null}
          {kind === 'form' && profile.form === 'part' ? (
            <PartFormSkeleton edit={pathname.endsWith('/edit')} />
          ) : null}
          {kind === 'form' && profile.form === 'intake' ? (
            <IntakeFormSkeleton edit={pathname.endsWith('/edit')} />
          ) : null}
          {kind === 'list' ? rows() : null}
          {kind === 'reports' ? (
            <>
              <div className="rz-card rz-card__body">
                <LoadingFields count={2} />
              </div>
              {rows()}
            </>
          ) : null}
          {kind === 'dashboard' ? (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div className="grid min-w-0 gap-4">
                {rows(4)}
                {rows(3)}
              </div>
              {rows(4)}
            </div>
          ) : null}
          {(kind === 'record' && key !== 'parts') ||
          (kind === 'form' && !profile.form) ||
          kind === 'settings' ? (
            <div
              className={cn(
                'grid min-w-0 items-start gap-4',
                'lg:grid-cols-[minmax(0,1fr)_300px]',
              )}
            >
              <div className="grid min-w-0 gap-4">
                <div className="rz-card rz-card__body grid gap-4">
                  <Skeleton className="h-4 w-1/3" />
                  {kind === 'record' ? rows(4, true) : <LoadingFields />}
                </div>
                <div className="rz-card rz-card__body grid gap-4">
                  <Skeleton className="h-4 w-1/4" />
                  {kind === 'record' ? (
                    rows(3, true)
                  ) : (
                    <LoadingFields count={4} />
                  )}
                </div>
              </div>
              <div className="rz-card rz-card__body grid min-w-0 gap-4">
                <Skeleton className="h-4 w-1/2" />
                {kind === 'record' && profile.photo && key === 'cars' ? (
                  <Skeleton className="aspect-4/3 h-auto" />
                ) : null}
                <SkeletonRows
                  announce={false}
                  columns={2}
                  embedded
                  rows={4}
                  variant="lines"
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export function CabinetLoadingScreen({
  module,
  label,
  layout,
}: {
  module?: CabinetModuleKey
  label?: string
  layout?: 'list' | 'record'
}) {
  const { pathname } = useLocation()
  const { locale } = useLocale()
  const key = module ?? loadingModule(pathname)
  const kind = layout ?? loadingLayout(key, pathname).kind
  return (
    <RedesignShell
      crumb={<span aria-current="page">{moduleLabel(key, locale)}</span>}
      width={kind === 'record' || kind === 'form' ? 'record' : 'list'}
    >
      <CabinetLoadingContent
        module={key}
        {...(label === undefined ? {} : { label })}
        {...(layout === undefined ? {} : { layout })}
      />
    </RedesignShell>
  )
}
