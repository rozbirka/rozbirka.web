import { Globe } from 'lucide-react'
import { StateScreen } from '@/components/app'
import { useLocale } from '@/i18n'
import { novaPoshtaUnavailableText } from './integration-labels'

/**
 * Nova Poshta outside Ukraine: said once, with nothing to press. Core hides
 * the definition and refuses NP commands for such a business, so the cabinet
 * offers no connect or configure action either.
 */
export function NovaPoshtaUnavailable() {
  const { locale } = useLocale()
  const text = novaPoshtaUnavailableText(locale)
  return (
    <StateScreen
      description={text.message}
      icon={<Globe aria-hidden />}
      label={text.title}
      title={text.title}
    />
  )
}
