import { PageBody, PageHeader } from '@/components/app'
import { useLocale } from '@/i18n'
import { moduleLabel } from '../module-messages'
import type { CabinetModuleDefinition } from '../module-registry'

export function CabinetModuleScreen({
  definition,
}: {
  definition: CabinetModuleDefinition
}) {
  const { locale } = useLocale()
  return (
    <PageBody>
      <PageHeader title={moduleLabel(definition.key, locale)} />
    </PageBody>
  )
}
