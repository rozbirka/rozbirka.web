import { useRef, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { olxLiveApi, type OlxPrepareContent } from '@/api/olx-live'
import {
  Button,
  ErrorState,
  Fact,
  FactList,
  SectionPanel,
  SelectPicker,
  Sheet,
  SkeletonRows,
} from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { OlxAttributeField } from '../olx/OlxAttributeField'
import { olxLiveMessages } from '../olx/olx-live-messages'
import { olxPublicationMessages } from '../olx/olx-publication-messages'
import {
  canPrepareOlxDraft,
  emptyOlxContent,
  hasAttributeValue,
} from '../olx/olx-prepare-content'
import {
  usePartOlxConnection,
  usePartOlxPublication,
  usePartOlxRead,
  type PartOlxDraft,
} from './part-olx-marketplace'
import { partMarketplaceMessages } from './part-marketplace-messages'

const readCategories = (_key: string, signal: AbortSignal) =>
  olxLiveApi.categories({ signal })
const readAttributes = (id: string, signal: AbortSignal) =>
  olxLiveApi.attributes(Number(id), { signal })

interface PartFields {
  name: string
  publicDescription: string
  price: number | null | undefined
  photoCount: number
}

export function PartMarketplaceForm({
  partId,
  part,
  value,
  onChange,
  disabled,
}: {
  partId?: string
  part: PartFields
  value: PartOlxDraft | undefined
  onChange: (draft: PartOlxDraft) => void
  disabled: boolean
}) {
  const t = useT(partMarketplaceMessages)
  const tl = useT(olxLiveMessages)
  const tc = useT(commonMessages)
  const tp = useT(olxPublicationMessages)
  const { accountId } = usePartOlxConnection()
  const publication = usePartOlxPublication(accountId ? partId : undefined)
  const [editing, setEditing] = useState<OlxPrepareContent | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const applied = value?.accountId === accountId ? value?.content : undefined
  const content = applied ?? publication.result?.content ?? emptyOlxContent
  const catalogue = usePartOlxRead(
    readCategories,
    accountId && (editing || content.categoryId) ? accountId : undefined,
  )
  const appliedCategory = catalogue.result?.find(
    (category) => category.id === content.categoryId,
  )
  const selectedCategory = catalogue.result?.find(
    (category) => category.id === editing?.categoryId,
  )
  const activeCategory = editing ? selectedCategory : appliedCategory
  const editorFields = usePartOlxRead(
    readAttributes,
    activeCategory ? String(activeCategory.id) : undefined,
  )
  const attributes =
    activeCategory?.id === appliedCategory?.id ? editorFields.result : undefined
  const titleLength = part.name.trim().length
  const descriptionLength = (
    part.publicDescription.trim() || content.publicDescription.trim()
  ).length
  const missingAttributes = attributes?.filter(
    (attribute) =>
      attribute.required &&
      !hasAttributeValue(content.attributes[attribute.code]),
  )
  const missing = [
    !appliedCategory || !content.categoryConfirmed ? tp('fieldCategory') : null,
    ...(missingAttributes?.map((attribute) => attribute.label) ?? []),
    titleLength < 16 || titleLength > 150 ? tp('fieldTitle') : null,
    descriptionLength < 80 || descriptionLength > 9000
      ? tp('fieldDescription')
      : null,
    part.price == null || part.price <= 0 ? tp('fieldPrice') : null,
  ].filter(Boolean)
  const editable =
    !partId || (publication.result && canPrepareOlxDraft(publication.result))
  const readiness =
    partId && publication.result === undefined
      ? null
      : publication.result === null
        ? t('checkDraft')
        : !editable
          ? t('existingAdvert')
          : catalogue.result === null
            ? t('categoriesFailed')
            : attributes === null
              ? t('attributesFailed')
              : content.categoryId &&
                  (!catalogue.result || (appliedCategory && !attributes))
                ? null
                : missing.length > 0
                  ? t('missing', { fields: missing.join(' · ') })
                  : t('reviewReady', { category: appliedCategory?.name ?? '' })

  if (!accountId) return null

  return (
    <SectionPanel
      title={t('title')}
      description={t('optional')}
      variant="panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span aria-hidden className="rz-code px-2 py-1">
            OLX
          </span>
          <div className="grid min-w-0 flex-1 gap-0.5">
            <span className="text-app-strong font-medium">OLX</span>
            {readiness ? (
              <p className="rz-caption m-0 break-words" role="status">
                {readiness}
              </p>
            ) : (
              <SkeletonRows rows={1} label={tl('loading')} />
            )}
          </div>
        </div>
        {publication.result === null ? (
          <Button size="sm" onClick={publication.retry}>
            {tc('retry')}
          </Button>
        ) : editable ? (
          <Button
            ref={trigger}
            size="sm"
            disabled={disabled}
            onClick={() => setEditing(content)}
          >
            <Settings2 aria-hidden /> {t('configure')}
          </Button>
        ) : null}
      </div>
      <Sheet
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          trigger.current?.focus()
        }}
        title={t('sheet')}
        description={part.name.trim() || undefined}
        footer={
          <>
            <span className="rz-caption mr-auto">{t('applyHint')}</span>
            <Button
              variant="primary"
              disabled={
                disabled ||
                !editing ||
                !selectedCategory ||
                !editorFields.result
              }
              onClick={() => {
                if (!editing || !selectedCategory || !editorFields.result)
                  return
                onChange({
                  accountId,
                  revision:
                    value?.accountId === accountId
                      ? value.revision
                      : (publication.result?.revision ?? null),
                  content: { ...editing, categoryConfirmed: true },
                })
                setEditing(null)
              }}
            >
              {t('apply')}
            </Button>
          </>
        }
      >
        {catalogue.result === undefined ? (
          <SkeletonRows rows={2} label={tl('loading')} />
        ) : catalogue.result === null ? (
          <ErrorState title={t('categoriesFailed')} onRetry={catalogue.retry} />
        ) : (
          <SelectPicker
            label={tl('category')}
            showLabel
            hint={t('categoryHint')}
            placeholder={tl('choose')}
            value={editing?.categoryId ? String(editing.categoryId) : ''}
            onValueChange={(id) =>
              setEditing(
                (previous) =>
                  previous && {
                    ...previous,
                    categoryId: Number(id),
                    categoryConfirmed: true,
                    attributes:
                      previous.categoryId === Number(id)
                        ? previous.attributes
                        : {},
                  },
              )
            }
            options={catalogue.result.map((category) => ({
              value: String(category.id),
              label: category.name,
              ...(category.path !== category.name
                ? { description: category.path }
                : {}),
            }))}
          />
        )}
        {selectedCategory && (
          <SectionPanel title={t('attributes')}>
            {editorFields.result === undefined ? (
              <SkeletonRows rows={2} label={tl('loading')} />
            ) : editorFields.result === null ? (
              <ErrorState
                title={t('attributesFailed')}
                onRetry={editorFields.retry}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {editorFields.result.map((attribute) => (
                  <OlxAttributeField
                    key={attribute.code}
                    attribute={attribute}
                    disabled={disabled}
                    value={editing?.attributes[attribute.code] ?? []}
                    error={
                      attribute.required &&
                      !hasAttributeValue(editing?.attributes[attribute.code])
                        ? tl('attribute_required')
                        : undefined
                    }
                    onChange={(values) =>
                      setEditing(
                        (previous) =>
                          previous && {
                            ...previous,
                            attributes: {
                              ...previous.attributes,
                              [attribute.code]: values,
                            },
                          },
                      )
                    }
                  />
                ))}
              </div>
            )}
          </SectionPanel>
        )}
        <SectionPanel title={t('payload')}>
          <FactList>
            <Fact label={tp('fieldTitle')}>
              {t('characters', { count: titleLength, min: 16, max: 150 })}
            </Fact>
            <Fact label={tp('fieldDescription')}>
              {t('characters', {
                count: descriptionLength,
                min: 80,
                max: 9000,
              })}
            </Fact>
            <Fact label={t('photos')}>{part.photoCount}</Fact>
          </FactList>
        </SectionPanel>
      </Sheet>
    </SectionPanel>
  )
}
