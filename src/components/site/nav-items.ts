import type { MessageKey } from '@/i18n/messages'
import type { siteMessages } from './site-messages'

export interface NavItem {
  /** Label key in `siteMessages`. */
  label: MessageKey<typeof siteMessages>
  /** In-page anchor, used to mark the active item. */
  href: string
  /** Fragment appended to the landing path of the current language. */
  hash: string
}

export const navItems: NavItem[] = [
  { label: 'navHome', href: '#top', hash: '' },
  { label: 'navFeatures', href: '#features', hash: '#features' },
  { label: 'navPricing', href: '#pricing', hash: '#pricing' },
  { label: 'navFaq', href: '#faq', hash: '#faq' },
]

/** Link target of a nav item on the landing at `landingPath` (`/`, `/en`…). */
export function navDestination(item: NavItem, landingPath: string): string {
  if (!item.hash) return landingPath
  return landingPath === '/' ? `/${item.hash}` : `${landingPath}${item.hash}`
}
