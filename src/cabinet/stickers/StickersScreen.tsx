import { useRef } from 'react'
import { useSearchParams } from 'react-router'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { useCabinet } from '../CabinetContext'
import { PartStickersScreen } from './PartStickersScreen'
import { LocationStickersScreen } from './LocationStickersScreen'
import { StickerModeSwitch } from './StickerModeSwitch'
import {
  parseStickerRoute,
  locationStickersHref,
  type LocationCollection,
  type StickerMode,
} from './sticker-route'
import { stickerModeAccess } from './sticker-access'

export function StickersScreen({ definition }: CabinetModuleScreenProps) {
  const [params, setParams] = useSearchParams()
  const cabinet = useCabinet()
  const { mode, collection } = parseStickerRoute(params)
  const lastCollection = useRef<{
    scope: string
    collection: LocationCollection
  } | null>(null)
  const scope = `${cabinet.snapshot?.userId ?? ''}:${cabinet.snapshot?.tenantId ?? ''}`
  const access =
    cabinet.status === 'ready' && cabinet.snapshot
      ? { status: 'ready' as const, snapshot: cabinet.snapshot, error: null }
      : cabinet.status === 'error'
        ? { status: 'error' as const, snapshot: null, error: cabinet.error }
        : { status: 'loading' as const, snapshot: null, error: null }
  const allowedModes = (['parts', 'locations'] as const).filter(
    (value) => stickerModeAccess(value, access).kind === 'allowed',
  )
  const changeMode = (value: StickerMode) => {
    if (mode === 'locations' && collection)
      lastCollection.current = { scope, collection }
    if (
      value === 'locations' &&
      lastCollection.current?.scope === scope &&
      cabinet.targetTenant
    ) {
      const href = locationStickersHref(
        cabinet.targetTenant.slug,
        lastCollection.current.collection,
        [],
      )
      setParams(new URL(href, 'http://localhost').searchParams)
    } else setParams(new URLSearchParams({ type: value }))
  }
  const navigation = (
    <StickerModeSwitch
      mode={mode}
      allowedModes={allowedModes}
      onChange={changeMode}
    />
  )
  return mode === 'locations' ? (
    <LocationStickersScreen navigation={navigation} />
  ) : (
    <PartStickersScreen definition={definition} navigation={navigation} />
  )
}
