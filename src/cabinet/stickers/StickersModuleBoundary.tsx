import { Navigate, useSearchParams } from 'react-router'
import { useCabinet } from '../CabinetContext'
import { ModuleBoundary, type ModuleBoundaryProps } from '../ModuleBoundary'
import { parseStickerRoute } from './sticker-route'
import {
  stickerAccessDefinition,
  stickerNavigationTarget,
} from './sticker-access'

export function StickersModuleBoundary({
  screen,
}: Pick<ModuleBoundaryProps, 'screen'>) {
  const [params] = useSearchParams()
  const cabinet = useCabinet()
  const { mode, invalid } = parseStickerRoute(params)
  if (
    !invalid &&
    !params.has('type') &&
    !params.has('part') &&
    cabinet.status === 'ready' &&
    cabinet.snapshot &&
    cabinet.targetTenant
  ) {
    const target = stickerNavigationTarget(cabinet.targetTenant.slug, {
      status: 'ready',
      snapshot: cabinet.snapshot,
      error: null,
    })
    if (target?.includes('?type=locations'))
      return <Navigate replace to={target} />
  }
  return (
    <ModuleBoundary
      module="stickers"
      definition={stickerAccessDefinition(mode)}
      screen={screen}
    />
  )
}
