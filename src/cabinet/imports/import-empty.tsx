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
    <li className="flex items-start gap-3">
      <span aria-hidden className="rz-steps__n mt-px flex-none">
        {num}
      </span>
      <span className="min-w-0">
        <span className="text-app-strong block font-semibold">{title}</span>
        <span className="text-app-muted mt-0.5 block text-pretty">{hint}</span>
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
    <div className="rz-kpi">
      <p className="rz-kpi__label m-0">{label}</p>
      <p className="text-app-strong m-0 text-title font-semibold">{value}</p>
      <p className="rz-kpi__meta m-0 text-pretty">{meta}</p>
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
    <div className="grid min-w-0 gap-3">
      <section aria-label={t('howItWorks')} className="rz-card">
        <div className="rz-card__body grid max-w-[560px] gap-4 py-8">
          <div className="grid gap-2">
            <p className="rz-eyebrow m-0">{t('noImportsYet')}</p>
            <h2 className="rz-h-title text-pretty">{t('emptyHeadline')}</h2>
            <p className="text-app-muted m-0 text-pretty">
              {t('emptyLede', { formats })}
            </p>
          </div>
          <ol className="m-0 grid list-none gap-3 p-0">
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
          <div className="rz-btn-row">
            <Button onClick={onNew} variant="primary">
              {t('uploadFile')}
            </Button>
            <Button onClick={downloadTemplate}>{t('downloadTemplate')}</Button>
          </div>
        </div>
      </section>

      <div className="rz-kpis">
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
