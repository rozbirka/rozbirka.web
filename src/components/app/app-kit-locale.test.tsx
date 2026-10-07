import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LocaleProvider, type Locale } from '@/i18n'
import {
  BulkBar,
  ConfirmDialog,
  ErrorState,
  Pagination,
  SkeletonRows,
} from '@/components/app'
import { UploadSummary } from './file-field'
import type { ReactNode } from 'react'

const inLocale = (locale: Locale, ui: ReactNode) =>
  render(
    <LocaleProvider locale={locale} syncDocumentLang={false}>
      {ui}
    </LocaleProvider>,
  )

describe('shared components in English (UK)', () => {
  it('pagination names its range and controls', () => {
    inLocale(
      'en-GB',
      <Pagination
        onPage={vi.fn()}
        onPageSize={vi.fn()}
        page={1}
        pageSize={30}
        total={1248}
        totalPages={42}
      />,
    )
    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeVisible()
    expect(screen.getByText('1–30 of 1248')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Next page' })).toHaveTextContent(
      'Next',
    )
    expect(screen.getByRole('option', { name: '30 per page' })).toBeTruthy()
  })

  it('bulk bar, error state and skeleton use English defaults', () => {
    inLocale(
      'en-GB',
      <>
        <BulkBar
          actions={[]}
          count={3}
          noun="parts"
          onClear={vi.fn()}
          onSelectPage={vi.fn()}
          pageCount={30}
        />
        <ErrorState correlationId="abc" onRetry={vi.fn()} />
        <SkeletonRows />
      </>,
    )
    expect(
      screen.getByRole('region', { name: 'Actions on selected' }),
    ).toHaveTextContent('3 parts selected')
    expect(
      screen.getByRole('button', { name: 'Clear selection' }),
    ).toBeVisible()
    expect(screen.getByText('Couldn’t load data')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(screen.getByText('reference abc')).toBeVisible()
    expect(screen.getByText('Loading data…')).toBeInTheDocument()
  })

  it('explicit labels from the caller still win', () => {
    inLocale(
      'en-GB',
      <ConfirmDialog
        cancelLabel="Keep it"
        confirmLabel="Delete"
        consequence="Gone for good."
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        title="Delete part?"
      />,
    )
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeVisible()
  })

  it('confirm dialog defaults its cancel button to the locale', () => {
    inLocale(
      'pl',
      <ConfirmDialog
        confirmLabel="Usuń"
        consequence="Na zawsze."
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open
        title="Usunąć?"
      />,
    )
    expect(screen.getByRole('button', { name: 'Anuluj' })).toBeVisible()
  })

  it('counts failed uploads with locale plurals', () => {
    const { unmount } = inLocale('en-GB', <UploadSummary failed={3} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '3 files didn’t upload. Retry or remove them to save.',
    )
    unmount()
    inLocale('pl', <UploadSummary failed={5} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '5 plików nie zostało przesłanych.',
    )
  })

  it('keeps Ukrainian without a provider', () => {
    render(<UploadSummary failed={2} />)
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 файли не завантажилися.',
    )
  })
})
