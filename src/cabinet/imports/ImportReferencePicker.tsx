import { useEffect, useRef, useState } from 'react'
import { Button, SelectInput } from '@/components/app'
import { importReferences, type ImportReference } from '@/api/import-references'
export function ImportReferencePicker({
  field,
  value,
  onChange,
}: {
  field: string
  value: string
  onChange: (id: string) => void
}) {
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
    <div className="import-stack">
      <div className="flex gap-2">
        <input
          className="min-w-0 w-full rounded-control border border-app-line bg-app-input px-3 py-2 text-app-ink"
          aria-label="Пошук запису"
          placeholder="Пошук за назвою"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button disabled={busy} onClick={() => void load()}>
          Знайти
        </Button>
      </div>
      <SelectInput value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Не вказувати</option>
        {value && !items.some((x) => x.id === value) ? (
          <option value={value}>Збережений вибір</option>
        ) : null}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </SelectInput>
      {error ? (
        <p role="alert" className="text-state-danger">
          Не вдалося завантажити довідник. Перевірте права доступу.
        </p>
      ) : null}
    </div>
  )
}
