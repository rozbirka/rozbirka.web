import type { ReactNode } from 'react'
import {
  PanelFooter,
  SectionPanel,
  Skeleton,
  SkeletonFields,
} from '@/components/app'

function Section({
  children,
  description = true,
  aside = false,
}: {
  children: ReactNode
  description?: boolean
  aside?: boolean
}) {
  return (
    <SectionPanel
      title={<Skeleton className="h-3 w-36" />}
      {...(description ? { description: <Skeleton className="w-3/5" /> } : {})}
      {...(aside ? { aside: <Skeleton className="h-3 w-20" /> } : {})}
    >
      {children}
    </SectionPanel>
  )
}

function Field({ hint = true }: { hint?: boolean }) {
  return (
    <div className="grid min-w-0 gap-2">
      <SkeletonFields count={1} />
      {hint ? <Skeleton className="h-2 w-3/5" /> : null}
    </div>
  )
}

function Notes() {
  return (
    <div className="grid gap-2">
      <Skeleton className="w-20" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-2 w-3/5" />
    </div>
  )
}

function Photos() {
  return (
    <div className="rz-inset grid gap-3">
      <Skeleton className="w-16" />
      <Skeleton className="h-2 w-3/5" />
      <div className="border-app-line grid h-28 place-content-center justify-items-center gap-3 rounded-panel border border-dashed">
        <Skeleton className="size-5" />
        <Skeleton className="w-28" />
        <Skeleton className="h-2 w-44 max-w-full" />
      </div>
      <Skeleton className="h-2 w-2/5" />
    </div>
  )
}

