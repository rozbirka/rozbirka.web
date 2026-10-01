import { WifiOff } from 'lucide-react'
import { useOnline } from './use-online'

/**
 * Says the connection is gone, and — the part that matters in a metal shed —
 * says what happens to the work in progress. The bar sits above the screen
 * rather than replacing it, so a form half filled in stays on screen and stays
 * filled in.
 *
 * Every cabinet screen breaks out of the shell's padding with a negative top
 * margin and then puts a sticky bar in the space it reclaimed. So the notice
 * does the same breakout, and gives the padding back underneath itself — the
 * screen's own negative margin then cancels that spacer instead of riding up
 * over the notice and hiding it behind its own header.
 */
export function ConnectionNotice() {
  const online = useOnline()
  if (online) return null

  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 md:-mx-8 md:-mt-8 lg:-mx-10 lg:-mt-10">
      <div
        className="border-state-warn/35 bg-state-warn-soft text-app-ink flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-4 py-3 text-[14.5px] sm:px-6 md:px-8 lg:px-12"
        role="status"
      >
        <WifiOff aria-hidden className="text-state-warn size-4 shrink-0" />
        <span className="font-semibold">Немає звʼязку</span>
        <span className="text-app-muted">
          Уже відкрите лишається на екрані, а введене — у формі. Надсилання не
          пройде, доки мережа не повернеться.
        </span>
      </div>
      <div aria-hidden className="h-6 md:h-8 lg:h-10" />
    </div>
  )
}
