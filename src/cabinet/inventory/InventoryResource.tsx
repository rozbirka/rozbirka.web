import type { ReactNode } from 'react'
import { Button, Notice, SkeletonRows } from '@/components/app'
import { useT } from '@/i18n'
import { inventoryMessages } from './messages'
import type { LoadState } from './use-stock-resource'

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

export function Resource<T>({
  state,
  retry,
  children,
  errorContent,
  framed = true,
}: {
  state: LoadState<T>
  errorContent?: ReactNode
  framed?: boolean
  retry: () => void
  children: (data: T) => ReactNode
}) {
  const t = useT(inventoryMessages)
  const frame = (content: ReactNode) =>
    framed ? <div className="rz-page">{content}</div> : content
  if (state.kind === 'loading')
    return frame(<SkeletonRows label={t('loading')} />)
  if (state.kind === 'error') {
    return frame(
      <>
        <Notice tone="danger">
          {t('loadFailed')}{' '}
          <button className="underline" onClick={retry} type="button">
            {t('retry')}
          </button>
        </Notice>
        {errorContent}
      </>,
    )
  }
  return children(state.data)
}
