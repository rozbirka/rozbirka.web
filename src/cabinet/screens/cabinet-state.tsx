import { useLocale } from '@/i18n'
import { moduleLabel } from '../module-messages'
import type { CabinetModuleDefinition } from '../module-registry'
import { RedesignShell, RedesignTitle } from '../redesign-shell'

export function CabinetModuleScreen({
  definition,
}: {
  definition: CabinetModuleDefinition
}) {
  const { locale } = useLocale()
  const label = moduleLabel(definition.key, locale)
  return (
    <RedesignShell crumb={<span aria-current="page">{label}</span>}>
      <RedesignTitle title={label} />
    </RedesignShell>
  )
}
