import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Button,
  Field,
  Notice,
  PageBody,
  PageHeader,
  Pagination,
  SearchInput,
} from '@/components/app'
import { partsApi, type PartListItem } from '@/api/parts'
import { stickersApi } from '@/api/stickers'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { evaluateModuleAccess } from '../policy'
import { tenantResetRegistry } from '../tenant-reset-registry'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import {
  buildStickerHtml,
  renderStickers,
  type PrintableSticker,
  type RenderedSticker,
} from './sticker-output'

interface QueueItem {
  id: string
  quantity: number
}
interface QueueScope {
  userId: string
  tenantId: string
}
interface StoredQueue {
  version: 1
  expiresAt: number
  items: QueueItem[]
}

const MAX_STICKERS = 200
const QUEUE_TTL_MS = 24 * 60 * 60 * 1000
const queueKey = ({ userId, tenantId }: QueueScope) =>
  `rozbirka.stickers.queue.v1:${userId}:${tenantId}`
const validQueueItem = (value: unknown): value is QueueItem => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item['id'] === 'string' &&
    item['id'].length > 0 &&
    Number.isInteger(item['quantity']) &&
    Number(item['quantity']) > 0
  )
}
const validQueue = (value: unknown): value is QueueItem[] => {
  if (!Array.isArray(value) || !value.every(validQueueItem)) return false
  return value.reduce((sum, item) => sum + item.quantity, 0) <= MAX_STICKERS
}
const readQueue = (scope: QueueScope): QueueItem[] => {
  if (typeof window === 'undefined') return []
  const key = queueKey(scope)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const stored = JSON.parse(raw) as Partial<StoredQueue>
    if (
      stored.version !== 1 ||
      typeof stored.expiresAt !== 'number' ||
      stored.expiresAt <= Date.now() ||
      !validQueue(stored.items)
    ) {
      localStorage.removeItem(key)
      return []
    }
    return stored.items
  } catch {
    try {
      localStorage.removeItem(key)
    } catch {
      // Storage is unavailable; use an empty in-memory queue.
    }
    return []
  }
}
const writeQueue = (scope: QueueScope, items: QueueItem[]) => {
  if (typeof window === 'undefined') return
  const key = queueKey(scope)
  try {
    if (!items.length) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(
      key,
      JSON.stringify({
        version: 1,
        expiresAt: Date.now() + QUEUE_TTL_MS,
        items,
      } satisfies StoredQueue),
    )
  } catch {
    // Storage can be blocked or full; the active in-memory queue remains usable.
  }
}
export function StickersScreen({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const { targetTenant, snapshot } = cabinet
  const access =
    cabinet.status === 'ready' && snapshot
      ? { status: 'ready' as const, snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const generationDecision = evaluateModuleAccess(
    definition,
    access,
    'mutation',
  )
  const scope = useMemo(
    () =>
      targetTenant && snapshot?.userId && snapshot.tenantId === targetTenant.id
        ? { userId: snapshot.userId, tenantId: targetTenant.id }
        : null,
    [snapshot, targetTenant],
  )
  const scopeIdentity = scope ? `${scope.userId}:${scope.tenantId}` : 'none'
  return (
    <TenantStickerQueue
      generationDecision={generationDecision.kind}
      key={scopeIdentity}
      requireLatestMutation={requireLatestMutation}
      scope={scope}
    />
  )
}

function TenantStickerQueue({
  scope,
  generationDecision,
  requireLatestMutation,
}: {
  scope: QueueScope | null
  generationDecision: ReturnType<typeof evaluateModuleAccess>['kind']
  requireLatestMutation: ReturnType<
    typeof useLatestMutationGuard
  >['requireLatestMutation']
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  // Another screen can send parts here to be printed — one from a part card, a
  // whole batch from an intake. The ids arrive in the URL and join the queue as
  // it is read, so a queue is never a render behind the address bar.
  const requested = useMemo(() => searchParams.getAll('part'), [searchParams])
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    const stored = scope ? readQueue(scope) : []
    const additions: QueueItem[] = []
    for (const id of requested)
      if (
        !stored.some((item) => item.id === id) &&
        !additions.some((item) => item.id === id)
      )
        additions.push({ id, quantity: 1 })
    return additions.length > 0 ? [...stored, ...additions] : stored
  })
  useEffect(() => {
    if (requested.length === 0) return
    // The parameter has done its job; drop it so a reload does not re-queue.
    const next = new URLSearchParams(searchParams)
    next.delete('part')
    setSearchParams(next, { replace: true })
  }, [requested, searchParams, setSearchParams])
  const [search, setSearch] = useState('')
  const [partsPage, setPartsPage] = useState(1)
  const [partsTotal, setPartsTotal] = useState(0)
  const [partsTotalPages, setPartsTotalPages] = useState(1)
  const [parts, setParts] = useState<PartListItem[]>([])
  const [partLabels, setPartLabels] = useState<Record<string, string>>({})
  const [partsUnavailable, setPartsUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [printable, setPrintable] = useState<PrintableSticker[]>([])
  const [preview, setPreview] = useState<RenderedSticker[]>([])
  const [busy, setBusy] = useState(false)
  const generationRef = useRef(0)
  const canGenerate = generationDecision === 'allowed'
  const total = useMemo(
    () => queue.reduce((sum, item) => sum + item.quantity, 0),
    [queue],
  )

  useEffect(() => {
    if (scope) writeQueue(scope, queue)
  }, [queue, scope])
  useEffect(() => {
    const controller = new AbortController()
    void partsApi
      .list({
        page: partsPage,
        pageSize: 30,
        ...(search.trim() ? { q: search.trim() } : {}),
        signal: controller.signal,
      })
      .then(
        (page) => {
          if (controller.signal.aborted) return
          setParts(page.items)
          setPartsTotal(page.total)
          setPartsTotalPages(Math.max(1, page.totalPages))
          setPartLabels((current) => ({
            ...current,
            ...Object.fromEntries(
              page.items.map((part) => [part.id, part.name]),
            ),
          }))
          setPartsUnavailable(false)
        },
        () => {
          if (!controller.signal.aborted) setPartsUnavailable(true)
        },
      )
    return () => controller.abort()
  }, [partsPage, search])
  useEffect(() => {
    if (!scope) return
    const unregister = tenantResetRegistry.register((resetScope) => {
      if (
        resetScope.userId !== scope.userId ||
        resetScope.tenantId !== scope.tenantId
      )
        return
      try {
        localStorage.removeItem(queueKey(scope))
      } catch {
        // Scope state is still cleared from memory when storage is unavailable.
      }
      setQueue([])
    })
    return unregister
  }, [scope])
  const selectPart = (partId: string, selected: boolean) => {
    if (!canGenerate || partsUnavailable) return
    if (selected && total >= MAX_STICKERS) {
      setError(
        `За один раз можна підготувати не більше ${MAX_STICKERS} стікерів.`,
      )
      return
    }
    setQueue((current) => {
      if (!selected) return current.filter((item) => item.id !== partId)
      return current.some((item) => item.id === partId)
        ? current
        : [...current, { id: partId, quantity: 1 }]
    })
    setError(null)
    setPrintable([])
    setPreview([])
  }
  const clear = () => {
    setQueue([])
    setPrintable([])
    setPreview([])
    setError(null)
  }

  const generate = async () => {
    if (!canGenerate || !queue.length || busy) return
    const generation = ++generationRef.current
    setBusy(true)
    setError(null)
    try {
      const scope = requireLatestMutation({ quota: false })
      const response = await stickersApi.getBatchData(
        queue.map((item) => item.id),
        { signal: scope.signal },
      )
      if (generation !== generationRef.current) return
      const next = queue.map((queued) => {
        const sticker = response.items.find((item) => item.id === queued.id)
        if (!sticker) throw new Error('missing-sticker')
        const vehicle = [sticker.carBrand, sticker.carModel]
          .filter(Boolean)
          .join(' ')
        const vehicleWithYear = [
          vehicle,
          sticker.carYear ? `(${sticker.carYear})` : '',
        ]
          .filter(Boolean)
          .join(' ')
        const carLabel = [sticker.carCode, vehicleWithYear]
          .filter(Boolean)
          .join(' · ')
        return {
          id: sticker.id,
          name: sticker.name,
          qrCode: sticker.qrCode,
          quantity: queued.quantity,
          carLabel: carLabel || null,
        }
      })
      const rendered = await renderStickers(next, window.location.origin)
      if (generation !== generationRef.current) return
      setPrintable(next)
      setPreview(rendered)
    } catch {
      if (generation === generationRef.current)
        setError('Не вдалося підготувати дані стікерів.')
    } finally {
      if (generation === generationRef.current) setBusy(false)
    }
  }
  const artifact = () => buildStickerHtml(printable, window.location.origin)
  const download = async () => {
    try {
      const html = await artifact()
      const url = URL.createObjectURL(
        new Blob([html], { type: 'text/html;charset=utf-8' }),
      )
      try {
        const link = document.createElement('a')
        link.href = url
        link.download = 'rozbirka-stickers.html'
        link.click()
      } finally {
        URL.revokeObjectURL(url)
      }
    } catch {
      setError('Не вдалося завантажити макет стікерів.')
    }
  }
  const print = async () => {
    try {
      const html = await artifact()
      const printWindow = window.open('', '_blank')
      if (!printWindow) throw new Error('popup-blocked')
      printWindow.opener = null
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    } catch {
      setError('Не вдалося відкрити макет для друку.')
    }
  }
  const share = async () => {
    try {
      const html = await artifact()
      const file = new File([html], 'rozbirka-stickers.html', {
        type: 'text/html',
      })
      if (!navigator.share || !navigator.canShare?.({ files: [file] })) {
        setError('Обмін файлами не підтримується цим браузером.')
        return
      }
      await navigator.share({
        files: [file],
        title: 'Стікери Rozbirka',
      })
    } catch {
      setError('Не вдалося поділитися макетом стікерів.')
    }
  }

  const labelFor = (partId: string) =>
    partLabels[partId] ?? 'Деталь недоступна у поточній вибірці'

  return (
    <PageBody width="narrow">
      <PageHeader eyebrow="Склад" title="Стікери" />
      <p className="text-app-muted text-sm">
        Черга стікерів для поточної розбірки
      </p>
      {!scope ? (
        <Notice tone="danger">
          Відновлення черги заблоковано без стабільної ідентичності користувача
          та розбірки.
        </Notice>
      ) : null}
      <section className="border-app-line bg-app-raised overflow-hidden rounded-[20px] border">
        <div className="grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <Field label="Пошук запчастин">
            <SearchInput
              aria-label="Пошук запчастин"
              onChange={(event) => {
                setSearch(event.target.value)
                setPartsPage(1)
              }}
              placeholder="Назва або QR-код"
              value={search}
            />
          </Field>
          <Button
            disabled={!canGenerate || partsUnavailable || parts.length === 0}
            onClick={() => {
              setQueue((current) => {
                const selected = new Set(current.map((item) => item.id))
                const additions = parts
                  .filter((part) => !selected.has(part.id))
                  .slice(0, Math.max(0, MAX_STICKERS - current.length))
                  .map((part) => ({ id: part.id, quantity: 1 }))
                return [...current, ...additions]
              })
              setError(null)
              setPrintable([])
              setPreview([])
            }}
          >
            Обрати все
          </Button>
          <Button disabled={!queue.length} onClick={clear}>
            Скинути
          </Button>
        </div>
        <ul
          className="divide-app-line grid divide-y"
          aria-label="Список запчастин"
        >
          {parts.map((part) => (
            <li key={part.id}>
              <label className="hover:bg-white/[0.03] flex min-h-14 cursor-pointer items-center gap-3 px-4 py-3 text-sm text-white">
                <input
                  checked={queue.some((item) => item.id === part.id)}
                  className="accent-brand size-4"
                  disabled={!canGenerate || partsUnavailable}
                  onChange={(event) =>
                    selectPart(part.id, event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="font-semibold">{part.name}</span>
              </label>
            </li>
          ))}
        </ul>
        <Pagination
          label="Пагінація запчастин для стікерів"
          onPage={setPartsPage}
          page={partsPage}
          pageSize={30}
          total={partsTotal}
          totalPages={partsTotalPages}
        />
      </section>
      {partsUnavailable ? (
        <p className="text-app-dim text-[13.5px]" role="status">
          Вибір деталей недоступний: список не завантажено, пошук за внутрішнім
          ID вимкнено.
        </p>
      ) : null}
      {!canGenerate ? (
        <p className="text-app-dim text-[13.5px]" role="status">
          {generationDecision === 'subscription-blocked'
            ? 'Поточна підписка не дозволяє генерацію стікерів.'
            : generationDecision === 'access-loading'
              ? 'Перевіряємо право на генерацію стікерів…'
              : generationDecision === 'access-error'
                ? 'Не вдалося перевірити право на генерацію стікерів.'
                : 'Недостатньо прав для генерації стікерів.'}
        </p>
      ) : null}
      <p className="text-app-muted text-sm tabular-nums">У черзі: {total}</p>
      {queue.map((item) => (
        <div
          className="border-app-line rounded-panel bg-app-raised flex flex-wrap items-center justify-between gap-2 border px-3.5 py-2 text-sm text-white"
          key={item.id}
        >
          <span>
            {labelFor(item.id)} × {item.quantity}
          </span>
          <Button
            aria-label={`Прибрати ${labelFor(item.id)}`}
            disabled={!canGenerate}
            onClick={() => {
              setQueue((current) =>
                current.filter((entry) => entry.id !== item.id),
              )
              setPrintable([])
              setPreview([])
            }}
          >
            Прибрати
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          aria-busy={busy}
          disabled={!queue.length || !canGenerate || busy}
          onClick={() => void generate()}
          variant="primary"
        >
          Отримати дані стікерів
        </Button>
        <Button
          disabled={!preview.length || busy}
          onClick={() => void download()}
        >
          Завантажити макет
        </Button>
        <Button disabled={!preview.length || busy} onClick={() => void print()}>
          Друкувати
        </Button>
        <Button disabled={!preview.length || busy} onClick={() => void share()}>
          Поділитися
        </Button>
        <Button disabled={!preview.length || busy} onClick={clear}>
          Підтвердити друк
        </Button>
        <Button disabled={!queue.length || !canGenerate} onClick={clear}>
          Очистити чергу
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {preview.length ? (
        <section
          aria-label="Макет стікерів"
          className="grid gap-3 sm:grid-cols-3"
        >
          {preview.map((sticker, index) => (
            <article
              className="grid min-w-0 max-w-full gap-2 overflow-hidden rounded bg-white p-3 text-black"
              key={`${sticker.id}-${index}`}
            >
              <div
                aria-label={`QR-код ${sticker.name}`}
                dangerouslySetInnerHTML={{ __html: sticker.qrSvg }}
                className="max-w-full overflow-hidden [&_svg]:h-auto [&_svg]:max-w-full [&_svg]:w-full"
                role="img"
              />
              <strong>{sticker.name}</strong>
              {sticker.carLabel ? <span>{sticker.carLabel}</span> : null}
              <a href={sticker.resumeUrl}>Відкрити сканування</a>
            </article>
          ))}
        </section>
      ) : null}
    </PageBody>
  )
}
