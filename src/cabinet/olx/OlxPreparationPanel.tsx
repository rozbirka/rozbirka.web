import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Link } from 'react-router'
import {
  Amount,
  Button,
  Fact,
  FactList,
  ErrorState,
  Field,
  Notice,
  Panel,
  PhotoGrid,
  PanelFooter,
  SectionPanel,
  SelectPicker,
  Skeleton,
  SkeletonFields,
  TextArea,
  TextInput,
} from '@/components/app'
import {
  olxLiveApi,
  type OlxAttribute,
  type OlxAdvert,
  type OlxCategory,
  type OlxCity,
  type OlxDistrict,
  type OlxPreparation,
  type OlxPrepareContent,
  type OlxPreview,
  type OlxLivePublication,
} from '@/api/olx-live'
import { Check, ChevronRight, FileText, Pencil } from 'lucide-react'
import { normalizeApiProblem } from '@/api/errors'
import { partsApi, type PartDetail } from '@/api/parts'
import { useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { cabinetModules } from '../module-registry'
import { PartPriceEditor } from '../parts/PartPriceDrawer'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
import { tenantRequestScope } from '../tenant-request-scope'
import { olxBatchMessages } from './olx-batch-messages'
import { OlxAttributeField } from './OlxAttributeField'
import { OlxCityPicker } from './OlxCityPicker'
import { olxCityLabel } from './olx-city-label'
import {
  createOlxDescriptionDraft,
  type OlxDescriptionPart,
} from './olx-description-draft'
import {
  olxPublicationMessages,
  readOlxProviderIssue,
} from './olx-publication-messages'
import { olxIssueKeys, olxLiveMessages } from './olx-live-messages'
import { olxTitleLengthIssue } from './olx-title-length'
import { OlxPartNameEditor } from './OlxPartNameEditor'
import { OlxPublicationActions } from './OlxPublicationActions'
import {
  canPrepareOlxDraft,
  emptyOlxContent,
  hasAttributeValue,
  isCompatibilityWithoutOptions,
} from './olx-prepare-content'
import type { OlxPartDraft } from './olx-part-oauth-return'

const pageLayout = {
  grid: 'items-start gap-3 xl:grid-cols-2',
  firstSection: '[&>header]:min-h-11 [&>header]:items-center [&>header]:pt-0',
  section: '[&>header]:items-center [&>header]:pt-3 [&>div]:py-3',
  feedback: 'xl:col-span-2',
}

const minDescriptionLength = 80
const maxDescriptionLength = 9000
const focusableField =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled)'

function PreparationColumn({
  page,
  children,
}: {
  page: boolean
  children: ReactNode
}) {
  if (!page) return <>{children}</>
  return <Panel className="min-w-0 py-0">{children}</Panel>
}

interface QueueRepair {
  accountId: string
  jobRevision: string
  listingHref?: string | undefined
  providerFields: readonly string[] | null
  mutationSignal: () => AbortSignal
  onRetry: (revision: string, signal: AbortSignal) => Promise<void>
  retryFailure: (failure: unknown) => string
}

const previewFields: Readonly<Record<string, string>> = {
  category: 'category_id',
  advertiser: 'advertiser_type',
  contact: 'contact.name',
  phone: 'contact.phone',
  city: 'location.city_id',
  district: 'location.district_id',
  photos: 'images',
  currency: 'price',
}

function meaningfulAttributes(attributes: OlxPrepareContent['attributes']) {
  return Object.fromEntries(
    Object.entries(attributes)
      .map(([key, values]): [string, string[]] => [
        key,
        values.map((value) => value.trim()).filter(Boolean),
      ])
      .filter(([, values]) => values.length > 0)
      .sort(([left], [right]) => left.localeCompare(right)),
  )
}

function repairDraftKey(content: OlxPrepareContent) {
  return JSON.stringify({
    ...content,
    publicDescription: content.publicDescription.trim(),
    contactName: content.contactName.trim(),
    contactPhone: content.contactPhone.trim(),
    attributes: meaningfulAttributes(content.attributes),
  })
}

function draftField(content: OlxPrepareContent, field: string): unknown {
  if (field.startsWith('attributes.'))
    return (content.attributes[field.slice(11)] ?? [])
      .map((value) => value.trim())
      .filter(Boolean)
  switch (field) {
    case 'attributes':
      return meaningfulAttributes(content.attributes)
    case 'description':
      return content.publicDescription.trim()
    case 'category_id':
      return [content.categoryId, content.categoryConfirmed]
    case 'advertiser_type':
      return content.advertiserType
    case 'contact.name':
      return content.contactName.trim()
    case 'contact.phone':
      return content.contactPhone.trim()
    case 'contact':
      return [content.contactName.trim(), content.contactPhone.trim()]
    case 'location.city_id':
      return content.cityId ?? null
    case 'location.district_id':
      return content.districtId ?? null
    case 'location':
      return [content.cityId, content.districtId]
    default:
      return undefined
  }
}

