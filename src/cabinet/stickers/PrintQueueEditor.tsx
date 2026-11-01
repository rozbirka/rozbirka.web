import { useState } from 'react'
import { Button, SearchInput, Sheet } from '@/components/app'
import { useT } from '@/i18n'
import { locationLabelMessages } from '../inventory/location-label-messages'
import { locationStickersMessages } from './location-stickers-messages'

export function PrintQueueEditor({
  ids,
  entries,
  mode,
  onClose,
  onSubmit,
}: {
  ids: readonly string[]
  entries: readonly { id: string; name: string; code?: string }[]
  mode: 'remove' | 'confirm'
  onClose: () => void
  onSubmit: (ids: string[]) => void
}) {
  const t = useT(locationLabelMessages),
    ts = useT(locationStickersMessages)
  const [search, setSearch] = useState(''),
    [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const visible = ids.filter((id) =>
    `${byId.get(id)?.name ?? t('unavailable')} ${byId.get(id)?.code ?? id}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  )
  const chosen = ids.filter((id) => selected.has(id))
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={t(mode === 'remove' ? 'editQueue' : 'confirmTitle')}
      description={mode === 'confirm' ? t('confirmHint') : undefined}
      footer={
        <Button
          disabled={!chosen.length}
          onClick={() => onSubmit(chosen)}
          variant={mode === 'remove' ? 'danger' : 'primary'}
        >
          {mode === 'remove'
            ? ts('removeSelected', { count: chosen.length })
            : t('confirm', { count: chosen.length })}
        </Button>
      }
    >
      <div className="grid gap-3">
        <SearchInput
          aria-label={ts('searchQueue')}
          placeholder={ts('searchQueue')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button onClick={() => setSelected(new Set([...selected, ...visible]))}>
          {t('selectResults', { count: visible.length })}
        </Button>
        <ul className="divide-app-line m-0 grid list-none divide-y p-0">
          {visible.map((id) => (
            <li key={id}>
              <label className="flex min-w-0 items-center gap-3 py-3">
                <input
                  type="checkbox"
                  className="rz-check"
                  aria-label={
                    byId.get(id)?.name ?? `${t('unavailable')} · ${id}`
                  }
                  checked={selected.has(id)}
                  onChange={() =>
                    setSelected((current) => {
                      const next = new Set(current)
                      if (next.has(id)) next.delete(id)
                      else next.add(id)
                      return next
                    })
                  }
                />
                <span className="min-w-0 break-words">
                  <strong className="rz-strong">
                    {byId.get(id)?.name ?? t('unavailable')}
                  </strong>
                  <span className="rz-caption ml-2">
                    {byId.get(id)?.code ?? id}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {!visible.length ? <p className="rz-muted">{t('noMatches')}</p> : null}
      </div>
    </Sheet>
  )
}
