import { SectionPanel, Skeleton } from '@/components/app'
import { useT } from '@/i18n'
import { inventoryMessages } from './messages'
import { newSessionMessages } from './new-session-messages'

/** Uses the same sections and choice-card measures as the new-session form. */
export function InventorySessionSkeleton() {
  const t = useT(newSessionMessages)
  const ti = useT(inventoryMessages)
  return (
    <div
      aria-busy="true"
      aria-label={ti('loading')}
      data-inventory-session-skeleton
      role="status"
    >
      <div aria-hidden className="grid min-w-0">
        <SectionPanel
          title={t('typeTitle')}
          description={t('typeHint')}
          variant="plain"
        >
          <div className="flex flex-wrap gap-2">
            {[0, 1].map((index) => (
              <div
                className="rz-choice-card min-w-0 flex-[1_1_10rem]"
                key={index}
              >
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-full" />
                <div className="grid min-w-0 flex-1 gap-2">
                  <Skeleton className="h-3 w-2/5" />
                  <Skeleton className="h-2 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
        <SectionPanel
          title={t('zonesTitle')}
          description={t('zonesHintPick')}
          variant="plain"
        >
          <div className="flex flex-wrap gap-1.5">
            {[0, 1].map((index) => (
              <div className="rz-choice-card min-w-0 items-center" key={index}>
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className={index === 0 ? 'h-3 w-28' : 'h-3 w-24'} />
              </div>
            ))}
          </div>
          <div className="grid gap-2">
            {[0, 1, 2].map((index) => (
              <div
                className="rz-choice-card w-full flex-wrap items-center gap-x-3.5 gap-y-1"
                key={index}
              >
                <Skeleton className="size-4 shrink-0" />
                <div className="grid min-w-0 flex-[1_1_8rem] gap-2">
                  <Skeleton className="h-3 w-3/5" />
                  <Skeleton className="h-2 w-4/5" />
                </div>
                <div className="w-full pl-8.5 sm:w-auto sm:pl-0">
                  <Skeleton className="h-2 w-20" />
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
        <SectionPanel title={t('scopeTitle')} variant="plain">
          <div className="rz-inset grid gap-2">
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-2 w-2/5" />
            <div className="flex items-baseline justify-between gap-3">
              <Skeleton className="h-2 w-12" />
              <Skeleton className="h-3 w-6" />
            </div>
          </div>
          <Skeleton className="h-2 w-3/5" />
        </SectionPanel>
      </div>
    </div>
  )
}
