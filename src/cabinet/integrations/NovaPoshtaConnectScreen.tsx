import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { X } from 'lucide-react'
import {
  Button,
  ConfirmDialog,
  Notice,
  useOptionalToast,
} from '@/components/app'
import type { CashRegister } from '@/api/cash'
import type {
  NovaPoshtaContact,
  NovaPoshtaCounterparty,
  NovaPoshtaDivision,
  NovaPoshtaSettlement,
} from '@/api/integrations'
import { novaPoshtaSetupApi } from '@/api/nova-poshta-setup'
import { normalizeApiProblem } from '@/api/errors'
import { useTenantSettings } from '@/auth/useTenantSettings'
import { useLocale, useT } from '@/i18n'
import { useCabinet } from '../CabinetContext'
import { cabinetPath } from '../cabinet-paths'
import { moduleLabel, navigationGroupLabel } from '../module-messages'
import { cabinetModules } from '../module-registry'
import { RedesignShell } from '../redesign-shell'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { IntegrationCrumbs } from './IntegrationsScreen'
import { NpChecks, type NpCheck } from './np-checks'
import { npConnectMessages } from './np-connect-messages'
import {
  KeyStep,
  PointStep,
  ReviewStep,
  SenderStep,
  TillStep,
} from './np-connect-steps'
import { npFormsMessages } from './np-forms-messages'
import {
  branchNumber,
  isRejectedKey,
  pendingSetup,
  pointFromCatalogue,
  problemCode,
  senderForm,
  setupConfiguration,
  useSetupProblem,
} from './np-setup-model'
import { integrationsMessages } from './integrations-messages'
import { forgetNovaPoshtaPresence } from '../nova-poshta-presence'
import { isNovaPoshtaAvailable } from './integration-labels'
import { NovaPoshtaUnavailable } from './nova-poshta-unavailable'

type Step = 0 | 1 | 2 | 3 | 4

const STEP_NAMES = [
  'stepKey',
  'stepSender',
  'stepTill',
  'stepPoint',
  'stepReview',
] as const

interface Session {
  id: string
  version: string
}

/**
 * Connecting Nova Poshta, as five steps on one page (module 46 §1).
 *
 * The key is checked first and Core keeps it in a setup session for an hour;
 * every later step reads the carrier's catalogues through that session, so
 * the browser never holds the key again and the integration stays untouched
 * until «Завершити підключення» applies everything at once.
 */
