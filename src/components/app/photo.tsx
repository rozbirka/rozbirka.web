import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
} from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LoaderCircle,
  MoveHorizontal,
  RotateCw,
  X,
} from 'lucide-react'
import { Dialog, Slot } from 'radix-ui'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'
import { fullPhotoSource } from './photo-source'
import { Skeleton } from './skeleton'

export interface Photo {
  id: string
  url: string
  thumbnailUrl?: string
  /** What the photo shows. Falls back to a numbered description. */
  alt?: string
}

/**
 * A photo that keeps its box whatever the file does: fixed aspect ratio so the
 * grid never reflows while loading, and a stated placeholder when the file is
 * gone rather than a broken-image glyph.
 */
export function Thumbnail({
  photo,
  alt,
  className,
  ratio = 'square',
  size = 'thumbnail',
  fallback = 'compact',
}: {
  photo: Pick<Photo, 'url' | 'thumbnailUrl'>
  alt: string
  className?: string
  ratio?: 'square' | 'wide'
  /**
   * `thumbnail` is the small file, right for a strip or a row. `full` loads the
   * original — a frame several hundred pixels wide shows every artefact of a
   * thumbnail stretched to fit, which reads as a broken photo rather than a
   * small one.
   */
  size?: 'thumbnail' | 'full'
  /** Roomier unavailable state for record tiles; never changes the image frame. */
  fallback?: 'compact' | 'tile'
}) {
  const t = useT(appMessages)
  const source =
    size === 'full' ? fullPhotoSource(photo) : (photo.thumbnailUrl ?? photo.url)
  // Load state belongs to one file: a new src starts over, and the reset
  // happens during render rather than in an effect, so nothing renders twice
  // with the previous photo's state.
  const [status, setStatus] = useState({
    source,
    failed: false,
    loaded: false,
  })
  if (status.source !== source)
    setStatus({ source, failed: false, loaded: false })
  const { failed, loaded } = status
  /**
   * The small file shows while the original travels, so switching photos is
   * never a blank box — the frame fills at once and sharpens a moment later.
   */
  const placeholder =
    size === 'full' && photo.thumbnailUrl && photo.thumbnailUrl !== photo.url
      ? photo.thumbnailUrl
      : null

  return (
    <span
      className={cn(
        'bg-app-input border-app-line rounded-control relative block overflow-hidden border',
        ratio === 'square' ? 'aspect-square' : 'aspect-4/3',
        fallback === 'tile' && '@container',
        className,
      )}
    >
      {failed ? (
        <span
          className={cn(
            'text-app-dim absolute inset-0 flex flex-col items-center justify-center text-center whitespace-normal',
            fallback === 'tile'
              ? 'gap-2 p-3 text-caption leading-snug @max-[140px]:gap-1 @max-[140px]:p-1 @max-[140px]:pt-6 @max-[140px]:text-micro @max-[140px]:leading-tight'
              : size === 'thumbnail'
                ? 'p-0.5 text-[9px] leading-tight'
                : 'gap-1 p-2 text-caption leading-tight',
          )}
        >
          {fallback === 'tile' ? (
            <span className="border-app-line bg-app-raised grid size-9 shrink-0 place-items-center rounded-control border @max-[140px]:size-5">
              <ImageOff aria-hidden className="size-5 @max-[140px]:size-3" />
            </span>
          ) : size === 'full' ? (
            <ImageOff aria-hidden className="size-4 shrink-0" />
          ) : null}
          <span className="w-full min-w-0 wrap-anywhere">
            {size === 'thumbnail' && fallback === 'compact'
              ? t('photoUnavailable')
                  .split(' ')
                  .map((word, index) => (
                    <span className="block whitespace-nowrap" key={index}>
                      {word}
                    </span>
                  ))
              : t('photoUnavailable')}
          </span>
        </span>
      ) : (
        <>
          {placeholder === null ? null : (
            <img
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-105 object-cover blur-[6px]"
              src={placeholder}
            />
          )}
          <img
            alt={alt}
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              placeholder !== null &&
                'transition-opacity duration-200 motion-reduce:transition-none',
              placeholder !== null && !loaded && 'opacity-0',
            )}
            loading={size === 'full' ? 'eager' : 'lazy'}
            onError={() =>
              setStatus((current) => ({ ...current, failed: true }))
            }
            onLoad={() =>
              setStatus((current) => ({ ...current, loaded: true }))
            }
            src={source}
          />
        </>
      )}
    </span>
  )
}

