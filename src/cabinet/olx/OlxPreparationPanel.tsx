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
import { createPortal } from 'react-dom'
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
  SearchPicker,
  SearchPickerOption,
  SearchPickerOptions,
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
import { Check, FileText, Pencil } from 'lucide-react'
import { normalizeApiProblem } from '@/api/errors'
import { partsApi, type PartDetail } from '@/api/parts'
import { useLocale, useT } from '@/i18n'
import { cn } from '@/lib/utils'
import { cabinetModules } from '../module-registry'
import { PartPriceEditor } from '../parts/PartPriceDrawer'
import { useLatestMutationGuard } from '../use-latest-mutation-guard'
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
import { emptyOlxContent } from './olx-prepare-content'
import type { OlxPartDraft } from './olx-part-oauth-return'

function isCompatibilityWithoutOptions(attribute: OlxAttribute) {
  return attribute.code === 'compatibility_list' && !attribute.values.length
}

function hasAttributeValue(values: string[] = []) {
  return values.some((value) => value.trim() !== '')
}

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

export function OlxPreparationPanel({
  id,
  partDetails,
  canEdit,
  startEditingDescription = false,
  page,
  partHref = null,
  expectedAdvertId = null,
  latestAdvert,
  actionsTarget,
  onPartSaved,
  onPublicationChange,
  onMutationBusy,
  draftRef,
  restoredDraft = null,
}: {
  id: string
  partDetails?: OlxDescriptionPart
  canEdit: boolean
  startEditingDescription?: boolean
  page?: { partAvailable: boolean; statusTarget: HTMLDivElement | null }
  partHref?: string | null
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
}) {
  const t = useT(olxLiveMessages)
  const { locale } = useLocale()
  const tp = useT(olxPublicationMessages)
  const checklistHeading = useId()
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
  const [failed, setFailed] = useState(false)
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
    void Promise.all([
      olxLiveApi.preparation(id, { signal: controller.signal }),
      olxLiveApi.categories({ signal: controller.signal }),
      publicationRequest,
    ]).then(
      ([preparation, categories, savedPublication]) => {
        if (controller.signal.aborted) return
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
        setContent({
          ...draft,
          contactName: settings?.contactName ?? draft.contactName,
          contactPhone: settings?.contactPhone ?? draft.contactPhone,
          cityId: cityId ?? null,
          districtId:
            settings?.cityId != null
              ? (settings.districtId ?? null)
              : (draft.districtId ?? null),
        })
        if (resumable && restoredDraft.city?.id === cityId) {
          setCity(restoredDraft.city)
        } else if (cityId && !savedPublication.advertId)
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
                  settings?.cityId == null
                )
                  setContent((value) => ({
                    ...value,
                    cityId: null,
                    districtId: null,
                  }))
              },
            )
      },
      () => {
        if (controller.signal.aborted) return
        setFailed(true)
        if (fullPage)
          void publicationRequest.then(
            (savedPublication) => {
              if (controller.signal.aborted) return
              setPublication(savedPublication)
              onPublicationChange?.(savedPublication)
            },
            () => undefined,
          )
      },
    )
    return () => controller.abort()
  }, [id, attempt, fullPage, onPublicationChange, restoredDraft])
  useEffect(() => {
    if (hasPublicationResult || !content.categoryId) return
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
  }, [content.categoryId, attributeAttempt, hasPublicationResult])
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
      if (!signal.aborted) setBusy(false)
    }
  }
  if (failed)
    return (
      <div className="grid min-w-0 gap-4">
        <ErrorState
          title={t('partError')}
          description={t('readError')}
          onRetry={() => {
            setFailed(false)
            setLoaded(null)
            setAttempt((x) => x + 1)
          }}
        />
        {page && publication && hasPublicationResult && (
          <OlxPublicationActions
            id={id}
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
  if (!loaded)
    return (
      <OlxPreparationSkeleton
        actionsTarget={actionsTarget}
        fullPage={fullPage}
      />
    )
  if (expectedAdvertId && publication?.advertId !== expectedAdvertId)
    return <Notice tone="warn">{tp('advertMismatch')}</Notice>
  const part = preview?.part ?? loaded.preparation.part
  const nameIssue = olxTitleLengthIssue(part.title)
  const useColumns = fullPage && !hasPublicationResult
  const compactSection = cn(useColumns && pageLayout.section)
  const sectionVariant = fullPage && !useColumns ? 'panel' : 'plain'
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
  const visibleProviderFields =
    publication?.error === 'OLX_WRITE_REJECTED'
      ? (publication.errorFields ?? []).filter((issue) => {
          const { field } = readOlxProviderIssue(issue)
          return (
            !editedProviderFields.includes(field) &&
            !(
              field.startsWith('attributes.') &&
              editedProviderFields.includes('category_id')
            )
          )
        })
      : []
  const providerIssues = visibleProviderFields.map(readOlxProviderIssue)
  function providerFieldError(...fields: string[]) {
    const messages = new Set(
      providerIssues
        .filter(({ field }) => fields.includes(field))
        .map(({ reason }) => tp(reason ?? 'provider_invalid')),
    )
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
    canEdit &&
    part.status === 'available' &&
    Boolean(
      publication &&
      !publication.advertId &&
      ['draft', 'rejected'].includes(publication.state),
    )
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
  return (
    <div
      ref={formFields}
      className={cn(
        'grid min-w-0',
        useColumns ? pageLayout.grid : fullPage ? 'gap-4' : 'gap-1',
      )}
    >
      {draftConflict && (
        <Notice tone="warn" className={cn(useColumns && pageLayout.feedback)}>
          {tp('returnDraftChanged')}
        </Notice>
      )}
      {remaining.length > 0 && (
        <Panel
          role="region"
          aria-labelledby={checklistHeading}
          className={cn(
            'grid gap-2 px-3 py-2.5',
            useColumns && pageLayout.feedback,
          )}
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
      )}
      {!hasPublicationResult && (
        <>
          <PreparationColumn page={fullPage}>
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
                <div data-olx-field="category" className="min-w-0">
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
                    hint={t(
                      loaded.preparation.suggestions.length > 0
                        ? 'categoryHint'
                        : 'noCategorySuggestions',
                    )}
                    error={providerFieldError('category_id')}
                    options={loaded.categories.map((item) => ({
                      value: String(item.id),
                      label: item.name,
                      description: item.path
                        .split(' / ')
                        .slice(0, -1)
                        .join(' / '),
                    }))}
                  />
                </div>
                {loaded.preparation.suggestions.length > 0 && (
                  <div>
                    <p className="rz-label mb-2">{t('suggestions')}</p>
                    <div className="grid gap-2">
                      {loaded.preparation.suggestions.map((item) => {
                        const selected =
                          content.categoryConfirmed &&
                          item.id === content.categoryId
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
                                {item.path
                                  .split(' / ')
                                  .slice(0, -1)
                                  .join(' / ')}
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
                        <AttributeField
                          attribute={attribute}
                          disabled={detailsDisabled}
                          error={providerFieldError(
                            `attributes.${attribute.code}`,
                          )}
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
                error={providerFieldError(
                  'attributes',
                  ...unmappedAttributeFields,
                )}
              />
            </SectionPanel>
          </PreparationColumn>
        </>
      )}
      <PreparationColumn page={useColumns}>
        {!hasPublicationResult && (
          <>
            <SectionPanel
              title={t('sellerDetails')}
              headingLevel={3}
              variant={sectionVariant}
              className={cn(
                compactSection,
                useColumns && pageLayout.firstSection,
              )}
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
                <Field
                  label={t('phone')}
                  error={providerFieldError('contact.phone')}
                >
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
                        value={
                          city
                            ? olxCityLabel(city)
                            : String(content.cityId ?? '')
                        }
                        readOnly
                      />
                    </Field>
                  ) : (
                    <OlxCityPicker
                      cityId={content.cityId ?? null}
                      fieldLabel={t('city')}
                      selectedLabel={city ? olxCityLabel(city) : t('choose')}
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
                      <div
                        data-olx-field="district"
                        className="min-w-0"
                        tabIndex={-1}
                      >
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
                  ...(cityDistricts?.items?.length
                    ? []
                    : ['location.district_id']),
                )}
              />
            </SectionPanel>
            <SectionPanel
              title={t('priceAndPhotos')}
              headingLevel={3}
              variant={useColumns ? 'plain' : 'panel'}
              className={compactSection}
              aside={fullPage ? editPriceAction : undefined}
            >
              <FactList columns={2} className={cn(fullPage && 'grid-cols-2')}>
                <Fact label={t('price')}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {fullPage && (part.price == null || part.price <= 0) ? (
                      <span className="text-state-warn">
                        {t('priceNotSet')}
                      </span>
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
                    setUnavailablePhotos((previous) =>
                      new Set(previous).add(url),
                    )
                  }}
                  label={t('photos')}
                  title={part.title}
                  layout="strip"
                />
              )}
              {blockedPhotos ? (
                <Notice tone="warn">{t('missingPhotos')}</Notice>
              ) : (
                photos.length === 0 && (
                  <p className="rz-caption m-0">{t('withoutPhotos')}</p>
                )
              )}
            </SectionPanel>
          </>
        )}
        {!showResult && (
          <SectionPanel
            title={t('advertContent')}
            headingLevel={3}
            variant={sectionVariant}
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
            <Field
              label={t('description')}
              required
              error={providerFieldError('description')}
              hint={t(
                usesCoreDescription ? 'coreDescriptionHint' : 'descriptionHint',
              )}
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
                  change(
                    { publicDescription: event.target.value },
                    'description',
                  )
                }
              />
            </Field>
            {canFillDescription && descriptionFailed && (
              <Notice tone="warn">{t('fillDescriptionFailed')}</Notice>
            )}

            {listingSettings?.descriptionSuffix && (
              <p className="rz-caption m-0">{t('listingSuffixHint')}</p>
            )}
            {!fullPage && canEdit && publication?.state === 'draft' && (
              <p className="rz-caption m-0">{t('ephemeral')}</p>
            )}
            {!hasPublicationResult && (preview !== null || previewFailed) && (
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
        )}
      </PreparationColumn>
      <div
        className={cn(
          !showResult && !fullPage && 'pt-3',
          useColumns && pageLayout.feedback,
        )}
      >
        {displayedPublication && (
          <OlxPublicationActions
            partAvailable={page?.partAvailable ?? part.status === 'available'}
            id={id}
            publication={
              displayedPublication.error === 'OLX_WRITE_REJECTED'
                ? {
                    ...displayedPublication,
                    errorFields: visibleProviderFields,
                  }
                : displayedPublication
            }
            editor={{
              content,
              preview,
              canEdit: canEdit && part.status === 'available',
              blocked: busy || partEditor !== null,
              actionsTarget,
              statusTarget: page?.statusTarget ?? null,
              result: showResult
                ? {
                    title: part.title,
                    category: loaded.categories.find(
                      ({ id }) => id === content.categoryId,
                    )?.name,
                    onEditDescription: () => setEditingDescription(true),
                    partHref,
                  }
                : null,
              onShowStatus: hasPublicationResult
                ? () => setEditingDescription(false)
                : undefined,
              checkAction: !hasPublicationResult &&
                preview?.issues.length !== 0 && (
                  <Button
                    variant={preview?.issues.length === 0 ? 'ghost' : 'primary'}
                    onClick={() => void check()}
                    disabled={
                      busy ||
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
        )}
      </div>
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

interface AttributeFieldProps {
  attribute: OlxAttribute
  disabled: boolean
  error?: string | undefined
  value: string[]
  onChange: (value: string[]) => void
}

function MultipleAttributePicker({
  attribute,
  disabled,
  error,
  value,
  onChange,
}: AttributeFieldProps) {
  const t = useT(olxLiveMessages)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const term = query.trim().toLocaleLowerCase()
  const options = attribute.values.filter(({ label }) =>
    label.toLocaleLowerCase().includes(term),
  )
  const selectedLabels = attribute.values
    .filter(({ code }) => value.includes(code))
    .map(({ label }) => label)

  return (
    <SearchPicker
      label={attribute.label}
      showLabel
      required={attribute.required}
      disabled={disabled}
      error={error}
      hint={t('multipleHint')}
      placeholder={t('searchAttribute')}
      resultsLabel={attribute.label}
      heading={attribute.label}
      count={options.length}
      headerHidden
      searchable={attribute.values.length > 7}
      triggerLabel={selectedLabels.join(', ') || t('choose')}
      query={query}
      onQueryChange={setQuery}
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) setQuery('')
      }}
      floating
      allowEmptyQuery
    >
      {options.length === 0 ? (
        <p className="rz-caption m-0 p-3" role="status">
          {t('noResults')}
        </p>
      ) : (
        <SearchPickerOptions label={attribute.label} multiple>
          {options.map(({ code, label }) => {
            const selected = value.includes(code)
            return (
              <SearchPickerOption
                key={code}
                label={label}
                selected={selected}
                aside={
                  selected ? (
                    <Check aria-hidden className="text-app-strong size-4" />
                  ) : null
                }
                onSelect={() =>
                  onChange(
                    selected
                      ? value.filter((item) => item !== code)
                      : [...value, code],
                  )
                }
              >
                {label}
              </SearchPickerOption>
            )
          })}
        </SearchPickerOptions>
      )}
    </SearchPicker>
  )
}

function AttributeField({
  attribute,
  disabled,
  error,
  value,
  onChange,
}: AttributeFieldProps) {
  const t = useT(olxLiveMessages)
  if (isCompatibilityWithoutOptions(attribute)) {
    const hasValue = hasAttributeValue(value)
    return (
      <div className="grid min-w-0 gap-2">
        <Field
          label={attribute.label}
          required={attribute.required}
          hint={t('compatibilityListHint')}
          error={hasValue ? t('compatibility_list_requires_catalog') : error}
        >
          <TextInput readOnly value={value.join(', ')} />
        </Field>
        {hasValue && (
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start"
            disabled={disabled}
            onClick={() => onChange([])}
          >
            {t('clearCompatibilityList')}
          </Button>
        )}
      </div>
    )
  }
  if (attribute.values.length > 0 && attribute.multiple)
    return (
      <MultipleAttributePicker
        attribute={attribute}
        disabled={disabled}
        error={error}
        value={value}
        onChange={onChange}
      />
    )
  if (attribute.values.length > 0 && !attribute.multiple)
    return (
      <SelectPicker
        label={attribute.label}
        showLabel
        required={attribute.required}
        disabled={disabled}
        error={error}
        searchable={attribute.values.length > 7}
        placeholder={t('choose')}
        value={value[0] ?? ''}
        onValueChange={(code) => onChange(code ? [code] : [])}
        options={[
          ...(attribute.required ? [] : [{ value: '', label: '—' }]),
          ...attribute.values.map(({ code, label }) => ({
            value: code,
            label,
          })),
        ]}
      />
    )
  return (
    <Field
      label={attribute.label}
      required={attribute.required}
      error={error}
      hint={attribute.multiple ? t('multipleTextHint') : undefined}
    >
      {attribute.multiple ? (
        <TextArea
          rows={3}
          maxLength={10000}
          value={value.join('\n')}
          onChange={(event) => onChange(event.target.value.split('\n'))}
        />
      ) : (
        <TextInput
          inputMode={attribute.numeric ? 'decimal' : 'text'}
          maxLength={1000}
          value={value[0] ?? ''}
          onChange={(event) =>
            onChange(event.target.value ? [event.target.value] : [])
          }
        />
      )}
    </Field>
  )
}
