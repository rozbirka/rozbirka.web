import { ImportReferencePicker } from './ImportReferencePicker'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Upload, ArrowLeft } from 'lucide-react'
import {
  Button,
  Card,
  Field,
  Notice,
  SelectInput,
  TextInput,
  SkeletonRows,
} from '@/components/app'
import {
  partImportsApi as api,
  type ImportCapabilities,
  type ImportStatus,
  type ImportRow,
  type ImportMapping,
  type ImportValidation,
  type ImportSelection,
  type ImportProfile,
} from '@/api/part-imports'
import { normalizeApiProblem } from '@/api/errors'
import { useCabinet } from '../CabinetContext'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { cabinetPath } from '../cabinet-paths'
import { ImportHistory } from './import-history'
import {
  createMapping,
  fieldLabels,
  valueLabels,
  statusLabels,
  issueText,
  isActiveImport,
  mayConfirm,
} from './import-model'
import './imports.css'

const steps = [
  'Історія',
  'Файл',
  'Налаштування',
  'Перевірка',
  'Підтвердження',
  'Виконання',
]
const titles = [
  'Імпорт запчастин',
  'Завантаження файлу',
  'Налаштування імпорту',
  'Перевірка даних',
  'Підтвердження',
  'Деталі імпорту',
]
const descriptions = [
  'Перенесення залишків із власної таблиці CSV або XLSX.',
  'CSV або XLSX до 10 МіБ. Перевірте, що система прочитала таблицю правильно.',
  'Зіставте колонки файлу з полями Розбірки. Спільні значення застосовуються до всіх рядків.',
  'Виберіть рядки для імпорту та вирішіть проблеми. Один рядок із кількістю 5 створює одну позицію з п’ятьма одиницями товару.',
  'Це те, що буде створено. Після запуску зміни виконуються у фоні.',
  'Стан роботи та результати рядків. Сторінку можна закрити — імпорт продовжиться.',
]
const draftStates = ['Uploaded', 'NeedsReview', 'Ready']
export function ImportScreen(props: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const { importId } = useParams()
  if (cabinet.status !== 'ready' || !cabinet.snapshot)
    return <SkeletonRows label="Перевіряємо доступ…" />
  if (!cabinet.snapshot.permissions.has('parts.manage'))
    return <Notice tone="warn">Недостатньо прав для імпорту</Notice>
  return (
    <ImportWorkspace
      key={`${cabinet.snapshot.tenantId}:${cabinet.snapshot.userId}:${cabinet.snapshot.generation}:${importId ?? 'history'}`}
      {...props}
    />
  )
}
function ImportWorkspace({ definition }: CabinetModuleScreenProps) {
  const cabinet = useCabinet()
  const navigate = useNavigate()
  const { importId } = useParams<{ importId: string }>()
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const base = cabinetPath(cabinet.targetTenant!.slug, 'parts', 'imports')
  const [advanced, setAdvanced] = useState(false)
  const [caps, setCaps] = useState<ImportCapabilities | null>(null),
    [history, setHistory] = useState<ImportStatus[]>([]),
    [historyPage, setHistoryPage] = useState(1),
    [historyTotal, setHistoryTotal] = useState(0)
  const [status, setStatus] = useState<ImportStatus | null>(null),
    [rows, setRows] = useState<ImportRow[]>([]),
    [step, setStep] = useState(importId ? 1 : 0)
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [file, setFile] = useState<File | null>(null)
  const [selection, setSelection] = useState<ImportSelection>({
    delimiter: ',',
    encoding: 'utf-8',
    headerRow: 1,
    startRow: 2,
  })
  const [mapping, setMapping] = useState<ImportMapping | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [decisions, setDecisions] = useState<Record<string, string>>({})
  const [validation, setValidation] = useState<ImportValidation | null>(null),
    [validated, setValidated] = useState<string[]>([]),
    [filter, setFilter] = useState('all'),
    [rowPage, setRowPage] = useState(1)
  const [rowTotal, setRowTotal] = useState(0)
  const [profiles, setProfiles] = useState<ImportProfile[]>([]),
    [profileName, setProfileName] = useState(''),
    [readSettings, setReadSettings] = useState(false)
  const lifetime = useRef<AbortController | null>(null),
    working = useRef(false),
    uploadKey = useRef(crypto.randomUUID()),
    commitKey = useRef(crypto.randomUUID()),
    version = useRef(''),
    statusRef = useRef<ImportStatus | null>(null)
  useEffect(() => {
    const c = new AbortController()
    lifetime.current = c
    return () => c.abort()
  }, [])
  const live = () => !lifetime.current?.signal.aborted
  function apply(s: ImportStatus) {
    if (!live()) return
    if (
      statusRef.current?.id === s.id &&
      statusRef.current.revision > s.revision
    )
      throw new Error('STALE_REVISION')
    const v = `${s.id}:${s.revision}:${s.previewVersion}`
    if (version.current !== v) {
      setValidation(null)
      setValidated([])
      version.current = v
    }
    statusRef.current = s
    setStatus(s)
    if (s.source?.warnings.length || (s.source && !s.source.fields.length))
      setReadSettings(true)
  }
  async function readRows(s: ImportStatus, signal: AbortSignal) {
    if (!s.source || s.status === 'Expired') {
      if (live()) setRows([])
      return []
    }
    const page = await api.rows(s.id, rowPage, false, { signal })
    if (
      page.revision !== s.revision ||
      page.previewVersion !== s.previewVersion
    )
      throw new Error('STALE_REVISION')
    if (!signal.aborted && live()) {
      setRows(page.items)
      setRowTotal(page.total)
    }
    return page.items
  }

  async function refresh(id: string, signal: AbortSignal, withRows = true) {
    const s = await api.status(id, { signal })
    if (signal.aborted || !live()) return s
    apply(s)
    if (withRows) await readRows(s, signal)
    return s
  }
  function failure(e: unknown) {
    if (!live()) return
    const p = normalizeApiProblem(e)
    if (p.kind === 'cancelled') return
    const code =
      p.code ??
      (e instanceof Error && /^[A-Z][A-Z0-9_]*$/.test(e.message)
        ? e.message
        : '')
    setError(code ? issueText(code) : p.message)
    if (/STALE|SCHEMA|CONFLICT/.test(code)) {
      setValidation(null)
      setValidated([])
    }
  }
  async function action(
    fn: (signal: AbortSignal) => Promise<void>,
    quota = false,
  ) {
    if (working.current) return
    working.current = true
    setBusy(true)
    setError(null)
    try {
      const scope = requireLatestMutation({ quota })
      const signal = AbortSignal.any([scope.signal, lifetime.current!.signal])
      await fn(signal)
    } catch (e) {
      failure(e)
    } finally {
      working.current = false
      if (live()) setBusy(false)
    }
  }
  const effectFailure = useEffectEvent(failure)
  const loadImport = useEffectEvent(refresh)
  useEffect(() => {
    const c = new AbortController()
    void api.capabilities({ signal: c.signal }).then((v) => {
      if (!c.signal.aborted) setCaps(v)
    }, effectFailure)
    return () => c.abort()
  }, [])
  useEffect(() => {
    if (!caps?.enabled) return
    const c = new AbortController()
    void api.list(historyPage, { signal: c.signal }).then((p) => {
      if (!c.signal.aborted) {
        setHistory(p.items)
        setHistoryTotal(p.total)
      }
    }, effectFailure)
    return () => c.abort()
  }, [caps?.enabled, historyPage, importId])
  useEffect(() => {
    if (!importId || !caps?.enabled) return
    const c = new AbortController()
    const timer = setTimeout(() => {
      void loadImport(importId, c.signal).then((s) => {
        if (c.signal.aborted) return
        setMapping(s.mapping)
        setSelection(
          s.source?.selection ?? {
            delimiter: ',',
            encoding: 'utf-8',
            headerRow: 1,
            startRow: 2,
          },
        )
        setSelected([])
        setDecisions({})
        setStep(
          s.execution ||
            (!draftStates.includes(s.status) && !isActiveImport(s.status))
            ? 5
            : s.mapping
              ? 3
              : 1,
        )
      }, effectFailure)
    }, 0)
    return () => {
      clearTimeout(timer)
      c.abort()
    }
  }, [importId, caps?.enabled])
  useEffect(() => {
    if (
      !status ||
      importId !== status.id ||
      (!isActiveImport(status.status) && status.report?.status !== 'Pending') ||
      busy
    )
      return
    const c = new AbortController()
    const timer = setTimeout(() => {
      void loadImport(status.id, c.signal).catch(effectFailure)
    }, 5000)
    return () => {
      clearTimeout(timer)
      c.abort()
    }
  }, [status, busy, importId])
  useEffect(() => {
    if (!statusRef.current || !importId) return
    const c = new AbortController()
    void loadImport(importId, c.signal).catch(effectFailure)
    return () => c.abort()
  }, [rowPage, importId])
  const changed = () => {
    setValidation(null)
    setValidated([])
  }
  const mapRule = (target: string, source: string, constant?: string) => {
    changed()
    setMapping((m) => {
      const rules = (m?.rules ?? []).filter((r) => r.target !== target)
      if (source || constant)
        rules.push({
          target,
          sources: source ? [source] : [],
          ...(constant ? { constant } : {}),
        })
      return {
        schemaVersion: caps!.schemaVersion,
        version: m?.version ?? 0,
        rules,
        skippedFields: (m?.skippedFields ?? []).filter(
          (id) => !rules.some((r) => r.sources.includes(id)),
        ),
      }
    })
  }
  const canConfirm =
    status &&
    mayConfirm(
      validation,
      status.revision,
      status.previewVersion,
      selected,
      validated,
    )
  const editable =
    !!status && draftStates.includes(status.status) && !!status.source
  const visible = rows.filter(
    (r) =>
      filter === 'all' ||
      (r.draft?.issues ?? []).some((i) =>
        filter === 'decision'
          ? i.severity === 'NeedsDecision'
          : i.severity !== 'Warning',
      ),
  )
  const chosenProblems = rows.filter(
    (r) =>
      selected.includes(r.rowId) &&
      (r.draft?.issues ?? []).some(
        (i) =>
          i.severity !== 'Warning' &&
          !(i.code === 'DUPLICATE_DECISION_REQUIRED' && decisions[r.rowId]),
      ),
  )
  const opts = (values: string[]) =>
    values.map((v) => (
      <option key={v} value={v}>
        {valueLabels[v] ?? v}
      </option>
    ))
  async function saveMapping(signal: AbortSignal) {
    if (!status || !caps) return
    const next = createMapping(
      caps.schemaVersion,
      status.mapping?.version ?? 0,
      caps.fields,
      {},
      {},
      mapping?.rules ?? [],
      mapping?.skippedFields ?? [],
    )
    await api.map(status.id, status.revision, next, { signal })
    const s = await refresh(status.id, signal)
    if (!signal.aborted) {
      setMapping(s.mapping)
      setSelected([])
      setDecisions({})
      setStep(3)
    }
  }
  async function validate(signal: AbortSignal) {
    if (!status) return
    const ids = [...selected]
    const v = await api.validate(
      status.id,
      {
        revision: status.revision,
        previewVersion: status.previewVersion,
        rowIds: ids,
        duplicateDecisions: decisions,
      },
      { signal },
    )
    const s = await refresh(status.id, signal)
    if (signal.aborted) return
    if (s.revision !== v.revision) throw new Error('STALE_REVISION')
    setValidation(v)
    setValidated(ids)
    commitKey.current = crypto.randomUUID()
    setStep(v.digest && v.invalidCount === 0 ? 4 : 3)
  }
  function chooseFile(f: File | undefined) {
    if (!f) return
    if (caps && f.size > caps.limits.maxBytes) {
      setError(issueText('FILE_LIMIT'))
      return
    }
    if (!/\.(csv|xlsx)$/i.test(f.name)) {
      setError('Оберіть файл CSV або XLSX.')
      return
    }
    setError(null)
    setFile(f)
    uploadKey.current = crypto.randomUUID()
    changed()
  }
  const download = () =>
    action(async (signal) => {
      const blob = await api.report(status!.id, { signal })
      if (signal.aborted) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'import-results.csv'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    })
  const primary =
    step === 0
      ? 'Новий імпорт'
      : step === 1
        ? status?.source
          ? 'Налаштувати імпорт'
          : 'Завантажити файл'
        : step === 2
          ? 'Перевірити дані'
          : step === 3
            ? 'До підтвердження'
            : step === 4
              ? 'Почати імпорт'
              : 'До історії'
  const next = () => {
    if (step === 0) {
      void navigate(base)
      setStatus(null)
      setRows([])
      setMapping(null)
      setFile(null)
      setStep(1)
    } else if (step === 1 && status?.source) setStep(2)
    else if (step === 1 && file)
      void action(async (signal) => {
        const uploaded = await api.upload(file, uploadKey.current, selection, {
          signal,
        })
        if (!signal.aborted) void navigate(`${base}/${uploaded.id}`)
      })
    else if (step === 2) void action(saveMapping)
    else if (step === 3) void action(validate)
    else if (step === 4 && canConfirm)
      void action(async (signal) => {
        await api.commit(
          status.id,
          {
            revision: status.revision,
            previewVersion: status.previewVersion,
            digest: validation!.digest!,
            key: commitKey.current,
          },
          { signal },
        )
        await refresh(status.id, signal)
        if (!signal.aborted) setStep(5)
      }, true)
    else if (step === 5) {
      void navigate(base)
      setStep(0)
    }
  }
  if (!caps)
    return error ? (
      <Notice tone="danger">{error}</Notice>
    ) : (
      <SkeletonRows label="Перевіряємо доступність імпорту…" />
    )
  if (!caps.enabled)
    return (
      <Notice tone="info">Імпорт поки недоступний для цього середовища.</Notice>
    )
  return (
    <div className="type-redesign import-workspace">
      <header className="import-top">
        <Button asChild>
          <Link to={cabinetPath(cabinet.targetTenant!.slug, 'parts')}>
            <ArrowLeft aria-hidden />
            До деталей
          </Link>
        </Button>
        <span className="import-caption">Склад · Імпорт запчастин</span>
        <div className="grow" />
        {step > 0 && step < 5 ? (
          <Button
            disabled={busy}
            onClick={() => {
              void navigate(base)
              setStep(0)
            }}
          >
            До історії
          </Button>
        ) : null}
        <Button
          variant="primary"
          disabled={
            busy ||
            (step === 1 && !status?.source && !file) ||
            (step === 1 && status?.source?.fields.length === 0) ||
            (step === 2 && !editable) ||
            (step === 3 && (!editable || selected.length === 0)) ||
            (step === 4 && !canConfirm)
          }
          onClick={next}
        >
          {primary}
        </Button>
      </header>
      <div className="import-body">
        {step === 0 ? null : (
          <nav className="import-steps" aria-label="Кроки імпорту">
            {steps.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-current={step === i ? 'step' : undefined}
                disabled={
                  busy ||
                  (i > 1 &&
                    (!status?.source || status.source.fields.length === 0)) ||
                  (i === 4 && !canConfirm) ||
                  (i === 5 && !status?.execution)
                }
                onClick={() => {
                  if (i === 0) void navigate(base)
                  setStep(i)
                }}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {label}
              </button>
            ))}
          </nav>
        )}
        <h1>{titles[step]}</h1>
        <p className="import-description">{descriptions[step]}</p>
        {error ? (
          <Notice
            tone="danger"
            action={
              status ? (
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(async (signal) => {
                      await refresh(status.id, signal)
                    })
                  }
                >
                  Оновити
                </Button>
              ) : undefined
            }
          >
            {error}
          </Notice>
        ) : null}
        {step === 0 ? (
          <ImportHistory
            capabilities={caps}
            imports={history}
            onOpen={(id) => {
              void navigate(`${base}/${id}`)
            }}
            onPage={setHistoryPage}
            page={historyPage}
            total={historyTotal}
          />
        ) : null}
        {step === 1 ? (
          <div className="import-columns">
            <div className="import-stack">
              <Card title="Таблиця запчастин">
                <label
                  className="import-drop"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    if (!status) chooseFile(e.dataTransfer.files[0])
                  }}
                >
                  <Upload aria-hidden />
                  <strong>Перетягніть CSV або XLSX</strong>
                  <span>або виберіть файл — до 10 МіБ</span>
                  <input
                    aria-label="Файл імпорту"
                    type="file"
                    accept=".csv,.xlsx"
                    disabled={busy || !!status}
                    onChange={(e) => chooseFile(e.target.files?.[0])}
                  />
                </label>
                {file ? <p className="mt-4">{file.name}</p> : null}
                {status ? (
                  <p className="mt-4 text-app-muted">
                    {statusLabels[status.status] ?? status.status} ·{' '}
                    {status.rowCount} рядків
                  </p>
                ) : null}
              </Card>
              {status?.source ? (
                <Card title="Що прочитала система">
                  <div className="import-table">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          {status.source.fields.map((f) => (
                            <th key={f.id}>{f.header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 3).map((r) => (
                          <tr key={r.rowId}>
                            <td>{r.sourceRow}</td>
                            {status.source!.fields.map((f) => (
                              <td key={f.id}>
                                {r.source.cells.find(
                                  (c) => c.column === f.column,
                                )?.raw ?? '—'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}
            </div>
            <Card title="Читання файлу">
              <p className="text-app-muted">
                Змінюйте налаштування, якщо дані прочитані неправильно.
              </p>
              {status?.source?.warnings.map((warning) => (
                <Notice key={warning} tone="warn">
                  {issueText(warning)}
                </Notice>
              ))}
              <Button onClick={() => setReadSettings((v) => !v)}>
                Налаштувати
              </Button>
              {readSettings ? (
                <div className="import-stack mt-4">
                  {status?.source ? (
                    <Field label="Аркуш">
                      <SelectInput
                        value={selection.sheet ?? ''}
                        onChange={(e) =>
                          setSelection((s) => ({ ...s, sheet: e.target.value }))
                        }
                      >
                        <option value="">Оберіть аркуш</option>
                        {status.source.tables.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  ) : null}
                  <Field label="Рядок заголовків">
                    <TextInput
                      type="number"
                      min={1}
                      value={selection.headerRow ?? 1}
                      onChange={(e) =>
                        setSelection((s) => ({
                          ...s,
                          headerRow: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Перший рядок даних">
                    <TextInput
                      type="number"
                      min={1}
                      value={selection.startRow ?? 2}
                      onChange={(e) =>
                        setSelection((s) => ({
                          ...s,
                          startRow: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Роздільник CSV">
                    <SelectInput
                      value={selection.delimiter}
                      onChange={(e) => {
                        setSelection((s) => ({
                          ...s,
                          delimiter: e.target.value,
                        }))
                        uploadKey.current = crypto.randomUUID()
                      }}
                    >
                      <option value=",">Кома</option>
                      <option value=";">Крапка з комою</option>
                      <option value={'\t'}>Табуляція</option>
                      <option value="|">Вертикальна риска</option>
                    </SelectInput>
                  </Field>
                  <Field label="Кодування CSV">
                    <SelectInput
                      value={selection.encoding}
                      onChange={(e) => {
                        setSelection((s) => ({
                          ...s,
                          encoding: e.target.value,
                        }))
                        uploadKey.current = crypto.randomUUID()
                      }}
                    >
                      {opts(caps.encodings)}
                    </SelectInput>
                  </Field>
                  {status?.source?.warnings.includes('HIDDEN_ROWS') ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selection.acceptHiddenRows ?? false}
                        onChange={(e) =>
                          setSelection((s) => ({
                            ...s,
                            acceptHiddenRows: e.target.checked,
                          }))
                        }
                      />
                      Підтверджую включення прихованих рядків
                    </label>
                  ) : null}
                  {status?.source?.warnings.includes('HIDDEN_COLUMNS') ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selection.acceptHiddenColumns ?? false}
                        onChange={(e) =>
                          setSelection((s) => ({
                            ...s,
                            acceptHiddenColumns: e.target.checked,
                          }))
                        }
                      />
                      Підтверджую включення прихованих колонок
                    </label>
                  ) : null}
                  {editable ? (
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void action(async (signal) => {
                          await api.analyze(
                            status.id,
                            status.revision,
                            selection,
                            { signal },
                          )
                          await refresh(status.id, signal)
                          if (!signal.aborted) {
                            setMapping(null)
                            setSelected([])
                          }
                        })
                      }
                    >
                      Прочитати ще раз
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          </div>
        ) : null}
        {step === 2 && status?.source ? (
          <div className="import-columns">
            <Card
              title="Зіставлення колонок"
              aside={
                <Button onClick={() => setAdvanced((v) => !v)}>
                  {advanced ? 'Основні поля' : 'Усі поля'}
                </Button>
              }
            >
              <div className="import-table">
                <table>
                  <thead>
                    <tr>
                      <th>Поле Розбірки</th>
                      <th>Колонка файлу</th>
                    </tr>
                  </thead>
                  <tbody>
                    {caps.fields
                      .filter(
                        (f) =>
                          advanced ||
                          [
                            'Name',
                            'Quantity',
                            'DesiredSalePrice',
                            'ExternalCode',
                          ].includes(f.id),
                      )
                      .map((f) => (
                        <tr key={f.id}>
                          <td>
                            {fieldLabels[f.id] ?? f.id}
                            {f.required ? (
                              <span className="text-brand"> *</span>
                            ) : null}
                          </td>
                          <td>
                            <SelectInput
                              aria-label={`Колонка: ${fieldLabels[f.id] ?? f.id}`}
                              value={
                                mapping?.rules.find((r) => r.target === f.id)
                                  ?.sources[0] ?? ''
                              }
                              onChange={(e) =>
                                mapRule(
                                  f.id,
                                  e.target.value,
                                  mapping?.rules.find((r) => r.target === f.id)
                                    ?.constant ?? undefined,
                                )
                              }
                            >
                              <option value="">Не з колонки</option>
                              {status.source!.fields.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.header || `Колонка ${c.column}`}
                                </option>
                              ))}
                            </SelectInput>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="import-stack mt-4">
                <h3>Колонки, які не імпортувати</h3>
                {status.source.fields
                  .filter(
                    (f) =>
                      !mapping?.rules.some((r) => r.sources.includes(f.id)),
                  )
                  .map((f) => (
                    <label key={f.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={mapping?.skippedFields.includes(f.id) ?? false}
                        onChange={(e) => {
                          changed()
                          setMapping((m) => ({
                            ...m!,
                            version: m?.version ?? 0,
                            schemaVersion: caps.schemaVersion,
                            rules: m?.rules ?? [],
                            skippedFields: e.target.checked
                              ? [...(m?.skippedFields ?? []), f.id]
                              : (m?.skippedFields ?? []).filter(
                                  (id) => id !== f.id,
                                ),
                          }))
                        }}
                      />
                      {f.header || f.id}
                    </label>
                  ))}
              </div>
            </Card>
            <div className="import-stack">
              <Card title="Спільні значення">
                <div className="import-stack">
                  {caps.fields
                    .filter(
                      (f) =>
                        advanced ||
                        [
                          'SourceType',
                          'Strategy',
                          'CarId',
                          'IntakeId',
                          'InventoryZoneId',
                          'EquipmentTypeId',
                          'Condition',
                          'CustomerId',
                          'ReserveQuantity',
                          'ReservePrice',
                          'OrderNotes',
                        ].includes(f.id),
                    )
                    .filter(
                      (f) =>
                        !mapping?.rules.find((r) => r.target === f.id)?.sources
                          .length,
                    )
                    .map((f) => (
                      <Field
                        key={f.id}
                        label={fieldLabels[f.id] ?? f.id}
                        required={f.required}
                      >
                        {f.allowed ? (
                          <SelectInput
                            value={
                              mapping?.rules.find((r) => r.target === f.id)
                                ?.constant ?? ''
                            }
                            onChange={(e) => mapRule(f.id, '', e.target.value)}
                          >
                            <option value="">Не вказувати</option>
                            {opts(f.allowed)}
                          </SelectInput>
                        ) : f.type === 'reference' ? (
                          <ImportReferencePicker
                            field={f.id}
                            value={
                              mapping?.rules.find((r) => r.target === f.id)
                                ?.constant ?? ''
                            }
                            onChange={(value) => mapRule(f.id, '', value)}
                          />
                        ) : (
                          <TextInput
                            value={
                              mapping?.rules.find((r) => r.target === f.id)
                                ?.constant ?? ''
                            }
                            onChange={(e) => mapRule(f.id, '', e.target.value)}
                            placeholder={undefined}
                          />
                        )}
                      </Field>
                    ))}
                </div>
              </Card>
              <Card title="Профіль імпорту">
                <div className="import-stack">
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async (signal) => {
                        const p = await api.profiles({ signal })
                        if (!signal.aborted) setProfiles(p)
                      })
                    }
                  >
                    Мої профілі
                  </Button>
                  {profiles.map((p) => (
                    <Button
                      key={p.id}
                      onClick={() =>
                        void action(async (signal) => {
                          const match = await api.matchProfile(
                            status.id,
                            p.id,
                            { signal },
                          )
                          if (signal.aborted) return
                          if (match.conflicts.length)
                            throw new Error(match.conflicts.join(', '))
                          if (match.plan) {
                            changed()
                            setMapping(match.plan)
                          }
                        })
                      }
                    >
                      {p.name}
                    </Button>
                  ))}
                  <Field label="Назва профілю">
                    <TextInput
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                  </Field>
                  <Button
                    disabled={busy || !status.mapping || !profileName.trim()}
                    onClick={() =>
                      void action(async (signal) => {
                        await api.saveProfile(status.id, profileName, {
                          signal,
                        })
                      })
                    }
                  >
                    Зберегти застосоване зіставлення
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        ) : null}
        {step === 3 ? (
          <>
            <div className="import-actions">
              {[
                ['all', 'Усі'],
                ['errors', 'З проблемами на сторінці'],
                ['decision', 'Рішення на сторінці'],
              ].map(([key, label]) => (
                <Button
                  key={key}
                  aria-pressed={filter === key}
                  onClick={() => {
                    setFilter(key!)
                    setRowPage(1)
                  }}
                >
                  {label}
                </Button>
              ))}
              <span className="grow" />
              <strong>{selected.length} вибрано</strong>
            </div>
            {chosenProblems.length ? (
              <Notice
                tone="warn"
                action={
                  <Button
                    onClick={() => {
                      setSelected((ids) =>
                        ids.filter(
                          (id) => !chosenProblems.some((r) => r.rowId === id),
                        ),
                      )
                      changed()
                    }}
                  >
                    Виключити проблемні рядки
                  </Button>
                }
              >
                {chosenProblems.length} рядків потребують рішення.
              </Notice>
            ) : null}
            <div className="import-actions">
              <Button
                disabled={!editable}
                onClick={() => {
                  setSelected((ids) => [
                    ...new Set([...ids, ...rows.map((r) => r.rowId)]),
                  ])
                  changed()
                }}
              >
                Обрати сторінку ({rows.length})
              </Button>
              <Button
                onClick={() => {
                  setSelected([])
                  changed()
                }}
              >
                Зняти вибір
              </Button>
            </div>
            <div className="import-table">
              <table>
                <thead>
                  <tr>
                    <th>Вибір</th>
                    <th>Майбутня запчастина</th>
                    <th>К-сть</th>
                    <th>Ціна</th>
                    <th>Стан рядка</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.rowId}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Обрати рядок ${r.sourceRow}`}
                          checked={selected.includes(r.rowId)}
                          disabled={!editable}
                          onChange={(e) => {
                            setSelected((ids) =>
                              e.target.checked
                                ? [...ids, r.rowId]
                                : ids.filter((id) => id !== r.rowId),
                            )
                            changed()
                          }}
                        />
                      </td>
                      <td>
                        {r.draft?.values['Name'] ?? 'Не зіставлено'}
                        <small>Рядок {r.sourceRow}</small>
                      </td>
                      <td>{r.draft?.values['Quantity'] ?? '—'}</td>
                      <td>{r.draft?.values['DesiredSalePrice'] ?? '—'}</td>
                      <td>
                        {r.draft?.issues.length ? (
                          r.draft.issues.map((i, n) => (
                            <div key={n}>
                              <span className="text-state-warn">
                                {fieldLabels[i.field] ?? i.field}:{' '}
                                {issueText(i.code)}
                              </span>
                              {i.code === 'DUPLICATE_DECISION_REQUIRED' ? (
                                <Button
                                  disabled={!!decisions[r.rowId]}
                                  onClick={() => {
                                    setDecisions((d) => ({
                                      ...d,
                                      [r.rowId]: 'create-separately',
                                    }))
                                    changed()
                                  }}
                                >
                                  {decisions[r.rowId]
                                    ? 'Створити окремо обрано'
                                    : 'Створити окремо'}
                                </Button>
                              ) : null}
                            </div>
                          ))
                        ) : r.draft ? (
                          <span className="text-state-ok">
                            Готовий до перевірки
                          </span>
                        ) : (
                          'Потрібне зіставлення'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="import-actions">
              <Button
                disabled={rowPage === 1}
                onClick={() => setRowPage((p) => p - 1)}
              >
                Назад
              </Button>
              <span>{rowPage}</span>
              <Button
                disabled={rowPage * 100 >= rowTotal}
                onClick={() => setRowPage((p) => p + 1)}
              >
                Далі
              </Button>
            </div>
            <p className="text-app-muted text-sm">
              Комірки не редагуються в імпорті. Виправляйте через зіставлення
              колонок, спільні значення або вихідний файл.
            </p>
          </>
        ) : null}
        {step === 4 && validation ? (
          <div className="import-columns">
            <Card title={`Буде створено ${validation.plannedParts} запчастин`}>
              <div className="import-stats">
                {[
                  ['Запчастин', validation.plannedParts],
                  ['Замовлень', validation.plannedOrders],
                  ['Нових клієнтів', validation.plannedCustomers],
                  ['Автомобілів', validation.plannedCars],
                  ['Партій', validation.plannedIntakes],
                  ['Фото', validation.plannedPhotos],
                  ['Виключено рядків', rowTotal - selected.length],
                ].map(([label, count]) => (
                  <div key={label}>
                    <span className="import-caption">{label}</span>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
              <Notice tone="info">
                Зупинка імпорту не видаляє вже створені дані.
              </Notice>
            </Card>
            <Card title="Налаштування імпорту">
              <p>
                {selected.length} обраних рядків. Перевірку виконано сервером.
              </p>
              <Button onClick={() => setStep(3)}>Назад до перевірки</Button>
            </Card>
          </div>
        ) : null}
        {step === 5 && status ? (
          <div className="import-columns">
            <div className="import-stack">
              <Card title={statusLabels[status.status] ?? status.status}>
                <div className="import-actions">
                  <strong className="text-4xl">
                    {status.execution?.committed ?? 0}
                  </strong>
                  <span>
                    з {status.execution?.selected ?? status.rowCount} вибраних
                    рядків створено
                  </span>
                </div>
                <progress
                  className="w-full"
                  value={status.execution?.committed ?? 0}
                  max={Math.max(
                    1,
                    status.execution?.selected ?? status.rowCount,
                  )}
                />
                <p className="mt-3 text-app-muted">
                  Помилки: {status.execution?.failed ?? 0}
                </p>
                {isActiveImport(status.status) ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async (signal) => {
                        apply(
                          await api.cancel(status.id, status.revision, {
                            signal,
                          }),
                        )
                      })
                    }
                  >
                    Зупинити імпорт
                  </Button>
                ) : null}
                {status.errorCode ? (
                  <Notice tone="warn">{issueText(status.errorCode)}</Notice>
                ) : null}
              </Card>
              <Card title="Результати рядків">
                <div className="import-stack">
                  {rows.map((r) => (
                    <div
                      key={r.rowId}
                      className="border-b border-app-line pb-3"
                    >
                      <strong>
                        {r.draft?.values['Name'] ?? `Рядок ${r.sourceRow}`}
                      </strong>
                      <p className="text-app-muted">
                        {r.executionStatus === 'Committed'
                          ? 'Запчастину створено'
                          : r.executionErrorCode
                            ? issueText(r.executionErrorCode)
                            : 'Очікує обробки'}
                      </p>
                      {r.partId ? (
                        <Link
                          className="text-brand"
                          to={cabinetPath(
                            cabinet.targetTenant!.slug,
                            'parts',
                            r.partId,
                          )}
                        >
                          До запчастини
                        </Link>
                      ) : null}
                    </div>
                  ))}
                </div>
                <div className="import-actions">
                  <Button
                    disabled={rowPage === 1}
                    onClick={() => setRowPage((p) => p - 1)}
                  >
                    Назад
                  </Button>
                  <Button
                    disabled={rowPage * 100 >= rowTotal}
                    onClick={() => setRowPage((p) => p + 1)}
                  >
                    Далі
                  </Button>
                </div>
              </Card>
            </div>
            <div className="import-stack">
              <Card title="CSV-звіт">
                <p className="text-app-muted">
                  Звіт готується окремо від імпорту й може стати доступним
                  пізніше.
                </p>
                <Button
                  disabled={busy || status.report?.status !== 'Ready'}
                  onClick={() => {
                    void download()
                  }}
                >
                  Завантажити звіт
                </Button>
                {status.report?.status === 'Failed' ? (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async (signal) => {
                        await api.retryReport(status.id, status.revision, {
                          signal,
                        })
                        await refresh(status.id, signal)
                      })
                    }
                  >
                    Повторити підготовку звіту
                  </Button>
                ) : null}
              </Card>
              {['Failed', 'Cancelled', 'CompletedWithErrors'].includes(
                status.status,
              ) &&
              (!status.execution ||
                rows.some((r) =>
                  ['Pending', 'RetryableFailure'].includes(
                    r.executionStatus ?? '',
                  ),
                )) ? (
                <Card title="Повтор">
                  <p className="text-app-muted">
                    Уже створені запчастини не дублюються. Повтор доступний для
                    рядків, які можна відновити.
                  </p>
                  <Button
                    disabled={busy}
                    onClick={() =>
                      void action(async (signal) => {
                        apply(
                          await api.retry(
                            status.id,
                            status.revision,
                            status.execution?.id,
                            { signal },
                          ),
                        )
                      })
                    }
                  >
                    Повторити
                  </Button>
                </Card>
              ) : null}
              <Card title="Можна закрити сторінку">
                <p className="text-app-muted">
                  Імпорт виконується у фоні. Закриття екрана не є скасуванням —
                  знайдіть імпорт в історії.
                </p>
              </Card>
              <Button
                disabled={busy}
                onClick={() =>
                  void action(async (signal) => {
                    await refresh(status.id, signal)
                  })
                }
              >
                Оновити стан
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
