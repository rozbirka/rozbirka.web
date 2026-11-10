import { useEffect, useState } from 'react'
import { Button, Field, SelectInput } from '@/components/app'
import type {
  NovaPoshtaDivision,
  NovaPoshtaPage,
  NovaPoshtaSettlement,
} from '@/api/integrations'
import { providerReturnApi } from '@/api/provider-return'
import { useT } from '@/i18n'
import { SettlementPicker } from '../../integrations/settlement-picker'
import { providerReturnMessages } from './provider-return-messages'

export interface ReturnBranch {
  settlement: NovaPoshtaSettlement
  division: NovaPoshtaDivision
}

export function ReturnBranchPicker({
  integrationId,
  shipmentId,
  value,
  onChange,
}: {
  integrationId: string
  shipmentId: string
  value: ReturnBranch | null
  onChange: (value: ReturnBranch | null) => void
}) {
  const t = useT(providerReturnMessages)
  const [settlement, setSettlement] = useState(value?.settlement ?? null)
  const [page, setPage] = useState(1)
  const [loaded, setLoaded] = useState<
    (NovaPoshtaPage<NovaPoshtaDivision> & { settlementRef: string }) | null
  >(null)
  const [failure, setFailure] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const settlementRef = settlement?.ref ?? null
  useEffect(() => {
    if (!settlementRef) return
    const controller = new AbortController()
    void providerReturnApi
      .divisions(integrationId, shipmentId, settlementRef, page, {
        signal: controller.signal,
      })
      .then(
        (next) => {
          if (controller.signal.aborted) return
          setLoaded((previous) => ({
            ...next,
            settlementRef,
            items: [
              ...(page > 1 && previous?.settlementRef === settlementRef
                ? previous.items
                : []),
              ...next.items,
            ].filter(
              (item, index, all) =>
                all.findIndex((other) => other.ref === item.ref) === index,
            ),
          }))
          setFailure(false)
        },
        () => {
          if (!controller.signal.aborted) setFailure(true)
        },
      )
    return () => controller.abort()
  }, [integrationId, shipmentId, settlementRef, page, attempt])
  const current = loaded?.settlementRef === settlementRef ? loaded : null
  const loading = Boolean(settlementRef && !failure && current?.page !== page)
  return (
    <>
      <SettlementPicker
        integrationId={integrationId}
        label={t('settlement')}
        picked={settlement}
        onPick={(next) => {
          setSettlement(next)
          setPage(1)
          setLoaded(null)
          setFailure(false)
          onChange(null)
        }}
        search={(query, signal) =>
          providerReturnApi.settlements(integrationId, shipmentId, query, {
            signal,
          })
        }
        use="receiving"
      />
      <Field
        label={t('branch')}
        required
        error={failure ? t('branchesFailed') : undefined}
      >
        <SelectInput
          disabled={!settlement || loading || failure}
          value={value?.division.ref ?? ''}
          onChange={(event) => {
            const division = current?.items.find(
              (item) => item.ref === event.target.value,
            )
            onChange(division && settlement ? { settlement, division } : null)
          }}
        >
          <option value="">
            {loading
              ? t('branchesLoading')
              : !settlement
                ? t('chooseSettlement')
                : t('choose')}
          </option>
          {current?.items.map((item) => (
            <option key={item.ref} value={item.ref}>
              {item.name}
            </option>
          ))}
        </SelectInput>
      </Field>
      {failure ? (
        <Button
          onClick={() => {
            setFailure(false)
            setAttempt((value) => value + 1)
          }}
        >
          {t('retry')}
        </Button>
      ) : null}
      {current && !failure && current.page < current.lastPage ? (
        <Button disabled={loading} onClick={() => setPage(current.page + 1)}>
          {t('moreBranches')}
        </Button>
      ) : null}
      {current &&
      !loading &&
      !failure &&
      current.items.length === 0 &&
      current.page === current.lastPage ? (
        <p className="rz-caption m-0">{t('noBranches')}</p>
      ) : null}
    </>
  )
}
