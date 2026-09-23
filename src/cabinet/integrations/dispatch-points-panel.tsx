import { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Notice, StatusPill } from '@/components/app'
import {
  integrationsApi,
  type NovaPoshtaDispatchPoint,
} from '@/api/integrations'
import { normalizeApiProblem } from '@/api/errors'
import { useCabinet } from '../CabinetContext'
import { cabinetModules } from '../module-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  DispatchPointForm,
  type DispatchPointSubmission,
} from './dispatch-point-form'

const NO_SETTLEMENT_NAME =
  'Сервіс зберігає відділення й населений пункт кодами Нової пошти. Назву відділення підтягуємо з довідника, назви міста в довіднику за кодом немає.'

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; points: NovaPoshtaDispatchPoint[] }
  | { kind: 'error' }

type Editing =
  | { mode: 'new' }
  | { mode: 'edit'; point: NovaPoshtaDispatchPoint }
  | null

/**
 * Dispatch points as a tab of the carrier screen: the yard's own addresses,
 * the sender every waybill is stamped with.
 */
export function DispatchPointsPanel({
  integrationId,
  onPointsChange,
}: {
  integrationId: string
  onPointsChange?: ((count: number) => void) | undefined
}) {
  const cabinet = useCabinet()
  const tenant = cabinet.targetTenant
  const generation = cabinet.snapshot?.generation
  const scopeKey = `${generation ?? ''}:${tenant?.id ?? ''}:${integrationId}`
  const report = onPointsChange
  const [loaded, setLoaded] = useState<{
    key: string
    state: LoadState
  } | null>(null)
  const [reloads, setReloads] = useState(0)
  const [divisionNames, setDivisionNames] = useState<Record<number, string>>({})
  const [editing, setEditing] = useState<Editing>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.integrations,
  )

  const state: LoadState =
    loaded?.key === scopeKey ? loaded.state : { kind: 'loading' }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (integrationId === '') return
    const controller = new AbortController()
    void integrationsApi
      .dispatchPoints(integrationId, { signal: controller.signal })
      .then(
        (points) => {
          if (!controller.signal.aborted) {
            setLoaded({ key: scopeKey, state: { kind: 'ready', points } })
            report?.(points.length)
          }
        },
        () => {
          if (!controller.signal.aborted) {
            setLoaded({ key: scopeKey, state: { kind: 'error' } })
          }
        },
      )
    return () => controller.abort()
  }, [integrationId, reloads, report, scopeKey])

  const points = state.kind === 'ready' ? state.points : []

  // The point stores carrier ids; the branch name only exists in the carrier's
  // own catalogue, so it is resolved per settlement and never invented.
  useEffect(() => {
    const list = loaded?.state.kind === 'ready' ? loaded.state.points : []
    if (list.length === 0) return
    const controller = new AbortController()
    const settlements = [...new Set(list.map((item) => item.settlementId))]
    void Promise.all(
      settlements.map(async (settlementId) => {
        try {
          const page = await integrationsApi.divisions(
            integrationId,
            settlementId,
            1,
            { signal: controller.signal },
          )
          return page.items
        } catch {
          return []
        }
      }),
    ).then((pages) => {
      if (controller.signal.aborted) return
      const names: Record<number, string> = {}
      for (const page of pages)
        for (const division of page) names[division.id] = division.name
      setDivisionNames(names)
    })
    return () => controller.abort()
  }, [integrationId, loaded])

  const reload = useCallback(() => setReloads((value) => value + 1), [])

  if (tenant === null) {
    return (
      <p className="text-app-muted text-sm">
        Оберіть розбірку, щоб відкрити точки відправлення.
      </p>
    )
  }

  const guard = (): boolean => {
    try {
      requireLatestMutation()
      return true
    } catch {
      setFormError('Дія недоступна: немає прав на налаштування команди.')
      return false
    }
  }

  const save = async (submission: DispatchPointSubmission) => {
    if (saving || editing === null || !guard()) return
    setSaving(true)
    setFormError(null)
    try {
      const saved =
        editing.mode === 'new'
          ? await integrationsApi.createDispatchPoint(
              integrationId,
              submission.input,
            )
          : await integrationsApi.updateDispatchPoint(
              integrationId,
              editing.point.id,
              submission.input,
            )
      if (submission.makeDefault) {
        await integrationsApi.makeDispatchPointDefault(integrationId, saved.id)
      }
      if (!mountedRef.current) return
      setEditing(null)
      reload()
    } catch (error) {
      if (mountedRef.current) setFormError(normalizeApiProblem(error).message)
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  const deactivate = async (point: NovaPoshtaDispatchPoint) => {
    if (saving || !guard()) return
    setSaving(true)
    setFormError(null)
    try {
      await integrationsApi.deactivateDispatchPoint(integrationId, point.id)
      if (!mountedRef.current) return
      setEditing(null)
      reload()
    } catch (error) {
      if (mountedRef.current) setFormError(normalizeApiProblem(error).message)
    } finally {
      if (mountedRef.current) setSaving(false)
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="text-app-muted max-w-[62ch] text-[14px] leading-6 text-pretty">
          Звідки ви відправляєте посилки. Дані точки підставляються у
          відправника накладної, точка за замовчуванням — під час оформлення
          доставки.
        </p>
        <Button
          disabled={state.kind !== 'ready'}
          onClick={() => {
            setFormError(null)
            setEditing({ mode: 'new' })
          }}
          variant="primary"
        >
          Додати точку
        </Button>
      </div>

      {state.kind === 'error' && (
        <Notice tone="danger">
          Не вдалося завантажити точки. Дані точок не змінені —{' '}
          <button
            className="underline underline-offset-4"
            onClick={reload}
            type="button"
          >
            спробувати ще раз
          </button>
          .
        </Notice>
      )}
      {formError !== null && editing === null && (
        <Notice tone="danger">{formError}</Notice>
      )}

      {state.kind === 'loading' && (
        <p className="text-app-muted text-sm">
          Завантажуємо точки відправлення…
        </p>
      )}

      {state.kind === 'ready' && points.length === 0 && (
        <section className="border-app-line bg-app-raised grid justify-items-center gap-3 rounded-[20px] border px-10 py-14 text-center">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-white">
            Точок відправлення ще немає
          </h2>
          <p className="text-app-muted max-w-[46ch] text-[14px] leading-6 text-pretty">
            Додайте хоча б одну точку, щоб оформлювати доставку із замовлень.
            Перша активна точка стане точкою за замовчуванням.
          </p>
          <Button
            onClick={() => {
              setFormError(null)
              setEditing({ mode: 'new' })
            }}
            variant="primary"
          >
            Додати точку
          </Button>
        </section>
      )}

      {state.kind === 'ready' && points.length > 0 && (
        <section
          aria-label="Точки відправлення"
          className="border-app-line bg-app-raised min-w-0 overflow-hidden rounded-[20px] border"
        >
          <ul className="divide-app-line grid divide-y">
            {points.map((point) => (
              <li
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-4"
                key={point.id}
              >
                <div className="min-w-0 flex-[1_1_220px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold tracking-[-0.01em] text-white">
                      {point.name}
                    </span>
                    {point.isDefault && (
                      <span className="border-brand/30 text-brand rounded-full border bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-bold">
                        За замовчуванням
                      </span>
                    )}
                  </div>
                  <p className="text-app-dim mt-0.5 truncate text-xs">
                    {point.companyName ?? 'Відправник — фізична особа'}
                  </p>
                </div>
                <div className="min-w-0 flex-[1_1_180px]">
                  {divisionNames[point.divisionId] === undefined ? (
                    <p
                      className="text-app-dim text-[13px] text-pretty"
                      title={NO_SETTLEMENT_NAME}
                    >
                      Назва відділення недоступна
                    </p>
                  ) : (
                    <p className="text-app-ink truncate text-[14px] font-semibold">
                      {divisionNames[point.divisionId]}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-[1_1_160px]">
                  <p className="text-app-ink truncate text-[14px] font-semibold">
                    {point.senderName}
                  </p>
                  <p className="text-app-dim mt-0.5 truncate font-mono text-xs">
                    {point.phone}
                  </p>
                </div>
                <StatusPill tone={point.isActive ? 'ok' : 'neutral'}>
                  {point.isActive ? 'Активна' : 'Неактивна'}
                </StatusPill>
                <Button
                  onClick={() => {
                    setFormError(null)
                    setEditing({ mode: 'edit', point })
                  }}
                >
                  Змінити
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-app-dim border-app-line border-t px-6 py-4 text-[13px] leading-5 text-pretty">
            Точка за замовчуванням підставляється під час оформлення. Менеджер
            може вибрати іншу.
          </p>
        </section>
      )}

      {editing !== null && (
        <DispatchPointForm
          draft={{
            point: editing.mode === 'edit' ? editing.point : null,
            settlementName: null,
          }}
          error={formError}
          integrationId={integrationId}
          key={editing.mode === 'edit' ? editing.point.id : 'new'}
          onClose={() => {
            if (saving) return
            setEditing(null)
            setFormError(null)
          }}
          onDeactivate={
            editing.mode === 'edit'
              ? () => void deactivate(editing.point)
              : undefined
          }
          onSubmit={(submission) => void save(submission)}
          pending={saving}
        />
      )}
    </div>
  )
}
