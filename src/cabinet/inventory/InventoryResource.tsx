import type { ReactNode } from 'react'
import { Button, ErrorState, Notice } from '@/components/app'
import { useT } from '@/i18n'
import { RedesignShell } from '../redesign-shell'
import { inventoryMessages } from './messages'
import type { LoadState } from './use-stock-resource'
import { CabinetLoadingContent, CabinetLoadingScreen } from '../loading-screen'

export function InventoryLoadError({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const t = useT(inventoryMessages)
  return (
    <Notice
      tone="danger"
      action={<Button onClick={onRetry}>{t('retry')}</Button>}
    >
      {message}
    </Notice>
  )
}

/**
 * Loading and failure of a whole screen, drawn the way the design system's
 * List/Record frames draw them: skeleton cards and a centred error card under
 * the screen's own breadcrumb when one is given.
 */
export function Resource<T>({
  state,
  retry,
  children,
  errorContent,
  framed = true,
  crumb,
  layout,
  loadingContent,
}: {
  state: LoadState<T>
  errorContent?: ReactNode
  framed?: boolean
  retry: () => void
  children: (data: T) => ReactNode
  /** The breadcrumb the screen shows once loaded; keeps the topbar in place. */
  crumb?: ReactNode
  /** `record` sketches a main column and an aside, as Record.dc.html does. */
  layout?: 'list' | 'record'
  loadingContent?: ReactNode
}) {
  const t = useT(inventoryMessages)
  const frame = (content: ReactNode) =>
    crumb !== undefined ? (
      <RedesignShell crumb={crumb}>{content}</RedesignShell>
    ) : framed ? (
      <div className="rz-page">{content}</div>
    ) : (
      content
    )
  if (state.kind === 'loading') {
    if (loadingContent !== undefined) return frame(loadingContent)
    if (crumb === undefined && framed)
      return (
        <CabinetLoadingScreen
          label={t('loading')}
          {...(layout === undefined ? {} : { layout })}
        />
      )
    return frame(
      <CabinetLoadingContent
        label={t('loading')}
        {...(layout === undefined ? {} : { layout })}
      />,
    )
  }
  if (state.kind === 'error') {
    return frame(
      <>
        <ErrorState
          onRetry={retry}
          retryLabel={t('retry')}
          title={t('loadFailed')}
        />
        {errorContent}
      </>,
    )
  }
  return children(state.data)
}