export function NovaPoshtaConnectScreen() {
  const cabinet = useCabinet()
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const replacingKey = searchParams.get('newKey') === '1'
  const integrationId = params['integrationId'] ?? ''
  const { locale } = useLocale()
  const t = useT(npConnectMessages)
  const tf = useT(npFormsMessages)
  const ti = useT(integrationsMessages)
  const toast = useOptionalToast()
  const problemText = useSetupProblem()
  const { countryCode } = useTenantSettings()
  const { requireLatestMutation } = useLatestMutationGuard(
    cabinetModules.integrations,
  )
  const tenant = cabinet.targetTenant
  const tenantId = tenant?.id ?? ''

  const [step, setStep] = useState<Step>(0)
  const [furthest, setFurthest] = useState<Step>(0)
  const [session, setSession] = useState<Session | null>(null)
  const [key, setKey] = useState('')
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keyNotice, setKeyNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<'key' | 'complete' | null>(null)
  const [completeError, setCompleteError] = useState<string | null>(null)
  const [exitOpen, setExitOpen] = useState(false)
  const [sender, setSender] = useState<NovaPoshtaCounterparty | null>(null)
  const [contact, setContact] = useState<NovaPoshtaContact | null>(null)
  const [till, setTill] = useState<CashRegister | null | undefined>(undefined)
  const [settlement, setSettlement] = useState<NovaPoshtaSettlement | null>(
    null,
  )
  const [division, setDivision] = useState<NovaPoshtaDivision | null>(null)
  const headingRef = useRef<HTMLHeadingElement | null>(null)
  const exitRef = useRef<HTMLButtonElement | null>(null)
  const firstRender = useRef(true)

  // A key verified on an earlier visit stays usable while its session lives:
  // the exit dialog promises the next visit starts from step 2.
  useEffect(() => {
    if (tenantId === '' || integrationId === '') return
    if (replacingKey) {
      pendingSetup.clear(tenantId, integrationId)
      return
    }
    const stored = pendingSetup.read(tenantId, integrationId)
    if (stored === null) return
    const controller = new AbortController()
    void novaPoshtaSetupApi
      .get(integrationId, stored, { signal: controller.signal })
      .then(
        (found) => {
          if (controller.signal.aborted) return
          if (
            found.state === 'Pending' &&
            Date.parse(found.expiresAt) > Date.now()
          ) {
            setSession({ id: found.id, version: found.version })
            setStep(1)
            setFurthest(1)
          } else pendingSetup.clear(tenantId, integrationId)
        },
        () => {
          if (!controller.signal.aborted)
            pendingSetup.clear(tenantId, integrationId)
        },
      )
    return () => controller.abort()
  }, [integrationId, replacingKey, tenantId])

  // Section 11: a new step puts focus on its heading.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
  }, [step])

  const go = (next: Step) => {
    setStep(next)
    setFurthest((current) => (next > current ? next : current))
  }

  const onTill = useCallback((next: CashRegister | null) => setTill(next), [])

  if (tenant === null) {
    return (
      <div className="rz-page">
        <p className="rz-muted m-0">{ti('pickBusinessOne')}</p>
      </div>
    )
  }

  const listPath = cabinetPath(tenant.slug, 'integrations')
  const crumb = (
    <IntegrationCrumbs
      current={tf('novaPoshta')}
      parents={[
        navigationGroupLabel('settings', locale) ?? '',
        moduleLabel('integrations', locale),
      ]}
    />
  )

  if (!isNovaPoshtaAvailable(countryCode)) {
    return (
      <RedesignShell crumb={crumb}>
        <NovaPoshtaUnavailable />
      </RedesignShell>
    )
  }

  const expire = () => {
    pendingSetup.clear(tenant.id, integrationId)
    setSession(null)
    setKeyNotice(t('sessionExpired'))
    go(0)
  }

  const verifyKey = async () => {
    const value = key.trim()
    if (value === '') {
      if (session !== null) go(1)
      return
    }
    if (busy !== null) return
    setBusy('key')
    setKeyError(null)
    setKeyNotice(null)
    try {
      requireLatestMutation()
      const started = await novaPoshtaSetupApi.begin(integrationId, value)
      if (session !== null) {
        // A new key may reach another cabinet: its senders are not ours.
        void novaPoshtaSetupApi
          .cancel(integrationId, session.id, session.version)
          .catch(() => undefined)
        setSender(null)
        setContact(null)
      }
      setSession({ id: started.id, version: started.version })
      pendingSetup.write(tenant.id, integrationId, started.id)
      setKey('')
      go(1)
    } catch (problem) {
      const normalized = normalizeApiProblem(problem)
      if (isRejectedKey(normalized)) setKeyError(t('keyRejected'))
      else setKeyNotice(problemText(problem))
    } finally {
      setBusy(null)
    }
  }

  const complete = async () => {
    if (
      busy !== null ||
      session === null ||
      sender === null ||
      contact === null ||
      till === undefined ||
      settlement === null ||
      division === null
    )
      return
    setBusy('complete')
    setCompleteError(null)
    try {
      requireLatestMutation()
      const configured = await novaPoshtaSetupApi.configure(
        integrationId,
        session.id,
        session.version,
        setupConfiguration(
          sender,
          contact,
          pointFromCatalogue(settlement, division),
          till?.id ?? null,
        ),
      )
      setSession({ id: configured.id, version: configured.version })
      await novaPoshtaSetupApi.complete(
        integrationId,
        configured.id,
        configured.version,
      )
      pendingSetup.clear(tenant.id, integrationId)
      forgetNovaPoshtaPresence()
      toast?.show({ tone: 'ok', message: t('connected') })
      void navigate(cabinetPath(tenant.slug, 'integrations', integrationId))
    } catch (problem) {
      if (problemCode(normalizeApiProblem(problem)) === 'np_setup_expired')
        expire()
      else setCompleteError(t('completeError'))
    } finally {
      setBusy(null)
    }
  }

  const leave = () => {
    if (step === 0 && session === null && key.trim() === '') {
      void navigate(
        replacingKey
          ? cabinetPath(tenant.slug, 'integrations', integrationId)
          : listPath,
      )
      return
    }
    setExitOpen(true)
  }

  const progressValue = (index: Step): string => {
    if (index === 0) return session === null ? '' : t('progressKey')
    if (index === 1)
      return sender === null || contact === null
        ? ''
        : `${contact.name} · ${senderForm(sender.name)}`
    if (index === 2)
      return till === undefined ? '' : till === null ? t('tillNone') : till.name
    if (index === 3)
      return settlement === null || division === null
        ? ''
        : `${settlement.name} · ${branchNumber(division.name)}`
    return ''
  }
  const progress: NpCheck[] = STEP_NAMES.map((name, index) => {
    const value = progressValue(index as Step)
    const done = index !== step && index < furthest && value !== ''
    return {
      label: `${String(index + 1)}. ${t(name)}`,
      value: index === step ? t('progressNow') : done ? value : '',
      state: index === step ? 'pending' : done ? 'ok' : 'none',
    }
  })

  const exitEffects = [
    ...(session === null
      ? []
      : [t(replacingKey ? 'replacementKeyAgain' : 'exitKeyKept')]),
    ...(sender === null ? [] : [t('exitSelectionLost')]),
  ]

  return (
    <RedesignShell
      actions={
        <Button onClick={leave} ref={exitRef} variant="quiet">
          <X aria-hidden />
          {t('exit')}
        </Button>
      }
      crumb={crumb}
    >
      <div className="grid min-w-0 gap-1">
        <p className="rz-eyebrow m-0">
          {t('stepOf', { step: String(step + 1), name: t(STEP_NAMES[step]) })}
        </p>
        <h1 className="rz-h-page">{t('title')}</h1>
      </div>

      {replacingKey && <Notice tone="info">{t('replacementNote')}</Notice>}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid min-w-0 gap-3.5">
          {step === 0 && (
            <KeyStep
              busy={busy === 'key'}
              error={keyError}
              headingRef={headingRef}
              notice={keyNotice}
              onChange={(value) => {
                setKey(value)
                setKeyError(null)
              }}
              onSubmit={() => void verifyKey()}
              value={key}
              verified={session !== null}
            />
          )}
          {step === 1 && session !== null && (
            <SenderStep
              contact={contact}
              headingRef={headingRef}
              integrationId={integrationId}
              onBack={() => go(0)}
              onContact={setContact}
              onNext={() => go(2)}
              onSender={(next) => {
                setSender(next)
                setContact(null)
              }}
              sender={sender}
              sessionId={session.id}
            />
          )}
          {step === 2 && (
            <TillStep
              headingRef={headingRef}
              onBack={() => go(1)}
              onChange={onTill}
              onNext={() => go(3)}
              till={till}
            />
          )}
          {step === 3 && session !== null && (
            <PointStep
              division={division}
              headingRef={headingRef}
              integrationId={integrationId}
              onBack={() => go(2)}
              onDivision={setDivision}
              onNext={() => go(4)}
              onSettlement={setSettlement}
              sessionId={session.id}
              settlement={settlement}
            />
          )}
          {step === 4 &&
            sender !== null &&
            contact !== null &&
            till !== undefined &&
            settlement !== null &&
            division !== null && (
              <ReviewStep
                busy={busy === 'complete'}
                contact={contact}
                error={completeError}
                headingRef={headingRef}
                onBack={() => go(3)}
                onChange={(target) => go(target)}
                onComplete={() => void complete()}
                point={pointFromCatalogue(settlement, division)}
                sender={sender}
                till={till}
              />
            )}
        </div>

        <section
          aria-labelledby="np-progress"
          className="rz-card hidden min-w-0 lg:block"
        >
          <header className="rz-card__head py-2.5">
            <div className="grid min-w-0 gap-0.5">
              <h2 className="rz-h-card" id="np-progress">
                {t('progressTitle')}
              </h2>
              <p className="rz-caption m-0 text-pretty">{t('progressHint')}</p>
            </div>
          </header>
          <div className="rz-card__body">
            <NpChecks items={progress} />
          </div>
        </section>
      </div>

      <ConfirmDialog
        confirmLabel={t('exitConfirm')}
        consequence={t(replacingKey ? 'replacementExit' : 'exitConsequence')}
        effects={exitEffects}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          exitRef.current?.focus()
        }}
        onConfirm={() => {
          setExitOpen(false)
          void navigate(
            replacingKey
              ? cabinetPath(tenant.slug, 'integrations', integrationId)
              : listPath,
          )
        }}
        onOpenChange={setExitOpen}
        open={exitOpen}
        title={t('exitTitle')}
      />
    </RedesignShell>
  )
}
