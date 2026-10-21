import { useEffect, useRef, useState } from 'react'
import { Button, SelectInput } from '@/components/app'
import { importReferences, type ImportReference } from '@/api/import-references'
import { importMappingMessages } from './import-mapping-messages'
import { useImportT } from './use-import-text'
export function ImportReferencePicker({
  field,
  value,
  onChange,
}: {
  field: string
  value: string
  onChange: (id: string) => void
}) {
  const t = useImportT(importMappingMessages)
  const [search, setSearch] = useState(''),
    [items, setItems] = useState<ImportReference[]>([]),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false)
  const currentRequest = useRef<AbortController | null>(null)
  useEffect(() => () => currentRequest.current?.abort(), [])
  async function load() {
    currentRequest.current?.abort()
    const controller = new AbortController()
    currentRequest.current = controller
    setBusy(true)
    setError(false)
    try {
      const result = await importReferences(field, search, {
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setItems(result)
    } catch {
      if (!controller.signal.aborted) setError(true)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }
  return (
    <div className="grid min-w-0 gap-2">
      <div className="flex min-w-0 gap-2">
        <input
          className="rz-input w-full min-w-0 max-md:text-title"
          aria-label={t('searchRecord')}
          placeholder={t('searchByName')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button disabled={busy} onClick={() => void load()}>
          {t('find')}
        </Button>
      </div>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('notSpecified')}</option>
        {value && !items.some((x) => x.id === value) ? (
          <option value={value}>{t('savedChoice')}</option>
        ) : null}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectInput>
      {error ? (
        <p role="alert" className="rz-error m-0">
          {t('referenceFailed')}
        </p>
      ) : null}
    </div>
  )
}
