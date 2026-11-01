import type { MessageKey } from '@/i18n/messages'
import type { siteMessages } from './site-messages'

export interface NavItem {
  /** Label key in `siteMessages` (footer and, unless `shortLabel`, header). */
  label: MessageKey<typeof siteMessages>
  /** Shorter header label, when the mock-up uses one («Тариф»). */
  shortLabel?: MessageKey<typeof siteMessages>
  /** In-page anchor of the section. */
  href: string
  /** Fragment appended to the landing path of the current language. */
  hash: string
}

/** Landing sections in page order (the header highlights the current one). */
export const navItems: NavItem[] = [
  { label: 'navReviews', href: '#reviews', hash: '#reviews' },
  { label: 'navHow', href: '#how', hash: '#how' },
  { label: 'navFeatures', href: '#features', hash: '#features' },
  {
    label: 'navPricing',
    shortLabel: 'navPricingShort',
    href: '#pricing',
    hash: '#pricing',
  },
  { label: 'navFaq', href: '#faq', hash: '#faq' },
]

/** Link target of a nav item on the landing at `landingPath` (`/`, `/en`…). */
export function navDestination(item: NavItem, landingPath: string): string {
  return landingPath === '/' ? `/${item.hash}` : `${landingPath}${item.hash}`
}
