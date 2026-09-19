import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { Button, Notice, SkeletonRows } from '@/components/app'
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
import { ImportConfirmStep } from './import-confirm'
import { ImportConflict } from './import-conflict'
import { ImportFileStep } from './import-file'
import { ImportHistory } from './import-history'
import { ImportMappingStep } from './import-mapping'
import { ImportResultStep } from './import-result'
import { ImportReviewStep } from './import-review'
import {
  createMapping,
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
  'CSV або XLSX до 10 MiB. Перевірте, що система прочитала таблицю правильно.',
  'Зіставте колонки файлу з полями Розбірки. Спільні значення застосовуються до всіх рядків.',
  'Виберіть рядки для імпорту та вирішіть проблеми. Один рядок із кількістю 5 створює одну позицію з п’ятьма одиницями товару.',
  'Це те, що буде створено. Після запуску зміни виконуються у фоні.',
  'Стан роботи та результати рядків цього імпорту.',
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
  const location = useLocation()
  const { importId } = useParams<{ importId: string }>()
  // Leaving a finished import for a new one changes the route key and remounts
  // this screen, so "start over" has to travel with the navigation.
  const fresh = (location.state as { fresh?: boolean } | null)?.fresh === true
  const { requireLatestMutation } = useLatestMutationGuard(definition)
  const base = cabinetPath(cabinet.targetTenant!.slug, 'parts', 'imports')
  const [caps, setCaps] = useState<ImportCapabilities | null>(null),
    [history, setHistory] = useState<ImportStatus[]>([]),
    [historyPage, setHistoryPage] = useState(1),
    [historyTotal, setHistoryTotal] = useState(0)
  const [status, setStatus] = useState<ImportStatus | null>(null),
    [rows, setRows] = useState<ImportRow[]>([]),
    [step, setStep] = useState(importId || fresh ? 1 : 0)
  const [transfer, setTransfer] = useState<{
      loaded: number
      total: number
    } | null>(null),
    [busy, setBusy] = useState(false),
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
  const [conflict, setConflict] = useState<{
    mapping: ImportMapping | null
    validation: ImportValidation | null
  } | null>(null)
  const [validation, setValidation] = useState<ImportValidation | null>(null),
    [validated, setValidated] = useState<string[]>([]),
    [rowPage, setRowPage] = useState(1)
  const [rowTotal, setRowTotal] = useState(0)
  const [profiles] = useState<ImportProfile[]>([]),
    [profileName, setProfileName] = useState(''),
    [readSettings, setReadSettings] = useState(false)
  const lifetime = useRef<AbortController | null>(null),
    working = useRef(false),
    uploadKey = useRef(crypto.randomUUID()),
    uploadAbort = useRef<AbortController | null>(null),
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
    if (s.source && (s.source.warnings?.length || !s.source.fields?.length))
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
      // Keep what the confirmation was computed against: the conflict screen
      // is only useful if it can show the difference, not just the failure.
      setConflict({ mapping, validation })
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
      // Progress carries the counters without the source document, the mapping
      // or the rows; the whole record is only worth re-reading once the run has
      // actually moved on.
      void api.progress(status.id, { signal: c.signal }).then((p) => {
        if (c.signal.aborted || !live()) return
        const moved =
          p.status !== status.status ||
          p.revision !== status.revision ||
          p.report.status !== status.report?.status ||
          !p.execution !== !status.execution
        if (moved) {
          void loadImport(status.id, c.signal).catch(effectFailure)
          return
        }
        setStatus((current) =>
          current?.id !== p.id
            ? current
            : {
                ...current,
                errorCode: p.errorCode,
                execution:
                  current.execution && p.execution
                    ? { ...current.execution, ...p.execution }
                    : current.execution,
              },
        )
      }, effectFailure)
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
  const startOver = () => {
    void navigate(base, { state: { fresh: true } })
    setStatus(null)
    setRows([])
    setMapping(null)
    setFile(null)
    setStep(1)
  }
  const next = () => {
    if (step === 0) {
      startOver()
    } else if (step === 1 && status?.source) setStep(2)
    else if (step === 1 && file)
      void action(async (signal) => {
        const controller = new AbortController()
        uploadAbort.current = controller
        setTransfer({ loaded: 0, total: file.size })
        try {
          const uploaded = await api.upload(
            file,
            uploadKey.current,
            selection,
            {
              signal: AbortSignal.any([signal, controller.signal]),
              onProgress: (loaded, total) => {
                if (live()) setTransfer({ loaded, total })
              },
            },
          )
          if (!signal.aborted && !controller.signal.aborted)
            void navigate(`${base}/${uploaded.id}`)
        } finally {
          uploadAbort.current = null
          if (live()) setTransfer(null)
        }
      })
    else if (step === 2) void action(saveMapping)
    else if (step === 3) void action(validate)
    else if (step === 4 && canConfirm)
      void action(async (signal) => {
        try {
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
        } catch (e) {
          const p = normalizeApiProblem(e)
          const code = p.code ?? ''
          if (!/STALE|SCHEMA|CONFLICT/.test(code)) throw e
          // Nothing was created. The conflict screen promises to show what
          // changed, and that is only possible with the record as it is now —
          // so re-read it before handing over.
          setConflict({ mapping, validation })
          setError(issueText(code))
          setValidation(null)
          setValidated([])
          await refresh(status.id, signal)
          return
        }
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
        {step === 3 || step === 4 ? null : (
          <Button
            disabled={
              busy ||
              (step === 1 && !status?.source && !file) ||
              (step === 1 && !status?.source?.fields?.length) ||
              (step === 2 && !editable)
            }
            onClick={next}
            variant="primary"
          >
            {primary}
          </Button>
        )}
      </header>
      <div className="import-body">
        {step === 0 ? null : (
          <nav aria-label="Кроки імпорту" className="import-steps">
            {steps.slice(1).map((label, index) => {
              // The rail is the flow only: history is where the flow starts
              // from, not a step inside it, so it is numbered 1 through 5.
              const i = index + 1
              return (
                <span className="import-steps__item" key={label}>
                  <button
                    aria-current={step === i ? 'step' : undefined}
                    data-state={
                      step === i
                        ? status?.status === 'Failed'
                          ? 'failed'
                          : 'current'
                        : step > i
                          ? 'done'
                          : 'ahead'
                    }
                    disabled={
                      busy ||
                      (i > 1 && !status?.source?.fields?.length) ||
                      (i === 4 && !canConfirm) ||
                      (i === 5 && !status?.execution)
                    }
                    onClick={() => setStep(i)}
                    type="button"
                  >
                    <span>{i}</span>
                    {label}
                  </button>
                  {i < steps.length - 1 ? (
                    <span aria-hidden className="import-steps__arrow">
                      →
                    </span>
                  ) : null}
                </span>
              )
            })}
          </nav>
        )}
        <h1>{titles[step]}</h1>
        {step === 2 ? null : (
          <p className="import-description">
            {step === 1 && status?.status === 'Failed'
              ? 'Файл прочитати не вдалося. Нижче — що саме сталося й що можна зробити.'
              : step === 1 && transfer !== null
                ? transfer.loaded < transfer.total
                  ? 'Файл передається на сервер. Не закривайте вкладку до кінця передавання.'
                  : 'Файл на сервері. Читаємо структуру таблиці — це кілька секунд.'
                : descriptions[step]}
          </p>
        )}
        {error && !(step === 4 && conflict) ? (
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
            onNew={next}
            onPage={setHistoryPage}
            page={historyPage}
            total={historyTotal}
          />
        ) : null}
        {step === 1 ? (
          <ImportFileStep
            busy={busy}
            capabilities={caps}
            editable={editable}
            file={file}
            onChooseFile={chooseFile}
            onContinue={next}
            onReanalyze={(override) =>
              void action(async (signal) => {
                if (!status) return
                await api.analyze(
                  status.id,
                  status.revision,
                  override ?? selection,
                  { signal },
                )
                await refresh(status.id, signal)
                if (!signal.aborted) {
                  setMapping(null)
                  setSelected([])
                }
              })
            }
            onCancelTransfer={() => uploadAbort.current?.abort()}
            onSelection={setSelection}
            onToggleSettings={() => setReadSettings((value) => !value)}
            rows={rows}
            selection={selection}
            settingsOpen={readSettings}
            status={status}
            transfer={transfer}
          />
        ) : null}
        {step === 2 && status?.source ? (
          <ImportMappingStep
            busy={busy}
            capabilities={caps}
            editable={editable}
            mapping={mapping}
            onApplyProfile={(profile) =>
              void action(async (signal) => {
                const match = await api.matchProfile(status.id, profile.id, {
                  signal,
                })
                if (signal.aborted) return
                if (match.conflicts.length)
                  throw new Error(match.conflicts.join(', '))
                if (match.plan) {
                  changed()
                  setMapping(match.plan)
                }
              })
            }
            onClearProfile={() => {
              changed()
              setMapping(null)
            }}
            onContinue={next}
            onProfileName={setProfileName}
            onRule={mapRule}
            onSaveProfile={() =>
              void action(async (signal) => {
                await api.saveProfile(status.id, profileName, { signal })
              })
            }
            onSkip={(fileFieldId, skippedNow) => {
              changed()
              setMapping((current) => ({
                schemaVersion: caps.schemaVersion,
                version: current?.version ?? 0,
                rules: current?.rules ?? [],
                skippedFields: skippedNow
                  ? [...(current?.skippedFields ?? []), fileFieldId]
                  : (current?.skippedFields ?? []).filter(
                      (id) => id !== fileFieldId,
                    ),
              }))
            }}
            profileName={profileName}
            profiles={profiles}
            rows={rows}
            status={status}
          />
        ) : null}
        {step === 3 && status ? (
          <ImportReviewStep
            busy={busy}
            decisions={decisions}
            editable={editable}
            onContinue={next}
            onDecision={(rowId, decision) => {
              setDecisions((current) => ({ ...current, [rowId]: decision }))
              changed()
            }}
            onRowPage={setRowPage}
            onSelected={(next) => {
              setSelected(next)
              changed()
            }}
            rowPage={rowPage}
            rowTotal={rowTotal}
            rows={rows}
            selected={selected}
            validation={validation}
          />
        ) : null}
        {step === 4 && validation ? (
          <ImportConfirmStep
            busy={busy}
            mapping={mapping}
            onBack={() => setStep(3)}
            onCommit={next}
            rows={rows}
            selected={selected}
            validation={validation}
          />
        ) : step === 4 && status ? (
          <ImportConflict
            busy={busy}
            lastValidation={conflict?.validation ?? null}
            mine={conflict?.mapping ?? null}
            onRecheck={() =>
              void action(async (signal) => {
                const fresh = await refresh(status.id, signal)
                if (signal.aborted) return
                setConflict(null)
                setMapping(fresh.mapping)
                setStep(3)
              })
            }
            onSettings={() => {
              setConflict(null)
              setStep(2)
            }}
            status={status}
            theirs={status.mapping}
          />
        ) : null}
        {step === 5 && status ? (
          <ImportResultStep
            busy={busy}
            fileName={file?.name ?? null}
            onCancel={() =>
              void action(async (signal) => {
                apply(await api.cancel(status.id, status.revision, { signal }))
              })
            }
            onNewImport={startOver}
            onReport={() => {
              void download()
            }}
            onRetry={() =>
              void action(async (signal) => {
                apply(
                  await api.retry(
                    status.id,
                    status.revision,
                    status.execution?.id,
                    {
                      signal,
                    },
                  ),
                )
              })
            }
            onRetryReport={() =>
              void action(async (signal) => {
                await api.retryReport(status.id, status.revision, { signal })
                await refresh(status.id, signal)
              })
            }
            onRowPage={setRowPage}
            onSource={() =>
              void action(async (signal) => {
                const link = await api.sourceDownload(status.id, { signal })
                if (signal.aborted) return
                if (!link.url)
                  throw new Error(
                    link.status === 'Gone'
                      ? 'EXPIRED'
                      : 'IMPORT_SOURCE_UNAVAILABLE',
                  )
                window.open(link.url, '_blank', 'noopener,noreferrer')
              })
            }
            partHref={(partId) =>
              cabinetPath(cabinet.targetTenant!.slug, 'parts', partId)
            }
            partsHref={cabinetPath(cabinet.targetTenant!.slug, 'parts')}
            rowPage={rowPage}
            rowTotal={rowTotal}
            rows={rows}
            status={status}
          />
        ) : null}
      </div>
    </div>
  )
}