/** Prev/next arrow of the viewer: a 44px round control over the stage edge. */
const viewerArrow =
  'absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full border border-(--rz-border-strong) bg-(--rz-surface) p-0 text-(--rz-text-strong) cursor-pointer disabled:cursor-default disabled:opacity-35 max-sm:hidden'

/**
 * The full-size view, opened from a grid or a gallery — module 47 of the
 * design system. Always dark whatever the cabinet theme: the photo is the only
 * thing on screen. Arrows and Home/End page through without wrapping, a swipe
 * does the same on a phone, and the strip shows where the current photo sits.
 */
function Lightbox({
  photos,
  index,
  label,
  title,
  coverLabel,
  onIndex,
  onClose,
  returnFocus,
}: {
  photos: readonly Photo[]
  index: number
  label: string
  /** The record the photos belong to; shown above the photo. */
  title?: string
  coverLabel?: string
  onIndex: (next: number) => void
  onClose: () => void
  returnFocus: RefObject<HTMLButtonElement | null>
}) {
  const t = useT(appMessages)
  const total = photos.length
  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next))
      if (clamped !== index) onIndex(clamped)
    },
    [index, onIndex, total],
  )
  // Load state belongs to one file, and a retry starts that file over.
  const [load, setLoad] = useState({
    source: '',
    state: 'loading' as 'loading' | 'loaded' | 'failed',
    attempt: 0,
  })
  const touchStart = useRef<number | null>(null)
  const [brokenThumbs, setBrokenThumbs] = useState<ReadonlySet<string>>(
    () => new Set(),
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const next = {
        ArrowLeft: index - 1,
        ArrowRight: index + 1,
        Home: 0,
        End: total - 1,
      }[event.key]
      if (next === undefined) return
      event.preventDefault()
      go(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, total])

  const photo = photos[index]
  const source = photo ? fullPhotoSource(photo) : ''
  if (load.source !== source) setLoad({ source, state: 'loading', attempt: 0 })
  if (!photo) return null
  const name = photo.alt ?? `${label} ${String(index + 1)}`
  const several = total > 1

  return (
    <Dialog.Root onOpenChange={(next) => !next && onClose()} open>
      <Dialog.Portal>
        <Dialog.Content
          className={cn(
            'rz fixed inset-0 z-50 grid bg-(--rz-camera-bg) text-(--rz-text) outline-none',
            several
              ? 'grid-rows-[56px_minmax(0,1fr)_auto_74px] sm:grid-rows-[56px_minmax(0,1fr)_96px]'
              : 'grid-rows-[56px_minmax(0,1fr)]',
          )}
          data-theme="dark"
          onClick={(event) => {
            // A click on the empty dark area closes, as on the backdrop.
            const target = event.target
            if (
              target instanceof Element &&
              !target.closest('button, img, header, [role="alert"]')
            )
              onClose()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocus.current?.focus()
          }}
        >
          <header className="flex min-w-0 items-center gap-3 border-b border-(--rz-border) pr-1 pl-4 sm:pr-3 sm:pl-5">
            <span className="grid min-w-0 flex-1 gap-0.5">
              <Dialog.Title className="rz-strong m-0 truncate font-semibold">
                {title ?? label}
              </Dialog.Title>
              <Dialog.Description className="rz-caption m-0 truncate">
                {name}
              </Dialog.Description>
            </span>
            <span
              aria-label={t('photoPosition', {
                index: String(index + 1),
                total: String(total),
              })}
              className="rz-mono text-(--rz-text-strong) tabular-nums"
            >
              {index + 1} / {total}
            </span>
            <span aria-hidden className="rz-kbd max-sm:hidden">
              Esc
            </span>
            <Dialog.Close asChild>
              <button
                aria-label={t('closeViewer')}
                className="rz-btn rz-btn--icon rz-btn--ghost max-sm:size-11"
                type="button"
              >
                <X aria-hidden className="size-icon-md" />
              </button>
            </Dialog.Close>
          </header>

          <div
            className="relative grid min-h-0 place-items-center py-4 sm:px-[84px] sm:py-6"
            onTouchEnd={(event) => {
              const from = touchStart.current
              const to = event.changedTouches[0]?.clientX
              touchStart.current = null
              if (from === null || to === undefined) return
              if (Math.abs(to - from) > 48) go(index + (to < from ? 1 : -1))
            }}
            onTouchStart={(event) => {
              touchStart.current = event.touches[0]?.clientX ?? null
            }}
          >
            <div className="relative grid aspect-4/3 w-full place-items-center overflow-hidden border-y border-(--rz-border) bg-(--rz-surface-2) sm:h-full sm:w-auto sm:max-w-full sm:rounded-(--rz-r-sm) sm:border-x">
              {load.state === 'failed' ? (
                <span
                  className="grid max-w-80 justify-items-center gap-2 text-center"
                  role="alert"
                >
                  <ImageOff
                    aria-hidden
                    className="size-icon-lg text-(--rz-text-dim)"
                  />
                  <span className="rz-strong font-semibold">
                    {t('photoLoadFailed')}
                  </span>
                  <span className="rz-muted text-pretty">
                    {t('photoLoadFailedHint')}
                  </span>
                  <button
                    className="rz-btn rz-btn--sm"
                    onClick={() =>
                      setLoad((current) => ({
                        ...current,
                        state: 'loading',
                        attempt: current.attempt + 1,
                      }))
                    }
                    type="button"
                  >
                    <RotateCw aria-hidden />
                    {t('retryPhoto')}
                  </button>
                </span>
              ) : (
                <>
                  <img
                    alt={name}
                    className={cn(
                      'absolute inset-0 h-full w-full object-contain',
                      load.state !== 'loaded' && 'opacity-0',
                    )}
                    key={`${source}#${String(load.attempt)}`}
                    onError={() =>
                      setLoad((current) => ({ ...current, state: 'failed' }))
                    }
                    onLoad={() =>
                      setLoad((current) => ({ ...current, state: 'loaded' }))
                    }
                    src={source}
                  />
                  {load.state === 'loading' ? (
                    <span
                      className="grid justify-items-center gap-2 text-(--rz-text-dim)"
                      role="status"
                    >
                      <LoaderCircle
                        aria-hidden
                        className="rz-spin size-icon-lg"
                      />
                      {t('photoLoading')}
                    </span>
                  ) : null}
                  {index === 0 && coverLabel ? (
                    <span className="rz-photo__badge">{coverLabel}</span>
                  ) : null}
                </>
              )}
            </div>
            {several ? (
              <>
                <button
                  aria-label={t('previousPhoto')}
                  className={cn(viewerArrow, 'left-4')}
                  disabled={index === 0}
                  onClick={() => go(index - 1)}
                  type="button"
                >
                  <ChevronLeft aria-hidden className="size-icon-lg" />
                </button>
                <button
                  aria-label={t('nextPhoto')}
                  className={cn(viewerArrow, 'right-4')}
                  disabled={index === total - 1}
                  onClick={() => go(index + 1)}
                  type="button"
                >
                  <ChevronRight aria-hidden className="size-icon-lg" />
                </button>
              </>
            ) : null}
          </div>

          {several ? (
            <p className="m-0 flex items-center justify-center gap-2 px-4 pb-2 text-caption text-(--rz-text-muted) sm:hidden">
              <MoveHorizontal aria-hidden className="size-icon" />
              {t('swipeHint')}
            </p>
          ) : null}
          {several ? (
            <div
              aria-label={t('thumbnails')}
              className="flex items-center gap-2 overflow-x-auto border-t border-(--rz-border) px-4 py-1 [scrollbar-width:none] sm:[&>:first-child]:ml-auto sm:[&>:last-child]:mr-auto"
              role="tablist"
            >
              {photos.map((item, position) => (
                <button
                  aria-label={t('thumbnailOf', {
                    index: String(position + 1),
                    total: String(total),
                    name: item.alt ?? `${label} ${String(position + 1)}`,
                  })}
                  aria-selected={position === index}
                  className={cn(
                    'grid h-[42px] w-14 flex-none cursor-pointer place-items-center overflow-hidden rounded-(--rz-r-sm) border border-(--rz-border) bg-(--rz-surface-2) p-0 sm:h-[54px] sm:w-[72px]',
                    position === index &&
                      'outline-2 outline-offset-2 outline-(--rz-brand)',
                  )}
                  key={item.id}
                  onClick={() => go(position)}
                  role="tab"
                  type="button"
                >
                  {brokenThumbs.has(item.id) ? (
                    <ImageOff
                      aria-hidden
                      className="size-icon-md text-(--rz-text-dim)"
                    />
                  ) : (
                    <img
                      alt=""
                      className="h-full w-full object-cover"
                      onError={() =>
                        setBrokenThumbs((current) =>
                          new Set(current).add(item.id),
                        )
                      }
                      src={item.thumbnailUrl ?? item.url}
                    />
                  )}
                </button>
              ))}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function photoGridClassName(
  variant: 'compact' | 'tiles',
  layout: 'grid' | 'strip',
  className?: string,
) {
  return cn(
    'rz-photos m-0 list-none p-0',
    variant === 'tiles' && 'rz-photos--tiles',
    layout === 'strip' &&
      'rz-photo-strip min-w-0 w-full grid-flow-col grid-cols-none auto-cols-[calc((100%-12px)/2)] gap-3 overflow-x-auto overscroll-x-contain pb-1 sm:auto-cols-[min(180px,calc((100%-36px)/4))] [scrollbar-width:thin] [scrollbar-color:var(--rz-border-strong)_transparent]',
    className,
  )
}

/** Pending record photos use the exact same tracks as the loaded strip. */
export function PhotoStripSkeleton() {
  return (
    <div
      aria-hidden
      className={photoGridClassName('tiles', 'strip', 'overflow-hidden')}
    >
      {[0, 1, 2, 3].map((index) => (
        <Skeleton
          className="aspect-4/3 h-auto w-full rounded-control"
          key={index}
        />
      ))}
    </div>
  )
}

/**
 * The photo strip of a record. Clicking opens the full image, so the grid can
 * stay small without hiding detail; without photos it says so instead of
 * collapsing to nothing.
 */
export function PhotoGrid({
  photos,
  label,
  emptyLabel,
  className,
  variant = 'compact',
  layout = 'grid',
  coverLabel,
  title,
}: {
  photos: readonly Photo[]
  /** Names the group, and seeds the alt text of each photo. */
  label: string
  /** The record the photos belong to, as the viewer heads it. */
  title?: string
  emptyLabel?: string
  className?: string
  /** Record tiles use a wider frame and keep the shared thumbnail loading. */
  variant?: 'compact' | 'tiles'
  /** One scrollable row keeps record tiles at their existing size. */
  layout?: 'grid' | 'strip'
  /** When supplied, identifies the first photo as the record cover. */
  coverLabel?: string
}) {
  const t = useT(appMessages)
  const opener = useRef<HTMLButtonElement | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  if (photos.length === 0) {
    return (
      <p className={cn('rz-caption m-0', className)}>
        {emptyLabel ?? t('noPhotos')}
      </p>
    )
  }

  return (
    <>
      <ul
        aria-label={label}
        className={photoGridClassName(variant, layout, className)}
      >
        {photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              aria-label={photo.alt ?? `${label} ${String(index + 1)}`}
              className="relative block w-full cursor-zoom-in"
              onClick={(event) => {
                opener.current = event.currentTarget
                setOpenIndex(index)
              }}
              type="button"
            >
              <Thumbnail
                alt={photo.alt ?? `${label} ${String(index + 1)}`}
                photo={photo}
                ratio={variant === 'tiles' ? 'wide' : 'square'}
                fallback={variant === 'tiles' ? 'tile' : 'compact'}
              />
              {index === 0 && coverLabel ? (
                <span className="rz-photo__badge pointer-events-none">
                  {coverLabel}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
      {openIndex === null ? null : (
        <Lightbox
          returnFocus={opener}
          index={Math.min(openIndex, photos.length - 1)}
          label={label}
          {...(title === undefined ? {} : { title })}
          {...(coverLabel === undefined ? {} : { coverLabel })}
          onClose={() => setOpenIndex(null)}
          onIndex={setOpenIndex}
          photos={photos}
        />
      )}
    </>
  )
}

/**
 * A record's photos when they are the point of the section: one large frame
 * showing the chosen shot, the whole set as a strip under it. Picking a
 * thumbnail changes the large frame; the large frame opens the viewer — so a
 * glance costs one click and a close look costs two.
 */
export function Gallery({
  photos,
  label,
  emptyLabel,
  ratio = 'wide',
  variant = 'panel',
  className,
  title,
  coverLabel,
}: {
  photos: readonly Photo[]
  /** Names the gallery, and seeds the alt text of each photo. */
  label: string
  /** The record the photos belong to, as the viewer heads it. */
  title?: string
  /** Marks the first photo as the record cover in the viewer. */
  coverLabel?: string
  emptyLabel?: ReactNode
  /** Shape of the large frame. */
  ratio?: 'wide' | 'square'
  /**
   * `panel` sits inside a padded section. `framed` runs the large photo to the
   * edges of its card, with the strip inset under it.
   */
  variant?: 'panel' | 'framed'
  className?: string
}) {
  const t = useT(appMessages)
  const [current, setCurrent] = useState(0)
  const opener = useRef<HTMLButtonElement | null>(null)
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const selected = Math.min(current, photos.length - 1)
  const shown = photos[selected]

  // Paging through a gallery is a sequence: the next photo is almost always
  // the next click, so it is worth having it in the cache before then.
  useEffect(() => {
    const neighbours = [photos[current + 1], photos[current - 1]].filter(
      (photo) => photo !== undefined,
    )
    for (const photo of neighbours) {
      const preload = new Image()
      preload.src = fullPhotoSource(photo)
    }
  }, [current, photos])

  if (!shown) {
    return (
      <p
        className={cn(
          'rz-caption m-0',
          variant === 'framed' && 'px-4 py-4',
          className,
        )}
      >
        {emptyLabel ?? t('noPhotos')}
      </p>
    )
  }

  const framed = variant === 'framed'

  const nameOf = (photo: Photo, index: number) =>
    photo.alt ?? `${label} ${String(index + 1)}`
  const pad = (value: number) => String(value).padStart(2, '0')

  return (
    <div className={cn('grid min-w-0', framed ? 'gap-0' : 'gap-2', className)}>
      <div className={cn('relative', framed && 'border-app-line border-y')}>
        <button
          aria-label={t('openFullScreen', { name: nameOf(shown, selected) })}
          className="block w-full cursor-zoom-in"
          onClick={(event) => {
            opener.current = event.currentTarget
            setOpenIndex(Math.min(current, photos.length - 1))
          }}
          type="button"
        >
          <Thumbnail
            alt={nameOf(shown, selected)}
            className={cn(framed && 'rounded-none border-0')}
            photo={shown}
            ratio={ratio === 'wide' ? 'wide' : 'square'}
            size="full"
          />
        </button>
        {photos.length > 1 ? (
          <span
            aria-hidden
            className="rz-photo__badge pointer-events-none top-auto bottom-2 left-2 font-mono tabular-nums"
          >
            {pad(selected + 1)} / {pad(photos.length)}
          </span>
        ) : null}
      </div>
      {photos.length > 1 ? (
        <ul
          aria-label={label}
          className={cn(
            'grid min-w-0',
            framed
              ? 'auto-cols-fr grid-flow-col gap-2 overflow-x-auto p-3'
              : 'grid-cols-4 gap-2 sm:grid-cols-5',
          )}
        >
          {photos.map((photo, index) => (
            <li key={photo.id}>
              <button
                aria-current={index === selected ? 'true' : undefined}
                aria-label={t('showPhoto', { name: nameOf(photo, index) })}
                className={cn(
                  'block w-full cursor-pointer overflow-hidden transition-opacity',
                  'rounded-control border',
                  index === selected
                    ? 'border-brand'
                    : 'border-app-line-2 opacity-70 hover:opacity-100',
                )}
                onClick={() => setCurrent(index)}
                type="button"
              >
                <Thumbnail
                  alt={nameOf(photo, index)}
                  className={cn(
                    'rounded-none border-0',
                    framed && 'rounded-control',
                  )}
                  photo={photo}
                  ratio="wide"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {openIndex === null ? null : (
        <Lightbox
          returnFocus={opener}
          index={Math.min(openIndex, photos.length - 1)}
          label={label}
          {...(title === undefined ? {} : { title })}
          {...(coverLabel === undefined ? {} : { coverLabel })}
          onClose={() => setOpenIndex(null)}
          onIndex={(next) => {
            setOpenIndex(next)
            setCurrent(next)
          }}
          photos={photos}
        />
      )}
    </div>
  )
}

/**
 * A record as a card: the photo carries recognition, the title carries
 * identity, and status stays visible without opening the record.
 */
export function RecordCard({
  title,
  photo,
  meta,
  status,
  footer,
  href,
  onOpen,
  asChild = false,
  children,
  className,
}: {
  title: ReactNode
  photo?: Pick<Photo, 'url' | 'thumbnailUrl'> | null
  /** Mono line under the title: codes, OEM, supplier. */
  meta?: ReactNode
  status?: ReactNode
  footer?: ReactNode
  href?: string
  onOpen?: () => void
  /** Render the card as the given element — a router link, for instance. */
  asChild?: boolean
  children?: ReactNode
  className?: string
}) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="text-app-strong block font-semibold break-words">
            {title}
          </span>
          {meta === undefined ? null : (
            <span className="text-app-dim mt-1 block font-mono text-caption">
              {meta}
            </span>
          )}
        </span>
        {status}
      </span>
      {footer === undefined ? null : (
        <span className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          {footer}
        </span>
      )}
    </>
  )

  const shell = cn(
    'rz-card flex flex-col gap-2 p-3 text-left transition-colors',
    (href !== undefined || onOpen !== undefined) &&
      'hover:border-app-line-2 hover:bg-app-hover',
    className,
  )

  const media =
    photo === undefined ? null : photo === null ? (
      <span className="bg-app-input rounded-control text-app-dim mb-1 grid aspect-4/3 place-items-center text-caption">
        <ImageOff aria-hidden className="size-4" />
      </span>
    ) : (
      <Thumbnail alt="" className="mb-1" photo={photo} ratio="wide" />
    )

  if (asChild) {
    return (
      <Slot.Root className={shell}>
        {children}
        {media}
        {body}
      </Slot.Root>
    )
  }

  if (href !== undefined) {
    return (
      <a className={shell} href={href}>
        {media}
        {body}
      </a>
    )
  }

  if (onOpen !== undefined) {
    return (
      <button className={shell} onClick={onOpen} type="button">
        {media}
        {body}
      </button>
    )
  }

  return (
    <div className={shell}>
      {media}
      {body}
    </div>
  )
}
