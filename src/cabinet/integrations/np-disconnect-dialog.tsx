import { useEffect, useState } from 'react'
import { ConfirmDialog } from '@/components/app'
import {
  integrationsApi,
  type IntegrationDeactivationImpact,
} from '@/api/integrations'
import { formatMoney, useLocale, useT } from '@/i18n'
import { npDisconnectMessages } from './np-disconnect-messages'

type ImpactState =
  | { kind: 'loading' }
  | { kind: 'ready'; impact: IntegrationDeactivationImpact }
  /** The count is a courtesy: without it the general consequences still hold. */
  | { kind: 'failed' }

/**
 * «Відключити Нову пошту?» (2.12–2.13). Waybills still on the road are named
 * first, with their post-payment when the reader may see money, because
 * nobody will be told when they arrive. Focus starts on «Скасувати».
 * The caller remounts it for every opening, so the count is never stale.
 */
export function NpDisconnectDialog({
  error,
  integrationId,
  onConfirm,
  onOpenChange,
  open,
  pending,
}: {
  error: string | null
  integrationId: string
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
  open: boolean
  pending: boolean
}) {
  const { locale } = useLocale()
  const t = useT(npDisconnectMessages)
  const [impact, setImpact] = useState<ImpactState>({ kind: 'loading' })

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    void integrationsApi
      .deactivationImpact(integrationId, { signal: controller.signal })
      .then(
        (result) => {
          if (!controller.signal.aborted)
            setImpact({ kind: 'ready', impact: result })
        },
        () => {
          if (!controller.signal.aborted) setImpact({ kind: 'failed' })
        },
      )
    return () => controller.abort()
  }, [integrationId, open])

  const onTheRoad =
    impact.kind === 'ready' && impact.impact.inTransitCount > 0
      ? impact.impact
      : null
  const cod =
    onTheRoad !== null &&
    onTheRoad.codCount !== null &&
    onTheRoad.codCount > 0 &&
    onTheRoad.expectedCodUah !== null
      ? {
          count: onTheRoad.codCount,
          sum:
            formatMoney(onTheRoad.expectedCodUah, 'UAH', locale, {
              fractionDigits: 0,
            }) ?? '',
        }
      : null
  const keep = [
    t('keepData'),
    t('keepBlocked'),
    t('keepTracking'),
    t('keepParcels'),
  ]
  const effects =
    onTheRoad === null
      ? keep
      : [
          `${
            cod === null
              ? t('inTransit', { count: onTheRoad.inTransitCount })
              : t('inTransitCod', {
                  count: onTheRoad.inTransitCount,
                  cod: cod.count,
                  sum: cod.sum,
                })
          } ${cod === null ? t('followUp') : t('followUpCod')}`,
          ...keep,
        ]

  return (
    <ConfirmDialog
      confirmDisabled={impact.kind === 'loading'}
      confirmLabel={t('disconnect')}
      consequence={
        onTheRoad === null ? t('confirmLater') : t('confirmOnTheRoad')
      }
      effects={effects}
      error={error}
      onConfirm={onConfirm}
      onOpenChange={onOpenChange}
      open={open}
      pending={pending}
      title={t('confirmTitle')}
    />
  )
}
