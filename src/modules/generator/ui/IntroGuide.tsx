import { type Locale, messagesFor } from '@/common/i18n';

const STAGES = ['plain', 'fallback', 'web'] as const;

export function IntroGuide({
  locale,
  loaded,
  demoFonts,
  interactive = true,
}: {
  locale: Locale;
  loaded: boolean;
  demoFonts: Record<(typeof STAGES)[number], string> | undefined;
  interactive?: boolean;
}) {
  const t = messagesFor(locale);
  const captions = {
    plain: t.intro_demo_plain(),
    fallback: t.intro_demo_fallback(),
    web: t.intro_demo_web(),
  } as const;
  return (
    <section
      class="ff-intro"
      aria-labelledby={interactive ? 'ff-intro-title' : undefined}
      aria-hidden={interactive ? undefined : 'true'}
    >
      <h3
        id={interactive ? 'ff-intro-title' : undefined}
        class="ff-heading ff-article__head ff-article__title"
      >
        {t.intro_heading()}
      </h3>
      <p class="ff-intro__text">{t.intro_what()}</p>
      <div class="ff-intro__demo" aria-hidden="true">
        {STAGES.map((stage) => (
          <figure key={stage} class="ff-intro__frame" data-state={stage}>
            <figcaption class="ff-intro__caption">{captions[stage]}</figcaption>
            <p
              class="ff-intro__text"
              style={demoFonts ? { fontFamily: demoFonts[stage] } : undefined}
            >
              {t.intro_demo_text()}
            </p>
          </figure>
        ))}
      </div>
      <p class="ff-intro__text ff-muted">{t.intro_demo_note()}</p>
      <div class="ff-intro__status" role={interactive ? 'status' : undefined}>
        <p
          class="ff-intro__status-text ff-intro__text"
          data-shown={loaded ? undefined : ''}
          aria-hidden={loaded ? 'true' : undefined}
        >
          {t.intro_status_empty()}
        </p>
        <p
          class="ff-intro__status-text ff-intro__text"
          data-shown={loaded ? '' : undefined}
          aria-hidden={loaded ? undefined : 'true'}
        >
          {t.intro_status_loaded()}
        </p>
      </div>
    </section>
  );
}
