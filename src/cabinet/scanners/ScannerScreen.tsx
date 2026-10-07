import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  MapPin,
  Printer,
  QrCode,
  RotateCcw,
  ScanLine,
  SearchX,
} from 'lucide-react'
import { Link } from 'react-router'
import {
  Button,
  DateValue,
  DeniedState,
  EmptyState,
  Field,
  PhotoFileField,
  Notice,
  PageBody,
  PageHeader,
  SectionPanel,
  StateScreen,
  StatusPill,
  Thumbnail,
  TextInput,
  type NoticeTone,
} from '@/components/app'
import { cn } from '@/lib/utils'
import {
  partStatusPresentation,
  conditionLabel,
  historyLabel,
  unitLabel,
} from '../parts/part-labels'
import { scannersApi } from '@/api/scanners'
import { partsApi, type PartHistory } from '@/api/parts'
import { inventoryApi, type PartInventoryZone } from '@/api/inventory'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { normalizeScanCode } from './scan-code'
import { scannerMessages } from './messages'
import { useLocale, useT, type MessageKey } from '@/i18n'

type ScannerMessageKey = MessageKey<typeof scannerMessages>

interface BarcodeResult {
  rawValue: string
}
interface BarcodeDetectorLike {
  detect(source: ImageBitmapSource): Promise<BarcodeResult[]>
}
type BarcodeDetectorConstructor = new (options: {
  formats: string[]
}) => BarcodeDetectorLike
const stopStream = (stream: MediaStream | null) =>
  stream?.getTracks().forEach((track) => track.stop())

const getDetector = (): BarcodeDetectorConstructor | null =>
  'BarcodeDetector' in globalThis
    ? (globalThis as unknown as { BarcodeDetector: BarcodeDetectorConstructor })
        .BarcodeDetector
    : null

/**
 * What the scanner says between attempts. `inline` messages ride along with the
 * screen; the other two own the result area, because "not found" and "no camera"
 * are outcomes the yard has to act on, not asides.
 */
type ScanNotice =
  | { kind: 'inline'; tone: NoticeTone; text: ScannerMessageKey }
  | { kind: 'not-found' }
  | { kind: 'camera-denied' }

/**
 * The scanned record, flattened for display. Only fields the server already
 * returned after the tenant-authorized lookup; each stays optional so a lean
 * payload renders fewer facts instead of empty ones.
 */
interface ScannedPart {
  id: string
  name: string
  /** The code as it was submitted — proof of what this card came from. */
  code: string
  qrCode: string | null
  status: string | null
  condition: string | null
  unit: string | null
  quantityAvailable: number | null
  quantityReserved: number | null
  car: string | null
  carId: string | null
  carCode: string | null
  photo: { url: string; thumbnailUrl?: string } | null
}

/** One code this device has already resolved in this sitting. */
interface RecentScan {
  code: string
  name: string
  at: string
}

