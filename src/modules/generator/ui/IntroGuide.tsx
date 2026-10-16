import { type Locale, messagesFor } from '@/common/i18n';
import { DOCK_OPEN_EVENT, Icon, type IconName } from '@/common/ui';

const STEPS = [
  ['inputs', 'download'],
  ['audience', 'browserslist'],
  ['tuning', 'ruler'],
  ['results', 'css'],
] as const satisfies readonly (readonly [string, IconName])[];

const STAGES = ['plain', 'fallback', 'web'] as const;

export function IntroGuide({
  locale,
  collapsed = false,
  interactive = true,
  onToggle,
}: {
  locale: Locale;
  collapsed?: boolean;
  interactive?: boolean;
  onToggle?: (() => void) | undefined;
}) {
  const t = messagesFor(locale);
  const copy = {
    inputs: [t.intro_step_inputs(), t.intro_step_inputs_text()],
    audience: [t.intro_step_audience(), t.intro_step_audience_text()],
    tuning: [t.intro_step_tuning(), t.intro_step_tuning_text()],
    results: [t.intro_step_results(), t.intro_step_results_text()],
  } as const;
  const captions = {
    plain: t.intro_demo_plain(),
    fallback: t.intro_demo_fallback(),
    web: t.intro_demo_web(),
  } as const;
  const toggle = onToggle && interactive && (
    <button type="button" class="ff-intro__toggle" aria-expanded={!collapsed} onClick={onToggle}>
      {collapsed ? t.intro_show() : t.intro_hide()}
    </button>
  );
  if (collapsed) {
    return (
      <section class="ff-intro ff-intro--compact">
        <h4 class="ff-article__heading">{t.intro_heading()}</h4>
        {toggle}
      </section>
    );
  }
  return (
    <section class="ff-intro" aria-labelledby={interactive ? 'ff-intro-title' : undefined}>
      <h3 id={interactive ? 'ff-intro-title' : undefined} class="ff-article__title">
        {t.intro_heading()}
      </h3>
      {toggle}
      <p>{t.intro_what()}</p>
      <div class="ff-intro__demo" aria-hidden="true">
        {STAGES.map((stage) => (
          <figure key={stage} class="ff-intro__frame" data-state={stage}>
            <figcaption>{captions[stage]}</figcaption>
            <p>{t.intro_demo_text()}</p>
            <span class="ff-intro__button">{t.intro_demo_button()}</span>
          </figure>
        ))}
      </div>
      <p class="ff-muted">{t.intro_demo_note()}</p>
      <h4 class="ff-article__heading">{t.intro_steps_heading()}</h4>
      <ol class="ff-intro__steps">
        {STEPS.map(([step, icon]) => {
          const card = (
            <>
              <Icon name={icon} />
              <strong>{copy[step][0]}</strong>
              <span class="ff-muted">{copy[step][1]}</span>
            </>
          );
          return (
            <li key={step}>
              {interactive ? (
                <button
                  type="button"
                  class="ff-intro__card"
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent(DOCK_OPEN_EVENT, { detail: step }))
                  }
                >
                  {card}
                </button>
              ) : (
                <div class="ff-intro__card">{card}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
