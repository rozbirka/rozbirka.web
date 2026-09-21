import { Button } from '@/components/app'
import type { ImportCapabilities } from '@/api/part-imports'
import { fieldLabels } from './import-model'

const STEPS = [
  {
    num: '1',
    title: 'Завантажте файл',
    hint: 'Ми прочитаємо рядки й покажемо перші з них.',
  },
  {
    num: '2',
    title: 'Зіставте колонки',
    hint: 'Вкажіть, де назва, кількість і ціна. Решту можна задати спільним значенням.',
  },
  {
    num: '3',
    title: 'Перевірте рядки',
    hint: 'Виключіть проблемні або виправте налаштування. Нічого не створюється, поки не підтвердите.',
  },
  {
    num: '4',
    title: 'Запустіть імпорт',
    hint: 'Робота йде у фоні — сторінку можна закрити й повернутися до результату.',
  },
] as const

const mib = (bytes: number) => Math.round(bytes / (1024 * 1024))

const count = (value: number) =>
  value.toLocaleString('uk-UA').replace(/\u00a0/g, ' ')

/**
 * A header row named after the fields this server actually declares, required
 * ones first. There is no template endpoint, and inventing a fixed list of
 * columns would go stale the moment the import schema gains a field — this one
 * cannot, because it is built from /capabilities.
 */
function templateCsv(capabilities: ImportCapabilities) {
  const named = capabilities.fields.map((field) => ({
    ...field,
    label: fieldLabels[field.id] ?? field.id,
  }))
  const ordered = [
    ...named.filter((field) => field.required),
    ...named.filter((field) => !field.required),
  ]
  // A leading BOM so Excel opens a Ukrainian header row as UTF-8 rather than
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
  const formats = capabilities.formats.join(', ').toUpperCase()
  const columns = capabilities.limits.maxColumns
  const perPart = capabilities.maxPhotosPerEntity

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv(capabilities)], {
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
        aria-label="Як працює імпорт"
        className="border-app-line bg-app-raised rounded-[20px] border px-6 py-12 sm:px-8 md:px-12 md:py-14"
      >
        <div className="max-w-[560px]">
          <p className="text-app-dim font-mono text-[11px] tracking-[0.16em] uppercase">
            Імпортів ще не було
          </p>
          <h2 className="mt-4.5 text-[26px] leading-[1.12] font-extrabold tracking-[-0.025em] text-pretty text-white sm:text-[30px]">
            Завантажте таблицю — і склад наповниться за кілька хвилин
          </h2>
          <p className="text-app-muted mt-3.5 text-[15px] leading-[1.6] text-pretty">
            Підійде будь-який файл {formats} з назвами деталей і кількістю. Ви
            самі пояснюєте, що означає кожна колонка, і бачите повний перелік
            майбутніх записів до того, як щось буде створено.
          </p>
          <ol className="mt-7 grid gap-3.5">
            {STEPS.map((step) => (
              <Step
                hint={
                  step.num === '1'
                    ? `${formats} до ${String(mib(capabilities.limits.maxBytes))} MiB. ${step.hint}`
                    : step.hint
                }
                key={step.num}
                num={step.num}
                title={step.title}
              />
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-2.5">
            <Button onClick={onNew} variant="primary">
              Завантажити файл
            </Button>
            <Button onClick={downloadTemplate}>Завантажити шаблон CSV</Button>
          </div>
        </div>
      </section>

      <div className="mt-3.5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">
        <Limit
          label="Формати"
          meta={`до ${String(mib(capabilities.limits.maxBytes))} MiB, до ${count(capabilities.limits.maxRows)} рядків${columns === undefined ? '' : ` і ${count(columns)} колонок`}`}
          value={formats}
        />
        <Limit
          label="Фото"
          meta={
            perPart === undefined
              ? 'Ліміт фото для цього середовища невідомий.'
              : `Посилання з вашої таблиці · до ${String(perPart)} фото на позицію`
          }
          value="За посиланням"
        />
        <Limit
          label="Що не робимо"
          meta="Схожі позиції не зливаються автоматично — рішення за вами"
          value="Не обʼєднуємо"
        />
      </div>
    </div>
  )
}
