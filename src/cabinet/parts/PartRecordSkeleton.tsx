import type { ReactNode } from 'react'
import { PhotoStripSkeleton, SectionPanel, Skeleton } from '@/components/app'

function Card({
  children,
  action = false,
}: {
  children: ReactNode
  action?: boolean
}) {
  return (
    <SectionPanel
      title={<Skeleton className="h-3 w-28" />}
      {...(action ? { aside: <Skeleton className="h-5 w-16" /> } : {})}
    >
      {children}
    </SectionPanel>
  )
}

/** Same compact photos and four sidebar cards as the loaded part record. */
export function PartRecordSkeleton() {
  return (
    <div
      aria-hidden
      className="flex min-w-0 flex-wrap items-start gap-4"
      data-part-record-skeleton
    >
      <div className="grid min-w-0 flex-[1_1_480px] gap-4">
        <Card>
          <PhotoStripSkeleton />
        </Card>
        <Card>
          <Skeleton className="w-3/5" />
          <Skeleton className="h-2 w-2/5" />
        </Card>
        <Card action>
          {[0, 1, 2].map((index) => (
            <div
              className="border-app-line flex gap-3 border-t py-3 first:border-t-0"
              key={index}
            >
              <Skeleton className="size-5 shrink-0 rounded-full" />
              <div className="grid min-w-0 flex-1 gap-3">
                <Skeleton className="w-3/5" />
                <Skeleton className="h-2 w-1/3" />
                <Skeleton className="h-2 w-1/4" />
              </div>
              <Skeleton className="h-2 w-10" />
            </div>
          ))}
        </Card>
      </div>
      <aside className="grid w-full max-w-[380px] min-w-0 flex-[1_1_280px] gap-4">
        <Card action>
          <Skeleton className="h-6 w-3/5" />
          <Skeleton className="h-2 w-4/5" />
        </Card>
        <Card>
          <div className="divide-app-line grid grid-cols-3 divide-x">
            {[0, 1, 2].map((index) => (
              <div className="grid min-w-0 gap-3 px-2 first:pl-0" key={index}>
                <Skeleton className="h-2 w-4/5" />
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-2 w-3/5" />
              </div>
            ))}
          </div>
        </Card>
        <Card action>
          {[0, 1, 2, 3].map((index) => (
            <div
              className="border-app-line grid grid-cols-2 gap-4 border-t py-2 first:border-t-0"
              key={index}
            >
              <Skeleton className="w-3/5" />
              <Skeleton className="w-4/5" />
            </div>
          ))}
        </Card>
        <Card action>
          <Skeleton className="w-4/5" />
          <Skeleton className="h-2 w-3/5" />
          <div className="border-app-line mt-2 grid grid-cols-2 gap-4 border-t pt-3">
            <Skeleton className="w-2/3" />
            <Skeleton className="w-4/5" />
          </div>
        </Card>
      </aside>
    </div>
  )
}
