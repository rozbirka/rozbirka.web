import type { MessageKey } from '@/i18n/messages'
import type { siteMessages } from './site-messages'

export interface NavItem {
  /** Label key in `siteMessages`. */
  label: MessageKey<typeof siteMessages>
  /** In-page anchor of the section. */
  href: string
  /** Fragment appended to the landing path of the current language. */
  hash: string
}

export const navItems: NavItem[] = [
  { label: 'navHow', href: '#how', hash: '#how' },
  { label: 'navFeatures', href: '#features', hash: '#features' },
  { label: 'navReviews', href: '#reviews', hash: '#reviews' },
  { label: 'navPricing', href: '#pricing', hash: '#pricing' },
  { label: 'navFaq', href: '#faq', hash: '#faq' },
]

/** Link target of a nav item on the landing at `landingPath` (`/`, `/en`…). */
export function navDestination(item: NavItem, landingPath: string): string {
  return landingPath === '/' ? `/${item.hash}` : `${landingPath}${item.hash}`
}
