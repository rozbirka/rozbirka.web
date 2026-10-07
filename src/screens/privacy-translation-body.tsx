import type { ReactNode } from 'react'
import {
  PRIVACY_MAIL,
  type PrivacyTranslation,
  type Run,
} from './privacy-translations'

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, index): ReactNode => {
    if (typeof run === 'string') return run
    if ('strong' in run) return <strong key={index}>{run.strong}</strong>
    return (
      <a
        className="text-brand underline-offset-2 hover:underline"
        href={`mailto:${PRIVACY_MAIL}`}
        key={index}
      >
        {PRIVACY_MAIL}
      </a>
    )
  })
}

export function PrivacyTranslationBody({
  translation,
}: {
  translation: PrivacyTranslation
}) {
  return (
    <div className="prose-content mt-12 space-y-10 text-[15px] leading-relaxed text-foreground/85">
      {translation.sections.map((section) => (
        <section key={section.title}>
          <h2 className="mb-3 text-xl font-medium text-foreground">
            {section.title}
          </h2>
          {section.blocks.map((block, index) =>
            'p' in block ? (
              <p className={index > 0 ? 'mt-3' : undefined} key={index}>
                <Runs runs={block.p} />
              </p>
            ) : (
              <ul className="list-disc space-y-2 pl-6" key={index}>
                {block.ul.map((item, itemIndex) => (
                  <li key={itemIndex}>
                    <Runs runs={item} />
                  </li>
                ))}
              </ul>
            ),
          )}
        </section>
      ))}
    </div>
  )
}
