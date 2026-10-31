/**
 * Phones (≤640px) turn a card grid into a horizontal snap carousel, as in the
 * mock-up: cards at 84% width, the row bleeds to the screen edges. The row
 * scrolls, so give it `tabIndex={0}` and a label: keyboard users then focus
 * it and scroll with the arrow keys (axe: scrollable-region-focusable).
 */
export const phoneCarousel =
  'focus-visible:outline-lp-accent rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 max-sm:-mx-5 max-sm:flex max-sm:snap-x max-sm:snap-mandatory max-sm:gap-3 max-sm:overflow-x-auto max-sm:px-5 max-sm:pt-1 max-sm:pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:[&>*]:shrink-0 max-sm:[&>*]:basis-[84%] max-sm:[&>*]:snap-center max-sm:[&>*]:snap-always'
