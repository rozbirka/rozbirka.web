import { useCallback, useState } from 'react'
import { useOptionalToast } from '@/components/app'

/** Short operation results use the cabinet toast; isolated hosts keep readable feedback. */
export function useStickerFeedback() {
  const toast = useOptionalToast()
  const [error, storeError] = useState<string | null>(null)
  const [message, storeMessage] = useState<string | null>(null)
  const setError = useCallback(
    (value: string | null) => {
      storeError(toast ? null : value)
      if (value && toast) toast.show({ tone: 'danger', message: value })
    },
    [toast],
  )
  const setMessage = useCallback(
    (value: string | null) => {
      storeMessage(toast ? null : value)
      if (value && toast) toast.show({ tone: 'ok', message: value })
    },
    [toast],
  )
  return { error, message, setError, setMessage }
}
