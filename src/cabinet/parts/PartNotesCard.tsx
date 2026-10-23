import type { ReactNode } from 'react'
import { partsApi } from '@/api/parts'
import { NotesCard } from '@/components/app'
import type { LatestMutationScope } from '../use-latest-mutation-guard'

export function PartNotesCard({
  partId,
  notes,
  canEdit,
  beforeSave,
  onSaved,
  footer,
}: {
  partId: string
  notes: string | null
  canEdit: boolean
  beforeSave: () => LatestMutationScope
  onSaved: (notes: string) => void
  footer?: ReactNode
}) {
  return (
    <NotesCard
      value={notes}
      canEdit={canEdit}
      footer={footer}
      onSave={async (value) => {
        const scope = beforeSave()
        // Null means omission in this API; an empty string clears the note.
        const saved = await partsApi.update(
          partId,
          {
            notes: value,
            desiredSalePrice: { isSet: false },
          },
          { signal: scope.signal },
        )
        scope.signal.throwIfAborted()
        return saved.notes ?? null
      }}
      readBack={async () => {
        const scope = beforeSave()
        const saved = await partsApi.get(partId, { signal: scope.signal })
        scope.signal.throwIfAborted()
        return saved.notes ?? null
      }}
      onSaved={(value) => onSaved(value ?? '')}
    />
  )
}
