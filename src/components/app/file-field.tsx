import type { ComponentProps, ReactNode } from 'react'
import { FileWarning, ImagePlus, RotateCcw, Upload, X } from 'lucide-react'
import { useLocale } from '@/i18n/LocaleProvider'
import { cn } from '@/lib/utils'
import { Button } from './button'
import { useFieldControl } from './field-context'
import { formatFileSize } from './format'
import { Thumbnail } from './photo'
import { useT } from '@/i18n/hooks'
import { appMessages } from './app-messages'

/**
 * File picker sized like every other control: the browser's own button is the
 * click target, so it gets the same 44px floor rather than the 20px default.
 */
export function FileField({ className, ...props }: ComponentProps<'input'>) {
  const field = useFieldControl()

  return (
    <input
      {...field}
      type="file"
      {...props}
      className={cn(
        'rz-input text-app-muted flex cursor-pointer items-center py-0',
        'file:rounded-rz-xs file:bg-app-active file:text-app-strong hover:file:bg-app-selected file:mr-2.5 file:h-6 file:cursor-pointer file:border-0 file:px-2 file:text-caption file:font-medium',
        className,
      )}
    />
  )
}

/**
 * Image-only picker with one product label across cabinet flows. The native
 * file control remains available to assistive technology while its
 * browser-specific text stays hidden.
 */
export function PhotoFileField({
  className,
  disabled,
  ...props
}: ComponentProps<'input'>) {
  const field = useFieldControl()
  const t = useT(appMessages)

  return (
    <label
      className={cn(
        'border-app-line-2 bg-app-input hover:border-app-dim rounded-control flex min-h-24 cursor-pointer flex-col items-center justify-center border border-dashed px-5 text-center transition-colors',
        disabled && 'cursor-not-allowed opacity-55',
        className,
      )}
    >
      <ImagePlus aria-hidden className="text-app-muted size-5" />
      <span className="text-app-strong mt-2 font-semibold">
        {t('choosePhotos')}
      </span>
      <span className="rz-caption mt-0.5">{t('choosePhotosHint')}</span>
      <input
        {...field}
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        type="file"
        {...props}
      />
    </label>
  )
}

export interface UploadItem {
  id: string
  name: string
  /** Bytes, when the file came from the picker rather than the server. */
  size?: number
  status: 'pending' | 'uploaded' | 'failed'
  /** Why it failed, in words the user can act on. */
  error?: string
  previewUrl?: string
  url?: string
}

/**
 * The files attached to a record, each with its own state and its own way out:
 * a failed upload can be retried or dropped without touching the others.
 */
export function UploadList({
  items,
  label,
  onRetry,
  onRemove,
  emptyLabel,
}: {
  items: readonly UploadItem[]
  label: string
  onRetry?: (item: UploadItem) => void
  onRemove?: (item: UploadItem) => void
  emptyLabel?: ReactNode
}) {
  const { locale } = useLocale()
  const t = useT(appMessages)
  if (items.length === 0) {
    return <p className="rz-caption">{emptyLabel ?? t('noFiles')}</p>
  }

  return (
    <ul aria-label={label} className="grid gap-2">
      {items.map((item) => (
        <li
          className="rz-inset flex flex-wrap items-center gap-3 p-2"
          key={item.id}
        >
          {item.previewUrl || item.url ? (
            <Thumbnail
              alt=""
              className="rounded-rz-xs size-8 shrink-0"
              photo={{ url: item.previewUrl ?? item.url! }}
            />
          ) : (
            <span className="bg-app-active text-app-dim rounded-rz-xs grid size-8 shrink-0 place-items-center">
              <Upload aria-hidden className="size-3.5" />
            </span>
          )}

          <span className="min-w-0 flex-1">
            <span className="text-app-strong block truncate">{item.name}</span>
            <span
              className={cn(
                'text-caption block font-mono',
                item.status === 'failed' ? 'text-state-danger' : 'text-app-dim',
              )}
            >
              {item.status === 'failed'
                ? (item.error ?? t('uploadFailed'))
                : item.status === 'pending'
                  ? t('uploading')
                  : item.size === undefined
                    ? t('uploaded')
                    : formatFileSize(item.size, locale)}
            </span>
          </span>

          <span className="flex shrink-0 flex-wrap gap-2">
            {item.status === 'failed' && onRetry !== undefined ? (
              <Button
                aria-label={t('retryFile', { name: item.name })}
                onClick={() => onRetry(item)}
                size="icon"
              >
                <RotateCcw aria-hidden />
              </Button>
            ) : null}
            {onRemove === undefined ? null : (
              <Button
                aria-label={t('removeFile', { name: item.name })}
                onClick={() => onRemove(item)}
                size="icon"
                variant="quiet"
              >
                <X aria-hidden />
              </Button>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Sits under an upload list when some files did not make it. */
export function UploadSummary({ failed }: { failed: number }) {
  const t = useT(appMessages)
  if (failed === 0) return null

  return (
    <p className="rz-error items-center" role="status">
      <FileWarning aria-hidden className="size-3.5" />
      {failed === 1 ? t('oneFileFailed') : t('filesFailed', { count: failed })}
    </p>
  )
}
