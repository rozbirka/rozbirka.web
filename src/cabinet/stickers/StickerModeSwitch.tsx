import { Segmented } from '@/components/app'
import { useT } from '@/i18n'
import { locationStickersMessages } from './location-stickers-messages'
import type { StickerMode } from './sticker-route'

export function StickerModeSwitch({
  mode,
  onChange,
  allowedModes,
}: {
  mode: StickerMode
  onChange: (mode: StickerMode) => void
  allowedModes: readonly StickerMode[]
}) {
  const t = useT(locationStickersMessages)
  return (
    <Segmented
      label={t('mode')}
      name="sticker-mode"
      value={mode}
      onChange={onChange}
      options={(['parts', 'locations'] as const).map((value) => ({
        value,
        label: t(value),
        disabled: !allowedModes.includes(value),
      }))}
      className="w-fit max-w-full"
    />
  )
}