export function ScannerScreen(_props: CabinetModuleScreenProps) {
  const { targetTenant } = useCabinet()
  const t = useT(scannerMessages)
  const { locale } = useLocale()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)
  const sequenceRef = useRef(0)
  const scanGenerationRef = useRef(0)
  const fileGenerationRef = useRef(0)
  const requestRef = useRef<AbortController | null>(null)
  const pendingRef = useRef(false)
  const [code, setCode] = useState('')
  const [cameraState, setCameraState] = useState<
    'idle' | 'active' | 'unavailable'
  >('idle')
  const [videoReady, setVideoReady] = useState(false)
  const [status, setStatus] = useState<ScanNotice | null>(null)
  const [part, setPart] = useState<ScannedPart | null>(null)
  const [history, setHistory] = useState<PartHistory['events']>([])
  const [placement, setPlacement] = useState<PartInventoryZone[]>([])
  const [recent, setRecent] = useState<RecentScan[]>([])
  const [pending, setPending] = useState(false)
  const [filePreview, setFilePreview] = useState<{
    name: string
    url: string
  } | null>(null)
  const filePreviewRef = useRef(filePreview)
  useEffect(() => {
    filePreviewRef.current = filePreview
  }, [filePreview])

  const shutdownCamera = useCallback(
    (nextState: 'idle' | 'unavailable' = 'idle') => {
      scanGenerationRef.current += 1
      stopStream(streamRef.current)
      streamRef.current = null
      if (mountedRef.current) {
        setVideoReady(false)
        setCameraState(nextState)
      }
    },
    [],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      sequenceRef.current += 1
      fileGenerationRef.current += 1
      requestRef.current?.abort()
      if (
        filePreviewRef.current?.url &&
        typeof URL.revokeObjectURL === 'function'
      )
        URL.revokeObjectURL(filePreviewRef.current.url)
      shutdownCamera()
    }
  }, [shutdownCamera])

  useEffect(() => {
    const video = videoRef.current
    const stream = streamRef.current
    if (cameraState !== 'active' || !video || !stream) return
    video.srcObject = stream
    void Promise.resolve(video.play()).catch(() => undefined)
  }, [cameraState])

  const resolve = useCallback(
    async (rawCode: string) => {
      const normalized = normalizeScanCode(rawCode)
      if (!normalized || pendingRef.current) return
      const sequence = ++sequenceRef.current
      requestRef.current?.abort()
      const controller = new AbortController()
      requestRef.current = controller
      pendingRef.current = true
      setPart(null)
      setPending(true)
      setStatus({
        kind: 'inline',
        tone: 'info',
        text: 'checkingInline',
      })
      try {
        const result = await scannersApi.resolveQr(normalized, {
          signal: controller.signal,
        })
        if (!mountedRef.current || sequence !== sequenceRef.current) return
        shutdownCamera()
        const vehicle = [result.carBrand, result.carModel, result.carYear]
          .filter(Boolean)
          .join(' ')
        const cover = result.photos?.[0]
        setPart({
          id: result.id,
          name: result.name,
          code: normalized,
          qrCode: result.qrCode ?? null,
          status: result.status ?? null,
          condition: result.condition ?? null,
          unit: result.unit ?? null,
          quantityAvailable: result.quantityAvailable ?? null,
          quantityReserved: result.quantityReserved ?? null,
          car: vehicle || null,
          carId: result.carId ?? null,
          carCode: result.carCode ?? null,
          photo: cover
            ? { url: cover.url, thumbnailUrl: cover.thumbnailUrl }
            : null,
        })
        setStatus(null)
        setRecent((current) =>
          [
            {
              code: normalized,
              name: result.name,
              at: new Date().toISOString(),
            },
            ...current.filter((entry) => entry.code !== normalized),
          ].slice(0, 5),
        )
        void partsApi.history(result.id, { signal: controller.signal }).then(
          (next) => {
            if (mountedRef.current && sequence === sequenceRef.current)
              setHistory(next.events.slice(0, 3))
          },
          () => undefined,
        )
        void inventoryApi
          .getPartZones(result.id, { signal: controller.signal })
          .then(
            (zones) => {
              if (mountedRef.current && sequence === sequenceRef.current)
                setPlacement(zones)
            },
            () => undefined,
          )
      } catch {
        if (
          !mountedRef.current ||
          controller.signal.aborted ||
          sequence !== sequenceRef.current
        )
          return
        setPart(null)
        setStatus({ kind: 'not-found' })
      } finally {
        if (mountedRef.current && sequence === sequenceRef.current) {
          pendingRef.current = false
          setPending(false)
        }
      }
    },
    [shutdownCamera],
  )

  useEffect(() => {
    const Detector = getDetector()
    const video = videoRef.current
    if (cameraState !== 'active' || !videoReady || !Detector || !video) return
    const generation = ++scanGenerationRef.current
    const detector = new Detector({ formats: ['qr_code'] })
    let frame: number | null = null
    let cancelled = false
    const detect = async () => {
      if (cancelled || generation !== scanGenerationRef.current) return
      try {
        const result = await detector.detect(video)
        if (cancelled || generation !== scanGenerationRef.current) return
        const value = result[0]?.rawValue
        if (value) {
          shutdownCamera()
          await resolve(value)
          return
        }
      } catch {
        if (cancelled || generation !== scanGenerationRef.current) return
      }
      frame = requestAnimationFrame(() => void detect())
    }
    void detect()
    return () => {
      cancelled = true
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [cameraState, resolve, shutdownCamera, videoReady])

  const stopCamera = () => {
    shutdownCamera()
    setStatus({
      kind: 'inline',
      tone: 'info',
      text: 'cameraStopped',
    })
  }

  const enableCamera = async () => {
    shutdownCamera()
    const generation = scanGenerationRef.current
    try {
      const stream = await navigator.mediaDevices?.getUserMedia?.({
        video: { facingMode: 'environment' },
      })
      if (!stream) throw new Error('unsupported')
      if (!mountedRef.current || generation !== scanGenerationRef.current) {
        stopStream(stream)
        return
      }
      streamRef.current = stream
      setVideoReady(false)
      setCameraState('active')
      const Detector = getDetector()
      setStatus(
        Detector
          ? {
              kind: 'inline',
              tone: 'info',
              text: 'cameraOn',
            }
          : {
              kind: 'inline',
              tone: 'warn',
              text: 'cameraUnsupported',
            },
      )
    } catch {
      if (mountedRef.current && generation === scanGenerationRef.current) {
        shutdownCamera('unavailable')
        setStatus({ kind: 'camera-denied' })
      }
    }
  }
  const scanFile = async (file: File | null) => {
    if (
      filePreviewRef.current?.url &&
      typeof URL.revokeObjectURL === 'function'
    )
      URL.revokeObjectURL(filePreviewRef.current.url)
    const previewUrl =
      file && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : null
    setFilePreview(
      file && previewUrl ? { name: file.name, url: previewUrl } : null,
    )
    const Detector = getDetector()
    if (!file || !Detector) {
      setStatus({
        kind: 'inline',
        tone: 'warn',
        text: 'imageUnsupported',
      })
      return
    }
    const generation = ++fileGenerationRef.current
    try {
      const result = await new Detector({ formats: ['qr_code'] }).detect(file)
      if (!mountedRef.current || generation !== fileGenerationRef.current)
        return
      const value = result[0]?.rawValue
      if (value) {
        shutdownCamera()
        await resolve(value)
      } else
        setStatus({
          kind: 'inline',
          tone: 'warn',
          text: 'imageNoCode',
        })
    } catch {
      if (mountedRef.current && generation === fileGenerationRef.current)
        setStatus({
          kind: 'inline',
          tone: 'danger',
          text: 'imageFailed',
        })
    }
  }

  /** Clears the last result and reopens the camera for the next part in hand. */
  const scanNext = async () => {
    setPart(null)
    setStatus(null)
    setCode('')
    await enableCamera()
  }

  const cameraLive = cameraState === 'active'
  const partStatus = part?.status
    ? partStatusPresentation(part.status, locale)
    : null

  return (
    <PageBody width="narrow">
      <PageHeader eyebrow={t('eyebrow')} title={t('title')} />
      <p className="text-app-muted text-sm">{t('intro')}</p>

      {cameraLive ? (
        <div className="rounded-panel border-app-line relative overflow-hidden border bg-black">
          <video
            aria-label={t('cameraLabel')}
            autoPlay
            className="aspect-4/3 w-full object-cover"
            muted
            onCanPlay={() => setVideoReady(true)}
            playsInline
            ref={videoRef}
          />
          <span
            aria-hidden
            className="border-brand/70 pointer-events-none absolute inset-x-8 inset-y-6 rounded-2xl border-2"
          />
        </div>
      ) : null}

      {part ? (
        <div className="grid gap-4">
          <SectionPanel
            aside={
              <span className="text-app-dim font-mono text-[12px] break-all">
                {part.qrCode ?? part.code}
              </span>
            }
            description={t('recognisedHint')}
            title={t('recognisedTitle')}
          >
            <div className="flex flex-wrap items-start gap-4">
              {part.photo ? (
                <Thumbnail
                  alt=""
                  className="size-20 shrink-0"
                  photo={part.photo}
                />
              ) : null}
              <div className="grid min-w-0 flex-1 gap-2">
                <p className="text-[18px] font-bold break-words text-white">
                  {part.name}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {partStatus ? (
                    <StatusPill tone={partStatus.tone}>
                      {partStatus.label}
                      {typeof part.quantityAvailable === 'number'
                        ? ` · ${t('quantity', { count: part.quantityAvailable, unit: unitLabel(part.unit, locale) })}`
                        : ''}
                    </StatusPill>
                  ) : null}
                  {part.condition ? (
                    <span className="border-app-line bg-app-input text-app-muted rounded-full border px-2.5 py-1 text-[13px]">
                      {conditionLabel(part.condition, locale)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </SectionPanel>

          <div className="grid items-start gap-4 lg:grid-cols-2">
            <SectionPanel
              description={t('actionsHint')}
              title={t('actionsTitle')}
            >
              <div className="grid gap-2.5">
                <div className="border-app-line rounded-panel flex flex-wrap items-center justify-between gap-3 border p-3.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <MapPin aria-hidden className="text-app-dim size-4" />
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-white">
                        {t('placement')}
                      </span>
                      <span className="text-app-muted block text-[13px]">
                        {placement.length === 0
                          ? t('noPlacement')
                          : placement
                              .map((zone) => zone.zoneCode ?? zone.zoneName)
                              .filter(Boolean)
                              .join(' · ')}
                      </span>
                    </span>
                  </span>
                  <Button asChild>
                    <Link
                      to={`/app/${targetTenant?.slug ?? ''}/parts/${part.id}/inventory`}
                    >
                      {t('move')}
                    </Link>
                  </Button>
                </div>
                <div className="border-app-line rounded-panel flex flex-wrap items-center justify-between gap-3 border p-3.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <Printer aria-hidden className="text-app-dim size-4" />
                    <span className="text-sm font-semibold text-white">
                      {t('sticker')}
                    </span>
                  </span>
                  <Button asChild>
                    <Link
                      to={`/app/${targetTenant?.slug ?? ''}/stickers?part=${part.id}`}
                    >
                      {t('print')}
                    </Link>
                  </Button>
                </div>
                {part.carId ? (
                  <div className="border-app-line rounded-panel flex flex-wrap items-center justify-between gap-3 border p-3.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <QrCode aria-hidden className="text-app-dim size-4" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">
                          {t('source')}
                        </span>
                        <span className="text-app-muted block text-[13px]">
                          {[part.carCode, part.car].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                    </span>
                    <Button asChild>
                      <Link
                        to={`/app/${targetTenant?.slug ?? ''}/cars/${part.carId}`}
                      >
                        {t('openCar')}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            </SectionPanel>

            <SectionPanel
              aside={
                <Link
                  className="hover:text-brand text-app-muted text-[13px]"
                  to={`/app/${targetTenant?.slug ?? ''}/parts/${part.id}`}
                >
                  {t('fullHistory')}
                </Link>
              }
              title={t('movementTitle')}
            >
              {history.length === 0 ? (
                <p className="text-app-dim text-[13px]">{t('noEvents')}</p>
              ) : (
                <ol className="grid">
                  {history.map((event, index) => (
                    <li
                      className={cn(
                        'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5',
                        index > 0 && 'border-app-line border-t',
                      )}
                      key={event.id}
                    >
                      <span className="text-sm font-semibold text-white">
                        {historyLabel(event.eventType, locale)}
                      </span>
                      <span className="text-app-dim flex flex-wrap gap-x-2.5 text-[12px]">
                        {event.user.name}
                        <DateValue value={event.createdAt} />
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </SectionPanel>
          </div>

          {recent.length > 1 ? (
            <SectionPanel title={t('recentTitle')}>
              <ol className="grid">
                {recent.slice(1).map((entry, index) => (
                  <li
                    className={cn(
                      'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5',
                      index > 0 && 'border-app-line border-t',
                    )}
                    key={entry.code}
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">
                        {entry.name}
                      </span>
                      <span className="text-app-dim block font-mono text-[12px] break-all">
                        {entry.code}
                      </span>
                    </span>
                    <DateValue
                      className="text-app-dim text-[12px]"
                      value={entry.at}
                    />
                  </li>
                ))}
              </ol>
            </SectionPanel>
          ) : null}
        </div>
      ) : pending ? (
        <StateScreen
          description={t('checkingHint')}
          icon={<ScanLine aria-hidden />}
          title={t('checkingTitle')}
          tone="brand"
        />
      ) : status?.kind === 'not-found' ? (
        <StateScreen
          description={t('notFoundHint')}
          icon={<SearchX aria-hidden />}
          role="alert"
          title={t('notFoundTitle')}
          tone="warn"
          actions={
            <Button
              className="min-h-14"
              onClick={() => void scanNext()}
              variant="primary"
            >
              <ScanLine aria-hidden />
              {t('scanAgain')}
            </Button>
          }
        />
      ) : status?.kind === 'camera-denied' ? (
        <DeniedState
          description={t('cameraDeniedHint')}
          title={t('cameraDeniedTitle')}
        />
      ) : cameraLive ? null : (
        <EmptyState
          description={t('readyHint')}
          icon={<QrCode aria-hidden />}
          title={t('readyTitle')}
        />
      )}

      {status?.kind === 'inline' ? (
        <Notice
          role={status.tone === 'danger' ? 'alert' : 'status'}
          tone={status.tone}
        >
          {t(status.text)}
        </Notice>
      ) : null}

      {/* The yard works one-handed: the deciding action stays under the thumb. */}
      <div className="rounded-panel border-app-line bg-app-overlay/95 sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 grid gap-2 border p-3 backdrop-blur md:bottom-6">
        {part ? (
          <>
            <Button asChild className="min-h-14 w-full" variant="primary">
              <Link to={`/app/${targetTenant?.slug ?? ''}/parts/${part.id}`}>
                {t('openPart')}
              </Link>
            </Button>
            <Button
              className="min-h-14 w-full"
              onClick={() => void scanNext()}
              variant="ghost"
            >
              <ScanLine aria-hidden />
              {t('scanNext')}
            </Button>
          </>
        ) : (
          <>
            {cameraLive ? (
              <Button
                className="min-h-14 w-full"
                onClick={stopCamera}
                variant="ghost"
              >
                {t('stopCamera')}
              </Button>
            ) : null}
            <Button
              className="min-h-14 w-full"
              onClick={() => void enableCamera()}
              variant={cameraLive ? 'quiet' : 'primary'}
            >
              {cameraLive ? <RotateCcw aria-hidden /> : <Camera aria-hidden />}
              {t('startCamera')}
            </Button>
            {cameraLive ? (
              <p className="text-app-dim text-center text-[12.5px]">
                {t('frozenHint')}
              </p>
            ) : null}
          </>
        )}
      </div>

      <SectionPanel description={t('manualHint')} title={t('manualTitle')}>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void resolve(code)
          }}
        >
          <Field hint={t('codeHint')} label={t('codeLabel')}>
            <TextInput
              aria-label={t('codeLabel')}
              autoComplete="off"
              onChange={(event) => setCode(event.target.value)}
              placeholder={t('codePlaceholder')}
              value={code}
            />
          </Field>
          <Field hint={t('fileHint')} label={t('fileLabel')}>
            <PhotoFileField
              aria-label={t('fileLabel')}
              onChange={(event) =>
                void scanFile(event.target.files?.[0] ?? null)
              }
            />
            {filePreview ? (
              <div className="border-app-line flex min-w-0 items-center gap-3 rounded-control border p-2">
                <img
                  alt={t('filePreview', { name: filePreview.name })}
                  className="size-14 shrink-0 rounded-control object-cover"
                  src={filePreview.url}
                />
                <span className="text-app-ink min-w-0 flex-1 truncate text-sm">
                  {filePreview.name}
                </span>
              </div>
            ) : null}
          </Field>
          <Button
            aria-busy={pending}
            className="min-h-14 w-full"
            disabled={pending}
            type="submit"
            /* Without a camera this is the only way in, so it takes the fill. */
            variant={
              cameraState === 'unavailable' && !part ? 'primary' : 'ghost'
            }
          >
            {t('findPart')}
          </Button>
        </form>
      </SectionPanel>

      <p className="text-app-dim text-[13.5px]">{t('vinUnavailable')}</p>
    </PageBody>
  )
}
