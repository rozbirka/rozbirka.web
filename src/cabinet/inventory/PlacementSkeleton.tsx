import { SectionPanel, Skeleton } from '@/components/app'
import { appMessages } from '@/components/app/app-messages'
import { useT } from '@/i18n'
import { placementMessages } from './placement-messages'

type Level = 'warehouse' | 'zone' | 'section' | 'shelf'
const levels: readonly Level[] = ['warehouse', 'zone', 'section', 'shelf']

export function PlacementFieldsSkeleton({
  fields = levels,
  inline = false,
  actions = false,
  announce = true,
}: {
  fields?: readonly Level[]
  inline?: boolean
  actions?: boolean
  announce?: boolean
}) {
  const t = useT(placementMessages)
  const ta = useT(appMessages)
  return (
    <div
      aria-busy="true"
      className={
        inline ? 'grid min-w-0 gap-3 sm:grid-cols-2' : 'grid min-w-0 gap-4'
      }
      data-placement-skeleton="fields"
    >
      {announce ? (
        <p role="status" className="sr-only">
          {ta('loadingData')}
        </p>
      ) : null}
      {fields.map((level) => (
        <div aria-hidden className="grid min-w-0 gap-1.5" key={level}>
          <div className="flex min-h-control items-center justify-between gap-3">
            <p className="rz-label m-0">{t(level)}</p>
            {actions && (level === 'warehouse' || level === 'zone') ? (
              <Skeleton className="h-control w-32" />
            ) : null}
          </div>
          <Skeleton className="h-control w-full" />
        </div>
      ))}
    </div>
  )
}

function PartSummary() {
  const t = useT(placementMessages)
  return (
    <div aria-hidden className="grid gap-1.5">
      <p className="rz-label m-0">{t('partDetails')}</p>
      <div className="border-app-line bg-app-raised grid min-w-0 gap-2 rounded-panel border px-3 py-2">
        <Skeleton className="w-3/4" />
        <Skeleton className="h-2 w-2/5" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <Skeleton className="h-2 w-3/5" />
        <Skeleton className="h-2 w-2/5" />
      </div>
    </div>
  )
}

/** Shared by every entry point to single-part placement. */
export function PlacementSkeleton({
  page = false,
  announce = true,
}: {
  page?: boolean
  announce?: boolean
}) {
  const t = useT(appMessages)
  return (
    <div
      aria-busy="true"
      className="grid min-w-0 gap-4"
      data-placement-skeleton={page ? 'page' : 'drawer'}
    >
      {announce ? (
        <p className="sr-only" role="status">
          {t('loadingData')}
        </p>
      ) : null}
      {page ? (
        <>
          <Skeleton className="h-5 w-64 max-w-full" />
          <div
            aria-hidden
            className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <div className="grid min-w-0 gap-4">
              {levels.map((level) => (
                <SectionPanel key={level} title={<Skeleton className="w-32" />}>
                  <PlacementFieldsSkeleton fields={[level]} announce={false} />
                </SectionPanel>
              ))}
              <PartSummary />
            </div>
            <SectionPanel title={<Skeleton className="w-32" />}>
              <Skeleton className="w-3/4" />
              <Skeleton className="w-1/2" />
              <Skeleton className="h-control w-full" />
            </SectionPanel>
          </div>
        </>
      ) : (
        <>
          <PlacementFieldsSkeleton actions announce={false} />
          <PartSummary />
        </>
      )}
    </div>
  )
}
