import { type Locale, messagesFor } from '@/common/i18n';
import { Button, DOCK_OPEN_EVENT } from '@/common/ui';

const STEPS = ['inputs', 'audience', 'tuning', 'results'] as const;

export function IntroGuide({ locale }: { locale: Locale }) {
  const t = messagesFor(locale);
  const copy = {
    inputs: [t.intro_step_inputs(), t.intro_step_inputs_text()],
    audience: [t.intro_step_audience(), t.intro_step_audience_text()],
    tuning: [t.intro_step_tuning(), t.intro_step_tuning_text()],
    results: [t.intro_step_results(), t.intro_step_results_text()],
  } as const;
  return (
    <section class="ff-intro" aria-labelledby="ff-intro-title">
      <h3 id="ff-intro-title" class="ff-article__title">
        {t.intro_heading()}
      </h3>
      <p>{t.intro_what()}</p>
      <div class="ff-intro__demo" aria-hidden="true">
        <figure class="ff-intro__frame" data-state="before">
          <figcaption>{t.intro_demo_before()}</figcaption>
          <p>{t.intro_demo_text()}</p>
          <span class="ff-intro__button">{t.intro_demo_button()}</span>
        </figure>
        <span class="ff-intro__arrow">→</span>
        <figure class="ff-intro__frame" data-state="after">
          <figcaption>{t.intro_demo_after()}</figcaption>
          <p>{t.intro_demo_text()}</p>
          <span class="ff-intro__button">{t.intro_demo_button()}</span>
        </figure>
      </div>
      <p class="ff-muted">{t.intro_demo_note()}</p>
      <h4 class="ff-article__heading">{t.intro_steps_heading()}</h4>
      <ol class="ff-intro__steps">
        {STEPS.map((step) => (
          <li key={step}>
            <strong>{copy[step][0]}</strong>
            <span class="ff-muted">{copy[step][1]}</span>
            <Button
              variant="secondary"
              onClick={() =>
                window.dispatchEvent(new CustomEvent(DOCK_OPEN_EVENT, { detail: step }))
              }
            >
              {t.intro_open()}
            </Button>
          </li>
        ))}
      </ol>
    </section>
  );
}
