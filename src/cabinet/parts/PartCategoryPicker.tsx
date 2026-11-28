import { useEffect, useMemo, useState } from 'react'
import { partsApi, type PartCategory } from '@/api/parts'
import { Button, SelectPicker } from '@/components/app'
import { useT } from '@/i18n'
import { partFormMessages } from './part-form-messages'

const emptyValue = 'none'

const words = (value: string) =>
  value
    .normalize('NFC')
    .toLocaleLowerCase('uk')
    .replace(/['’ʼ]/g, '')
    .match(/\p{L}{3,}/gu) ?? []

function wordScore(query: string, candidate: string) {
  if (query === candidate) return 4
  const shorter = Math.min(query.length, candidate.length)
  let common = 0
  while (common < shorter && query[common] === candidate[common]) common++
  // Handle common Ukrainian number, gender and case endings.
  if (common >= 4 && Math.max(query.length, candidate.length) - common <= 3)
    return 3
  if (
    common === shorter &&
    Math.max(query.length, candidate.length) - common <= 1
  )
    return 3
  return 0
}

function suggestPartCategories(
  name: string,
  categories: readonly PartCategory[],
) {
  const query = [...new Set(words(name))]
  if (!query.length) return []
  return categories
    .filter((category) => category.isLeaf)
    .map((category) => {
      const label = words(category.name)
      const scores = label.map((word) =>
        Math.max(...query.map((term) => wordScore(term, word))),
      )
      const score = scores.reduce((sum, match) => sum + match, 0)
      const leadingWordBonus = scores[0] ? 1 : 0
      const exact = label.join(' ') === query.join(' ')
      return { category, score: score + leadingWordBonus + (exact ? 10 : 0) }
    })
    .filter(({ score }) => score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.category.name.localeCompare(b.category.name, 'uk'),
    )
    .slice(0, 3)
    .map(({ category }) => category)
}

export function PartCategoryPicker({
  name,
  value,
  onChange,
}: {
  name: string
  value?: number | null | undefined
  onChange: (value: number | null) => void
}) {
  const t = useT(partFormMessages)
  const [categories, setCategories] = useState<PartCategory[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void partsApi.categories({ signal: controller.signal }).then(
      (result) => {
        if (controller.signal.aborted) return
        setCategories(result)
        setStatus('ready')
      },
      () => {
        if (!controller.signal.aborted) setStatus('error')
      },
    )
    return () => controller.abort()
  }, [attempt])

  const leafOptions = useMemo(() => {
    const byId = new Map(categories.map((category) => [category.id, category]))
    return categories
      .filter((category) => category.isLeaf)
      .map((category) => {
        const path: string[] = []
        let parent = byId.get(category.parentId ?? 0)
        while (parent) {
          path.unshift(parent.name)
          parent = byId.get(parent.parentId ?? 0)
        }
        return {
          value: String(category.id),
          label: category.name,
          description: path.join(' / '),
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'uk'))
  }, [categories])
  const suggestions = suggestPartCategories(name, categories)

  return (
    <div className="grid gap-2">
      <SelectPicker
        label={t('category')}
        showLabel
        options={[
          { value: emptyValue, label: t('noCategory') },
          ...leafOptions,
        ]}
        value={value == null ? emptyValue : String(value)}
        placeholder={t('category')}
        disabled={status !== 'ready'}
        busy={status === 'loading'}
        onValueChange={(selected) =>
          onChange(selected === emptyValue ? null : Number(selected))
        }
      />
      {status === 'error' ? (
        <div className="flex flex-wrap items-center gap-2" role="status">
          <span className="rz-caption">{t('categoriesUnavailable')}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatus('loading')
              setAttempt((current) => current + 1)
            }}
          >
            {t('retry')}
          </Button>
        </div>
      ) : null}
      {value == null && suggestions.length > 0 ? (
        <div className="grid gap-1">
          <span className="rz-caption">{t('suggestedCategories')}</span>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((category) => (
              <Button
                key={category.id}
                size="sm"
                variant="ghost"
                onClick={() => onChange(category.id)}
              >
                {category.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