export function OlxPreparationPanel({
  id,
  partDetails,
  canEdit,
  canSeeDiagnostics = false,
  startEditingDescription = false,
  page,
  partHref = null,
  expectedAccountId,
  expectedAdvertId = null,
  latestAdvert,
  actionsTarget,
  onPartSaved,
  onPublicationChange,
  onMutationBusy,
  draftRef,
  restoredDraft = null,
  repair,
}: {
  id: string
  partDetails?: OlxDescriptionPart
  canEdit: boolean
  canSeeDiagnostics?: boolean
  startEditingDescription?: boolean
  page?: {
    partAvailable: boolean
    quantityAvailable: number
    accountId: string | null
    canManage: boolean
  }
  partHref?: string | null
  expectedAccountId?: string
  expectedAdvertId?: string | null
  latestAdvert?:
    | (Pick<OlxAdvert, 'id' | 'status'> & { checkedAt: string })
    | null
  actionsTarget: HTMLDivElement | null
  onPartSaved?: (part: PartDetail) => void
  onPublicationChange?: (value: OlxLivePublication) => void
  onMutationBusy?: (busy: boolean) => void
  draftRef?: Ref<{ draft: OlxPartDraft | null; editingPartData: boolean }>
  restoredDraft?: OlxPartDraft | null
  repair?: QueueRepair
}) {
  const t = useT(olxLiveMessages)
  const tb = useT(olxBatchMessages)
  const repairing = repair !== undefined
  const [savedRepairContent, setSavedRepairContent] =
    useState<OlxPrepareContent | null>(null)
  const [repairError, setRepairError] = useState<string | null>(null)
  const { locale } = useLocale()
  const tp = useT(olxPublicationMessages)
  const checklistHeading = useId()
  const partDraftId = useId()
  const [mobileDraftExpanded, setMobileDraftExpanded] = useState(false)
  const formFields = useRef<HTMLDivElement>(null)
  const [editingDescription, setEditingDescription] = useState(
    startEditingDescription,
  )
  const [partEditor, setPartEditor] = useState<'name' | 'price' | null>(null)
  const [unavailablePhotos, setUnavailablePhotos] = useState<
    ReadonlySet<string>
  >(new Set())
  const priceTrigger = useRef<HTMLButtonElement>(null)
  const nameTrigger = useRef<HTMLButtonElement>(null)
  const returnToEditorTrigger = useRef<'name' | 'price' | null>(null)
  const previewResult = useRef<HTMLDivElement>(null)
  const descriptionInput = useRef<HTMLTextAreaElement>(null)
  const fillingDescription = useRef(false)
  const [descriptionPending, setDescriptionPending] = useState(false)
  const [descriptionFailed, setDescriptionFailed] = useState(false)
  const [loaded, setLoaded] = useState<{
    preparation: OlxPreparation
    categories: OlxCategory[]
  } | null>(null)
  const [publication, setPublication] = useState<OlxLivePublication | null>(
    null,
  )
  const [draftConflict, setDraftConflict] = useState(false)
  const [loadFailure, setLoadFailure] = useState<{
    categories: OlxCategory[]
    partAvailable: boolean
  } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [attributeAttempt, setAttributeAttempt] = useState(0)
  const [districtAttempt, setDistrictAttempt] = useState(0)
  const [content, setContent] = useState<OlxPrepareContent>(emptyOlxContent)
  const [attributes, setAttributes] = useState<{
    id: number
    items: OlxAttribute[] | null
    errorCode?: string
  } | null>(null)
  const [city, setCity] = useState<OlxCity | null>(null)
  const [districts, setDistricts] = useState<{
    id: number
    items: OlxDistrict[] | null
  } | null>(null)
  const [preview, setPreview] = useState<OlxPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const [editedProviderFields, setEditedProviderFields] = useState<string[]>([])
  const life = useRef<AbortController | null>(null)
  const submitting = useRef(false)
  const fullPage = page !== undefined
  const [draftActions, setDraftActions] = useState<HTMLDivElement | null>(null)
  const hasPublicationResult =
    publication?.advertId != null ||
    ['creating', 'unknown'].includes(publication?.state ?? '')
  const showResult = hasPublicationResult && !editingDescription
  useImperativeHandle(
    draftRef,
    () => ({
      draft:
        loaded && publication && (!hasPublicationResult || editingDescription)
          ? {
              content,
              revision: publication.revision ?? null,
              city,
              editingDescription,
            }
          : null,
      editingPartData: partEditor !== null,
    }),
    [
      loaded,
      publication,
      hasPublicationResult,
      content,
      city,
      editingDescription,
      partEditor,
    ],
  )

  useEffect(() => {
    const controller = new AbortController()
    life.current = controller
    const publicationRequest = olxLiveApi.publication(id, {
      signal: controller.signal,
    })
    if (repairing) {
      const tenant = tenantRequestScope.signal
      const abort = () => controller.abort()
      if (tenant.aborted) abort()
      else
        tenant.addEventListener('abort', abort, {
          once: true,
          signal: controller.signal,
        })
    }
    void Promise.allSettled([
      olxLiveApi.preparation(id, { signal: controller.signal }),
      olxLiveApi.categories({ signal: controller.signal }),
      publicationRequest,
    ]).then(([preparationResult, categoriesResult, publicationResult]) => {
      if (controller.signal.aborted) return
      if (
        preparationResult.status === 'rejected' ||
        categoriesResult.status === 'rejected' ||
        publicationResult.status === 'rejected'
      ) {
        const savedPublication =
          publicationResult.status === 'fulfilled'
            ? publicationResult.value
            : null
        setPublication(savedPublication)
        if (savedPublication) onPublicationChange?.(savedPublication)
        setLoadFailure({
          categories:
            categoriesResult.status === 'fulfilled'
              ? categoriesResult.value
              : [],
          partAvailable:
            preparationResult.status === 'fulfilled' &&
            preparationResult.value.part.status === 'available',
        })
        return
      }
      const { value: preparation } = preparationResult
      const { value: categories } = categoriesResult
      const { value: savedPublication } = publicationResult
      setLoaded({ preparation, categories })
      setPublication(savedPublication)
      setEditedProviderFields([])
      onPublicationChange?.(savedPublication)
      const resumable =
        restoredDraft !== null &&
        restoredDraft.revision === (savedPublication.revision ?? null)
      setDraftConflict(restoredDraft !== null && !resumable)
      const draft =
        (resumable ? restoredDraft.content : savedPublication.content) ??
        emptyOlxContent
      const settings = savedPublication.advertId
        ? null
        : preparation.listingSettings
      const cityId = settings?.cityId ?? draft.cityId
      const formContent = {
        ...draft,
        contactName: settings?.contactName ?? draft.contactName,
        contactPhone: settings?.contactPhone ?? draft.contactPhone,
        cityId: cityId ?? null,
        districtId:
          settings?.cityId != null
            ? (settings.districtId ?? null)
            : (draft.districtId ?? null),
      }
      setContent(formContent)
      if (repairing) setSavedRepairContent(formContent)
      if (resumable && restoredDraft.city?.id === cityId) {
        setCity(restoredDraft.city)
      } else if (cityId && (fullPage || !savedPublication.advertId))
        void olxLiveApi
          .city(cityId, {
            signal: controller.signal,
          })
          .then(
            (value) => {
              if (!controller.signal.aborted) setCity(value)
            },
            () => {
              if (
                !controller.signal.aborted &&
                !resumable &&
                !savedPublication.advertId &&
                settings?.cityId == null
              )
                setContent((value) => ({
                  ...value,
                  cityId: null,
                  districtId: null,
                }))
            },
          )
    })
    return () => controller.abort()
  }, [id, attempt, fullPage, onPublicationChange, restoredDraft, repairing])
  useEffect(() => {
    if ((!fullPage && hasPublicationResult) || !content.categoryId) return
    const controller = new AbortController()
    const category = content.categoryId
    void olxLiveApi.attributes(category, { signal: controller.signal }).then(
      (items) => {
        if (!controller.signal.aborted) setAttributes({ id: category, items })
      },
      (failure: unknown) => {
        if (!controller.signal.aborted) {
          const errorCode = normalizeApiProblem(failure).code
          setAttributes({
            id: category,
            items: null,
            ...(errorCode ? { errorCode } : {}),
          })
        }
      },
    )
    return () => controller.abort()
  }, [content.categoryId, attributeAttempt, hasPublicationResult, fullPage])
  useEffect(() => {
    if (!city) return
    const controller = new AbortController()
    void olxLiveApi.districts(city.id, { signal: controller.signal }).then(
      (items) => {
        if (!controller.signal.aborted) setDistricts({ id: city.id, items })
      },
      () => {
        if (!controller.signal.aborted)
          setDistricts({ id: city.id, items: null })
      },
    )
    return () => controller.abort()
  }, [city, districtAttempt])
  function clearProviderErrors(...fields: string[]) {
    if (publication?.error === 'OLX_WRITE_REJECTED' && fields.length > 0)
      setEditedProviderFields((previous) => [
        ...new Set([...previous, ...fields]),
      ])
  }

  function change(patch: Partial<OlxPrepareContent>, ...fields: string[]) {
    setContent((value) => ({ ...value, ...patch }))
    clearProviderErrors(...fields)
    setPreview(null)
    setPreviewFailed(false)
  }
  useEffect(() => {
    if (partEditor || !returnToEditorTrigger.current) return
    const trigger =
      returnToEditorTrigger.current === 'name' ? nameTrigger : priceTrigger
    returnToEditorTrigger.current = null
    trigger.current?.focus()
  }, [partEditor])
  useEffect(() => {
    if (preview || previewFailed)
      previewResult.current?.scrollIntoView?.({ block: 'nearest' })
  }, [preview, previewFailed])
  useEffect(() => {
    if (editingDescription && loaded) descriptionInput.current?.focus()
  }, [editingDescription, loaded])

  function selectCategory(value: number) {
    if (value === content.categoryId) {
      if (!content.categoryConfirmed) change({ categoryConfirmed: true })
      return
    }
    change(
      { categoryId: value, categoryConfirmed: true, attributes: {} },
      'category_id',
      'attributes',
    )
  }
  function closePartEditor() {
    returnToEditorTrigger.current = partEditor
    setPartEditor(null)
  }
  function updatePartSnapshot(saved: PartDetail) {
    clearProviderErrors(partEditor === 'name' ? 'title' : 'price')
    setLoaded(
      (current) =>
        current && {
          ...current,
          preparation: {
            ...current.preparation,
            part: {
              ...current.preparation.part,
              title: saved.name,
              price: saved.effectiveSalePrice ?? saved.desiredSalePrice ?? null,
              status: saved.status,
            },
          },
        },
    )
    setPreview(null)
    setPreviewFailed(false)
    onPartSaved?.(saved)
  }
  async function check() {
    const signal = life.current?.signal
    if (submitting.current || !signal || signal.aborted) return
    submitting.current = true
    setBusy(true)
    setPreviewFailed(false)
    try {
      const value = await olxLiveApi.preview(id, content, { signal })
      if (!signal.aborted) setPreview(value)
    } catch {
      if (!signal.aborted) {
        setPreview(null)
        setPreviewFailed(true)
      }
    } finally {
      submitting.current = false
      if (!signal.aborted) {
        setBusy(false)
      }
    }
  }
  const displayedPublication =
    publication &&
    latestAdvert &&
    latestAdvert.id === publication.advertId &&
    (!publication.checkedAt ||
      Date.parse(latestAdvert.checkedAt) > Date.parse(publication.checkedAt))
      ? {
          ...publication,
          observedStatus: latestAdvert.status,
          moderationReason:
            latestAdvert.status === publication.observedStatus
              ? (publication.moderationReason ?? null)
              : null,
          checkedAt: latestAdvert.checkedAt,
        }
      : publication
  if (
    (loaded || (loadFailure && publication)) &&
    expectedAdvertId &&
    publication?.advertId !== expectedAdvertId
  )
    return <Notice tone="warn">{tp('advertMismatch')}</Notice>
  if (loadFailure) {
    const retry = () => {
      setLoadFailure(null)
      setLoaded(null)
      setAttempt((x) => x + 1)
    }
    if (expectedAdvertId && displayedPublication?.advertId)
      return (
        <div className="grid min-w-0 gap-3">
          <OlxPublicationActions
            id={id}
            canSeeDiagnostics={canSeeDiagnostics}
            publication={displayedPublication}
            partAvailable={loadFailure.partAvailable}
            {...(expectedAccountId ? { expectedAccountId } : {})}
            result={{
              title: null,
              category: loadFailure.categories.find(
                ({ id }) => id === displayedPublication.content?.categoryId,
              )?.name,
              partHref,
              actionsTarget,
            }}
            onChange={(value) => {
              setPublication(value)
              onPublicationChange?.(value)
            }}
            onBusy={(value) => {
              setBusy(value)
              onMutationBusy?.(value)
            }}
          />
          <Notice
            tone="warn"
            action={
              <Button disabled={busy} onClick={retry}>
                {t('retry')}
              </Button>
            }
          >
            {t('editorLoadError')}
          </Notice>
        </div>
      )
    return (
      <div className="grid min-w-0 gap-4">
        <ErrorState
          title={t('partError')}
          description={t('readError')}
          onRetry={retry}
        />
        {page && publication && hasPublicationResult && (
          <OlxPublicationActions
            id={id}
            canSeeDiagnostics={canSeeDiagnostics}
            publication={publication}
            partAvailable={page.partAvailable}
            details={{ category: null, actionsTarget, close: null }}
            onChange={(value) => {
              setPublication(value)
              onPublicationChange?.(value)
            }}
            {...(onMutationBusy ? { onBusy: onMutationBusy } : {})}
          />
        )}
      </div>
    )
  }
  if (!loaded)
    return (
      <OlxPreparationSkeleton
        actionsTarget={actionsTarget}
        fullPage={fullPage}
      />
    )
  const part = preview?.part ?? loaded.preparation.part
  const nameIssue = olxTitleLengthIssue(part.title)
  const useColumns = fullPage
  const compactSection = cn(useColumns && pageLayout.section)
  const sectionVariant = 'plain'
  const listingSettings = loaded.preparation.listingSettings
  const defaults = publication?.advertId ? null : listingSettings
  const hasDefaultCity = defaults?.cityId != null
  const usesCoreDescription = part.publicDescription != null
  const descriptionValue = part.publicDescription ?? content.publicDescription
  const descriptionSuffix = listingSettings?.descriptionSuffix?.trim()
  const attrs = attributes?.id === content.categoryId ? attributes : null
  const invalidCompatibility =
    attrs?.items?.some(
      (attribute) =>
        isCompatibilityWithoutOptions(attribute) &&
        hasAttributeValue(content.attributes[attribute.code]),
    ) ?? false
  const cityDistricts = districts?.id === city?.id ? districts : null
  const rawProviderFields = !canSeeDiagnostics
    ? []
    : publication?.error === 'OLX_WRITE_REJECTED'
      ? (publication.errorFields ?? [])
      : repair &&
          publication &&
          (publication.revision === repair.jobRevision ||
            (publication.state === 'rejected' &&
              publication.submissionRevision === repair.jobRevision))
        ? (repair.providerFields ?? [])
        : []
  function lockedProviderField(field: string) {
    if (field === 'description') return usesCoreDescription
    if (field.startsWith('location')) return hasDefaultCity
    if (field === 'contact.name') return defaults?.contactName != null
    if (field === 'contact.phone') return defaults?.contactPhone != null
    if (field === 'contact')
      return defaults?.contactName != null && defaults.contactPhone != null
    return draftField(content, field) === undefined
  }
  const visibleProviderFields = rawProviderFields.filter((issue) => {
    const { field } = readOlxProviderIssue(issue)
    if (repair && savedRepairContent) {
      if (
        (field === 'attributes' || field.startsWith('attributes.')) &&
        content.categoryId !== savedRepairContent.categoryId
      )
        return false
      return (
        JSON.stringify(draftField(content, field)) ===
        JSON.stringify(draftField(savedRepairContent, field))
      )
    }
    return (
      !editedProviderFields.includes(field) &&
      !(
        field.startsWith('attributes.') &&
        editedProviderFields.includes('category_id')
      )
    )
  })
  const providerIssues = visibleProviderFields.map(readOlxProviderIssue)
  function providerFieldError(...fields: string[]) {
    const messages = new Set(
      providerIssues
        .filter(({ field }) => fields.includes(field))
        .map(({ reason }) => tp(reason ?? 'provider_invalid')),
    )
    if (repair || fullPage)
      for (const issue of preview?.issues ?? []) {
        const field =
          issue.code.startsWith('attribute_') ||
          issue.code.startsWith('compatibility_')
            ? `attributes.${issue.field}`
            : (previewFields[issue.field] ?? issue.field)
        if (fields.includes(field))
          messages.add(
            t(olxIssueKeys.find((code) => code === issue.code) ?? 'checkIssue'),
          )
      }
    return messages.size > 0 ? [...messages].join(' ') : undefined
  }
  const titleError = providerFieldError('title')
  const unmappedAttributeFields = providerIssues
    .map(({ field }) => field)
    .filter(
      (field) =>
        field.startsWith('attributes.') &&
        !attrs?.items?.some(({ code }) => field === `attributes.${code}`),
    )
  const photos = part.photos.filter((url) => !unavailablePhotos.has(url))
  const blockedPhotos = photos.length !== part.photos.length
  const canEditPartData =
    !repair &&
    canEdit &&
    part.status === 'available' &&
    Boolean(
      publication &&
      !publication.advertId &&
      ['draft', 'rejected'].includes(publication.state),
    )
  const repairAvailable =
    publication != null &&
    canPrepareOlxDraft(publication) &&
    publication.canWrite &&
    publication.revision != null &&
    !publication.excluded &&
    part.status === 'available'
  const detailsDisabled =
    busy ||
    !canEdit ||
    Boolean(publication && !['draft', 'rejected'].includes(publication.state))
  const canFillDescription =
    canEditPartData && !usesCoreDescription && !descriptionValue.trim()

  async function fillDescriptionFromPart() {
    const signal = life.current?.signal
    if (
      !canFillDescription ||
      busy ||
      !signal ||
      signal.aborted ||
      fillingDescription.current
    )
      return
    fillingDescription.current = true
    setDescriptionPending(true)
    setDescriptionFailed(false)
    try {
      const [details, compatibility] = await Promise.all([
        partDetails ?? partsApi.get(id, { signal }),
        partsApi.compatibilities(id, { signal }),
      ])
      const input = descriptionInput.current
      if (
        signal.aborted ||
        !input ||
        input.value.trim() ||
        input.readOnly ||
        input.disabled
      )
        return
      const text = createOlxDescriptionDraft(
        part.title,
        details,
        compatibility.items,
        locale,
        maxDescriptionLength -
          (descriptionSuffix ? descriptionSuffix.length + 2 : 0),
      )
      change({ publicDescription: text }, 'description')
      input.focus()
    } catch {
      if (!signal.aborted) setDescriptionFailed(true)
    } finally {
      fillingDescription.current = false
      if (!signal.aborted) setDescriptionPending(false)
    }
  }
  const remaining: { field: string; label: string }[] = []
  if (canEditPartData) {
    if (nameIssue) remaining.push({ field: 'name', label: t('reviewTitle') })
    if (!content.categoryId || !content.categoryConfirmed)
      remaining.push({ field: 'category', label: t('missingCategory') })
    for (const attribute of (content.categoryConfirmed ? attrs?.items : null) ??
      []) {
      if (
        attribute.required &&
        !hasAttributeValue(content.attributes[attribute.code])
      )
        remaining.push({
          field: `attribute:${attribute.code}`,
          label:
            attribute.code === 'state'
              ? t('missingState')
              : t('missingAttribute', { label: attribute.label }),
        })
    }
    if (
      content.advertiserType !== 'private' &&
      content.advertiserType !== 'business'
    )
      remaining.push({ field: 'advertiser', label: t('missingAdvertiser') })
    if (!content.contactName.trim())
      remaining.push({ field: 'contact', label: t('missingContact') })
    if (!content.cityId)
      remaining.push({ field: 'city', label: t('missingCity') })
    if (
      cityDistricts?.items?.length &&
      !cityDistricts.items.some(({ id }) => id === content.districtId)
    )
      remaining.push({ field: 'district', label: t('missingDistrict') })
    if (part.price == null || part.price <= 0)
      remaining.push({ field: 'price', label: t('missingPrice') })
    const description = descriptionValue.trim()
    const descriptionLength =
      description.length +
      (description && descriptionSuffix ? descriptionSuffix.length + 2 : 0)
    if (
      descriptionLength < minDescriptionLength ||
      descriptionLength > maxDescriptionLength
    )
      remaining.push({
        field: 'description',
        label: t(description ? 'reviewDescription' : 'missingDescription'),
      })
  }

  function focusField(field: string) {
    if (field === 'name' || field === 'price') {
      const trigger = field === 'name' ? nameTrigger : priceTrigger
      trigger.current?.scrollIntoView?.({ block: 'center' })
      setPartEditor(field)
      return
    }
    const target =
      field === 'description'
        ? descriptionInput.current
        : Array.from(
            formFields.current?.querySelectorAll<HTMLElement>(
              '[data-olx-field]',
            ) ?? [],
          ).find((element) => element.dataset['olxField'] === field)
    const control = target?.querySelector<HTMLElement>(focusableField) ?? target
    control?.scrollIntoView?.({ block: 'center' })
    control?.focus({ preventScroll: true })
  }
  const editPriceAction =
    canEditPartData && !partEditor ? (
      <Button
        ref={priceTrigger}
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={() => setPartEditor('price')}
      >
        <Pencil aria-hidden />
        {t('editPrice')}
      </Button>
    ) : undefined
  const needsRepair = providerIssues.some(
    ({ field }) => !lockedProviderField(field),
  )
  const checkDisabled =
    busy ||
    invalidCompatibility ||
    Boolean(content.categoryId && !attrs?.items) ||
    Boolean(city && !cityDistricts?.items)

  async function saveAndRetry() {
    const lifetime = life.current?.signal
    if (
      !repair ||
      !repairAvailable ||
      !publication?.revision ||
      preview?.issues.length !== 0 ||
      needsRepair ||
      checkDisabled ||
      submitting.current ||
      !lifetime ||
      lifetime.aborted
    )
      return
    submitting.current = true
    setBusy(true)
    onMutationBusy?.(true)
    setRepairError(null)
    let submittingRetry = false
    let signal = lifetime
    try {
      signal = AbortSignal.any([lifetime, repair.mutationSignal()])
      if (signal.aborted) return
      let saved = publication
      if (
        !savedRepairContent ||
        repairDraftKey(savedRepairContent) !== repairDraftKey(content)
      ) {
        saved = await olxLiveApi.saveDraft(id, content, publication.revision, {
          signal,
          expectedAccountId: repair.accountId,
        })
        if (signal.aborted) return
        setPublication(saved)
        setSavedRepairContent(content)
      }
      if (!saved.revision) throw new Error('Draft revision unavailable')
      submittingRetry = true
      await repair.onRetry(saved.revision, signal)
    } catch (error) {
      if (!signal.aborted) {
        const { code } = normalizeApiProblem(error)
        const affectedConnection =
          code === 'OLX_CONNECTION_CHANGED' ||
          code === 'OLX_NOT_CONNECTED' ||
          code === 'OLX_RECONNECT_REQUIRED' ||
          code === 'OLX_DRAFT_CHANGED' ||
          code === 'FORBIDDEN' ||
          code === 'OLX_WRITE_SCOPE_REQUIRED'
        setRepairError(
          submittingRetry || affectedConnection
            ? repair.retryFailure(error)
            : tb('repairSaveFailed'),
        )
      }
    } finally {
      submitting.current = false
      if (!signal.aborted) {
        setBusy(false)
        onMutationBusy?.(false)
      }
    }
  }

  const repairPartLink = partHref && (
    <Button asChild size="sm" variant="quiet">
      <Link to={partHref}>{tb('queueRepairOpenPart')}</Link>
    </Button>
  )
  if (repair && !repairAvailable)
    return (
      <Notice tone="warn" action={repairPartLink}>
        {tb('queueRepairUnavailable')}
      </Notice>
    )

  const descriptionField = (
    <Field
      label={t('description')}
      required
      error={providerFieldError('description')}
      hint={t(usesCoreDescription ? 'coreDescriptionHint' : 'descriptionHint')}
    >
      <TextArea
        ref={descriptionInput}
        disabled={
          busy ||
          !canEdit ||
          part.status !== 'available' ||
          !publication ||
          !['draft', 'rejected', 'linked', 'update_pending'].includes(
            publication.state,
          ) ||
          publication.removeRequested
        }
        rows={useColumns ? 4 : 5}
        maxLength={maxDescriptionLength}
        readOnly={usesCoreDescription}
        value={descriptionValue}
        onChange={(event) =>
          change({ publicDescription: event.target.value }, 'description')
        }
      />
    </Field>
  )

  const checklist =
    !repair && remaining.length > 0 ? (
      <Panel
        role="region"
        aria-labelledby={checklistHeading}
        className="grid gap-2 px-3 py-2.5"
      >
        <h3 className="rz-h-card" id={checklistHeading}>
          {t('remainingFields')}
        </h3>
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {remaining.map(({ field, label }) => (
            <li key={field} className="min-w-0 max-w-full">
              <Button
                size="sm"
                className="h-auto min-h-control max-w-full whitespace-normal text-left"
                disabled={
                  busy ||
                  (partEditor !== null &&
                    (field === 'name' || field === 'price'))
                }
                onClick={() => focusField(field)}
              >
                {label}
              </Button>
            </li>
          ))}
        </ul>
      </Panel>
    ) : null
  const sourceName = (
    <SectionPanel
      title={fullPage ? t('partName') : part.title}
      headingLevel={3}
      variant={fullPage ? 'plain' : 'panel'}
      {...(!fullPage ? { description: t('coreHint') } : {})}
      className={cn(
        compactSection,
        fullPage && pageLayout.firstSection,
        !fullPage &&
          !nameIssue &&
          !titleError &&
          partEditor !== 'name' &&
          '[&>div:last-child]:hidden',
      )}
      aside={
        canEditPartData && !partEditor ? (
          <Button
            ref={nameTrigger}
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => setPartEditor('name')}
          >
            <Pencil aria-hidden />
            {t('editName')}
          </Button>
        ) : undefined
      }
    >
      {fullPage && partEditor !== 'name' && (
        <p className="text-app-strong m-0 font-medium wrap-break-word">
          {part.title}
        </p>
      )}
      <ProviderFieldNotice error={titleError} />
      {fullPage && partEditor === 'name' && (
        <p className="rz-caption m-0">{t('coreHint')}</p>
      )}
      {partEditor === 'name' ? (
        <OlxPartNameEditor
          id={id}
          title={part.title}
          onPendingChange={(pending) => onMutationBusy?.(pending)}
          onClose={closePartEditor}
          onSaved={updatePartSnapshot}
        />
      ) : nameIssue ? (
        <Notice tone="danger" role="alert">
          {t(nameIssue.key, { count: nameIssue.count })}
        </Notice>
      ) : null}
    </SectionPanel>
  )
  const classification = (
    <SectionPanel
      title={t('classification')}
      headingLevel={3}
      variant="plain"
      className={compactSection}
    >
      <fieldset
        className={cn(
          'm-0 grid min-w-0 border-0 p-0',
          useColumns ? 'gap-3' : 'gap-4',
        )}
        disabled={detailsDisabled}
      >
        <div data-olx-field="category" className="min-w-0" tabIndex={-1}>
          <SelectPicker
            label={t('category')}
            showLabel
            required
            disabled={detailsDisabled}
            value={
              content.categoryConfirmed
                ? (content.categoryId?.toString() ?? '')
                : ''
            }
            onValueChange={(value) => selectCategory(Number(value))}
            placeholder={t('choose')}
            hint={
              !hasPublicationResult
                ? t(
                    loaded.preparation.suggestions.length > 0
                      ? 'categoryHint'
                      : 'noCategorySuggestions',
                  )
                : undefined
            }
            error={providerFieldError('category_id')}
            options={loaded.categories.map((item) => ({
              value: String(item.id),
              label: item.name,
              description: item.path.split(' / ').slice(0, -1).join(' / '),
            }))}
          />
        </div>
        {!repair &&
          !hasPublicationResult &&
          loaded.preparation.suggestions.length > 0 && (
            <div>
              <p className="rz-label mb-2">{t('suggestions')}</p>
              <div className="grid gap-2">
                {loaded.preparation.suggestions.map((item) => {
                  const selected =
                    content.categoryConfirmed && item.id === content.categoryId
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={selected}
                      className="rz-choice-card aria-pressed:border-brand aria-pressed:bg-brand-soft hover:not-aria-pressed:bg-app-hover text-app-strong w-full items-center justify-between text-left disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => selectCategory(item.id)}
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <span className="font-medium">{item.name}</span>
                        <span className="rz-caption text-app-muted">
                          {item.path.split(' / ').slice(0, -1).join(' / ')}
                        </span>
                      </span>
                      {selected && (
                        <Check
                          aria-hidden
                          className="text-brand-text size-5 shrink-0"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
      </fieldset>
      {content.categoryId &&
        (!attrs ? (
          <SkeletonFields count={2} label={t('loading')} />
        ) : attrs.items === null ? (
          <Notice
            tone="danger"
            action={
              <Button
                onClick={() => {
                  setAttributes(null)
                  setAttributeAttempt((x) => x + 1)
                }}
              >
                {t('retry')}
              </Button>
            }
          >
            {attrs.errorCode === 'OLX_RATE_LIMITED'
              ? tp('rateLimited')
              : attrs.errorCode === 'OLX_INVALID_CATEGORY'
                ? t('category_required')
                : t('categoryError')}
          </Notice>
        ) : (
          <fieldset
            disabled={detailsDisabled}
            className={cn(
              'm-0 grid min-w-0 border-0 p-0 md:grid-cols-2',
              useColumns ? 'gap-3' : 'gap-4',
            )}
          >
            {attrs.items.map((attribute) => (
              <div
                key={`${content.categoryId}:${attribute.code}`}
                data-olx-field={`attribute:${attribute.code}`}
                className="min-w-0"
                tabIndex={-1}
              >
                <OlxAttributeField
                  attribute={attribute}
                  disabled={detailsDisabled}
                  error={providerFieldError(`attributes.${attribute.code}`)}
                  value={content.attributes[attribute.code] ?? []}
                  onChange={(value) =>
                    change(
                      {
                        attributes: {
                          ...content.attributes,
                          [attribute.code]: value,
                        },
                      },
                      `attributes.${attribute.code}`,
                      'attributes',
                    )
                  }
                />
              </div>
            ))}
          </fieldset>
        ))}
      <ProviderFieldNotice
        error={providerFieldError('attributes', ...unmappedAttributeFields)}
      />
    </SectionPanel>
  )
  const seller = (
    <SectionPanel
      title={t('sellerDetails')}
      headingLevel={3}
      variant={sectionVariant}
      className={cn(compactSection, useColumns && pageLayout.firstSection)}
      aside={
        repair?.listingHref &&
        defaults &&
        (defaults.contactName != null ||
          defaults.contactPhone != null ||
          hasDefaultCity ||
          descriptionSuffix) && (
          <Button asChild size="sm" variant="quiet">
            <Link to={repair.listingHref}>{tb('queueRepairOpenSettings')}</Link>
          </Button>
        )
      }
      {...(defaults &&
      (defaults.contactName || defaults.contactPhone || defaults.cityId)
        ? { description: t('listingDefaultsHint') }
        : {})}
    >
      <fieldset
        className={cn(
          'm-0 grid min-w-0 border-0 p-0 md:grid-cols-2',
          useColumns ? 'gap-3' : 'gap-4',
        )}
        disabled={detailsDisabled}
      >
        <div data-olx-field="advertiser" className="min-w-0">
          <SelectPicker
            label={t('advertiser')}
            showLabel
            required
            disabled={detailsDisabled}
            searchable={false}
            placeholder={t('choose')}
            value={content.advertiserType}
            error={providerFieldError('advertiser_type')}
            onValueChange={(advertiserType) =>
              change({ advertiserType }, 'advertiser_type')
            }
            options={[
              { value: 'private', label: t('private') },
              { value: 'business', label: t('business') },
            ]}
          />
        </div>
        <Field
          label={t('contact')}
          required
          error={providerFieldError('contact.name')}
        >
          <TextInput
            data-olx-field="contact"
            maxLength={100}
            autoComplete="name"
            readOnly={defaults?.contactName != null}
            value={content.contactName}
            onChange={(event) =>
              change(
                { contactName: event.target.value },
                'contact.name',
                'contact',
              )
            }
          />
        </Field>
        <Field label={t('phone')} error={providerFieldError('contact.phone')}>
          <TextInput
            type="tel"
            maxLength={30}
            autoComplete="tel"
            readOnly={defaults?.contactPhone != null}
            value={content.contactPhone}
            onChange={(event) =>
              change(
                { contactPhone: event.target.value },
                'contact.phone',
                'contact',
              )
            }
          />
        </Field>
        <div data-olx-field="city" className="min-w-0">
          {hasDefaultCity ? (
            <Field
              label={t('city')}
              error={providerFieldError('location.city_id')}
            >
              <TextInput
                value={city ? olxCityLabel(city) : String(content.cityId ?? '')}
                readOnly
              />
            </Field>
          ) : (
            <OlxCityPicker
              cityId={content.cityId ?? null}
              fieldLabel={t('city')}
              selectedLabel={
                city
                  ? olxCityLabel(city)
                  : detailsDisabled && content.cityId
                    ? String(content.cityId)
                    : t('choose')
              }
              required
              disabled={detailsDisabled}
              error={providerFieldError('location.city_id')}
              load={olxLiveApi.cities}
              onPick={(value) => {
                setCity(value)
                if (value?.id !== content.cityId)
                  change(
                    { cityId: value?.id ?? null, districtId: null },
                    'location.city_id',
                    'location.district_id',
                    'location',
                  )
              }}
            />
          )}
        </div>
        {city &&
          (!cityDistricts ? (
            <SkeletonFields count={1} label={t('loading')} />
          ) : cityDistricts.items === null ? (
            <Notice
              tone="danger"
              action={
                <Button
                  onClick={() => {
                    setDistricts(null)
                    setDistrictAttempt((x) => x + 1)
                  }}
                >
                  {t('retry')}
                </Button>
              }
            >
              {t('districtError')}
            </Notice>
          ) : (
            cityDistricts.items.length > 0 && (
              <div data-olx-field="district" className="min-w-0" tabIndex={-1}>
                <SelectPicker
                  label={t('district')}
                  showLabel
                  required
                  disabled={hasDefaultCity || detailsDisabled}
                  error={providerFieldError('location.district_id')}
                  searchable={cityDistricts.items.length > 7}
                  placeholder={t('choose')}
                  value={content.districtId?.toString() ?? ''}
                  onValueChange={(value) =>
                    change(
                      { districtId: Number(value) || null },
                      'location.district_id',
                      'location',
                    )
                  }
                  options={cityDistricts.items.map((item) => ({
                    value: String(item.id),
                    label: item.name,
                  }))}
                />
              </div>
            )
          ))}
      </fieldset>
      <ProviderFieldNotice
        label={tp('fieldContact')}
        error={providerFieldError('contact')}
      />
      <ProviderFieldNotice
        label={tp('fieldLocation')}
        error={providerFieldError(
          'location',
          ...(cityDistricts?.items?.length ? [] : ['location.district_id']),
        )}
      />
    </SectionPanel>
  )
  const pricing = (
    <SectionPanel
      title={
        page && hasPublicationResult ? tp('partTabSource') : t('priceAndPhotos')
      }
      headingLevel={3}
      variant={useColumns ? 'plain' : 'panel'}
      className={compactSection}
      aside={fullPage ? editPriceAction : undefined}
    >
      <FactList columns={2} className={cn(fullPage && 'grid-cols-2')}>
        {page && hasPublicationResult && (
          <Fact label={t('partName')} className="col-span-2">
            {part.title}
          </Fact>
        )}
        <Fact label={t('price')}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {fullPage && (part.price == null || part.price <= 0) ? (
              <span className="text-state-warn">{t('priceNotSet')}</span>
            ) : (
              <Amount
                value={part.price}
                currency={part.currency ?? null}
                currencyDisplay="code"
              />
            )}
            {!fullPage && editPriceAction}
          </div>
        </Fact>
        <Fact label={t('photos')}>
          <span className="font-mono">{photos.length}</span>
        </Fact>
        {page && (
          <Fact label={tp('partTabAvailable')}>{page.quantityAvailable}</Fact>
        )}
      </FactList>
      <ProviderFieldNotice
        label={tp('fieldPrice')}
        error={providerFieldError('price')}
      />
      <ProviderFieldNotice
        label={tp('fieldPhotos')}
        error={providerFieldError('images')}
      />
      {fullPage && partEditor === 'price' && (
        <p className="rz-caption m-0">{t('coreHint')}</p>
      )}
      {partEditor === 'price' && (
        <OlxPartPriceEditor
          part={{
            id,
            name: part.title,
            status: part.status,
            desiredSalePrice: part.price ?? null,
            effectiveSalePrice: part.price ?? null,
          }}
          onPendingChange={(pending) => onMutationBusy?.(pending)}
          onClose={closePartEditor}
          onSaved={updatePartSnapshot}
        />
      )}
      {photos.length > 0 && (
        <PhotoGrid
          photos={photos.map((url) => ({
            id: url,
            url,
            alt: part.title,
          }))}
          onPhotoUnavailable={({ url }) => {
            setUnavailablePhotos((previous) => new Set(previous).add(url))
          }}
          label={t('photos')}
          title={part.title}
          layout="strip"
        />
      )}
      {blockedPhotos ? (
        <Notice tone="warn">{t('missingPhotos')}</Notice>
      ) : (
        photos.length === 0 &&
        (!page || !hasPublicationResult) && (
          <p className="rz-caption m-0">{t('withoutPhotos')}</p>
        )
      )}
    </SectionPanel>
  )
  const description = (
    <SectionPanel
      title={page ? tp('partTabDraft') : t('advertContent')}
      headingLevel={3}
      variant={sectionVariant}
      {...(page
        ? {
            description:
              hasPublicationResult && !publication?.advertId
                ? tp('partTabDraftLocked')
                : tp('partTabDraftHint'),
          }
        : {})}
      className={compactSection}
      aside={
        canFillDescription ? (
          <Button
            size="sm"
            disabled={busy || descriptionPending}
            aria-busy={descriptionPending}
            onClick={() => void fillDescriptionFromPart()}
          >
            <FileText aria-hidden />
            {t('fillDescriptionFromPart')}
          </Button>
        ) : undefined
      }
    >
      {descriptionField}
      {canFillDescription && descriptionFailed && (
        <Notice tone="warn">{t('fillDescriptionFailed')}</Notice>
      )}

      {listingSettings?.descriptionSuffix && (
        <p className="rz-caption m-0">{t('listingSuffixHint')}</p>
      )}
      {!fullPage && canEdit && publication?.state === 'draft' && (
        <p className="rz-caption m-0">{t('ephemeral')}</p>
      )}
      {(fullPage || !hasPublicationResult) &&
        (preview !== null || previewFailed) && (
          <div ref={previewResult}>
            {previewFailed && (
              <Notice tone="danger">{t('previewError')}</Notice>
            )}
            {preview && (
              <Notice block tone={preview.issues.length ? 'warn' : 'ok'}>
                <strong>
                  {preview.issues.length ? t('issues') : t('structureOk')}
                </strong>
                {preview.issues.length > 0 && (
                  <ul className="my-2 list-disc pl-5">
                    {preview.issues.map((issue, index) => (
                      <li key={`${issue.field}:${issue.code}:${index}`}>
                        {attrs?.items?.find((x) => x.code === issue.field)
                          ?.label
                          ? `${attrs.items.find((x) => x.code === issue.field)?.label}: `
                          : ''}
                        {t(
                          olxIssueKeys.find((x) => x === issue.code) ??
                            'checkIssue',
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="m-0 mt-2">{t('structureHint')}</p>
              </Notice>
            )}
          </div>
        )}
    </SectionPanel>
  )
  const publicationActions =
    !repair && displayedPublication ? (
      <OlxPublicationActions
        canSeeDiagnostics={canSeeDiagnostics}
        partAvailable={page?.partAvailable ?? part.status === 'available'}
        id={id}
        {...(expectedAccountId ? { expectedAccountId } : {})}
        publication={
          displayedPublication.error === 'OLX_WRITE_REJECTED'
            ? {
                ...displayedPublication,
                errorFields: visibleProviderFields,
              }
            : displayedPublication
        }
        {...(page
          ? {
              partPage: {
                accountId: page.accountId,
                canManage: page.canManage,
                category: loaded.categories.find(
                  ({ id }) => id === content.categoryId,
                )?.name,
                readiness: checklist,
              },
            }
          : {})}
        result={
          !page && showResult
            ? {
                title: expectedAdvertId ? null : part.title,
                category: loaded.categories.find(
                  ({ id }) => id === content.categoryId,
                )?.name,
                onEditDescription: () => setEditingDescription(true),
                partHref,
                actionsTarget,
              }
            : null
        }
        editor={{
          content,
          preview,
          canEdit: canEdit && part.status === 'available',
          blocked: busy || partEditor !== null,
          actionsTarget: page ? draftActions : actionsTarget,
          onShowStatus:
            !page && hasPublicationResult
              ? () => setEditingDescription(false)
              : undefined,
          checkAction: (page
            ? Boolean(
                publication &&
                ['draft', 'rejected', 'linked', 'update_pending'].includes(
                  publication.state,
                ),
              )
            : !hasPublicationResult && preview?.issues.length !== 0) && (
            <Button
              variant={
                fullPage || preview?.issues.length === 0 ? 'ghost' : 'primary'
              }
              onClick={() => void check()}
              disabled={
                busy ||
                page?.partAvailable === false ||
                partEditor !== null ||
                invalidCompatibility ||
                Boolean(content.categoryId && !attrs?.items) ||
                Boolean(city && !cityDistricts?.items)
              }
            >
              {busy ? t('loading') : t('preview')}
            </Button>
          ),
        }}
        onChange={(value) => {
          setPublication(value)
          if (
            value.revision !== publication?.revision ||
            value.error !== publication?.error
          )
            setEditedProviderFields([])
          if (
            value.error === 'OLX_WRITE_REJECTED' &&
            value.state === 'rejected'
          )
            setPreview(null)
          onPublicationChange?.(value)
        }}
        onBusy={(value) => {
          setBusy(value)
          onMutationBusy?.(value)
        }}
      />
    ) : null

  if (page) {
    const compactDraft =
      !mobileDraftExpanded &&
      publication?.state === 'linked' &&
      publication.observedStatus === 'active' &&
      !publication.error &&
      !publication.excluded
    const category = loaded.categories.find(
      ({ id }) => id === content.categoryId,
    )
    const condition = attrs?.items?.find(({ code }) => code === 'state')
    const conditionLabel = condition?.values.find(({ code }) =>
      content.attributes['state']?.includes(code),
    )?.label
    const draftRows = [
      {
        field: 'description',
        label: t('description'),
        value: tp('partTabDescriptionLength', {
          count: descriptionValue.length,
        }),
      },
      { field: 'category', label: t('category'), value: category?.name },
      condition && {
        field: 'attribute:state',
        label: condition.label,
        value: conditionLabel,
      },
      {
        field: 'contact',
        label: t('contact'),
        value: [content.contactName, city?.name].filter(Boolean).join(' · '),
      },
    ]
    return (
      <div ref={formFields} className="grid min-w-0 gap-3">
        {draftConflict && (
          <Notice tone="warn" className="lg:col-span-2">
            {tp('returnDraftChanged')}
          </Notice>
        )}
        {publication?.state === 'rejected' &&
          visibleProviderFields.length > 0 && (
            <Notice tone="danger">{tp('providerRejectedWithFields')}</Notice>
          )}
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22.5rem)]">
          <div className="contents lg:col-start-2 lg:row-start-1 lg:grid lg:min-w-0 lg:gap-3">
            <div className="order-1 min-w-0">{publicationActions}</div>
            <Panel
              role="region"
              aria-label={tp('partTabSource')}
              className="order-3 min-w-0 px-3 py-0"
            >
              {!hasPublicationResult && (
                <>
                  <h3 className="rz-h-card m-0 pt-3">{tp('partTabSource')}</h3>
                  {sourceName}
                </>
              )}
              {pricing}
            </Panel>
          </div>
          <Panel className="order-2 min-w-0 px-3 py-0 lg:col-start-1 lg:row-start-1">
            {compactDraft && (
              <div className="py-3 lg:hidden">
                <h3 className="rz-h-card mb-2">{tp('partTabDraft')}</h3>
                <div className="divide-app-line divide-y">
                  {draftRows.map((row) =>
                    row ? (
                      <Button
                        key={row.field}
                        variant="ghost"
                        className="w-full justify-between px-0 text-left whitespace-normal"
                        aria-controls={partDraftId}
                        aria-expanded={false}
                        onClick={() => {
                          flushSync(() => setMobileDraftExpanded(true))
                          focusField(row.field)
                        }}
                      >
                        <span>{row.label}</span>
                        <span className="text-app-muted flex min-w-0 items-center gap-1 text-right">
                          {row.value}
                          <ChevronRight aria-hidden className="shrink-0" />
                        </span>
                      </Button>
                    ) : null,
                  )}
                </div>
              </div>
            )}
            <div
              id={partDraftId}
              className={cn(compactDraft && 'hidden lg:block')}
            >
              {description}
              {classification}
              {seller}
              <PanelFooter className="px-0 [&:not(:has(button))]:hidden">
                <div ref={setDraftActions} className="contents" />
              </PanelFooter>
            </div>
          </Panel>
        </div>
      </div>
    )
  }

  return (
    <div ref={formFields} className={cn('grid min-w-0', 'gap-1')}>
      {draftConflict && (
        <Notice tone="warn" className={cn(useColumns && pageLayout.feedback)}>
          {tp('returnDraftChanged')}
        </Notice>
      )}
      {repair && (
        <>
          {visibleProviderFields.length > 0 && (
            <Notice tone="danger" block>
              <strong>{tb('queueRepairRejected')}</strong>
              <p className="m-0 mt-1">{tb('queueRepairHint')}</p>
            </Notice>
          )}
          <SectionPanel
            title={tb('queueRepairFromPart')}
            headingLevel={3}
            variant="plain"
            aside={repairPartLink}
          >
            <Field label={t('partName')} error={titleError}>
              <TextInput value={part.title} readOnly />
            </Field>
            <Field label={t('price')} error={providerFieldError('price')}>
              <div className="rz-input flex items-center">
                <Amount
                  value={part.price}
                  currency={part.currency ?? null}
                  currencyDisplay="code"
                />
              </div>
            </Field>
            <ProviderFieldNotice
              label={tp('fieldPhotos')}
              error={providerFieldError('images')}
            />
          </SectionPanel>
          <SectionPanel
            title={tb('queueRepairAdvert')}
            headingLevel={3}
            variant="plain"
          >
            {descriptionField}
            {descriptionSuffix && (
              <p className="rz-caption m-0">{t('listingSuffixHint')}</p>
            )}
          </SectionPanel>
        </>
      )}
      {!repair && checklist}
      {!hasPublicationResult && (
        <>
          {!repair && sourceName}
          {classification}
          {seller}
          {!repair && pricing}
        </>
      )}
      {!repair && !showResult && description}
      {repair && (
        <>
          {previewFailed && <Notice tone="danger">{t('previewError')}</Notice>}
          {preview && (
            <Notice tone={preview.issues.length > 0 ? 'warn' : 'ok'}>
              {preview.issues.length > 0
                ? t('issues')
                : needsRepair
                  ? tb('queueRepairHint')
                  : t('structureOk')}
            </Notice>
          )}
          {repairError && <Notice tone="danger">{repairError}</Notice>}
          {actionsTarget &&
            createPortal(
              <>
                <Button disabled={checkDisabled} onClick={() => void check()}>
                  {t('preview')}
                </Button>
                <Button
                  variant="primary"
                  disabled={
                    checkDisabled || preview?.issues.length !== 0 || needsRepair
                  }
                  onClick={() => void saveAndRetry()}
                >
                  {tb('queueRepairSubmit')}
                </Button>
              </>,
              actionsTarget,
            )}
        </>
      )}
      {!repair && publicationActions && (
        <div className={showResult ? undefined : 'pt-3'}>
          {publicationActions}
        </div>
      )}
    </div>
  )
}

function ProviderFieldNotice({
  error,
  label,
}: {
  error: string | undefined
  label?: string
}) {
  return error ? (
    <Notice tone="danger">
      <span>
        {label ? <strong>{label} · </strong> : null}
        {error}
      </span>
    </Notice>
  ) : null
}

function OlxPreparationSkeleton({
  actionsTarget,
  fullPage,
}: {
  actionsTarget: HTMLDivElement | null
  fullPage: boolean
}) {
  const t = useT(olxLiveMessages)
  const compactSection = cn(fullPage && pageLayout.section)
  return (
    <>
      <p role="status" className="sr-only">
        {t('loadingPreparation')}
      </p>
      <div
        aria-busy
        aria-label={t('loadingPreparation')}
        role="region"
        className={cn('grid min-w-0', fullPage ? pageLayout.grid : 'gap-1')}
      >
        <PreparationColumn page={fullPage}>
          <SectionPanel
            title={t('partName')}
            headingLevel={3}
            variant={fullPage ? 'plain' : 'panel'}
            className={cn(compactSection, fullPage && pageLayout.firstSection)}
          >
            <Skeleton className="w-48 max-w-full" />
          </SectionPanel>
          <SectionPanel
            title={t('classification')}
            headingLevel={3}
            variant="plain"
            className={compactSection}
          >
            <SkeletonFields count={1} />
            <Skeleton className="h-2 w-3/5" />
          </SectionPanel>
        </PreparationColumn>
        <PreparationColumn page={fullPage}>
          <SectionPanel
            title={t('sellerDetails')}
            headingLevel={3}
            variant="plain"
            className={cn(compactSection, fullPage && pageLayout.firstSection)}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <SkeletonFields count={2} />
              <SkeletonFields count={2} />
            </div>
          </SectionPanel>
          <SectionPanel
            title={t('priceAndPhotos')}
            headingLevel={3}
            variant={fullPage ? 'plain' : 'panel'}
            className={compactSection}
          >
            <SkeletonFields count={2} />
          </SectionPanel>
          <SectionPanel
            title={t('advertContent')}
            headingLevel={3}
            variant="plain"
            className={compactSection}
          >
            <Skeleton className="w-28" />
            <Skeleton className="h-28 w-full" />
          </SectionPanel>
        </PreparationColumn>
      </div>
      {actionsTarget &&
        createPortal(
          <>
            <Skeleton className="h-control w-36" />
            <Skeleton className="h-control w-32" />
          </>,
          actionsTarget,
        )}
    </>
  )
}

function OlxPartPriceEditor(
  props: Omit<ComponentProps<typeof PartPriceEditor>, 'beforeSave' | 'inline'>,
) {
  const { requireLatestMutation } = useLatestMutationGuard(cabinetModules.parts)
  return (
    <PartPriceEditor
      {...props}
      inline
      beforeSave={() => requireLatestMutation({ quota: false })}
    />
  )
}