function Choices({ count }: { count: number }) {
  return (
    <div
      className={
        count === 2 ? 'grid gap-3 sm:grid-cols-2' : 'grid gap-2 sm:grid-cols-3'
      }
    >
      {Array.from({ length: count }, (_, index) => (
        <div className="rz-choice-card min-w-0" key={index}>
          <Skeleton className="size-3.5 shrink-0 rounded-full" />
          <div className="grid min-w-0 flex-1 gap-3">
            <Skeleton className="w-3/5" />
            <Skeleton className="h-2 w-4/5" />
            {count === 3 ? <Skeleton className="h-2 w-2/3" /> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Mirrors the single-column source, description, condition and stock form. */
export function PartFormSkeleton({
  edit = false,
  footer = true,
}: {
  edit?: boolean
  footer?: boolean
}) {
  return (
    <div
      aria-hidden
      className="grid min-w-0 gap-4"
      data-form-skeleton="part"
      data-form-mode={edit ? 'edit' : 'create'}
    >
      {edit ? (
        <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2">
          <Skeleton className="w-24" />
          <Skeleton className="w-24" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-control w-36 sm:ml-auto" />
        </div>
      ) : null}
      <Section description={!edit} aside={edit}>
        {edit ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid min-w-0 gap-2">
              <Skeleton className="w-64 max-w-full" />
              <Skeleton className="w-32" />
            </div>
            <Skeleton className="h-control w-32" />
          </div>
        ) : (
          <>
            <Choices count={2} />
            <div className="sm:w-1/2">
              <Field />
            </div>
            <Skeleton className="h-control w-40" />
            <Skeleton className="h-2 w-4/5" />
          </>
        )}
      </Section>
      <Section description={!edit}>
        <Field hint={false} />
        <SkeletonFields count={2} />
        <Notes />
      </Section>
      <Section description={!edit}>
        {edit ? <Skeleton className="w-3/5" /> : null}
        <Choices count={3} />
        <Skeleton className="h-2 w-3/5" />
      </Section>
      <Section>
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <div className="grid gap-2">
            <Skeleton className="w-20" />
            <div className="flex h-control w-32 gap-px overflow-hidden rounded-control">
              <Skeleton className="h-full w-9" />
              <Skeleton className="h-full flex-1" />
              <Skeleton className="h-full w-9" />
            </div>
          </div>
          <Field />
          <Field />
        </div>
      </Section>
      <Section description={!edit} aside={edit}>
        {edit ? (
          <>
            <Skeleton className="w-3/5" />
            <div className="rz-inset grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div className="grid gap-2" key={index}>
                  <Skeleton className="h-2 w-16" />
                  <Skeleton className="w-3/5" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field />
              <Field />
              <Field />
            </div>
            <Skeleton className="h-control w-40" />
          </>
        )}
      </Section>
      {edit ? null : (
        <Section>
          <div className="sm:w-1/2">
            <Field hint={false} />
          </div>
        </Section>
      )}
      <Section description={false}>
        <Photos />
      </Section>
      {edit ? (
        <PanelFooter leading={<Skeleton className="w-3/5" />}>
          <Skeleton className="h-control w-44" />
        </PanelFooter>
      ) : null}
      {footer ? (
        <PanelFooter
          className="bg-app-raised sticky bottom-16 z-10 md:bottom-0"
          leading={<Skeleton className="w-48 max-w-full" />}
          standalone
        >
          <Skeleton className="h-control w-24" />
          <Skeleton className="h-control w-36" />
        </PanelFooter>
      ) : null}
    </div>
  )
}

/** Mirrors intake's four form cards and the separate pre-create summary. */
export function IntakeFormSkeleton({ edit = false }: { edit?: boolean }) {
  return (
    <div
      aria-hidden
      className="flex min-w-0 flex-wrap items-start gap-4"
      data-form-skeleton="intake"
    >
      <div className="grid min-w-0 flex-[1_1_480px] gap-4">
        <Section description={false}>
          <Field />
        </Section>
        <Section description={false}>
          <div className="rz-form-grid">
            <Field hint={false} />
          </div>
        </Section>
        <Section>
          <Field />
          <Notes />
        </Section>
        {edit ? null : (
          <Section description={false}>
            <Photos />
          </Section>
        )}
      </div>
      <aside className="grid min-w-0 flex-[1_1_280px] gap-4 lg:max-w-[380px]">
        <Section description={false}>
          <div className="rz-inset grid gap-3">
            <Skeleton className="w-3/5" />
            <Skeleton className="w-2/5" />
            <Skeleton className="h-2 w-4/5" />
          </div>
          <div className="grid gap-4">
            <div className="flex justify-between gap-4">
              <Skeleton className="w-2/5" />
              <Skeleton className="w-12" />
            </div>
            <div className="border-app-line flex justify-between gap-4 border-t pt-4">
              <Skeleton className="w-1/4" />
              <Skeleton className="w-20" />
            </div>
          </div>
          <div className="grid gap-2">
            <Skeleton className="w-2/3" />
            <Skeleton className="w-3/5" />
          </div>
          <Skeleton className="h-control w-full" />
          <Skeleton className="h-2 w-4/5" />
        </Section>
      </aside>
    </div>
  )
}

/** Vehicle identity, purchase, expenses, photos and notes with two summary cards. */
export function CarFormSkeleton() {
  return (
    <div
      aria-hidden
      className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]"
      data-form-skeleton="car"
    >
      <div className="grid min-w-0 gap-4">
        <Section>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field />
            <Field />
            <Field />
            <Field />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field />
            <Field />
          </div>
          <div className="grid gap-3">
            <Skeleton className="w-16" />
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton className="h-6 w-16 rounded-full" key={index} />
              ))}
            </div>
          </div>
        </Section>
        <Section>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field />
            <Field hint={false} />
          </div>
        </Section>
        <Section>
          <div className="rz-inset">
            <Skeleton className="w-4/5" />
          </div>
          <div className="border-app-line flex items-center justify-between gap-4 border-t pt-3">
            <Skeleton className="w-1/2" />
            <Skeleton className="h-control w-32" />
          </div>
        </Section>
        <Section>
          <Photos />
        </Section>
        <Section>
          <Notes />
        </Section>
      </div>
      <aside className="grid min-w-0 gap-3">
        <Section description={false}>
          {[0, 1, 2, 3].map((index) => (
            <div className="flex min-h-7 items-center gap-2" key={index}>
              <Skeleton className="size-3 shrink-0 rounded-full" />
              <Skeleton className="w-2/3" />
            </div>
          ))}
        </Section>
        <Section description={false}>
          {[0, 1, 2].map((index) => (
            <div
              className="border-app-line flex justify-between gap-4 border-t py-2 first:border-t-0"
              key={index}
            >
              <Skeleton className="w-2/5" />
              <Skeleton className="w-12" />
            </div>
          ))}
        </Section>
        <Skeleton className="h-2 w-4/5" />
      </aside>
    </div>
  )
}
