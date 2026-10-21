import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/app'

/**
 * The page head of the warehouse screens, as module 12 draws it: the 20px
 * title with a dim caption on the same baseline, and the status pills on the
 * line under them.
 */
export function WarehousePageHead({
  title,
  sub,
  chips,
}: {
  title: ReactNode
  sub?: ReactNode
  chips?: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <div className="rz-page-head">
        <h1 className="rz-h-page break-words">{title}</h1>
        {sub === undefined || sub === null || sub === '' ? null : (
          <span className="rz-caption text-pretty">{sub}</span>
        )}
      </div>
      {chips === undefined || chips === null ? null : (
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
      )}
    </div>
  )
}

/** The quiet "back" action at the start of the topbar actions. */
export function BackAction({ to, label }: { to: string; label: string }) {
  return (
    <Button asChild variant="quiet">
      <Link to={to}>
        <ChevronLeft aria-hidden />
        {label}
      </Link>
    </Button>
  )
}
