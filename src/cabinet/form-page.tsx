import { useEffect, useRef, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { Button, PanelFooter } from '@/components/app'
import { commonMessages, useT } from '@/i18n'
import { Crumbs, RedesignShell, RedesignTitle } from './redesign-shell'

/** A route-based form using the same page, sections and actions as the cabinet. */
export function FormPage({
  title,
  context,
  description,
  backTo,
  busy = false,
  actions,
  footerNote,
  children,
}: {
  title: string
  context: ReactNode
  description?: ReactNode
  backTo: string
  busy?: boolean
  actions: ReactNode
  footerNote?: ReactNode
  children: ReactNode
}) {
  const navigate = useNavigate()
  const t = useT(commonMessages)
  const page = useRef<HTMLElement>(null)
  useEffect(() => {
    const heading = page.current?.querySelector('h1')
    if (heading) {
      heading.tabIndex = -1
      heading.focus()
    }
  }, [title])

  return (
    <section
      aria-label={title}
      className="rz-form-page [&_h1:focus]:shadow-none! [&_h1:focus]:outline-none!"
      ref={page}
    >
      <RedesignShell
        crumb={
          <>
            <Button disabled={busy} onClick={() => void navigate(backTo)}>
              <ChevronLeft aria-hidden />
              {t('back')}
            </Button>
            <Crumbs items={[context, title]} />
          </>
        }
        width="record"
      >
        <div className="grid w-full max-w-[960px] gap-4">
          <RedesignTitle title={title} lead={description} />
          {children}
          <PanelFooter
            className="bg-app-raised sticky bottom-16 z-10 md:bottom-0"
            leading={footerNote}
            standalone
          >
            {actions}
          </PanelFooter>
        </div>
      </RedesignShell>
    </section>
  )
}
