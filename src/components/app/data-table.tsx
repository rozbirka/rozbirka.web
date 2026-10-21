import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

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
  /** The row whose record is open beside the list (peek): brand edge. */
  activeKey?: string | null
  footer?: ReactNode
  /** Turns the list into a working set: a checkbox per row and in the header. */
  selection?: DataTableSelection<Row>
  /** "compact" trades breathing room for rows on screen. Desktop only — the
   * card layout below 768px is already as tight as it reads. */
  density?: 'comfortable' | 'compact'
  /** Removes the table's own frame when a parent card already supplies it. */
  embedded?: boolean
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
  activeKey = null,
  footer,
  selection,
  density,
  embedded = false,
}: DataTableProps<Row>) {
  const t = useT(appMessages)
  // v2 density comes from tokens; the list's own setting scopes them.
  const densityAttr = density === undefined ? {} : { 'data-density': density }
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
      <div className={cn(embedded ? 'overflow-hidden' : 'rz-table-wrap')}>
        {empty}
        {footer}
      </div>
    )
  }

  return (
    <div
      className={cn('relative', embedded ? 'overflow-hidden' : 'rz-table-wrap')}
      {...densityAttr}
    >
      <div className="rz-table-scroll">
        <table className="rz-table" role="table">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr role="row">
              {selection === undefined ? null : (
                <th className="rz-col-check" role="columnheader" scope="col">
                  <input
                    aria-label={t('selectPage')}
                    checked={
                      pickable.length > 0 && pickedOnPage === pickable.length
                    }
                    className="rz-check align-middle"
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
                  className={cn(column.align === 'end' && 'rz-num')}
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
                  {...(picked ? { 'aria-selected': true } : {})}
                  {...(activeKey === id ? { 'data-active': 'true' } : {})}
                  className={cn(onRowClick !== undefined && 'cursor-pointer')}
                  key={id}
                  onClick={
                    onRowClick === undefined ? undefined : () => onRowClick(row)
                  }
                  role="row"
                >
                  {selection === undefined ? null : (
                    <td
                      className="rz-col-check"
                      data-label={t('selectRow')}
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
                        className="rz-check align-middle"
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
                        className={cn(column.align === 'end' && 'rz-num')}
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
      </div>
      {footer}
    </div>
  )
}
