import { Button } from '@/components/app'
import type { ImportCapabilities } from '@/api/part-imports'
import { useLocale, type Locale } from '@/i18n'
import { importHistoryMessages } from './import-history-messages'
import { fieldLabel } from './import-model'
import { useCount, useImportT } from './use-import-text'

const STEPS = [
  { num: '1', title: 'stepUploadTitle', hint: 'stepUploadHint' },
  { num: '2', title: 'stepMapTitle', hint: 'stepMapHint' },
  { num: '3', title: 'stepReviewTitle', hint: 'stepReviewHint' },
  { num: '4', title: 'stepRunTitle', hint: 'stepRunHint' },
] as const

const mib = (bytes: number) => Math.round(bytes / (1024 * 1024))

/**
 * A header row named after the fields this server actually declares, required
 * ones first. There is no template endpoint, and inventing a fixed list of
 * columns would go stale the moment the import schema gains a field — this one
 * cannot, because it is built from /capabilities.
 */
function templateCsv(capabilities: ImportCapabilities, locale: Locale) {
  const named = capabilities.fields.map((field) => ({
    ...field,
    label: fieldLabel(field.id, locale),
  }))
  const ordered = [
    ...named.filter((field) => field.required),
    ...named.filter((field) => !field.required),
  ]
  // A leading BOM so Excel opens a non-Latin header row as UTF-8 rather than
  // as the local codepage.
  return `\ufeff${ordered.map((field) => field.label).join(',')}\n`
}

function Step({
  num,
  title,
  hint,
}: {
  num: string
  title: string
  hint: string
}) {
  return (
    <li className="flex items-start gap-3.5">
      <span
        aria-hidden
        className="text-app-muted inline-flex size-6.5 flex-none items-center justify-center rounded-full bg-white/[0.06] font-mono text-[12px]"
      >
        {num}
      </span>
      <span className="min-w-0">
        <span className="text-app-ink block text-[15px] font-bold">
          {title}
        </span>
        <span className="text-app-muted mt-1 block text-[14px] leading-6 text-pretty">
          {hint}
        </span>
      </span>
    </li>
  )
}

function Limit({
  label,
  value,
  meta,
}: {
  label: string
  value: string
  meta: string
}) {
  return (
    <div className="border-app-line bg-app-raised rounded-[18px] border px-5.5 pt-5 pb-5.5">
      <p className="text-app-muted font-mono text-[10px] tracking-[0.14em] uppercase">
        {label}
      </p>
      <p className="text-app-ink mt-3 text-[20px] font-bold tracking-[-0.02em]">
        {value}
      </p>
      <p className="text-app-dim mt-1.5 text-[13px] leading-5 text-pretty">
        {meta}
      </p>
    </div>
  )
}

/**
 * The first thing someone sees who has never imported anything: what the four
 * steps are, and what the file may contain. Every figure comes from
 * /capabilities, so the promise on this screen and what the server will accept
 * cannot drift apart.
 */
export function ImportEmpty({
  capabilities,
  onNew,
}: {
  capabilities: ImportCapabilities
  onNew: () => void
}) {
  const { locale } = useLocale()
  const t = useImportT(importHistoryMessages)
  const count = useCount()
  const formats = capabilities.formats.join(', ').toUpperCase()
  const columns = capabilities.limits.maxColumns
  const perPart = capabilities.maxPhotosPerEntity

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv(capabilities, locale)], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'rozbirka-import-template.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="min-w-0">
      <section
        aria-label={t('howItWorks')}
        className="border-app-line bg-app-raised rounded-[20px] border px-6 py-12 sm:px-8 md:px-12 md:py-14"
      >
        <div className="max-w-[560px]">
          <p className="text-app-dim font-mono text-[11px] tracking-[0.16em] uppercase">
            {t('noImportsYet')}
          </p>
          <h2 className="mt-4.5 text-[26px] leading-[1.12] font-extrabold tracking-[-0.025em] text-pretty text-white sm:text-[30px]">
            {t('emptyHeadline')}
          </h2>
          <p className="text-app-muted mt-3.5 text-[15px] leading-[1.6] text-pretty">
            {t('emptyLede', { formats })}
          </p>
          <ol className="mt-7 grid gap-3.5">
            {STEPS.map((step) => (
              <Step
                hint={
                  step.num === '1'
                    ? t('stepUploadHintLimits', {
                        formats,
                        size: String(mib(capabilities.limits.maxBytes)),
                      })
                    : t(step.hint)
                }
                key={step.num}
                num={step.num}
                title={t(step.title)}
              />
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Button onClick={onNew} variant="primary">
              {t('uploadFile')}
            </Button>
            <Button onClick={downloadTemplate}>{t('downloadTemplate')}</Button>
          </div>
        </div>
      </section>

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">
        <Limit
          label={t('formats')}
          meta={
            columns === undefined
              ? t('formatsMeta', {
                  size: String(mib(capabilities.limits.maxBytes)),
                  rows: count(capabilities.limits.maxRows),
                })
              : t('formatsMetaColumns', {
                  size: String(mib(capabilities.limits.maxBytes)),
                  rows: count(capabilities.limits.maxRows),
                  columns: count(columns),
                })
          }
          value={formats}
        />
        <Limit
          label={t('photos')}
          meta={
            perPart === undefined
              ? t('photoLimitUnknown')
              : t('photoLimit', { count: String(perPart) })
          }
          value={t('byLink')}
        />
        <Limit
          label={t('whatWeDont')}
          meta={t('noMergeMeta')}
          value={t('noMerge')}
        />
      </div>
    </div>
  )
}
