/**
 * Fragment ids of the business settings sections other screens link to — the
 * onboarding checklist opens steps 1 and 2 at these sections. A section that
 * carries one of these ids is scrolled to and its first field focused by
 * `useHashTarget` when the URL names it (`/settings/business#region`).
 */
export const BUSINESS_SECTION_IDS = {
  /** Country, time zone and document language (ROZ-160). */
  region: 'region',
  /** Accounting currency (ROZ-159). */
  accountingCurrency: 'accounting-currency',
} as const
