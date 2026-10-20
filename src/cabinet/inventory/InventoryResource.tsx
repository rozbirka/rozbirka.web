import type { ReactNode } from 'react'
import { Notice, SkeletonRows } from '@/components/app'
import { useT } from '@/i18n'
import { inventoryMessages } from './messages'
import type { LoadState } from './use-stock-resource'

export function Resource<T>({
  state,
  retry,
  children,
  errorContent,
}: {
  state: LoadState<T>
  errorContent?: ReactNode
  retry: () => void
  children: (data: T) => ReactNode
}) {
  const t = useT(inventoryMessages)
  if (state.kind === 'loading') return <SkeletonRows label={t('loading')} />
  if (state.kind === 'error') {
    return (
      <>
        <Notice tone="danger">
          {t('loadFailed')}{' '}
          <button className="underline" onClick={retry} type="button">
            {t('retry')}
          </button>
        </Notice>
        {errorContent}
      </>
    )
  }
  return children(state.data)
}
