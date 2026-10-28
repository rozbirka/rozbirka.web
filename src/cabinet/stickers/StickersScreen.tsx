import { useSearchParams } from 'react-router'
import type { CabinetModuleScreenProps } from '../ModuleBoundary'
import { useCabinet } from '../CabinetContext'
import { PartStickersScreen } from './PartStickersScreen'
import { LocationStickersScreen } from './LocationStickersScreen'
import { StickerModeSwitch } from './StickerModeSwitch'
import { parseStickerRoute, type StickerMode } from './sticker-route'
import { stickerModeAccess } from './sticker-access'

export function StickersScreen({ definition }: CabinetModuleScreenProps) {
  const [params, setParams] = useSearchParams()
  const cabinet = useCabinet()
  const { mode } = parseStickerRoute(params)
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
    const next = new URLSearchParams({ type: value })
    setParams(next)
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
