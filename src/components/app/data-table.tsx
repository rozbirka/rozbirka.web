import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DataColumn<Row> {
  key: string
  /** Column header and, on narrow screens, the per-cell label. */
  label: string
  cell: (row: Row) => ReactNode
  align?: 'start' | 'end'
  /** The identifying column: keeps its own weight and drops the mobile label. */
  variant?: 'primary' | 'default'
  /** Action columns whose header is a label only for assistive technology. */
  headerHidden?: boolean
}

export interface DataTableSelection<Row> {
  /** Picked ids. May hold rows from pages that are no longer on screen. */
  selected: ReadonlySet<string>
  onChange: (next: ReadonlySet<string>) => void
  /** Names one row's checkbox: "Обрати: Фара ліва". */
  rowLabel: (row: Row) => string
  /** Why this row cannot be picked. Set means the checkbox is disabled. */
  unavailable?: (row: Row) => string | undefined
}

export interface DataTableProps<Row> {
  /** Names the table for assistive technology; visually hidden. */
  caption: string
  columns: readonly DataColumn<Row>[]
  rows: readonly Row[]
  rowKey: (row: Row) => string
  /** Shown instead of the body when there is nothing to list. */
  empty?: ReactNode
  onRowClick?: (row: Row) => void
  footer?: ReactNode
  /** Turns the list into a working set: a checkbox per row and in the header. */
  selection?: DataTableSelection<Row>
}

/**
 * One record per row on desktop, one card per record below 768px — same DOM in
 * both, so the row is never duplicated for screen readers or tests. ARIA roles
 * are explicit because the mobile layout drops the table display.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  footer,
  selection,
}: DataTableProps<Row>) {
  const pickable =
    selection === undefined
      ? []
      : rows.filter((row) => selection.unavailable?.(row) === undefined)
  const pickedOnPage =
    selection === undefined
      ? 0
      : pickable.filter((row) => selection.selected.has(rowKey(row))).length
  const togglePage = () => {
    if (selection === undefined) return
    const next = new Set(selection.selected)
    if (pickedOnPage === pickable.length)
      for (const row of pickable) next.delete(rowKey(row))
    else for (const row of pickable) next.add(rowKey(row))
    selection.onChange(next)
  }
  const toggleRow = (id: string) => {
    if (selection === undefined) return
    const next = new Set(selection.selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selection.onChange(next)
  }

  if (rows.length === 0 && empty !== undefined) {
    // The footer stays: page 2 of a filtered list can come back empty, and the
    // way back is in the pagination.
    return (
      <div className="border-app-line rounded-panel bg-app-raised overflow-hidden border">
        {empty}
        {footer}
      </div>
    )
  }

  return (
    <div className="border-app-line rounded-panel bg-app-raised relative overflow-hidden border md:overflow-x-auto">
      <table
        className="data-table w-full border-collapse text-[14.5px]"
        role="table"
      >
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr role="row">
            {selection === undefined ? null : (
              <th
                className="border-app-line w-11 border-b px-4 py-3"
                role="columnheader"
                scope="col"
              >
                <input
                  aria-label="Обрати всі на сторінці"
                  checked={
                    pickable.length > 0 && pickedOnPage === pickable.length
                  }
                  className="accent-brand size-4.5 align-middle"
                  disabled={pickable.length === 0}
                  onChange={togglePage}
                  ref={(node) => {
                    if (node)
                      node.indeterminate =
                        pickedOnPage > 0 && pickedOnPage < pickable.length
                  }}
                  type="checkbox"
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                className={cn(
                  'text-app-dim border-app-line border-b px-4 py-3 font-mono text-[11.5px] font-normal tracking-[0.08em] whitespace-nowrap uppercase',
                  column.align === 'end' ? 'text-right' : 'text-left',
                )}
                key={column.key}
                role="columnheader"
                scope="col"
              >
                {column.headerHidden ? (
                  <span className="sr-only">{column.label}</span>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const id = rowKey(row)
            const unavailable = selection?.unavailable?.(row)
            const picked = selection?.selected.has(id) === true
            return (
              <tr
                className={cn(
                  'border-app-line md:border-b',
                  onRowClick !== undefined &&
                    'cursor-pointer hover:bg-white/[0.025]',
                  picked && 'bg-brand/[0.06]',
                )}
                key={id}
                onClick={
                  onRowClick === undefined ? undefined : () => onRowClick(row)
                }
                role="row"
              >
                {selection === undefined ? null : (
                  <td
                    className="px-4 py-3.5 text-left font-normal"
                    data-label="Обрати"
                    // The checkbox is the point of the cell; a row that navigates
                    // must not swallow the click that picks it.
                    onClick={(event) => {
                      event.stopPropagation()
                    }}
                    role="cell"
                  >
                    <input
                      aria-label={selection.rowLabel(row)}
                      checked={picked}
                      className="accent-brand size-4.5 align-middle"
                      disabled={unavailable !== undefined}
                      onChange={() => toggleRow(id)}
                      type="checkbox"
                      {...(unavailable === undefined
                        ? {}
                        : { title: unavailable })}
                    />
                  </td>
                )}
                {columns.map((column) => {
                  const isPrimary = column.variant === 'primary'
                  const Cell = isPrimary ? 'th' : 'td'
                  return (
                    <Cell
                      className={cn(
                        'px-4 py-3.5 text-left font-normal',
                        column.align === 'end' && 'text-right tabular-nums',
                        isPrimary
                          ? 'text-app-ink font-medium'
                          : 'text-app-muted',
                      )}
                      data-label={
                        isPrimary || column.headerHidden
                          ? undefined
                          : column.label
                      }
                      key={column.key}
                      role={isPrimary ? 'rowheader' : 'cell'}
                      {...(isPrimary ? { scope: 'row' as const } : {})}
                    >
                      {column.cell(row)}
                    </Cell>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {footer}
    </div>
  )
}
